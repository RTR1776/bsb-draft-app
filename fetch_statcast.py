#!/usr/bin/env python3
"""
Fetch real Statcast/FanGraphs advanced stats for all 600 players in the draft app.
Run this locally on your machine (not in the cloud sandbox).

Requirements:
  pip install pybaseball pandas

Usage:
  python fetch_statcast.py

This will:
1. Load the player list from src/data/batters.json and src/data/pitchers.json
2. Fetch Statcast + FanGraphs leaderboard data for 2022-2025
3. Match players by FanGraphs ID (or name fallback)
4. Output src/data/advancedStats.json in the exact format the app expects

Takes ~2-5 minutes depending on your connection.
"""

import json
import os
import sys
import time
import warnings
from pathlib import Path

import pandas as pd

warnings.filterwarnings("ignore")

# Determine project root (where this script lives)
SCRIPT_DIR = Path(__file__).resolve().parent
BATTERS_JSON = SCRIPT_DIR / "src" / "data" / "batters.json"
PITCHERS_JSON = SCRIPT_DIR / "src" / "data" / "pitchers.json"
OUTPUT_JSON = SCRIPT_DIR / "src" / "data" / "advancedStats.json"

YEARS = [2022, 2023, 2024, 2025]


def load_players():
    """Load player lists from the app's JSON files."""
    with open(BATTERS_JSON) as f:
        batters = json.load(f)
    with open(PITCHERS_JSON) as f:
        pitchers = json.load(f)
    return batters, pitchers


def fetch_statcast_batters(year: int) -> pd.DataFrame:
    """Fetch Baseball Savant expected stats for batters."""
    from pybaseball import statcast_batter_expected_stats
    print(f"  Fetching Statcast batter expected stats {year}...")
    try:
        df = statcast_batter_expected_stats(year, minpa=50)
        if df is not None and not df.empty:
            print(f"    Got {len(df)} batters")
            return df
    except Exception as e:
        print(f"    Warning: statcast_batter_expected_stats failed: {e}")
    return pd.DataFrame()


def fetch_statcast_pitchers(year: int) -> pd.DataFrame:
    """Fetch Baseball Savant expected stats for pitchers."""
    from pybaseball import statcast_pitcher_expected_stats
    print(f"  Fetching Statcast pitcher expected stats {year}...")
    try:
        df = statcast_pitcher_expected_stats(year, minpa=50)
        if df is not None and not df.empty:
            print(f"    Got {len(df)} pitchers")
            return df
    except Exception as e:
        print(f"    Warning: statcast_pitcher_expected_stats failed: {e}")
    return pd.DataFrame()


def fetch_fg_batters(year: int) -> pd.DataFrame:
    """Fetch FanGraphs batting leaderboard (includes wRC+, K%, BB%, BABIP, etc.)."""
    from pybaseball import fg_batting_data
    print(f"  Fetching FanGraphs batting data {year}...")
    try:
        df = fg_batting_data(year, qual=50)
        if df is not None and not df.empty:
            print(f"    Got {len(df)} batters")
            return df
    except Exception as e:
        print(f"    Warning: fg_batting_data failed: {e}")
    return pd.DataFrame()


def fetch_fg_pitchers(year: int) -> pd.DataFrame:
    """Fetch FanGraphs pitching leaderboard (includes K%, BB%, FIP, Stuff+, etc.)."""
    from pybaseball import fg_pitching_data
    print(f"  Fetching FanGraphs pitching data {year}...")
    try:
        df = fg_pitching_data(year, qual=20)
        if df is not None and not df.empty:
            print(f"    Got {len(df)} pitchers")
            return df
    except Exception as e:
        print(f"    Warning: fg_pitching_data failed: {e}")
    return pd.DataFrame()


def safe_float(val, default=None):
    """Safely convert to float."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    try:
        return round(float(val), 3)
    except (ValueError, TypeError):
        return default


def safe_int(val, default=None):
    """Safely convert to int."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    try:
        return int(round(float(val)))
    except (ValueError, TypeError):
        return default


def find_statcast_col(df, candidates):
    """Find the first matching column name from a list of candidates."""
    for c in candidates:
        if c in df.columns:
            return c
        # Case-insensitive match
        for col in df.columns:
            if col.lower() == c.lower():
                return col
    return None


def build_batter_year_stats(fg_row, sc_row) -> dict:
    """
    Build a BatterYearStats dict from FanGraphs + Statcast data.

    Batter stat keys:
      exit_velo, barrel_pct, hard_hit_pct, launch_angle, xba, xslg,
      sprint_speed, k_pct, bb_pct, wrc_plus, babip, whiff_pct, chase_rate
    """
    stats = {}

    # --- From Statcast expected stats ---
    if sc_row is not None:
        stats["exit_velo"] = safe_float(sc_row.get("avg_hit_speed") or sc_row.get("exit_velocity"))
        stats["barrel_pct"] = safe_float(sc_row.get("brl_percent") or sc_row.get("barrel_batted_rate"))
        stats["hard_hit_pct"] = safe_float(sc_row.get("hard_hit_percent") or sc_row.get("ev95percent"))
        stats["launch_angle"] = safe_float(sc_row.get("avg_launch_angle") or sc_row.get("launch_angle"))
        stats["xba"] = safe_float(sc_row.get("est_ba") or sc_row.get("xba"))
        stats["xslg"] = safe_float(sc_row.get("est_slg") or sc_row.get("xslg"))
        stats["sprint_speed"] = safe_float(sc_row.get("sprint_speed"))
        stats["whiff_pct"] = safe_float(sc_row.get("whiff_percent") or sc_row.get("whiff_pct"))
        stats["chase_rate"] = safe_float(sc_row.get("oz_swing_percent") or sc_row.get("chase_rate") or sc_row.get("chase_percent"))

    # --- From FanGraphs ---
    if fg_row is not None:
        # K% and BB% from FanGraphs (more reliable)
        k_pct = fg_row.get("K%") or fg_row.get("SO%") or fg_row.get("k_pct")
        if k_pct is not None:
            val = safe_float(k_pct)
            if val is not None:
                # FanGraphs sometimes returns as decimal (0.25) or percentage (25.0)
                stats["k_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        bb_pct = fg_row.get("BB%") or fg_row.get("bb_pct")
        if bb_pct is not None:
            val = safe_float(bb_pct)
            if val is not None:
                stats["bb_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        wrc = fg_row.get("wRC+") or fg_row.get("WRC+") or fg_row.get("wrc_plus")
        if wrc is not None:
            stats["wrc_plus"] = safe_int(wrc)

        babip = fg_row.get("BABIP") or fg_row.get("babip")
        if babip is not None:
            stats["babip"] = safe_float(babip)

        # Fallbacks if Statcast didn't have them
        if "exit_velo" not in stats or stats["exit_velo"] is None:
            stats["exit_velo"] = safe_float(fg_row.get("EV") or fg_row.get("exit_velo"))
        if "barrel_pct" not in stats or stats["barrel_pct"] is None:
            stats["barrel_pct"] = safe_float(fg_row.get("Barrel%") or fg_row.get("barrel_pct"))
        if "hard_hit_pct" not in stats or stats["hard_hit_pct"] is None:
            stats["hard_hit_pct"] = safe_float(fg_row.get("HardHit%") or fg_row.get("hard_hit_pct"))
        if "launch_angle" not in stats or stats["launch_angle"] is None:
            stats["launch_angle"] = safe_float(fg_row.get("LA") or fg_row.get("launch_angle"))
        if "whiff_pct" not in stats or stats["whiff_pct"] is None:
            stats["whiff_pct"] = safe_float(fg_row.get("SwStr%") or fg_row.get("Whiff%"))
            if stats.get("whiff_pct") and stats["whiff_pct"] < 1:
                stats["whiff_pct"] = round(stats["whiff_pct"] * 100, 1)
        if "chase_rate" not in stats or stats["chase_rate"] is None:
            stats["chase_rate"] = safe_float(fg_row.get("O-Swing%") or fg_row.get("chase_rate"))
            if stats.get("chase_rate") and stats["chase_rate"] < 1:
                stats["chase_rate"] = round(stats["chase_rate"] * 100, 1)

    # Fill missing with None
    required = ["exit_velo", "barrel_pct", "hard_hit_pct", "launch_angle", "xba", "xslg",
                "sprint_speed", "k_pct", "bb_pct", "wrc_plus", "babip", "whiff_pct", "chase_rate"]
    for key in required:
        if key not in stats or stats[key] is None:
            stats[key] = None

    # If we got basically nothing, return None
    non_null = sum(1 for v in stats.values() if v is not None)
    if non_null < 3:
        return None

    return stats


def build_pitcher_year_stats(fg_row, sc_row) -> dict:
    """
    Build a PitcherYearStats dict from FanGraphs + Statcast data.

    Pitcher stat keys:
      fb_velo, spin_rate, whiff_pct, k_pct, bb_pct, csw_pct,
      stuff_plus, location_plus, xera, fip,
      barrel_against, hard_hit_against, gb_pct, chase_rate
    """
    stats = {}

    # --- From Statcast ---
    if sc_row is not None:
        stats["xera"] = safe_float(sc_row.get("est_era") or sc_row.get("xera"))
        stats["barrel_against"] = safe_float(sc_row.get("brl_percent") or sc_row.get("barrel_batted_rate"))
        stats["hard_hit_against"] = safe_float(sc_row.get("hard_hit_percent") or sc_row.get("ev95percent"))
        stats["whiff_pct"] = safe_float(sc_row.get("whiff_percent") or sc_row.get("whiff_pct"))
        stats["chase_rate"] = safe_float(sc_row.get("oz_swing_percent") or sc_row.get("chase_rate") or sc_row.get("chase_percent"))
        stats["fb_velo"] = safe_float(sc_row.get("avg_hit_speed"))  # This is exit velo against, not fb velo

    # --- From FanGraphs ---
    if fg_row is not None:
        # Velocity
        fb_velo = fg_row.get("FBv") or fg_row.get("vFA (pi)") or fg_row.get("FB%_velo") or fg_row.get("fbv")
        if fb_velo is not None:
            stats["fb_velo"] = safe_float(fb_velo)

        # Spin
        spin = fg_row.get("Spin Rate") or fg_row.get("spin_rate")
        if spin is not None:
            stats["spin_rate"] = safe_int(spin)

        # K% and BB%
        k_pct = fg_row.get("K%") or fg_row.get("SO%") or fg_row.get("k_pct")
        if k_pct is not None:
            val = safe_float(k_pct)
            if val is not None:
                stats["k_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        bb_pct = fg_row.get("BB%") or fg_row.get("bb_pct")
        if bb_pct is not None:
            val = safe_float(bb_pct)
            if val is not None:
                stats["bb_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        # CSW%
        csw = fg_row.get("CSW%") or fg_row.get("csw_pct") or fg_row.get("CStr%")
        if csw is not None:
            val = safe_float(csw)
            if val is not None:
                stats["csw_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        # Stuff+ and Location+
        stuff = fg_row.get("Stuff+") or fg_row.get("stuff_plus")
        if stuff is not None:
            stats["stuff_plus"] = safe_int(stuff)

        loc = fg_row.get("Location+") or fg_row.get("location_plus")
        if loc is not None:
            stats["location_plus"] = safe_int(loc)

        # FIP
        fip = fg_row.get("FIP") or fg_row.get("fip")
        if fip is not None:
            stats["fip"] = safe_float(fip)

        # GB%
        gb = fg_row.get("GB%") or fg_row.get("gb_pct")
        if gb is not None:
            val = safe_float(gb)
            if val is not None:
                stats["gb_pct"] = round(val * 100, 1) if val < 1 else round(val, 1)

        # Fallbacks
        if "xera" not in stats or stats["xera"] is None:
            stats["xera"] = safe_float(fg_row.get("xERA"))
        if "whiff_pct" not in stats or stats["whiff_pct"] is None:
            stats["whiff_pct"] = safe_float(fg_row.get("SwStr%") or fg_row.get("Whiff%"))
            if stats.get("whiff_pct") and stats["whiff_pct"] < 1:
                stats["whiff_pct"] = round(stats["whiff_pct"] * 100, 1)
        if "chase_rate" not in stats or stats["chase_rate"] is None:
            stats["chase_rate"] = safe_float(fg_row.get("O-Swing%") or fg_row.get("chase_rate"))
            if stats.get("chase_rate") and stats["chase_rate"] < 1:
                stats["chase_rate"] = round(stats["chase_rate"] * 100, 1)
        if "barrel_against" not in stats or stats["barrel_against"] is None:
            stats["barrel_against"] = safe_float(fg_row.get("Barrel%"))
        if "hard_hit_against" not in stats or stats["hard_hit_against"] is None:
            stats["hard_hit_against"] = safe_float(fg_row.get("HardHit%"))

    # Fill missing with None
    required = ["fb_velo", "spin_rate", "whiff_pct", "k_pct", "bb_pct", "csw_pct",
                "stuff_plus", "location_plus", "xera", "fip",
                "barrel_against", "hard_hit_against", "gb_pct", "chase_rate"]
    for key in required:
        if key not in stats or stats[key] is None:
            stats[key] = None

    # If we got basically nothing, return None
    non_null = sum(1 for v in stats.values() if v is not None)
    if non_null < 3:
        return None

    return stats


def normalize_name(name: str) -> str:
    """Normalize player name for fuzzy matching."""
    import unicodedata
    # Remove accents
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return name.lower().strip().replace(".", "").replace("'", "").replace("-", " ")


def main():
    print("=" * 60)
    print("BSB Draft App - Statcast Data Fetcher")
    print("=" * 60)

    # Check pybaseball is installed
    try:
        import pybaseball
        # Disable caching to avoid stale data
        pybaseball.cache.enable()
        print(f"pybaseball version: {pybaseball.__version__}")
    except ImportError:
        print("ERROR: pybaseball not installed. Run: pip install pybaseball")
        sys.exit(1)

    # Load players
    print("\nLoading player lists...")
    batters, pitchers = load_players()
    print(f"  {len(batters)} batters, {len(pitchers)} pitchers")

    # ─── Fetch all data ───
    print("\n" + "=" * 60)
    print("Fetching data from Baseball Savant + FanGraphs...")
    print("This may take a few minutes.\n")

    sc_bat_data = {}  # year -> DataFrame
    sc_pit_data = {}
    fg_bat_data = {}
    fg_pit_data = {}

    for year in YEARS:
        print(f"\n--- {year} ---")
        sc_bat_data[year] = fetch_statcast_batters(year)
        time.sleep(1)  # Be nice to the servers
        sc_pit_data[year] = fetch_statcast_pitchers(year)
        time.sleep(1)
        fg_bat_data[year] = fetch_fg_batters(year)
        time.sleep(1)
        fg_pit_data[year] = fetch_fg_pitchers(year)
        time.sleep(1)

    # ─── Build lookup indexes ───
    print("\n" + "=" * 60)
    print("Building player lookup indexes...")

    def build_index(df, id_col_candidates, name_col_candidates):
        """Build a dict: fangraphs_id -> row_dict, and a name->row_dict fallback."""
        by_id = {}
        by_name = {}
        if df is None or df.empty:
            return by_id, by_name

        # Find the ID column
        id_col = None
        for c in id_col_candidates:
            if c in df.columns:
                id_col = c
                break
            for col in df.columns:
                if col.lower() == c.lower():
                    id_col = col
                    break
            if id_col:
                break

        # Find the name column
        name_col = None
        for c in name_col_candidates:
            if c in df.columns:
                name_col = c
                break
            for col in df.columns:
                if col.lower() == c.lower():
                    name_col = col
                    break
            if name_col:
                break

        for _, row in df.iterrows():
            row_dict = row.to_dict()
            if id_col and pd.notna(row.get(id_col)):
                key = str(int(row[id_col])) if isinstance(row[id_col], (int, float)) else str(row[id_col])
                by_id[key] = row_dict
            if name_col and pd.notna(row.get(name_col)):
                nname = normalize_name(str(row[name_col]))
                by_name[nname] = row_dict

        return by_id, by_name

    id_cols = ["IDfg", "idfg", "playerid", "player_id", "fg_id", "xMLBAMID", "mlbamid"]
    name_cols = ["Name", "name", "last_name, first_name", "player_name", "PlayerName"]

    # Indexes per year
    sc_bat_idx = {}
    sc_pit_idx = {}
    fg_bat_idx = {}
    fg_pit_idx = {}

    for year in YEARS:
        # Statcast uses mlbam IDs - we'll match by name
        sc_bat_idx[year] = build_index(sc_bat_data[year], ["player_id", "mlbamid"], name_cols + ["player_name", "last_name, first_name"])
        sc_pit_idx[year] = build_index(sc_pit_data[year], ["player_id", "mlbamid"], name_cols + ["player_name", "last_name, first_name"])
        fg_bat_idx[year] = build_index(fg_bat_data[year], id_cols, name_cols)
        fg_pit_idx[year] = build_index(fg_pit_data[year], id_cols, name_cols)

    # ─── Match players and build output ───
    print("\nMatching players to Statcast/FanGraphs data...")

    def find_player_row(player_id, player_name, idx_by_id, idx_by_name):
        """Look up a player by FG ID first, then by name."""
        # Try FG ID
        if player_id in idx_by_id:
            return idx_by_id[player_id]
        # Try name
        nname = normalize_name(player_name)
        if nname in idx_by_name:
            return idx_by_name[nname]
        # Try partial name match (last name)
        parts = nname.split()
        if len(parts) >= 2:
            last = parts[-1]
            for key, row in idx_by_name.items():
                if key.endswith(last) or last in key:
                    # Verify first initial matches
                    if key.startswith(parts[0][0]):
                        return row
        return None

    output_batters = []
    matched_bat = 0
    for batter in batters:
        entry = {
            "id": batter["id"],
            "name": batter["name"],
            "team": batter["team"],
            "pos": batter.get("pos", batter.get("positions", ["DH"])[0] if batter.get("positions") else "DH"),
            "age": batter.get("age", 0),
            "fpts": batter.get("fpts", 0),
        }

        has_any = False
        for year in YEARS:
            fg_row = find_player_row(batter["id"], batter["name"], fg_bat_idx[year][0], fg_bat_idx[year][1])
            sc_row = find_player_row(batter["id"], batter["name"], sc_bat_idx[year][0], sc_bat_idx[year][1])

            if fg_row or sc_row:
                year_stats = build_batter_year_stats(fg_row, sc_row)
                entry[str(year)] = year_stats
                if year_stats:
                    has_any = True
            else:
                entry[str(year)] = None

        if has_any:
            matched_bat += 1
        output_batters.append(entry)

    output_pitchers = []
    matched_pit = 0
    for pitcher in pitchers:
        entry = {
            "id": pitcher["id"],
            "name": pitcher["name"],
            "team": pitcher["team"],
            "role": pitcher.get("role", "SP"),
            "age": pitcher.get("age", 0),
            "fpts": pitcher.get("fpts", 0),
        }

        has_any = False
        for year in YEARS:
            fg_row = find_player_row(pitcher["id"], pitcher["name"], fg_pit_idx[year][0], fg_pit_idx[year][1])
            sc_row = find_player_row(pitcher["id"], pitcher["name"], sc_pit_idx[year][0], sc_pit_idx[year][1])

            if fg_row or sc_row:
                year_stats = build_pitcher_year_stats(fg_row, sc_row)
                entry[str(year)] = year_stats
                if year_stats:
                    has_any = True
            else:
                entry[str(year)] = None

        if has_any:
            matched_pit += 1
        output_pitchers.append(entry)

    # ─── Write output ───
    output = {"batters": output_batters, "pitchers": output_pitchers}

    print(f"\n{'=' * 60}")
    print(f"Results:")
    print(f"  Batters matched:  {matched_bat}/{len(batters)}")
    print(f"  Pitchers matched: {matched_pit}/{len(pitchers)}")

    # Year breakdown
    for year in YEARS:
        bat_year = sum(1 for b in output_batters if b.get(str(year)) is not None)
        pit_year = sum(1 for p in output_pitchers if p.get(str(year)) is not None)
        print(f"  {year}: {bat_year} batters, {pit_year} pitchers with data")

    with open(OUTPUT_JSON, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    file_size = os.path.getsize(OUTPUT_JSON)
    print(f"\nWrote {OUTPUT_JSON}")
    print(f"File size: {file_size / 1024:.0f} KB")
    print(f"\nDone! Now run 'npx next build' to verify the app builds correctly.")


if __name__ == "__main__":
    main()
