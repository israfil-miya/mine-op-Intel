from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import t

from app.data import SheetData

DETECTORS = ("iqr", "z_score", "moving_average", "grubbs")


def weekday_detrended(values: pd.Series, dates: pd.Series, degree: int = 1) -> np.ndarray:
    raw = values.to_numpy(dtype=float)
    date_values = pd.to_datetime(dates)
    weekdays = date_values.dt.day_of_week.to_numpy()
    valid = np.isfinite(raw)
    adjusted = np.full(len(raw), np.nan, dtype=float)
    if not valid.any():
        return adjusted
    overall = float(np.mean(raw[valid]))
    weekday_means = {
        weekday: float(np.mean(raw[(weekdays == weekday) & valid]))
        for weekday in np.unique(weekdays[valid])
    }
    valid_indexes = np.flatnonzero(valid)
    weekday_adjusted = np.array(
        [raw[index] - weekday_means[weekdays[index]] + overall for index in valid_indexes]
    )
    x = np.linspace(-1.0, 1.0, len(valid_indexes))
    if len(valid_indexes) == 1:
        adjusted[valid_indexes] = weekday_adjusted
        return adjusted
    actual_degree = min(max(1, degree), len(valid_indexes) - 1)
    trend = np.polyval(np.polyfit(x, weekday_adjusted, actual_degree), x)
    adjusted[valid_indexes] = weekday_adjusted - trend + float(np.mean(trend))
    return adjusted


def polynomial_trend(values: pd.Series, degree: int = 2) -> dict[str, Any]:
    raw = values.to_numpy(dtype=float)
    valid = np.isfinite(raw)
    if not valid.any():
        return {"degree": 0, "coefficients": [], "values": []}
    valid_indexes = np.flatnonzero(valid)
    x = np.linspace(-1.0, 1.0, len(valid_indexes))
    if len(valid_indexes) == 1:
        actual_degree = 0
        coefficients = np.array([raw[valid_indexes[0]]])
    else:
        actual_degree = min(max(1, degree), len(valid_indexes) - 1)
        coefficients = np.polyfit(x, raw[valid], actual_degree)
    trend_values = np.full(len(raw), np.nan, dtype=float)
    trend_values[valid] = np.polyval(coefficients, x)
    return {
        "degree": actual_degree,
        "coefficients": [float(value) for value in coefficients],
        "values": [
            float(value) if np.isfinite(value) else None
            for value in trend_values
        ],
    }


def _grubbs_mask(values: np.ndarray, alpha: float = 0.05) -> np.ndarray:
    mask = np.zeros(len(values), dtype=bool)
    active = np.flatnonzero(np.isfinite(values))
    while len(active) >= 3:
        subset = values[active]
        standard_deviation = float(np.std(subset, ddof=1))
        if standard_deviation == 0 or not np.isfinite(standard_deviation):
            break
        mean = float(np.mean(subset))
        deviations = np.abs(subset - mean)
        local_index = int(np.argmax(deviations))
        sample_size = len(active)
        statistic = float(deviations[local_index] / standard_deviation)
        t_value = float(t.ppf(1 - alpha / (2 * sample_size), sample_size - 2))
        critical = (
            (sample_size - 1)
            / np.sqrt(sample_size)
            * np.sqrt(t_value**2 / (sample_size - 2 + t_value**2))
        )
        if statistic <= critical:
            break
        outlier_index = active[local_index]
        mask[outlier_index] = True
        active = np.delete(active, local_index)
    return mask


def detect_anomalies(
    values: pd.Series,
    iqr_k: float = 1.5,
    z_threshold: float = 3.0,
    ma_window: int = 7,
    ma_threshold_pct: float = 25.0,
    ma_centered: bool = False,
    grubbs_alpha: float = 0.05,
) -> dict[str, np.ndarray]:
    if iqr_k <= 0:
        raise ValueError("iqr_k must be greater than zero.")
    if z_threshold <= 0:
        raise ValueError("z_threshold must be greater than zero.")
    if ma_window < 2:
        raise ValueError("ma_window must be at least 2.")
    if ma_threshold_pct < 0:
        raise ValueError("ma_threshold_pct must be zero or greater.")
    if not 0 < grubbs_alpha < 1:
        raise ValueError("grubbs_alpha must be between 0 and 1.")

    array = values.to_numpy(dtype=float)
    finite = np.isfinite(array)
    result = {name: np.zeros(len(array), dtype=bool) for name in DETECTORS}
    if not finite.any():
        return result
    valid = array[finite]
    q1, q3 = np.quantile(valid, [0.25, 0.75])
    spread = q3 - q1
    result["iqr"] = finite & (
        (array < q1 - iqr_k * spread) | (array > q3 + iqr_k * spread)
    )

    mean = float(np.mean(valid))
    standard_deviation = float(np.std(valid, ddof=0))
    if standard_deviation > 0:
        result["z_score"] = finite & (
            np.abs(array - mean) > z_threshold * standard_deviation
        )

    series = pd.Series(array)
    reference = series.rolling(
        window=ma_window,
        min_periods=max(2, (ma_window + 1) // 2),
        center=ma_centered,
    ).mean()
    if not ma_centered:
        reference = reference.shift(1)
    deviation_pct = (series - reference).abs().div(reference.abs()).mul(100)
    deviation_pct = deviation_pct.where(reference != 0, np.inf)
    moving_mask = deviation_pct > ma_threshold_pct
    result["moving_average"] = moving_mask.fillna(False).to_numpy(dtype=bool)
    result["grubbs"] = _grubbs_mask(array, grubbs_alpha)
    return result


def calculate_statistics(values: pd.Series) -> dict[str, float | int | None]:
    numeric = values.dropna().astype(float)
    if numeric.empty:
        return {
            "count": 0,
            "mean": None,
            "median": None,
            "std": None,
            "min": None,
            "max": None,
            "sum": None,
            "q1": None,
            "q3": None,
        }
    return {
        "count": int(numeric.count()),
        "mean": float(numeric.mean()),
        "median": float(numeric.median()),
        "std": float(numeric.std(ddof=0)),
        "min": float(numeric.min()),
        "max": float(numeric.max()),
        "sum": float(numeric.sum()),
        "q1": float(numeric.quantile(0.25)),
        "q3": float(numeric.quantile(0.75)),
    }


def analyze(
    data: SheetData,
    basis: str = "raw",
    selected_series: list[str] | None = None,
    trend_degree: int = 2,
    iqr_k: float = 1.5,
    z_threshold: float = 3.0,
    ma_window: int = 7,
    ma_threshold_pct: float = 25.0,
    ma_centered: bool = False,
    grubbs_alpha: float = 0.05,
) -> dict[str, Any]:
    if basis not in {"raw", "adjusted"}:
        raise ValueError("basis must be either 'raw' or 'adjusted'")
    unknown = set(selected_series or ()) - set(data.series)
    if unknown:
        raise ValueError(f"Unknown series: {', '.join(sorted(unknown))}")
    chosen = selected_series or list(data.series)
    if not chosen:
        raise ValueError("At least one series must be selected.")

    frame = data.frame
    dates = frame[data.date_column]
    row_series: list[dict[str, Any]] = []
    series_result: dict[str, Any] = {}
    episode_flags: dict[str, dict[str, dict[int, set[str]]]] = {}
    for name in chosen:
        raw = frame[name].astype(float)
        adjusted = weekday_detrended(raw, dates, trend_degree)
        values = pd.Series(adjusted if basis == "adjusted" else raw.to_numpy())
        trends = polynomial_trend(raw, trend_degree)
        detections = detect_anomalies(
            values,
            iqr_k,
            z_threshold,
            ma_window,
            ma_threshold_pct,
            ma_centered,
            grubbs_alpha,
        )
        anomalies: dict[str, list[dict[str, Any]]] = {}
        valid_values = values.dropna()
        median = float(valid_values.median()) if not valid_values.empty else 0.0
        series_episode_flags: dict[str, dict[int, set[str]]] = {}
        for detector, mask in detections.items():
            indexes = np.flatnonzero(mask)
            anomalies[detector] = [
                {
                    "index": int(index),
                    "date": str(dates.iloc[index]),
                    "value": float(values.iloc[index]),
                    "observed_value": _json_number(raw.iloc[index]),
                    "direction": "high" if values.iloc[index] >= median else "low",
                }
                for index in indexes
            ]
            for index in indexes:
                direction = "high" if values.iloc[index] >= median else "low"
                series_episode_flags.setdefault(direction, {}).setdefault(
                    int(index), set()
                ).add(detector)
        episode_flags[name] = series_episode_flags
        series_result[name] = {
            "statistics": calculate_statistics(raw),
            "trend": trends,
            "anomalies": anomalies,
            "anomaly_counts": {key: len(value) for key, value in anomalies.items()},
        }
        for index, dt in enumerate(dates):
            row_series.append(
                {
                    "index": index,
                    "date": str(dt),
                    "series": name,
                    "value": _json_number(raw.iloc[index]),
                    "adjusted_value": _json_number(adjusted[index]),
                    "analysis_value": _json_number(values.iloc[index]),
                    "trend_value": trends["values"][index],
                }
            )

    episodes: list[dict[str, Any]] = []
    for name, directions in episode_flags.items():
        for direction, flags_by_index in directions.items():
            current: dict[str, Any] | None = None
            for index in sorted(flags_by_index):
                if current is None or index != current["last_index"] + 1:
                    if current is not None:
                        episodes.append(current)
                    current = {
                        "start_date": str(dates.iloc[index]),
                        "end_date": str(dates.iloc[index]),
                        "first_index": index,
                        "last_index": index,
                        "point_count": 1,
                        "series": [name],
                        "direction": direction,
                        "detectors": sorted(flags_by_index[index]),
                    }
                else:
                    current["end_date"] = str(dates.iloc[index])
                    current["last_index"] = index
                    current["point_count"] += 1
                    current["detectors"] = sorted(
                        set(current["detectors"]) | flags_by_index[index]
                    )
            if current is not None:
                episodes.append(current)

    for episode in episodes:
        name = episode["series"][0]
        observed_series = frame[name].astype(float)
        episode_values = observed_series.iloc[
            episode["first_index"] : episode["last_index"] + 1
        ]
        peak_index = int(
            episode_values.idxmax()
            if episode["direction"] == "high"
            else episode_values.idxmin()
        )
        observed = float(observed_series.iloc[peak_index])
        expected = series_result[name]["trend"]["values"][peak_index]
        deviation_pct = (
            (observed - expected) / abs(expected) * 100
            if expected is not None and expected != 0
            else None
        )
        episode.update(
            {
                "peak_date": str(dates.iloc[peak_index]),
                "observed": observed,
                "expected": expected,
                "deviation_pct": deviation_pct,
                "severity": (
                    abs(deviation_pct)
                    if deviation_pct is not None
                    else abs(observed - expected) if expected is not None else None
                ),
            }
        )
        episode.pop("first_index")
        episode.pop("last_index")
    episodes.sort(key=lambda episode: (episode["start_date"], episode["series"], episode["direction"]))

    return {
        "basis": basis,
        "parameters": {
            "trend_degree": trend_degree,
            "iqr_k": iqr_k,
            "z_threshold": z_threshold,
            "ma_window": ma_window,
            "ma_threshold_pct": ma_threshold_pct,
            "ma_centered": ma_centered,
            "grubbs_alpha": grubbs_alpha,
        },
        "date_column": data.date_column,
        "dates": [str(value) for value in dates],
        "series": series_result,
        "points": row_series,
        "anomaly_episodes": episodes,
    }


def _json_number(value: float) -> float | None:
    return float(value) if np.isfinite(value) else None
