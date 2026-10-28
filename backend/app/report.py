from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.data import SheetData

PAGE_W, PAGE_H = letter
MARGIN = 0.65 * inch
CONTENT_W = PAGE_W - 2 * MARGIN

C_NAVY = colors.HexColor("#0f2238")
C_INDIGO = colors.HexColor("#3d5a99")
C_ACCENT = colors.HexColor("#5b8fcc")
C_RULE = colors.HexColor("#c8d8e8")
C_ROW_ALT = colors.HexColor("#f3f7fb")
C_WHITE = colors.white
C_TEXT = colors.HexColor("#1a2030")
C_MUTED = colors.HexColor("#6b7a90")

MPL_PALETTE = [
    "#6366f1",
    "#38bdf8",
    "#f59e0b",
    "#10b981",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
]
MPL_OUTLIER = "#f97316"
MPL_TREND = "#94a3b8"
MPL_FLAGGED = "#f43f5e"
MPL_BG = "#ffffff"
MPL_GRID = "#e2e8f0"

DETECTOR_LABELS = {
    "iqr": "IQR rule",
    "z_score": "Z-score",
    "moving_average": "Moving average",
    "grubbs": "Grubbs test",
}


def _build_styles() -> dict[str, ParagraphStyle]:
    normal_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    def make(name: str, **kw) -> ParagraphStyle:
        return ParagraphStyle(name=name, **kw)

    return {
        "report_title": make(
            "ReportTitle",
            fontName=bold_font,
            fontSize=20,
            leading=26,
            textColor=C_NAVY,
            alignment=TA_LEFT,
            spaceAfter=2,
        ),
        "report_subtitle": make(
            "ReportSubtitle",
            fontName=normal_font,
            fontSize=9,
            leading=13,
            textColor=C_MUTED,
            alignment=TA_LEFT,
            spaceAfter=0,
        ),
        "section_heading": make(
            "SectionHeading",
            fontName=bold_font,
            fontSize=11,
            leading=15,
            textColor=C_NAVY,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "subsection_heading": make(
            "SubsectionHeading",
            fontName=bold_font,
            fontSize=9,
            leading=13,
            textColor=C_INDIGO,
            spaceBefore=8,
            spaceAfter=3,
        ),
        "body": make(
            "Body",
            fontName=normal_font,
            fontSize=8.5,
            leading=12,
            textColor=C_TEXT,
            spaceAfter=0,
        ),
        "body_muted": make(
            "BodyMuted",
            fontName=normal_font,
            fontSize=8,
            leading=11,
            textColor=C_MUTED,
            spaceAfter=0,
        ),
        "caption": make(
            "Caption",
            fontName=normal_font,
            fontSize=7.5,
            leading=10,
            textColor=C_MUTED,
            alignment=TA_CENTER,
            spaceAfter=0,
        ),
        "methodology": make(
            "Methodology",
            fontName=normal_font,
            fontSize=8,
            leading=12,
            textColor=C_TEXT,
            spaceAfter=0,
        ),
    }


def _table_style(
    *,
    header_bg: colors.Color = C_NAVY,
    font_size: int = 8,
    padding: int = 4,
    align_right_from: int | None = None,
    num_cols: int = 0,
) -> TableStyle:
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), C_WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), font_size),
        ("BOTTOMPADDING", (0, 0), (-1, 0), padding + 1),
        ("TOPPADDING", (0, 0), (-1, 0), padding + 1),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), font_size),
        ("TOPPADDING", (0, 1), (-1, -1), padding),
        ("BOTTOMPADDING", (0, 1), (-1, -1), padding),
        ("LEFTPADDING", (0, 0), (-1, -1), padding + 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), padding + 1),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_WHITE, C_ROW_ALT]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, C_ACCENT),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, C_RULE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, C_RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
    ]
    if align_right_from is not None and num_cols > 0:
        commands.append(("ALIGN", (align_right_from, 0), (num_cols - 1, -1), "RIGHT"))
    return TableStyle(commands)


def _mpl_style(ax: plt.Axes, fig: plt.Figure) -> None:
    fig.patch.set_facecolor(MPL_BG)
    ax.set_facecolor(MPL_BG)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(MPL_GRID)
    ax.spines["bottom"].set_color(MPL_GRID)
    ax.tick_params(colors="#64748b", labelsize=7)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax.grid(axis="y", color=MPL_GRID, linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)


def _chart(
    data: SheetData,
    analysis: dict[str, Any],
    chart_type: str,
    selected: list[str],
) -> bytes:
    fig, ax = plt.subplots(figsize=(9.6, 3.1))
    _mpl_style(ax, fig)

    dates = pd.to_datetime(analysis["dates"])
    stacked_bottom = np.zeros(len(dates), dtype=float)

    for idx, name in enumerate(selected):
        points = [p for p in analysis["points"] if p["series"] == name]
        if not points:
            continue
        values = np.asarray([p["value"] for p in points], dtype=float)
        trend = np.asarray([p["trend_value"] or 0 for p in points], dtype=float)
        color = MPL_PALETTE[idx % len(MPL_PALETTE)]
        is_total_stacked = chart_type == "stacked" and name.casefold() == "total"

        if is_total_stacked:
            ax.plot(dates, values, color=color, linewidth=2, linestyle="--", label=name, zorder=4)
        elif chart_type == "stacked":
            series_bottom = stacked_bottom.copy()
            ax.bar(dates, np.nan_to_num(values), bottom=stacked_bottom, color=color, alpha=0.78, label=name, width=0.85, zorder=2)
            stacked_bottom += np.nan_to_num(values)
        elif chart_type == "bar":
            ax.bar(dates, values, color=color, alpha=0.78, label=name, width=0.85, zorder=2)
        else:
            ax.plot(dates, values, color=color, linewidth=1.8, label=name, zorder=3)

        trend_plot = trend
        if chart_type == "stacked" and not is_total_stacked:
            trend_plot = series_bottom + trend
        ax.plot(dates, trend_plot, color=color, linewidth=1, linestyle=":", alpha=0.6, zorder=3)

        anomalous = sorted({
            rec["index"]
            for recs in analysis["series"][name]["anomalies"].values()
            for rec in recs
        })
        if anomalous:
            out_dates = [dates[i] for i in anomalous]
            out_vals = [
                (series_bottom[i] + values[i]) if (chart_type == "stacked" and not is_total_stacked) else values[i]
                for i in anomalous
            ]
            ax.scatter(out_dates, out_vals, marker="x", s=40, color=MPL_OUTLIER, linewidths=1.4, label=f"{name} outliers", zorder=6)

    ax.set_xlabel("Date", fontsize=7.5, color="#64748b", labelpad=4)
    ax.set_ylabel("Output", fontsize=7.5, color="#64748b", labelpad=4)
    ax.xaxis.set_major_formatter(mdates.AutoDateFormatter(mdates.AutoDateLocator()))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=4, maxticks=10))
    fig.autofmt_xdate(rotation=25, ha="right")

    if len(selected) <= 8:
        ax.legend(
            fontsize=6.5,
            framealpha=0.9,
            edgecolor="#c8d8e8",
            loc="upper left",
            ncol=min(len(selected), 4),
        )

    fig.tight_layout(pad=0.5)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight", facecolor=MPL_BG)
    plt.close(fig)
    return buf.getvalue()


def _episode_chart(analysis: dict[str, Any], episode: dict[str, Any]) -> bytes:
    name = episode["series"][0]
    points = [p for p in analysis["points"] if p["series"] == name]

    try:
        si = next(i for i, p in enumerate(points) if p["date"] == episode["start_date"])
        ei = next(i for i, p in enumerate(points) if p["date"] == episode["end_date"])
    except StopIteration:
        si, ei = 0, len(points) - 1
    window = points[max(0, si - 3) : min(len(points), ei + 4)]
    wdates = [pd.to_datetime(p["date"]) for p in window]
    wvals = np.asarray([p["value"] for p in window], dtype=float)
    wtrend = np.asarray([p["trend_value"] or 0 for p in window], dtype=float)

    fig, ax = plt.subplots(figsize=(9.0, 2.2))
    _mpl_style(ax, fig)

    ax.plot(wdates, wvals, color="#6366f1", linewidth=1.6, marker="o", markersize=3.5, label=name, zorder=3)
    ax.plot(wdates, wtrend, color=MPL_TREND, linewidth=1, linestyle="--", label="Trend", zorder=2)

    flagged_pts = [p for p in window if episode["start_date"] <= p["date"] <= episode["end_date"]]
    if flagged_pts:
        ax.scatter(
            [pd.to_datetime(p["date"]) for p in flagged_pts],
            [p["value"] for p in flagged_pts],
            color=MPL_FLAGGED,
            s=32,
            zorder=5,
            label="Flagged",
        )

    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.legend(fontsize=6.5, framealpha=0.9, edgecolor="#e2e8f0", loc="best")
    fig.autofmt_xdate(rotation=20, ha="right")
    fig.tight_layout(pad=0.5)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor=MPL_BG)
    plt.close(fig)
    return buf.getvalue()


def _hr() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.5, color=C_RULE, spaceAfter=0, spaceBefore=0)


def _section_header(text: str, styles: dict) -> list:
    return [
        Spacer(1, 0.08 * inch),
        Paragraph(text, styles["section_heading"]),
        _hr(),
        Spacer(1, 0.05 * inch),
    ]


def _meta_table(rows: list[tuple[str, str]], styles: dict) -> Table:
    data = [
        [Paragraph(f"<b>{k}</b>", styles["body_muted"]), Paragraph(v, styles["body"])]
        for k, v in rows
    ]
    tbl = Table(data, colWidths=[1.45 * inch, 5.75 * inch])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, C_RULE),
    ]))
    return tbl


def _number(value: float | None, decimals: int = 2) -> str:
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return "—"
    fmt = f"{{:,.{decimals}f}}"
    return fmt.format(value)


def _pct(value: float | None) -> str:
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return "—"
    return f"{value:+,.1f}%"


def generate_pdf(
    data: SheetData,
    analysis: dict[str, Any],
    chart_type: str,
    selected: list[str],
) -> bytes:
    if chart_type not in {"line", "bar", "stacked", "scatter"}:
        raise ValueError("chart_type must be one of: line, bar, stacked, scatter")
    if not selected:
        raise ValueError("Select at least one series for the report.")
    if unknown := set(selected) - set(data.series):
        raise ValueError(f"Unknown series: {', '.join(sorted(unknown))}")

    styles = _build_styles()
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN + 0.05 * inch,
        bottomMargin=MARGIN,
        title="Weyland-Yutani Analytics Report",
        author="Weyland-Yutani Operations Intelligence",
    )

    parameters = analysis.get("parameters", {})
    dates_list = analysis.get("dates", [])
    date_range = f"{dates_list[0]}  →  {dates_list[-1]}" if dates_list else "—"
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    basis_label = "Raw output" if analysis.get("basis") == "raw" else "De-trended (weekday + polynomial adjusted)"
    chart_label = chart_type.title()
    series_label = ", ".join(selected)

    trend_deg = parameters.get("trend_degree", 2)
    iqr_k = parameters.get("iqr_k", 1.5)
    z_thresh = parameters.get("z_threshold", 3.0)
    ma_win = parameters.get("ma_window", 7)
    ma_pct = parameters.get("ma_threshold_pct", 25.0)
    ma_centered = parameters.get("ma_centered", False)
    grubbs_alpha = parameters.get("grubbs_alpha", 0.05)

    story: list[Any] = [
        Paragraph("Weyland-Yutani", styles["report_subtitle"]),
        Paragraph("Mining Analytics Report", styles["report_title"]),
        _hr(),
        Spacer(1, 0.10 * inch),
        _meta_table([
            ("Generated", generated),
            ("Date range", date_range),
            ("Series", escape(series_label)),
            ("Chart type", chart_label),
            ("Analysis basis", basis_label),
            ("Data source", escape(data.source_name)),
        ], styles),
        Spacer(1, 0.10 * inch),
        Paragraph("Detector Configuration", styles["subsection_heading"]),
    ]

    param_data = [
        [
            Paragraph("<b>Parameter</b>", styles["body_muted"]),
            Paragraph("<b>Value</b>", styles["body_muted"]),
            Paragraph("<b>Parameter</b>", styles["body_muted"]),
            Paragraph("<b>Value</b>", styles["body_muted"]),
        ],
        [
            Paragraph("Polynomial trend degree", styles["body"]),
            Paragraph(str(trend_deg), styles["body"]),
            Paragraph("IQR multiplier (k)", styles["body"]),
            Paragraph(str(iqr_k), styles["body"]),
        ],
        [
            Paragraph("Z-score threshold (σ)", styles["body"]),
            Paragraph(str(z_thresh), styles["body"]),
            Paragraph("Moving-average window", styles["body"]),
            Paragraph(f"{ma_win} days", styles["body"]),
        ],
        [
            Paragraph("MA deviation threshold", styles["body"]),
            Paragraph(f"{ma_pct}%", styles["body"]),
            Paragraph("MA alignment", styles["body"]),
            Paragraph("Centered" if ma_centered else "Trailing", styles["body"]),
        ],
        [
            Paragraph("Grubbs α", styles["body"]),
            Paragraph(str(grubbs_alpha), styles["body"]),
            Paragraph("", styles["body"]),
            Paragraph("", styles["body"]),
        ],
    ]
    param_tbl = Table(param_data, colWidths=[2.15 * inch, 1.45 * inch, 2.15 * inch, 1.45 * inch])
    param_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_ROW_ALT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_WHITE, C_ROW_ALT]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, C_RULE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, C_RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ]))
    story.append(param_tbl)

    story += _section_header("Time-Series Overview", styles)
    try:
        chart_bytes = _chart(data, analysis, chart_type, selected)
        story += [
            Image(io.BytesIO(chart_bytes), width=CONTENT_W, height=2.60 * inch),
            Spacer(1, 0.04 * inch),
            Paragraph(
                f"Chart type: {chart_label}. Dotted lines indicate polynomial trendlines (degree {trend_deg}). × markers indicate flagged anomalies.",
                styles["caption"],
            ),
        ]
    except Exception as exc:  # noqa: BLE001
        story.append(Paragraph(f"[Chart could not be rendered: {exc}]", styles["body_muted"]))

    stat_col_w = [w * inch for w in [1.20, 0.50, 0.80, 0.80, 0.75, 0.65, 0.65, 0.60, 0.60, 0.65]]
    stat_rows = [["Series", "N", "Mean", "Median", "Std Dev", "Min", "Max", "Q1", "Q3", "IQR"]]
    for name in selected:
        s = analysis["series"][name]["statistics"]
        iqr = None if s["q1"] is None or s["q3"] is None else s["q3"] - s["q1"]
        stat_rows.append([
            name,
            str(s["count"]),
            _number(s["mean"]),
            _number(s["median"]),
            _number(s["std"]),
            _number(s["min"]),
            _number(s["max"]),
            _number(s["q1"]),
            _number(s["q3"]),
            _number(iqr),
        ])

    stat_tbl = Table(stat_rows, repeatRows=1, colWidths=stat_col_w)
    stat_tbl.setStyle(_table_style(font_size=8, padding=4, align_right_from=1, num_cols=10))
    stat_block = _section_header("Statistical Summary", styles) + [stat_tbl]
    story.append(KeepTogether(stat_block))

    story += _section_header("Anomaly Detection Summary", styles)
    story.append(Paragraph("Number of observations flagged by each detector for the selected series.", styles["body_muted"]))
    story.append(Spacer(1, 0.06 * inch))

    cnt_col_w = [1.60 * inch, 1.40 * inch, 1.40 * inch, 1.70 * inch, 1.10 * inch]
    cnt_rows = [["Series", "IQR rule", "Z-score", "Moving average", "Grubbs"]]
    for name in selected:
        c = analysis["series"][name]["anomaly_counts"]
        cnt_rows.append([
            name,
            str(c.get("iqr", 0)),
            str(c.get("z_score", 0)),
            str(c.get("moving_average", 0)),
            str(c.get("grubbs", 0)),
        ])

    cnt_tbl = Table(cnt_rows, repeatRows=1, colWidths=cnt_col_w)
    cnt_style = _table_style(font_size=8, padding=4)
    cnt_style.add("ALIGN", (1, 0), (4, -1), "CENTER")
    cnt_tbl.setStyle(cnt_style)
    story.append(cnt_tbl)

    detail_rows_raw: list[tuple[str, str, str, str]] = []
    for name in selected:
        for detector, records in analysis["series"][name]["anomalies"].items():
            for rec in sorted(records, key=lambda r: r["date"]):
                detail_rows_raw.append((
                    rec["date"],
                    name,
                    DETECTOR_LABELS.get(detector, detector),
                    _number(rec.get("observed_value", rec["value"])),
                ))
    detail_rows_raw.sort(key=lambda r: (r[0], r[1]))

    if detail_rows_raw:
        story += _section_header("Flagged Observations", styles)
        story.append(
            Paragraph(
                f"{len(detail_rows_raw)} individual data point(s) were flagged across all detectors for the selected series.",
                styles["body_muted"],
            )
        )
        story.append(Spacer(1, 0.06 * inch))

        det_col_w = [1.30 * inch, 1.40 * inch, 2.90 * inch, 1.60 * inch]
        det_rows = [["Date", "Series", "Detector", "Value"]] + [list(r) for r in detail_rows_raw]
        det_tbl = Table(det_rows, repeatRows=1, colWidths=det_col_w)
        det_style = _table_style(font_size=8, padding=4, align_right_from=3, num_cols=4)
        det_tbl.setStyle(det_style)
        story.append(det_tbl)

    episodes = [
        ep for ep in analysis.get("anomaly_episodes", [])
        if set(ep["series"]) & set(selected)
    ]
    episodes.sort(key=lambda ep: (ep.get("severity") or 0), reverse=True)

    if episodes:
        episode_limit = 25
        shown = episodes[:episode_limit]
        omitted = len(episodes) - len(shown)

        story.append(PageBreak())
        story += _section_header("Anomaly Episodes", styles)
        story.append(
            Paragraph(
                f"{len(episodes)} episode(s) detected (spikes and drops sorted by severity descending).",
                styles["body_muted"],
            )
        )
        story.append(Spacer(1, 0.06 * inch))

        ep_col_w = [0.90 * inch, 0.90 * inch, 1.10 * inch, 0.75 * inch, 0.55 * inch, 3.00 * inch]
        ep_rows = [["Start", "End", "Series", "Direction", "Days", "Detectors"]]
        for ep in shown:
            ep_rows.append([
                ep["start_date"],
                ep["end_date"],
                escape(", ".join(ep["series"])),
                ep["direction"].title(),
                str(ep["point_count"]),
                escape(", ".join(DETECTOR_LABELS.get(d, d) for d in ep["detectors"])),
            ])
        ep_tbl = Table(ep_rows, repeatRows=1, colWidths=ep_col_w)
        ep_style = _table_style(font_size=7.5, padding=4)
        ep_style.add("ALIGN", (3, 0), (4, -1), "CENTER")
        ep_tbl.setStyle(ep_style)
        story.append(ep_tbl)

        if omitted:
            story.append(Spacer(1, 0.05 * inch))
            story.append(Paragraph(
                f"Note: {omitted} additional episode(s) not shown due to the {episode_limit}-episode display limit.",
                styles["body_muted"],
            ))

        story.append(PageBreak())
        story += _section_header("Episode Notes", styles)
        for ep in shown:
            direction_icon = "▲" if ep["direction"] == "high" else "▼"
            ep_title = f"{direction_icon} {escape(', '.join(ep['series']))}  —  {ep['start_date']} to {ep['end_date']}"
            peak_date = ep.get("peak_date", ep["start_date"])
            observed = _number(ep.get("observed"))
            expected = _number(ep.get("expected"))
            deviation = _pct(ep.get("deviation_pct"))
            detectors = escape(", ".join(DETECTOR_LABELS.get(d, d) for d in ep["detectors"]))

            meta_text = (
                f"Peak date: <b>{peak_date}</b> &nbsp;|&nbsp; "
                f"Observed: <b>{observed}</b> &nbsp;|&nbsp; "
                f"Trend expected: <b>{expected}</b> &nbsp;|&nbsp; "
                f"Deviation: <b>{deviation}</b><br/>"
                f"Flagged points: <b>{ep['point_count']}</b> &nbsp;|&nbsp; "
                f"Detectors: {detectors}"
            )

            block: list[Any] = [
                Paragraph(ep_title, styles["subsection_heading"]),
                Paragraph(meta_text, styles["body"]),
                Spacer(1, 0.05 * inch),
            ]

            try:
                mini_bytes = _episode_chart(analysis, ep)
                block.append(Image(io.BytesIO(mini_bytes), width=CONTENT_W, height=1.85 * inch))
            except Exception as exc:  # noqa: BLE001
                block.append(Paragraph(f"[Chart unavailable: {exc}]", styles["body_muted"]))

            block.append(Spacer(1, 0.10 * inch))
            story.append(KeepTogether(block))

    story += _section_header("Methodology", styles)
    story.append(Paragraph(
        "<b>IQR rule:</b> Flags observations below Q1 − k·IQR or above Q3 + k·IQR, using Tukey fences with multiplier k.<br/>"
        "<b>Z-score:</b> Flags observations whose absolute deviation from the mean exceeds the threshold in units of σ.<br/>"
        "<b>Moving-average distance:</b> Flags observations whose percentage distance from a rolling mean exceeds threshold.<br/>"
        "<b>Grubbs' test:</b> Iterative two-sided extreme studentised deviate test applied at significance level α.<br/>"
        "<b>De-trended basis:</b> When selected, weekday effects and polynomial trend are removed before detection.",
        styles["methodology"],
    ))

    doc.build(story)
    return output.getvalue()
