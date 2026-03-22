#!/usr/bin/env python3
"""Data preparation for the whaling longread charts.

This script rebuilds the data.js payload from whaling_data_clean.csv.
It enforces voyage-level deduplication, yearly aggregation, and
methodologically correct constructions for chapters 1–5.
"""

import csv
import json
import random
import re
from pathlib import Path
from statistics import median
from typing import Dict, List, Tuple, Optional

CSV_PATH = Path("whaling_data_clean.csv")
DATA_PATH = Path("data.js")
REPORT_DIR = Path("reports")

YEAR_START = 1810
YEAR_END = 1899
ABS_SCALE = 1000.0

GROUND_PATTERNS = [
    (r"ochotsk|okhotsk|japan", (48.0, 155.0)),
    (r"bering", (58.0, -170.0)),
    (r"kamchatka", (55.0, 160.0)),
    (r"northwest coast|nw coast", (50.0, -135.0)),
    (r"baja", (23.0, -110.0)),
    (r"arctic|w arctic|western arctic|chukchi|beaufort", (72.0, -155.0)),
    (r"davis", (62.0, -55.0)),
    (r"hudson", (60.0, -85.0)),
    (r"greenland", (70.0, -30.0)),
    (r"grand banks", (45.0, -50.0)),
    (r"w indies|west indies", (18.0, -75.0)),
    (r"gulf of mexico", (24.0, -90.0)),
    (r"cape verde", (16.0, -25.0)),
    (r"western islands|azores|canary", (37.0, -25.0)),
    (r"cape of good hope", (-35.0, 18.0)),
    (r"patagonia", (-45.0, -65.0)),
    (r"brazil", (-15.0, -35.0)),
    (r"south atlantic|s atlantic", (-25.0, -5.0)),
    (r"north atlantic|n atlantic", (40.0, -35.0)),
    (r"atlantic", (20.0, -35.0)),
    (r"indian", (-15.0, 80.0)),
    (r"south seas|s pacific|south pacific", (-25.0, -140.0)),
    (r"north pacific|n pacific", (35.0, -155.0)),
    (r"pacific", (5.0, -150.0)),
    (r"desolation", (-48.0, 70.0)),
]


def to_int(value: Optional[str]) -> Optional[int]:
    """Parse integer values safely; return None for missing values."""
    try:
        if value is None:
            return None
        value = str(value).strip()
        if value == "" or value.lower() in {"nan", "na"}:
            return None
        return int(float(value))
    except Exception:
        return None


def to_float_optional(value: Optional[str]) -> Optional[float]:
    """Parse floats; return None for missing values instead of 0.

    This is used when we must distinguish real zeros from missing data.
    """
    try:
        if value is None:
            return None
        value = str(value).strip()
        if value == "" or value.lower() in {"nan", "na"}:
            return None
        return float(value)
    except Exception:
        return None


def to_float(value: Optional[str]) -> float:
    """Parse floats and coerce missing values to 0.

    This helper is used for chapter 1–2 series, where missing values
    can be treated as zeros after validation.
    """
    parsed = to_float_optional(value)
    return parsed if parsed is not None else 0.0


def load_and_validate_data(path: Path = CSV_PATH) -> List[Dict[str, str]]:
    """Load raw CSV data.

    Units in the source:
    - sperm (barrels)
    - oil (barrels)
    - bone (pounds)

    The loader does NOT coerce missing values; downstream functions
    decide how to handle them explicitly.
    """
    rows: List[Dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def resolve_duplicate_voyages(rows: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """Resolve duplicate voyageID records.

    Rule:
    - If all rows for a voyageID match on yearIn_num, sperm, oil, bone
      (after numeric parsing), keep one.
    - If they do NOT match, do NOT aggregate silently: keep one record
      for downstream series but emit all conflicting rows to a report.
    """
    by_id: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        vid = row.get("voyageID")
        if not vid:
            continue
        by_id.setdefault(vid, []).append(row)

    deduped: List[Dict[str, str]] = []
    conflicts: List[Dict[str, str]] = []

    def key(r: Dict[str, str]):
        return (
            to_int(r.get("yearIn_num")),
            to_float_optional(r.get("sperm")),
            to_float_optional(r.get("oil")),
            to_float_optional(r.get("bone")),
        )

    for vid, items in by_id.items():
        if len(items) == 1:
            deduped.append(items[0])
            continue
        keys = {key(r) for r in items}
        if len(keys) == 1:
            deduped.append(items[0])
        else:
            conflicts.extend(items)
            deduped.append(items[0])

    return deduped, conflicts


def resolve_duplicate_ground(rows: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """Resolve duplicate voyageID records for geography analysis.

    Rule:
    - If rows for a voyageID disagree on yearIn_num or ground, mark all as conflicts.
    - For analysis, keep a single representative row (prefer non-empty ground).
    """
    by_id: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        vid = row.get("voyageID")
        if not vid:
            continue
        by_id.setdefault(vid, []).append(row)

    deduped: List[Dict[str, str]] = []
    conflicts: List[Dict[str, str]] = []

    def key(r: Dict[str, str]):
        return (
            to_int(r.get("yearIn_num")),
            (r.get("ground") or "").strip().lower(),
        )

    for vid, items in by_id.items():
        keys = {key(r) for r in items}
        if len(keys) > 1:
            conflicts.extend(items)
        selected = None
        for row in items:
            ground = (row.get("ground") or "").strip()
            if ground and ground.upper() != "NA":
                selected = row
                break
        if selected is None:
            selected = items[0]
        deduped.append(selected)

    return deduped, conflicts


def geocode_ground(ground: Optional[str]) -> Optional[Tuple[float, float]]:
    """Map ground labels to approximate coordinates.

    This is a schematic geocoding based on ground names, used to reveal
    spatial shift (not to claim precise positions).
    """
    if ground is None:
        return None
    g = str(ground).strip().lower()
    if not g or g in {"na", "n/a"}:
        return None
    for pattern, coords in GROUND_PATTERNS:
        if re.search(pattern, g):
            return coords
    return None


def build_geography_decades(rows: List[Dict[str, str]]):
    """Aggregate geocoded grounds by decade with centroids and summary.

    Returns:
    - decades: list of {decade, points, centroid, totalVoyages, geocodedVoyages, share}
    - summary_rows: list of decade summary rows for CSV export
    """
    rng = random.Random(42)
    decade_points: Dict[int, List[Dict[str, float]]] = {}
    decade_counts: Dict[int, int] = {}
    decade_geo_counts: Dict[int, int] = {}
    decade_sum: Dict[int, Dict[str, float]] = {}

    max_points = 600
    decade_seen_geo: Dict[int, int] = {}

    for row in rows:
        year = to_int(row.get("yearIn_num"))
        if year is None or year < YEAR_START or year > YEAR_END:
            continue
        decade = (year // 10) * 10
        decade_counts[decade] = decade_counts.get(decade, 0) + 1

        coords = geocode_ground(row.get("ground"))
        if coords is None:
            continue

        lat, lon = coords
        decade_geo_counts[decade] = decade_geo_counts.get(decade, 0) + 1
        if decade not in decade_sum:
            decade_sum[decade] = {"lat": 0.0, "lon": 0.0}
        decade_sum[decade]["lat"] += lat
        decade_sum[decade]["lon"] += lon

        # reservoir sampling for points
        points = decade_points.setdefault(decade, [])
        seen = decade_seen_geo.get(decade, 0) + 1
        decade_seen_geo[decade] = seen
        point = {"lat": round(lat, 2), "lon": round(lon, 2)}
        if len(points) < max_points:
            points.append(point)
        else:
            j = rng.randint(0, seen - 1)
            if j < max_points:
                points[j] = point

    decades = []
    summary_rows = []
    for decade in sorted({d for d in range(YEAR_START, YEAR_END + 1, 10)}):
        total = decade_counts.get(decade, 0)
        geo = decade_geo_counts.get(decade, 0)
        share = (geo / total) if total else 0.0
        centroid = None
        if geo:
            centroid = {
                "lat": round(decade_sum[decade]["lat"] / geo, 2),
                "lon": round(decade_sum[decade]["lon"] / geo, 2),
            }
        decades.append(
            {
                "decade": decade,
                "points": decade_points.get(decade, []),
                "centroid": centroid,
                "totalVoyages": total,
                "geocodedVoyages": geo,
                "share": round(share, 3),
            }
        )
        summary_rows.append(
            {
                "decade": decade,
                "total_voyages": total,
                "geocoded_voyages": geo,
                "share_geocoded": round(share, 4),
                "centroid_lat": centroid["lat"] if centroid else "",
                "centroid_lon": centroid["lon"] if centroid else "",
            }
        )

    return decades, summary_rows

def resolve_duplicate_duration(rows: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """Resolve duplicate voyageID records for duration analysis.

    Rule:
    - If rows for a voyageID disagree on yearIn_num or voyage_duration,
      mark all as conflicts (do not aggregate silently).
    - For analysis, keep a single representative row per voyageID, preferring
      entries with a valid year and a positive duration.
    """
    by_id: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        vid = row.get("voyageID")
        if not vid:
            continue
        by_id.setdefault(vid, []).append(row)

    deduped: List[Dict[str, str]] = []
    conflicts: List[Dict[str, str]] = []

    def key(r: Dict[str, str]):
        return (
            to_int(r.get("yearIn_num")),
            to_float_optional(r.get("voyage_duration")),
        )

    for vid, items in by_id.items():
        keys = {key(r) for r in items}
        if len(keys) > 1:
            conflicts.extend(items)

        selected = None
        for row in items:
            year = to_int(row.get("yearIn_num"))
            dur = to_float_optional(row.get("voyage_duration"))
            if year is not None and dur is not None and dur > 0:
                selected = row
                break
        if selected is None:
            for row in items:
                if to_int(row.get("yearIn_num")) is not None:
                    selected = row
                    break
        if selected is None:
            selected = items[0]
        deduped.append(selected)

    return deduped, conflicts


def export_reports(
    conflicts: List[Dict[str, str]],
    excluded_ids: List[str],
    duration_conflicts: List[Dict[str, str]],
    duration_missing: List[Dict[str, str]],
    duration_invalid: List[Dict[str, str]],
    duration_summary: List[Dict[str, float]],
    ground_conflicts: List[Dict[str, str]],
    decade_geography_summary: List[Dict[str, float]],
) -> None:
    """Export conflict and exclusion reports for auditability."""
    REPORT_DIR.mkdir(exist_ok=True)

    if conflicts:
        conflict_path = REPORT_DIR / "voyage_conflicts.csv"
        with conflict_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(conflicts[0].keys()))
            writer.writeheader()
            writer.writerows(conflicts)

    if excluded_ids:
        excluded_path = REPORT_DIR / "voyages_excluded_all_missing.csv"
        with excluded_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["voyageID"])
            for vid in excluded_ids:
                writer.writerow([vid])

    if duration_conflicts:
        conflict_path = REPORT_DIR / "duration_conflicts.csv"
        with conflict_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(duration_conflicts[0].keys()))
            writer.writeheader()
            writer.writerows(duration_conflicts)

    if duration_missing:
        missing_path = REPORT_DIR / "duration_missing.csv"
        with missing_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(duration_missing[0].keys()))
            writer.writeheader()
            writer.writerows(duration_missing)

    if duration_invalid:
        invalid_path = REPORT_DIR / "duration_invalid.csv"
        with invalid_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(duration_invalid[0].keys()))
            writer.writeheader()
            writer.writerows(duration_invalid)

    if duration_summary:
        summary_path = REPORT_DIR / "duration_summary.csv"
        with summary_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(duration_summary[0].keys()))
            writer.writeheader()
            writer.writerows(duration_summary)

    if ground_conflicts:
        ground_path = REPORT_DIR / "ground_conflicts.csv"
        with ground_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(ground_conflicts[0].keys()))
            writer.writeheader()
            writer.writerows(ground_conflicts)

    if decade_geography_summary:
        geo_path = REPORT_DIR / "decade_geography_summary.csv"
        with geo_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(decade_geography_summary[0].keys()))
            writer.writeheader()
            writer.writerows(decade_geography_summary)


def aggregate_by_year(rows: List[Dict[str, str]]) -> Tuple[Dict[int, Dict[str, float]], Dict[int, int]]:
    """Aggregate chapter 1–2 product totals by yearIn_num."""
    year_stats: Dict[int, Dict[str, float]] = {}
    counts: Dict[int, int] = {}
    for row in rows:
        year = to_int(row.get("yearIn_num"))
        if year is None:
            continue
        if year < YEAR_START or year > YEAR_END:
            continue
        sperm = to_float(row.get("sperm"))
        oil = to_float(row.get("oil"))
        bone = to_float(row.get("bone"))
        if year not in year_stats:
            year_stats[year] = {"sperm": 0.0, "whale": 0.0, "baleen": 0.0}
            counts[year] = 0
        year_stats[year]["sperm"] += sperm
        year_stats[year]["whale"] += oil
        year_stats[year]["baleen"] += bone
        counts[year] += 1
    return year_stats, counts


def build_abs(year_stats: Dict[int, Dict[str, float]]) -> List[Dict[str, float]]:
    """Build yearly absolute totals (scaled to thousands)."""
    abs_data = []
    for year in range(YEAR_START, YEAR_END + 1):
        vals = year_stats.get(year, {"sperm": 0.0, "whale": 0.0, "baleen": 0.0})
        abs_data.append(
            {
                "year": year,
                "sperm": round(vals["sperm"] / ABS_SCALE, 2),
                "whale": round(vals["whale"] / ABS_SCALE, 2),
                "baleen": round(vals["baleen"] / ABS_SCALE, 2),
            }
        )
    return abs_data


def compute_rolling_means(values: List[float], window: int = 5) -> List[float]:
    """Compute centered rolling mean with a variable window at the edges."""
    if not values:
        return []
    half = window // 2
    out = []
    for i in range(len(values)):
        start = max(0, i - half)
        end = min(len(values), i + half + 1)
        subset = values[start:end]
        out.append(sum(subset) / len(subset))
    return out


def detect_phase_markers(years: List[int], smooth: List[float]):
    """Detect peak, growth onset, and decline onset using explicit heuristics.

    Rules:
    - Peak = max of smoothed series.
    - Growth onset = first year >= 20% of peak with two subsequent increases.
    - Decline onset = first year after peak with two subsequent decreases.

    If a rule cannot be satisfied, return None for that marker.
    """
    if not years or not smooth:
        return {"peak": None, "growthStart": None, "declineStart": None}
    peak_idx = max(range(len(smooth)), key=lambda i: smooth[i])
    peak_year = years[peak_idx]
    peak_val = smooth[peak_idx]

    growth_start = None
    if peak_val > 0:
        threshold = peak_val * 0.2
        for i in range(0, len(smooth) - 2):
            if smooth[i] >= threshold and smooth[i + 1] > smooth[i] and smooth[i + 2] > smooth[i + 1]:
                growth_start = years[i]
                break

    decline_start = None
    for i in range(peak_idx + 1, len(smooth) - 2):
        if smooth[i + 1] < smooth[i] and smooth[i + 2] < smooth[i + 1]:
            decline_start = years[i]
            break

    return {"peak": {"year": peak_year, "value": peak_val}, "growthStart": growth_start, "declineStart": decline_start}


def percentile(values: List[float], p: float) -> Optional[float]:
    """Return percentile p (0-100) using linear interpolation."""
    if not values:
        return None
    vals = sorted(values)
    if len(vals) == 1:
        return vals[0]
    k = (len(vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(vals) - 1)
    if f == c:
        return vals[f]
    return vals[f] + (vals[c] - vals[f]) * (k - f)


def aggregate_yearly_productivity(rows: List[Dict[str, str]]):
    """Compute per-year mean/median productivity per voyage for each product.

    - Uses yearIn_num (return year).
    - Keeps zeros for missing product values.
    - Excludes voyages only if all three products are missing.
    - Does NOT sum barrels and pounds into a single raw aggregate.
    """
    yearly = {}
    excluded_all_missing: List[str] = []

    for row in rows:
        year = to_int(row.get("yearIn_num"))
        if year is None or year < YEAR_START or year > YEAR_END:
            continue
        s = to_float_optional(row.get("sperm"))
        o = to_float_optional(row.get("oil"))
        b = to_float_optional(row.get("bone"))

        if s is None and o is None and b is None:
            vid = row.get("voyageID")
            if vid:
                excluded_all_missing.append(vid)
            continue

        s = s if s is not None else 0.0
        o = o if o is not None else 0.0
        b = b if b is not None else 0.0

        if year not in yearly:
            yearly[year] = {"N": 0, "sperm": [], "whale": [], "baleen": []}
        yearly[year]["N"] += 1
        yearly[year]["sperm"].append(s)
        yearly[year]["whale"].append(o)
        yearly[year]["baleen"].append(b)

    years = list(range(YEAR_START, YEAR_END + 1))
    result = {
        "years": years,
        "N": [],
        "series": {
            "sperm": {"mean": [], "median": [], "p10": [], "p90": [], "unit": "barrels"},
            "whale": {"mean": [], "median": [], "p10": [], "p90": [], "unit": "barrels"},
            "baleen": {"mean": [], "median": [], "p10": [], "p90": [], "unit": "pounds"},
        },
    }

    for year in years:
        entry = yearly.get(year, {"N": 0, "sperm": [], "whale": [], "baleen": []})
        N = entry["N"]
        result["N"].append(N)
        for key in ("sperm", "whale", "baleen"):
            values = entry[key]
            if N == 0:
                result["series"][key]["mean"].append(0.0)
                result["series"][key]["median"].append(0.0)
                result["series"][key]["p10"].append(0.0)
                result["series"][key]["p90"].append(0.0)
                continue
            mean_val = sum(values) / N
            median_val = median(values)
            p10 = percentile(values, 10)
            p90 = percentile(values, 90)
            result["series"][key]["mean"].append(mean_val)
            result["series"][key]["median"].append(median_val)
            result["series"][key]["p10"].append(p10 if p10 is not None else 0.0)
            result["series"][key]["p90"].append(p90 if p90 is not None else 0.0)

    # rolling means and phases
    for key in ("sperm", "whale", "baleen"):
        means = result["series"][key]["mean"]
        smooth = compute_rolling_means(means, window=5)
        phases = detect_phase_markers(years, smooth)
        result["series"][key]["smooth"] = smooth
        result["series"][key]["phase"] = phases

    # optional composite (normalized index)
    max_s = max(result["series"]["sperm"]["mean"]) if result["series"]["sperm"]["mean"] else 0
    max_o = max(result["series"]["whale"]["mean"]) if result["series"]["whale"]["mean"] else 0
    max_b = max(result["series"]["baleen"]["mean"]) if result["series"]["baleen"]["mean"] else 0

    composite = []
    for i in range(len(years)):
        s = result["series"]["sperm"]["mean"][i] / max_s if max_s else 0
        o = result["series"]["whale"]["mean"][i] / max_o if max_o else 0
        b = result["series"]["baleen"]["mean"][i] / max_b if max_b else 0
        composite.append((s + o + b) / 3)

    composite_smooth = compute_rolling_means(composite, window=5)
    composite_phase = detect_phase_markers(years, composite_smooth)

    result["composite"] = {
        "index": composite,
        "smooth": composite_smooth,
        "phase": composite_phase,
    }

    return result, excluded_all_missing


def aggregate_yearly_duration(
    rows: List[Dict[str, str]],
    counts: Dict[int, int],
    conflict_count: int,
):
    """Compute per-year duration statistics.

    - Uses yearIn_num (return year).
    - Excludes rows with missing duration or duration <= 0.
    - Keeps a single voyage per voyageID (deduped upstream).
    - Returns mean and median duration per year plus a summary report.
    """
    yearly: Dict[int, List[float]] = {}
    duration_missing: List[Dict[str, str]] = []
    duration_invalid: List[Dict[str, str]] = []
    duration_summary: List[Dict[str, float]] = []

    for row in rows:
        year = to_int(row.get("yearIn_num"))
        if year is None or year < YEAR_START or year > YEAR_END:
            continue
        raw = row.get("voyage_duration")
        dur = to_float_optional(raw)
        if dur is None:
            duration_missing.append(
                {
                    "voyageID": row.get("voyageID") or "",
                    "yearIn_num": str(year),
                    "voyage_duration": raw if raw is not None else "",
                    "reason": "missing",
                }
            )
            continue
        if dur <= 0:
            duration_invalid.append(
                {
                    "voyageID": row.get("voyageID") or "",
                    "yearIn_num": str(year),
                    "voyage_duration": raw if raw is not None else "",
                    "reason": "nonpositive",
                }
            )
            continue
        yearly.setdefault(year, []).append(dur)

    series = []
    for year in range(YEAR_START, YEAR_END + 1):
        durations = yearly.get(year, [])
        n_valid = len(durations)
        mean_val = sum(durations) / n_valid if n_valid else 0.0
        median_val = median(durations) if n_valid else 0.0
        series.append(
            {
                "year": year,
                "voyages": counts.get(year, 0),
                "duration": round(mean_val, 2),
                "medianDuration": round(median_val, 2),
                "durationN": n_valid,
            }
        )
        duration_summary.append(
            {
                "year": year,
                "voyages_total": counts.get(year, 0),
                "voyages_with_duration": n_valid,
                "mean_duration": round(mean_val, 4),
                "median_duration": round(median_val, 4),
                "conflict_voyages": conflict_count,
            }
        )

    return series, duration_missing, duration_invalid, duration_summary


def find_base_years(abs_data: List[Dict[str, float]]):
    base_years = {}
    base_values = {}
    for key in ("sperm", "whale", "baleen"):
        base_year = None
        base_value = None
        for row in abs_data:
            if row[key] > 0:
                base_year = row["year"]
                base_value = row[key]
                break
        base_years[key] = base_year
        base_values[key] = base_value
    return base_years, base_values


def build_index(abs_data: List[Dict[str, float]], base_years, base_values):
    index_data = []
    for row in abs_data:
        year = row["year"]
        idx_row = {"year": year}
        for key in ("sperm", "whale", "baleen"):
            base_year = base_years[key]
            base_value = base_values[key]
            if base_year is None or base_value in (None, 0):
                idx = 0.0
            elif year < base_year:
                idx = 0.0
            else:
                idx = (row[key] / base_value) * 100.0
            idx_row[key] = round(idx, 1)
        index_data.append(idx_row)
    return index_data


def compute_confidence_band(counts: Dict[int, int]) -> Dict[str, int]:
    count_series = [counts.get(y, 0) for y in range(YEAR_START, YEAR_END + 1)]
    nonzero = [c for c in count_series if c > 0]
    if not nonzero:
        return {}
    med = median(nonzero)
    threshold = med * 0.5
    end = None
    for y in range(YEAR_START, YEAR_END + 1):
        if counts.get(y, 0) < threshold:
            end = y
        else:
            break
    if end is None:
        return {}
    return {"start": YEAR_START, "end": end}


def compute_composite_divergence(year_stats: Dict[int, Dict[str, float]], counts: Dict[int, int]):
    """Compute composite product index vs voyage index using a shared base period.

    The composite index is an average of three normalized product lines:
    sperm, oil, and bone. Each line is normalized to the SAME base period
    so they are commensurate as indices (not physical volumes).

    This function does NOT sum barrels and pounds into a raw aggregate.
    It returns:
    - divergence series: [{year, compositeIndex, voyageIndex}, ...]
    - breakYears: {compositePeak, voyagePeak} based on smoothed series
    - meta: base period and base means
    """
    years = list(range(YEAR_START, YEAR_END + 1))
    series = []
    for year in years:
        vals = year_stats.get(year, {"sperm": 0.0, "whale": 0.0, "baleen": 0.0})
        series.append(
            {
                "year": year,
                "sperm": vals["sperm"],
                "whale": vals["whale"],
                "baleen": vals["baleen"],
                "voyages": counts.get(year, 0),
            }
        )

    def compute_threshold(values: List[float]) -> float:
        vals = [v for v in values if v > 0]
        if not vals:
            return 0.0
        p10 = percentile(vals, 10) or 0.0
        med = median(vals)
        return max(p10, med * 0.15)

    thresholds = {
        "sperm": compute_threshold([row["sperm"] for row in series]),
        "whale": compute_threshold([row["whale"] for row in series]),
        "baleen": compute_threshold([row["baleen"] for row in series]),
        "voyages": compute_threshold([row["voyages"] for row in series]),
    }

    def find_base_window(window: int):
        for i in range(0, len(series) - window + 1):
            window_rows = series[i : i + window]
            means = {
                "sperm": sum(r["sperm"] for r in window_rows) / window,
                "whale": sum(r["whale"] for r in window_rows) / window,
                "baleen": sum(r["baleen"] for r in window_rows) / window,
                "voyages": sum(r["voyages"] for r in window_rows) / window,
            }
            if all(means[k] > 0 and means[k] >= thresholds[k] for k in means):
                return window_rows[0]["year"], window_rows[-1]["year"], means
        return None

    base_period = find_base_window(5) or find_base_window(3)

    if base_period is None:
        # Fallback: use first year with all products defined
        for row in series:
            if row["voyages"] > 0 and row["sperm"] > 0 and row["whale"] > 0 and row["baleen"] > 0:
                base_period = (row["year"], row["year"], row)
                break

    if base_period is None:
        raise RuntimeError("No common base period found with all three product lines defined.")

    base_start, base_end, base_vals = base_period
    s_base = base_vals["sperm"]
    o_base = base_vals["whale"]
    b_base = base_vals["baleen"]
    v_base = base_vals["voyages"]

    divergence = []
    for row in series:
        s_idx = (row["sperm"] / s_base) * 100 if s_base else 0.0
        o_idx = (row["whale"] / o_base) * 100 if o_base else 0.0
        b_idx = (row["baleen"] / b_base) * 100 if b_base else 0.0
        composite = (s_idx + o_idx + b_idx) / 3
        v_idx = (row["voyages"] / v_base) * 100 if v_base else 0.0
        divergence.append(
            {
                "year": row["year"],
                "compositeIndex": round(composite, 1),
                "voyageIndex": round(v_idx, 1),
            }
        )

    comp_series = [d["compositeIndex"] for d in divergence]
    voy_series = [d["voyageIndex"] for d in divergence]
    comp_smooth = compute_rolling_means(comp_series, window=5)
    voy_smooth = compute_rolling_means(voy_series, window=5)
    comp_peak_year = years[comp_smooth.index(max(comp_smooth))] if comp_smooth else None
    voy_peak_year = years[voy_smooth.index(max(voy_smooth))] if voy_smooth else None

    return (
        divergence,
        {"compositePeak": comp_peak_year, "voyagePeak": voy_peak_year},
        {
            "basePeriod": {"start": base_start, "end": base_end},
            "baseMeans": {"sperm": s_base, "whale": o_base, "baleen": b_base, "voyages": v_base},
        },
    )


def load_data_js():
    text = DATA_PATH.read_text(encoding="utf-8")
    marker = "window.DATA ="
    idx = text.find(marker)
    if idx == -1:
        raise RuntimeError("data.js does not contain window.DATA")
    json_text = text[idx + len(marker) :].strip()
    if json_text.endswith(";"):
        json_text = json_text[:-1]
    return json.loads(json_text)


def write_data_js(data: Dict) -> None:
    content = "window.DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    DATA_PATH.write_text(content, encoding="utf-8")


def main():
    rows = load_and_validate_data()
    deduped, conflicts = resolve_duplicate_voyages(rows)
    duration_rows, duration_conflicts = resolve_duplicate_duration(rows)
    duration_conflict_ids = {row.get("voyageID") for row in duration_conflicts if row.get("voyageID")}
    ground_rows, ground_conflicts = resolve_duplicate_ground(rows)

    # Chapter 1–2 aggregates
    year_stats, counts = aggregate_by_year(deduped)
    abs_data = build_abs(year_stats)
    base_years, base_values = find_base_years(abs_data)
    index_data = build_index(abs_data, base_years, base_values)
    conf_band = compute_confidence_band(counts)
    divergence, break_years, divergence_meta = compute_composite_divergence(year_stats, counts)

    # Chapter 2 phase data (sums, not shares)
    years = [row["year"] for row in abs_data]
    raw_series = {
        "sperm": [row["sperm"] * ABS_SCALE for row in abs_data],
        "whale": [row["whale"] * ABS_SCALE for row in abs_data],
        "baleen": [row["baleen"] * ABS_SCALE for row in abs_data],
    }
    smooth_series = {k: compute_rolling_means(v, window=5) for k, v in raw_series.items()}
    phases = {}
    for key in ("sperm", "whale", "baleen"):
        phase = detect_phase_markers(years, smooth_series[key])
        phases[key] = {
            "unit": "barrels" if key != "baleen" else "pounds",
            "raw": [round(v, 2) for v in raw_series[key]],
            "smooth": [round(v, 2) for v in smooth_series[key]],
            "peak": phase["peak"],
            "growthStart": phase["growthStart"],
            "declineStart": phase["declineStart"],
        }

    # Chapter 3 productivity per voyage
    productivity, excluded_all_missing = aggregate_yearly_productivity(deduped)

    data = load_data_js()
    data["productsIndex"] = index_data
    data["productsAbs"] = abs_data
    data["productsMeta"] = {
        "baseYears": base_years,
        "absScale": int(ABS_SCALE),
        "absUnits": {"sperm": "barrels", "whale": "barrels", "baleen": "pounds"},
    }
    data["confidenceBand"] = conf_band
    data["divergence"] = divergence
    data["breakYears"] = break_years
    data["divergenceMeta"] = divergence_meta
    data["productPhases"] = {"years": years, "series": phases}
    data["voyageProductivity"] = productivity
    voyages_series, duration_missing, duration_invalid, duration_summary = aggregate_yearly_duration(
        duration_rows,
        counts,
        len(duration_conflict_ids),
    )
    data["voyages"] = voyages_series
    data.pop("catchPerVoyage", None)

    geography_decades, decade_geo_summary = build_geography_decades(ground_rows)
    data["geographyDecades"] = geography_decades
    data.pop("geography", None)

    write_data_js(data)
    export_reports(
        conflicts,
        excluded_all_missing,
        duration_conflicts,
        duration_missing,
        duration_invalid,
        duration_summary,
        ground_conflicts,
        decade_geo_summary,
    )

    print("Updated data.js")
    print("Base years:", base_years)
    print("Confidence band:", conf_band)
    if conflicts:
        print(f"Conflicts detected: {len(conflicts)} (see reports/voyage_conflicts.csv)")
    if excluded_all_missing:
        print(f"Excluded voyages (all products missing): {len(excluded_all_missing)}")
    if duration_conflicts:
        print(f"Duration conflicts detected: {len(duration_conflict_ids)} (see reports/duration_conflicts.csv)")
    if duration_missing:
        print(f"Missing duration rows: {len(duration_missing)} (see reports/duration_missing.csv)")
    if duration_invalid:
        print(f"Invalid duration rows: {len(duration_invalid)} (see reports/duration_invalid.csv)")
    if ground_conflicts:
        print(f"Ground conflicts detected: {len(ground_conflicts)} (see reports/ground_conflicts.csv)")


if __name__ == "__main__":
    main()
