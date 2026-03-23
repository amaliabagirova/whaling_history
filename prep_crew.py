
from __future__ import annotations

import csv
import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data.js"
DEFAULT_CREW_PATH = Path.home() / "Desktop" / "crew.csv"

STATE_ABBR = {"ma", "mass", "ct", "ri", "ny", "pa", "va", "nj"}

GROUP_PATTERNS = {
    "core_south_coast": [
        r"new bedford",
        r"fairhaven",
        r"fair haven",
        r"dartmouth",
        r"westport",
        r"acushnet",
        r"mattapoisett",
        r"wareham",
        r"marion",
        r"freetown",
        r"fall river",
    ],
    "cape_islands": [
        r"nantucket",
        r"tisbury",
        r"edgartown",
        r"chilmark",
        r"falmouth",
        r"vineyard",
        r"sandwich",
        r"barnstable",
        r"cape cod",
        r"capecod",
    ],
    "ct_ports": [
        r"new london",
        r"stonington",
        r"groton",
        r"norwich",
        r"waterford",
        r"montville",
        r"mystic",
        r"new haven",
    ],
    "atlantic_cities": [
        r"new york",
        r"brooklyn",
        r"philadelphia",
        r"boston",
        r"providence",
        r"baltimore",
        r"albany",
        r"newark",
        r"rochester",
    ],
    "atlantic_islands": [
        r"azores",
        r"fayal",
        r"pico",
        r"sao miguel",
        r"sao jorge",
        r"flores",
        r"cape verde",
        r"brava",
        r"fogo",
        r"saint helena",
        r"st helena",
        r"madeira",
        r"bermuda",
        r"barbados",
    ],
    "germany": [r"germany"],
}

GROUP_LABELS = {
    "core_south_coast": "Южная Новая Англия (портовый пояс)",
    "ct_ports": "Порты Коннектикута",
    "atlantic_cities": "Крупные атлантические города",
    "atlantic_islands": "Атлантические острова",
    "germany": "Germany",
    "cape_islands": "Кейп и острова",
    "other": "Прочие/смешанные",
}


def normalize_city(value: str) -> str:
    s = str(value).strip().lower()
    s = re.sub(r"[^a-z0-9\\s]", " ", s)
    parts = [p for p in s.split() if p not in STATE_ABBR]
    return " ".join(parts)


def assign_group(city_norm: str) -> str:
    for group, patterns in GROUP_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, city_norm):
                return group
    return "other"


def ks_statistic(x: np.ndarray, y: np.ndarray) -> float:
    x = np.sort(x)
    y = np.sort(y)
    n = len(x)
    m = len(y)
    i = j = 0
    cdf_x = cdf_y = 0.0
    d = 0.0
    while i < n and j < m:
        if x[i] <= y[j]:
            i += 1
            cdf_x = i / n
        else:
            j += 1
            cdf_y = j / m
        d = max(d, abs(cdf_x - cdf_y))
    return float(d)


def wasserstein(x: np.ndarray, y: np.ndarray, q: int = 200) -> float:
    x = np.sort(x)
    y = np.sort(y)
    qs = np.linspace(0, 1, q)
    xq = np.quantile(x, qs)
    yq = np.quantile(y, qs)
    return float(np.mean(np.abs(xq - yq)))


def iter_rows(path: Path):
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def compute_hist(values: np.ndarray, bins: List[int]) -> List[int]:
    counts, _ = np.histogram(values, bins=bins)
    return counts.tolist()


def summarize_group(age: np.ndarray, height: np.ndarray, n: int) -> Dict[str, float]:
    return {
        "N": int(n),
        "age_mean": float(np.mean(age)),
        "age_median": float(np.median(age)),
        "age_std": float(np.std(age, ddof=1)),
        "age_p25": float(np.quantile(age, 0.25)),
        "age_p75": float(np.quantile(age, 0.75)),
        "age_iqr": float(np.quantile(age, 0.75) - np.quantile(age, 0.25)),
        "age_p10": float(np.quantile(age, 0.1)),
        "age_p90": float(np.quantile(age, 0.9)),
        "age_lt20": float(np.mean(age < 20)),
        "age_ge30": float(np.mean(age >= 30)),
        "age_ge40": float(np.mean(age >= 40)),
        "height_mean": float(np.mean(height)),
        "height_median": float(np.median(height)),
        "height_std": float(np.std(height, ddof=1)),
        "height_p25": float(np.quantile(height, 0.25)),
        "height_p75": float(np.quantile(height, 0.75)),
        "height_iqr": float(np.quantile(height, 0.75) - np.quantile(height, 0.25)),
        "height_p10": float(np.quantile(height, 0.1)),
        "height_p90": float(np.quantile(height, 0.9)),
        "height_lt64": float(np.mean(height < 64)),
        "height_ge70": float(np.mean(height >= 70)),
    }


def load_data_js() -> Dict:
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


def main() -> None:
    crew_path = Path(os.environ.get("CREW_PATH", DEFAULT_CREW_PATH))
    if not crew_path.exists():
        raise SystemExit(f"crew file not found: {crew_path}")

    # accumulate via streaming
    age_all: List[float] = []
    height_all: List[float] = []
    age_year: List[float] = []
    height_year: List[float] = []
    year_all: List[int] = []
    group_all: List[str] = []

    group_age: Dict[str, List[float]] = defaultdict(list)
    group_height: Dict[str, List[float]] = defaultdict(list)
    group_count: Counter = Counter()

    city_counts: Counter = Counter()
    dup_map: Dict[str, set] = {}
    total_rows = 0
    missing_age = 0
    missing_height = 0
    missing_year = 0
    age_outside = 0
    height_outside = 0

    def parse_float(value: str | None) -> float | None:
        if value is None:
            return None
        value = str(value).strip()
        if value == "":
            return None
        try:
            return float(value)
        except Exception:
            return None

    for row in iter_rows(crew_path):
        total_rows += 1
        city = (row.get("res_city_clean") or "").strip()
        city_counts[city] += 1
        norm = normalize_city(city)
        dup_map.setdefault(norm, set()).add(city)
        group = assign_group(norm)

        age_val = parse_float(row.get("age_num"))
        height_val = parse_float(row.get("height_total_inches"))
        if age_val is None:
            missing_age += 1
        if height_val is None:
            missing_height += 1
        if age_val is None or height_val is None:
            continue

        age = age_val
        height = height_val

        if age < 10 or age > 70:
            age_outside += 1
        if height < 55 or height > 75:
            height_outside += 1

        group_count[group] += 1
        group_age[group].append(age)
        group_height[group].append(height)
        age_all.append(age)
        height_all.append(height)

        year_str = str(row.get("list_date", ""))[:4]
        if year_str.isdigit():
            year_all.append(int(year_str))
            group_all.append(group)
            age_year.append(age)
            height_year.append(height)
        else:
            missing_year += 1

    age_arr = np.array(age_all)
    height_arr = np.array(height_all)

    audit = {
        "rows": int(len(age_arr)),
        "total_rows": int(total_rows),
        "missing_age": int(missing_age),
        "missing_height": int(missing_height),
        "missing_year": int(missing_year),
        "age_range": [int(np.min(age_arr)), int(np.max(age_arr))],
        "height_range": [float(np.min(height_arr)), float(np.max(height_arr))],
        "age_outside_10_70": int(age_outside),
        "height_outside_55_75": int(height_outside),
        "age_heaping_0_5": float(np.mean((age_arr % 5) == 0)),
        "unique_res_city_clean": int(len(city_counts)),
    }

    audit["duplicate_examples"] = [
        sorted(list(vals))
        for norm, vals in dup_map.items()
        if len(vals) > 1 and norm in {"new bedford", "fairhaven", "new london", "fogo cape verde"}
    ]

    non_city = [
        "Germany",
        "Azores",
        "Cape Verde",
        "Brava",
        "Fayal",
        "Flores",
        "Pico, Azores",
        "Sao Jorge, Azores",
        "Saint Helena",
        "Madeira",
        "Bermuda",
        "Barbados",
    ]
    audit["non_city_counts"] = {k: int(city_counts.get(k, 0)) for k in non_city if k in city_counts}

    audit["age_summary"] = summarize_group(age_arr, height_arr, len(age_arr))
    audit["height_summary"] = {
        "mean": audit["age_summary"]["height_mean"],
        "median": audit["age_summary"]["height_median"],
        "std": audit["age_summary"]["height_std"],
        "iqr": audit["age_summary"]["height_iqr"],
        "lt64": audit["age_summary"]["height_lt64"],
        "ge70": audit["age_summary"]["height_ge70"],
    }

    # group summaries
    group_stats = []
    for group, ages in group_age.items():
        heights = group_height[group]
        stats = summarize_group(np.array(ages), np.array(heights), group_count[group])
        stats["group"] = group
        stats["label"] = GROUP_LABELS.get(group, group)
        group_stats.append(stats)
    group_stats = sorted(group_stats, key=lambda d: -d["N"])

    # distributions
    age_bins = list(range(10, 71))
    height_bins = list(range(50, 81))
    age_dist = {}
    height_dist = {}
    for group in group_age.keys():
        age_dist[group] = compute_hist(np.array(group_age[group]), age_bins)
        height_dist[group] = compute_hist(np.array(group_height[group]), height_bins)

    # distance stats
    pairs = [
        ("core_south_coast", "atlantic_islands"),
        ("core_south_coast", "germany"),
        ("ct_ports", "atlantic_islands"),
        ("atlantic_cities", "core_south_coast"),
    ]
    pair_stats = []
    for g1, g2 in pairs:
        if g1 not in group_age or g2 not in group_age:
            continue
        x = np.array(group_age[g1])
        y = np.array(group_age[g2])
        if len(x) < 50 or len(y) < 50:
            continue
        row = {
            "pair": f"{g1} vs {g2}",
            "age_ks": ks_statistic(x, y),
            "age_wass": wasserstein(x, y),
        }
        xh = np.array(group_height[g1])
        yh = np.array(group_height[g2])
        row["height_ks"] = ks_statistic(xh, yh)
        row["height_wass"] = wasserstein(xh, yh)
        pair_stats.append(row)

    def ols_with_dummies(values: np.ndarray, years: List[int], groups: List[str], ref: str = "core_south_coast"):
        y = np.array(values, dtype=float)
        year = np.array(years, dtype=float)
        grp = np.array(groups)
        mask = ~np.isnan(y)
        y = y[mask]
        year = year[mask]
        grp = grp[mask]
        unique_groups = sorted({g for g in grp if g != ref})
        X = [np.ones(len(y)), year]
        cols = ["intercept", "year"]
        for g in unique_groups:
            X.append((grp == g).astype(int))
            cols.append(g)
        X = np.column_stack(X)
        beta = np.linalg.lstsq(X, y, rcond=None)[0]
        return dict(zip(cols, beta)), len(y)

    age_coef, age_n = ols_with_dummies(np.array(age_year), year_all, group_all)
    height_coef, height_n = ols_with_dummies(np.array(height_year), year_all, group_all)

    crew_summary = {
        "audit": audit,
        "groups": group_stats,
        "labels": GROUP_LABELS,
        "ageBins": age_bins,
        "heightBins": height_bins,
        "ageDistributions": age_dist,
        "heightDistributions": height_dist,
        "pairStats": pair_stats,
        "regression": {
            "age": {"coefficients": age_coef, "N": age_n},
            "height": {"coefficients": height_coef, "N": height_n},
        },
    }

    data = load_data_js()
    data["crewSummary"] = crew_summary
    write_data_js(data)

    print("Updated data.js with crewSummary")


if __name__ == "__main__":
    main()
