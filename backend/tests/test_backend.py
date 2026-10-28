from __future__ import annotations

import os
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import analytics
from app.analytics import analyze, detect_anomalies, weekday_detrended
from app.config import Settings
from app.data import SheetData, SheetDataError, SheetRepository, csv_export_url, parse_sheet_csv
from app.main import app
from app.report import generate_pdf

CSV = """Date,Units,Revenue
2025-01-01,10,100
2025-01-02,11,110
2025-01-03,9,90
2025-01-04,10,100
2025-01-05,11,110
2025-01-06,10,100
2025-01-07,12,120
2025-01-08,200,2000
2025-01-09,10,100
2025-01-10,11,110
2025-01-11,10,100
2025-01-12,12,120
2025-01-13,11,110
2025-01-14,10,100
2025-01-15,12,120
"""


def test_sheet_url_normalization_and_validation() -> None:
    assert csv_export_url(
        "https://docs.google.com/spreadsheets/d/abc_123/edit?gid=42#gid=42"
    ) == "https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=42"
    with pytest.raises(SheetDataError, match="HTTPS"):
        csv_export_url("http://docs.google.com/spreadsheets/d/abc/edit")
    with pytest.raises(SheetDataError, match="spreadsheet"):
        csv_export_url("https://docs.google.com/document/d/abc/edit")


def test_settings_load_dotenv_from_project_root_and_keep_process_env_precedence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import config

    monkeypatch.delenv("GOOGLE_SHEET_URL", raising=False)
    loaded: list[tuple[Path, bool]] = []

    def fake_load_dotenv(path: Path, override: bool) -> None:
        loaded.append((path, override))
        os.environ.setdefault("GOOGLE_SHEET_URL", "https://example.test/from-dotenv")

    monkeypatch.setattr(config, "load_dotenv", fake_load_dotenv)
    project_root = Path(config.__file__).resolve().parents[2]
    assert Settings.from_env().google_sheet_url == "https://example.test/from-dotenv"
    assert loaded == [(project_root / ".env", False)]

    monkeypatch.setenv("GOOGLE_SHEET_URL", "https://example.test/from-process")
    assert Settings.from_env().google_sheet_url == "https://example.test/from-process"


def test_csv_parse_normalizes_dates_and_numeric_series() -> None:
    data = parse_sheet_csv(CSV)
    assert data.date_column == "Date"
    assert data.series == ("Units", "Revenue", "Total")
    assert len(data.frame) == 15
    assert data.frame["Units"].dtype.kind in "if"
    assert data.frame.iloc[0]["Date"] == "2025-01-01"
    assert data.series[-1] == "Total"
    assert data.frame["Total"].iloc[0] == 110


def test_sheet_total_is_recomputed_without_double_counting() -> None:
    data = parse_sheet_csv(
        "Date,Mine 1,Mine 2,Total\n"
        "2025-01-01,2,3,999\n"
        "2025-01-02,4,5,999\n"
    )
    assert data.series == ("Mine 1", "Mine 2", "Total")
    assert data.frame["Total"].tolist() == [5, 9]


def test_csv_parse_rejects_missing_dates_or_measurements() -> None:
    with pytest.raises(SheetDataError, match="date column"):
        parse_sheet_csv("Amount\n1\n2\n")
    with pytest.raises(SheetDataError, match="numeric measurement"):
        parse_sheet_csv("Date,Label\n2025-01-01,hello\n")


def test_analysis_tolerates_missing_values_in_one_series() -> None:
    data = parse_sheet_csv(
        "Date,Units,Revenue\n"
        "2025-01-01,1,10\n"
        "2025-01-02,,11\n"
        "2025-01-03,3,12\n"
    )
    result = analyze(data, "adjusted")
    assert result["points"][1]["value"] is None
    assert result["points"][1]["analysis_value"] is None
    assert result["series"]["Units"]["statistics"]["count"] == 2


def test_repository_cache_and_forced_refresh() -> None:
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, text=CSV, headers={"content-type": "text/csv"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    repository = SheetRepository(
        Settings(
            "https://docs.google.com/spreadsheets/d/public_sheet/edit?gid=0",
            60,
            2,
        ),
        client=client,
    )
    first = repository.get()
    second = repository.get()
    refreshed = repository.get(refresh=True)
    assert len(requests) == 2
    assert first.frame.equals(second.frame)
    assert refreshed.series == ("Units", "Revenue", "Total")
    client.close()


def test_repository_reports_unset_and_nonpublic_sheet() -> None:
    with pytest.raises(SheetDataError, match="GOOGLE_SHEET_URL"):
        SheetRepository(Settings(None, 10, 2)).get()

    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(403, text="Forbidden")
        )
    )
    repository = SheetRepository(
        Settings("https://docs.google.com/spreadsheets/d/secret/edit", 10, 2),
        client,
    )
    with pytest.raises(SheetDataError, match="not public"):
        repository.get()
    client.close()


def test_repository_explains_bad_request_from_google_export() -> None:
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(400, text="Bad Request")
        )
    )
    repository = SheetRepository(
        Settings("https://docs.google.com/spreadsheets/d/public_sheet/edit", 10, 2),
        client,
    )
    with pytest.raises(SheetDataError, match="gid of the Export tab"):
        repository.get()
    client.close()


def test_all_detectors_trend_basis_and_episode_output() -> None:
    data = parse_sheet_csv(CSV)
    raw = analyze(data, basis="raw", selected_series=["Units"])
    result = analyze(data, basis="adjusted", selected_series=["Units"])
    assert result["basis"] == "adjusted"
    assert result["series"]["Units"]["statistics"] == raw["series"]["Units"]["statistics"]
    assert result["points"][0]["value"] == raw["points"][0]["value"]
    assert set(result["series"]["Units"]["anomalies"]) == {
        "iqr",
        "z_score",
        "moving_average",
        "grubbs",
    }
    assert result["series"]["Units"]["trend"]["degree"] == 2
    assert result["anomaly_episodes"]
    assert all("start_date" in episode and "detectors" in episode for episode in result["anomaly_episodes"])
    assert all(len(episode["series"]) == 1 for episode in result["anomaly_episodes"])
    assert all(
        {"peak_date", "observed", "expected", "deviation_pct", "severity"} <= episode.keys()
        for episode in result["anomaly_episodes"]
    )


def test_total_series_is_calculated_from_mines_only() -> None:
    data = parse_sheet_csv(
        "Date,Mine A,Mine B,Total\n"
        "2025-01-01,10,20,999\n"
        "2025-01-02,11,22,999\n"
    )
    assert data.series == ("Mine A", "Mine B", "Total")
    assert data.frame["Total"].tolist() == [30, 33]
    result = analyze(data, selected_series=["Total"])
    assert result["series"]["Total"]["statistics"]["mean"] == 31.5


def test_detector_parameters_change_detection_results() -> None:
    values = pd.Series([float(index % 9 + 1) for index in range(30)] + [100.0])
    default = detect_anomalies(values)
    permissive = detect_anomalies(
        values,
        iqr_k=100,
        z_threshold=10,
        ma_window=3,
        ma_threshold_pct=1000,
        ma_centered=True,
        grubbs_alpha=0.5,
    )
    assert default["iqr"][-1]
    assert not permissive["iqr"][-1]
    assert default["z_score"][-1]
    assert not permissive["z_score"][-1]
    assert default["moving_average"][-1]
    assert not permissive["moving_average"][-1]
    assert default["grubbs"][-1]
    borderline = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 15.0])
    assert not detect_anomalies(borderline, grubbs_alpha=0.05)["grubbs"][-1]
    assert detect_anomalies(borderline, grubbs_alpha=0.2)["grubbs"][-1]


def test_episode_grouping_separates_series_and_direction(monkeypatch: pytest.MonkeyPatch) -> None:
    frame = pd.DataFrame(
        {
            "Date": pd.date_range("2025-01-01", periods=4).strftime("%Y-%m-%d"),
            "Mine A": [10.0, 100.0, 100.0, 10.0],
            "Mine B": [10.0, 10.0, 100.0, 10.0],
            "Total": [20.0, 110.0, 200.0, 20.0],
        }
    )
    data = SheetData(frame, "Date", ("Mine A", "Mine B", "Total"), "test")

    def controlled_detections(values: pd.Series, *args, **kwargs) -> dict[str, np.ndarray]:
        mask = np.zeros(len(values), dtype=bool)
        if values.iloc[1] > 50:
            mask[[0, 1, 2]] = True
        elif values.iloc[2] > 50:
            mask[2] = True
        return {
            "iqr": mask,
            "z_score": np.zeros(len(values), dtype=bool),
            "moving_average": np.zeros(len(values), dtype=bool),
            "grubbs": np.zeros(len(values), dtype=bool),
        }

    monkeypatch.setattr(analytics, "detect_anomalies", controlled_detections)
    result = analyze(data, selected_series=["Mine A", "Mine B"])
    episodes = result["anomaly_episodes"]
    assert {(tuple(e["series"]), e["direction"], e["start_date"], e["end_date"]) for e in episodes} == {
        (("Mine A",), "low", "2025-01-01", "2025-01-01"),
        (("Mine A",), "high", "2025-01-02", "2025-01-03"),
        (("Mine B",), "high", "2025-01-03", "2025-01-03"),
    }


def test_weekday_detrending_removes_linear_trend() -> None:
    dates = pd.Series(pd.date_range("2025-01-01", periods=28, freq="D").strftime("%Y-%m-%d"))
    values = pd.Series(np.arange(28, dtype=float) * 3 + dates.map(lambda d: pd.Timestamp(d).day_of_week).to_numpy())
    adjusted = weekday_detrended(values, dates)
    assert np.std(adjusted) < np.std(values)


def test_report_is_valid_pdf_and_respects_series_selection() -> None:
    data = parse_sheet_csv(CSV)
    result = analyze(data, "raw", ["Units"])
    pdf = generate_pdf(data, result, "line", ["Units"])
    stacked_pdf = generate_pdf(data, result, "stacked", ["Units"])
    assert pdf.startswith(b"%PDF")
    assert stacked_pdf.startswith(b"%PDF")
    with pytest.raises(ValueError, match="chart_type"):
        generate_pdf(data, result, "pie", ["Units"])
    with pytest.raises(ValueError, match="Unknown series"):
        generate_pdf(data, result, "bar", ["Nope"])


def test_api_health_and_unconfigured_source_error(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main

    monkeypatch.setattr(main.repository, "settings", Settings(None, 300, 15))
    client = TestClient(app)
    health_response = client.get("/api/health")
    assert health_response.status_code == 200
    assert health_response.json()["status"] == "degraded"
    meta_response = client.get("/api/meta")
    assert meta_response.status_code == 503
    assert "GOOGLE_SHEET_URL" in meta_response.json()["detail"]


def test_api_analysis_and_report_accept_series_and_chart_type(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main

    sample = parse_sheet_csv(CSV)
    monkeypatch.setattr(main.repository, "get", lambda refresh=False: sample)
    client = TestClient(app)
    analysis_response = client.get(
        "/api/analysis?basis=raw&series=Units&trend_degree=2&iqr_k=2&z_threshold=2.5"
        "&ma_window=4&ma_threshold_pct=20&ma_centered=true&grubbs_alpha=0.1"
    )
    assert analysis_response.status_code == 200
    assert list(analysis_response.json()["series"]) == ["Units"]
    assert analysis_response.json()["parameters"] == {
        "trend_degree": 2,
        "iqr_k": 2,
        "z_threshold": 2.5,
        "ma_window": 4,
        "ma_threshold_pct": 20,
        "ma_centered": True,
        "grubbs_alpha": 0.1,
    }
    report_response = client.get(
        "/api/report?chart_type=bar&series=Units&iqr_k=2&z_threshold=2.5"
        "&ma_window=4&ma_threshold_pct=20&ma_centered=true&grubbs_alpha=0.1"
    )
    assert report_response.status_code == 200
    assert report_response.headers["content-type"] == "application/pdf"
    assert report_response.content.startswith(b"%PDF")
    stacked_report = client.get("/api/report?chart_type=stacked&series=Units&series=Total")
    assert stacked_report.status_code == 200
    assert stacked_report.content.startswith(b"%PDF")
    invalid = client.get("/api/report?chart_type=pie&series=Units")
    assert invalid.status_code == 422
    invalid_parameter = client.get("/api/analysis?iqr_k=0")
    assert invalid_parameter.status_code == 422
