# Weyland-Yutani Operations Intelligence

A full-stack mining-output dashboard. The React 18 + TypeScript interface
displays mine and total-output statistics, interactive line/bar/stacked charts,
configurable anomaly detectors, and downloadable PDF reports. FastAPI fetches
and caches a public Google Sheets CSV, performs the analysis, and serves the
built dashboard from the same service.

The upstream spreadsheet is not included or published by this project. Provide
its public URL through `GOOGLE_SHEET_URL`; the sheet must be viewable by anyone
with the link.

## Formula-driven spreadsheet generator

The [generator workbook](./Weyland_Yutani_Generator.xlsx) is included. It has
editable controls for mine names, date range, normal/uniform distributions,
AR(1) smoothing, weekday factors, trend, and four configurable events. It also
contains an auto-updating chart and a clean `Export` tab with the dashboard
data contract. The example data includes a three-day November 10 drop and a
probabilistic November 20 spike.

Yellow cells are inputs. The workbook capacity is 10 mines and 365 days. To
regenerate the workbook from its Python source:

```powershell
python -m pip install -e ".[generator]"
python generator/create_generator.py
```

Upload the `.xlsx` file to Google Drive and open it using Google Sheets. Let
Sheets convert the formulas and chart, then verify they recalculate after
changing a control. Share settings are managed in Google Drive; for the
dashboard, grant at least “Anyone with the link” viewer access and set
`GOOGLE_SHEET_URL` to the sheet URL. If you also choose public editing, anyone
with that link can change the workbook.

## Run locally

Requires Python 3.11+ and Node.js 20+.

Create a `.env` file in the project root (next to `pyproject.toml`) and put
your Google Sheets URL there:

```dotenv
GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?gid=YOUR_EXPORT_TAB_ID
```

The backend loads this file automatically at startup. Existing shell
environment variables take precedence over `.env`. Keep `.env` private; it is
excluded from version control.

```powershell
python -m pip install -e ".[dev]"
Set-Location frontend
npm ci
npm run build
Set-Location ..
python -m uvicorn app.main:app --app-dir backend --reload
```

Open `http://localhost:8000`. FastAPI serves `frontend/dist` when it exists.
For frontend hot reload, run the API as above and start Vite in a second
terminal with `Set-Location frontend; npm run dev`; Vite proxies `/api` to
`http://localhost:8000`.

Optional environment settings:

* `SHEET_CACHE_TTL_SECONDS` (default `300`; `0` disables cache reuse)
* `SHEET_HTTP_TIMEOUT_SECONDS` (default `15`)

The CSV needs one date column (`Date`, `Day`, `Timestamp`, or `Datetime`; other
parseable date headers are accepted) and at least one numeric measurement
column. A computed `Total` series sums the mine columns per date; an existing
sheet `Total` is replaced to avoid double-counting. Invalid, private, and
non-CSV responses return actionable errors.

## Docker

The multi-stage image builds the React app and runs it with FastAPI:

```powershell
docker build -t weyland-yutani-dashboard .
docker run --rm -p 8000:8000 `
  -e GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/<sheet-id>/edit?gid=0" `
  weyland-yutani-dashboard
```

## API

Interactive OpenAPI docs: `http://localhost:8000/docs`.

* `GET /api/health` — service and source-configuration status (does not fetch
  the sheet).
* `GET /api/meta` — row count, date range, source series and cache settings.
* `GET /api/analysis` — statistics, trend values, four detector results,
  points for plotting, and anomaly episodes.
* `GET /api/report` — generated PDF with the selected line, bar, stacked, or
  scatter chart, statistics,
  detector findings and episode notes.

Analysis/report query parameters:

| Parameter | Default | Description |
|---|---:|---|
| `basis` | `raw` | Run detectors against raw values or weekday/trend-adjusted residuals |
| `series` | all | Repeat or comma-separate series names; includes `Total` |
| `trend_degree` | `2` | Polynomial degree, 1–4 |
| `iqr_k` | `1.5` | IQR fence multiplier |
| `z_threshold` | `3` | Absolute z-score cutoff |
| `ma_window` | `7` | Moving-average window (at least 2) |
| `ma_threshold_pct` | `25` | Percent distance from the moving average |
| `ma_centered` | `false` | Use a centered rather than trailing moving average |
| `grubbs_alpha` | `0.05` | Significance for iterative two-sided Grubbs testing |
| `refresh` | `false` | Bypass the sheet cache |

The dashboard exposes controls for each detector, detection basis, series,
chart type, and polynomial trendline. Episode rows can be selected to focus the
chart on the affected series. Summary statistics and report charts use raw
outputs; adjusted mode changes the detector inputs. Standard deviation uses
population `ddof=0`; quartiles use linear interpolation.

## Tests

```powershell
python -m pytest
```

The tests cover CSV validation and caching, detector parameter behavior,
series aggregation, episode grouping, the analysis API, and PDF generation.
