from __future__ import annotations

import io
import re
import threading
import time
from dataclasses import dataclass
from datetime import date
from urllib.parse import parse_qs, urlparse

import httpx
import numpy as np
import pandas as pd

from app.config import Settings


class SheetDataError(RuntimeError):
    pass


@dataclass(frozen=True)
class SheetData:
    frame: pd.DataFrame
    date_column: str
    series: tuple[str, ...]
    source_name: str


def csv_export_url(url: str) -> str:
    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise SheetDataError("GOOGLE_SHEET_URL is not a valid URL.") from exc
    if parsed.scheme != "https" or parsed.hostname not in {
        "docs.google.com",
        "spreadsheets.google.com",
    }:
        raise SheetDataError(
            "GOOGLE_SHEET_URL must be an HTTPS link to a Google spreadsheet."
        )

    match = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", parsed.path)
    if not match:
        raise SheetDataError(
            "GOOGLE_SHEET_URL must identify a spreadsheet (expected /spreadsheets/d/<sheet-id>)."
        )
    sheet_id = match.group(1)
    query = parse_qs(parsed.query)
    gid = query.get("gid", ["0"])[0]
    if not gid.isdigit():
        raise SheetDataError("The Google Sheet tab gid must be a number.")
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def _date_column(frame: pd.DataFrame) -> str:
    known = {"date", "day", "timestamp", "datetime"}
    for column in frame.columns:
        if str(column).strip().lower() in known:
            return str(column)

    candidates: list[tuple[str, float]] = []
    for column in frame.columns:
        name = str(column)
        values = frame[column].dropna()
        if values.empty:
            continue
        parsed = pd.to_datetime(values, errors="coerce", format="mixed")
        candidates.append((name, float(parsed.notna().mean())))
    if candidates:
        name, ratio = max(candidates, key=lambda item: item[1])
        if ratio >= 0.8:
            return name
    raise SheetDataError(
        "The sheet needs a date column (for example Date or Timestamp)."
    )


def parse_sheet_csv(content: str | bytes) -> SheetData:
    try:
        frame = pd.read_csv(io.BytesIO(content) if isinstance(content, bytes) else io.StringIO(content))
    except (pd.errors.ParserError, UnicodeDecodeError, ValueError) as exc:
        raise SheetDataError("The sheet response is not a valid CSV file.") from exc
    if frame.empty or len(frame.columns) < 2:
        raise SheetDataError(
            "The CSV must include a date column and at least one numeric series."
        )

    frame.columns = [str(column).strip() for column in frame.columns]
    if any(not column for column in frame.columns) or frame.columns.duplicated().any():
        raise SheetDataError("The CSV must have unique, non-empty column names.")
    date_column = _date_column(frame)
    parsed_dates = pd.to_datetime(frame[date_column], errors="coerce", format="mixed", utc=True)
    frame[date_column] = parsed_dates.dt.tz_convert(None)
    frame = frame.dropna(subset=[date_column]).copy()
    if frame.empty:
        raise SheetDataError("The date column contains no valid dates.")

    series: list[str] = []
    for column in frame.columns:
        if column == date_column:
            continue
        values = pd.to_numeric(frame[column], errors="coerce")
        if values.notna().any():
            frame[column] = values.replace([np.inf, -np.inf], np.nan)
            series.append(column)
    if not series:
        raise SheetDataError(
            "The sheet needs at least one numeric measurement column alongside its dates."
        )
    frame = frame[[date_column, *series]].dropna(subset=series, how="all")
    frame = frame.sort_values(date_column, kind="stable").reset_index(drop=True)
    if frame.empty:
        raise SheetDataError("The sheet contains no dated numeric measurements.")

    component_series = [name for name in series if name.casefold() != "total"]
    if component_series:
        for name in list(frame.columns):
            if name.casefold() == "total" and name != "Total":
                frame.drop(columns=[name], inplace=True)
        frame["Total"] = frame[component_series].sum(axis=1, min_count=1)
        series = [*component_series, "Total"]

    frame[date_column] = frame[date_column].dt.strftime("%Y-%m-%d")
    return SheetData(frame, date_column, tuple(series), "Google Sheets")


class SheetRepository:
    def __init__(
        self,
        settings: Settings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self.settings = settings or Settings.from_env()
        self._client = client or httpx.Client(
            timeout=self.settings.http_timeout_seconds,
            follow_redirects=True,
        )
        self._owns_client = client is None
        self._lock = threading.Lock()
        self._cache: SheetData | None = None
        self._cached_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(self.settings.google_sheet_url)

    def get(self, refresh: bool = False) -> SheetData:
        url = self.settings.google_sheet_url
        if not url:
            raise SheetDataError(
                "Google Sheet is not configured. Set GOOGLE_SHEET_URL to a public "
                "Google Sheets link, then restart the API."
            )

        with self._lock:
            if (
                not refresh
                and self._cache is not None
                and time.monotonic() - self._cached_at < self.settings.cache_ttl_seconds
            ):
                return SheetData(
                    self._cache.frame.copy(),
                    self._cache.date_column,
                    self._cache.series,
                    self._cache.source_name,
                )

            export_url = csv_export_url(url)
            try:
                response = self._client.get(export_url)
            except httpx.HTTPError as exc:
                if self._cache is not None:
                    return SheetData(
                        self._cache.frame.copy(),
                        self._cache.date_column,
                        self._cache.series,
                        self._cache.source_name,
                    )
                raise SheetDataError(
                    f"Could not reach the Google Sheet: {exc.__class__.__name__}."
                ) from exc
            if response.status_code in (401, 403):
                raise SheetDataError(
                    "The Google Sheet is not public. Allow anyone with the link to view it."
                )
            if response.status_code == 404:
                raise SheetDataError("The configured Google Sheet could not be found.")
            if response.status_code == 400:
                raise SheetDataError(
                    "Google Sheets rejected the CSV export request (HTTP 400). "
                    "Check that GOOGLE_SHEET_URL points to a Google Sheets document "
                    "and includes the gid of the Export tab (for example, "
                    "?gid=123456789). If gid is omitted, the first tab is used."
                )
            if response.status_code >= 400:
                raise SheetDataError(
                    f"Google Sheets returned HTTP {response.status_code}."
                )
            content_type = response.headers.get("content-type", "").lower()
            body = response.content
            prefix = body[:1000].lstrip().lower()
            if "text/html" in content_type or prefix.startswith(
                (b"<!doctype html", b"<html", b"<head")
            ):
                if any(
                    marker in prefix
                    for marker in (b"accounts.google.com", b"sign in", b"request access")
                ):
                    raise SheetDataError(
                        "The Google Sheet is not publicly readable. Allow anyone with "
                        "the link to view it."
                    )
                raise SheetDataError(
                    "Google Sheets returned a web page instead of CSV. Verify that the "
                    "spreadsheet and selected tab are publicly readable."
                )

            data = parse_sheet_csv(body)
            self._cache = data
            self._cached_at = time.monotonic()
            return SheetData(data.frame.copy(), data.date_column, data.series, data.source_name)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()


def date_range(data: SheetData) -> tuple[date, date]:
    dates = pd.to_datetime(data.frame[data.date_column])
    return dates.min().date(), dates.max().date()
