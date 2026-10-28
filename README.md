# Weyland-Yutani Operations Intelligence

A full-stack mining output analytics dashboard featuring an interactive React + TypeScript frontend, configurable anomaly detection algorithms, and downloadable PDF reports powered by FastAPI.

## Configuration & Environment Variables

Environment variables and secrets are handled on the backend using the [`python-dotenv`](https://github.com/theskumar/python-dotenv) package. The application automatically loads configuration from a `.env` file in the project root via `app.config.Settings.from_env()`.

### Precedence & Secrets Handling

- **Process Precedence:** System and shell environment variables (such as Docker `-e` or container orchestration secrets) take precedence over `.env` file entries (`override=False`).
- **Secret Isolation:** `.env` is excluded from version control via `.gitignore`. A template is provided in `.env.example`.
- **Server-Side Security:** The spreadsheet URL and API credentials remain strictly on the backend; the frontend client interacts solely with the `/api` endpoints without direct access to upstream secrets.

### Environment Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_SHEET_URL` | Yes (for live data) | — | Public Google Sheets URL with numeric `gid` (e.g. `https://docs.google.com/spreadsheets/d/<sheet-id>/edit?gid=0`) |
| `SHEET_CACHE_TTL_SECONDS` | No | `300` | In-memory cache time-to-live in seconds (`0` disables caching) |
| `SHEET_HTTP_TIMEOUT_SECONDS` | No | `15` | Request timeout for fetching sheet data in seconds |

> **Note:** The sheet requires a date column (`Date`, `Day`, `Timestamp`, or `Datetime`) and at least one numeric measurement column. The `gid` parameter must be numeric (`0` identifies the first tab).

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+

### Setup

1. Copy `.env.example` to `.env` and configure the spreadsheet URL:

```bash
cp .env.example .env
```

2. Install dependencies, build the frontend, and run the backend:

```bash
# Install backend dependencies
python -m pip install -e ".[dev]"

# Build frontend
cd frontend
npm ci
npm run build
cd ..

# Start FastAPI server (serves API and built frontend)
python -m uvicorn app.main:app --app-dir backend --reload
```

Open `http://localhost:8000`.

For frontend development with hot reloading, start the Vite dev server in `frontend/` (`npm run dev`), which proxies `/api` requests to `http://localhost:8000`.

## Docker

```bash
docker build -t weyland-yutani-dashboard .
docker run --rm -p 8000:8000 -e GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/<sheet-id>/edit?gid=0" weyland-yutani-dashboard
```

## API Reference

Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

### Endpoints

- `GET /api/health` — Service health and sheet source configuration status.
- `GET /api/meta` — Dataset metadata, column schemas, and date range (`?refresh=true` to bypass cache).
- `GET /api/analysis` — Time-series metrics, polynomial trend fit, anomaly detection, and consolidated episodes.
- `GET /api/report` — Download an analytics report as a PDF.

### Query Parameters

| Parameter | Applicable Endpoints | Default | Description |
|---|---|---:|---|
| `chart_type` | `/api/report` | `line` | Chart visualization: `line`, `bar`, `stacked`, or `scatter` |
| `basis` | `/api/analysis`, `/api/report` | `raw` | Data basis: `raw` or `adjusted` (weekday & trend detrended) |
| `series` | `/api/analysis`, `/api/report` | all | Series names (repeatable or comma-separated, e.g. `series=Mine 1,Mine 2`) |
| `trend_degree` | `/api/analysis`, `/api/report` | `2` | Polynomial trend degree (`1` to `4`) |
| `iqr_k` | `/api/analysis`, `/api/report` | `1.5` | IQR multiplier threshold (`> 0`) |
| `z_threshold` | `/api/analysis`, `/api/report` | `3.0` | Z-score threshold (`> 0`) |
| `ma_window` | `/api/analysis`, `/api/report` | `7` | Moving average window in days (`>= 2`) |
| `ma_threshold_pct` | `/api/analysis`, `/api/report` | `25.0` | Moving average percent deviation threshold (`>= 0`) |
| `ma_centered` | `/api/analysis`, `/api/report` | `false` | Window alignment: `true` for centered, `false` for trailing |
| `grubbs_alpha` | `/api/analysis`, `/api/report` | `0.05` | Grubbs test two-sided significance level (`0 < α < 1`) |
| `refresh` | `/api/analysis`, `/api/report` | `false` | Force reload from Google Sheets and refresh the cache |

## Testing

```bash
python -m pytest
```
