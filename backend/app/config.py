from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    google_sheet_url: str | None
    cache_ttl_seconds: int = 300
    http_timeout_seconds: float = 15.0

    @classmethod
    def from_env(cls) -> "Settings":
        project_root = Path(__file__).resolve().parents[2]
        env_path = project_root / ".env"
        load_dotenv(env_path, override=False)

        url = os.getenv("GOOGLE_SHEET_URL", "").strip() or None
        try:
            ttl = max(0, int(os.getenv("SHEET_CACHE_TTL_SECONDS", "300")))
        except ValueError:
            ttl = 300
        try:
            timeout = max(1.0, float(os.getenv("SHEET_HTTP_TIMEOUT_SECONDS", "15")))
        except ValueError:
            timeout = 15.0
        return cls(url, ttl, timeout)
