from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.analytics import analyze
from app.config import Settings
from app.data import SheetDataError, SheetRepository, date_range
from app.models import HealthResponse
from app.report import generate_pdf

settings = Settings.from_env()
repository = SheetRepository(settings)
app = FastAPI(
    title="Weyland-Yutani Analytics API",
    version="1.0.0",
    description="Time-series statistics, anomaly detection, trends, and PDF reports.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _get_data(refresh: bool):
    try:
        return repository.get(refresh=refresh)
    except SheetDataError as exc:
        status = 503 if not repository.configured else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc


def _select_series(series: list[str] | None, available: tuple[str, ...]) -> list[str]:
    if not series:
        return list(available)
    selected = [part.strip() for value in series for part in value.split(",") if part.strip()]
    unknown = set(selected) - set(available)
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown series: {', '.join(sorted(unknown))}. "
            f"Available series: {', '.join(available)}.",
        )
    return list(dict.fromkeys(selected))


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    configured = repository.configured
    return HealthResponse(
        status="ok" if configured else "degraded",
        source_configured=configured,
        message="API is ready." if configured else "Set GOOGLE_SHEET_URL to configure the data source.",
    )


@app.get("/api/meta")
def meta(refresh: bool = Query(default=False)) -> dict:
    data = _get_data(refresh)
    first, last = date_range(data)
    return {
        "title": "Weyland-Yutani Analytics",
        "source": data.source_name,
        "row_count": int(len(data.frame)),
        "date_column": data.date_column,
        "date_range": {"start": first.isoformat(), "end": last.isoformat()},
        "series": list(data.series),
        "columns": [
            {"name": data.date_column, "type": "date"},
            *[{"name": name, "type": "number"} for name in data.series],
        ],
        "cache_ttl_seconds": settings.cache_ttl_seconds,
    }


@app.get("/api/analysis")
def analysis(
    basis: Literal["raw", "adjusted"] = "raw",
    series: list[str] | None = Query(default=None),
    trend_degree: int = Query(default=2, ge=1, le=4),
    iqr_k: float = Query(default=1.5, gt=0),
    z_threshold: float = Query(default=3.0, gt=0),
    ma_window: int = Query(default=7, ge=2),
    ma_threshold_pct: float = Query(default=25.0, ge=0),
    ma_centered: bool = False,
    grubbs_alpha: float = Query(default=0.05, gt=0, lt=1),
    refresh: bool = False,
) -> dict:
    data = _get_data(refresh)
    selected = _select_series(series, data.series)
    try:
        return analyze(
            data,
            basis,
            selected,
            trend_degree,
            iqr_k,
            z_threshold,
            ma_window,
            ma_threshold_pct,
            ma_centered,
            grubbs_alpha,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/report")
def report(
    chart_type: Literal["line", "bar", "stacked", "scatter"] = "line",
    series: list[str] | None = Query(default=None),
    basis: Literal["raw", "adjusted"] = "raw",
    trend_degree: int = Query(default=2, ge=1, le=4),
    iqr_k: float = Query(default=1.5, gt=0),
    z_threshold: float = Query(default=3.0, gt=0),
    ma_window: int = Query(default=7, ge=2),
    ma_threshold_pct: float = Query(default=25.0, ge=0),
    ma_centered: bool = False,
    grubbs_alpha: float = Query(default=0.05, gt=0, lt=1),
    refresh: bool = False,
) -> Response:
    data = _get_data(refresh)
    selected = _select_series(series, data.series)
    try:
        result = analyze(
            data,
            basis,
            selected,
            trend_degree,
            iqr_k,
            z_threshold,
            ma_window,
            ma_threshold_pct,
            ma_centered,
            grubbs_alpha,
        )
        pdf = generate_pdf(data, result, chart_type, selected)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="weyland-yutani-report.pdf"'},
    )


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
