#!/usr/bin/env python3
"""
BSB Draft App — Custom Projection Engine & RP Strategy Analysis

Builds BSB-specific projections by blending 3-year game-log actuals (weighted
50/30/20) with Steamer projections, adjusted for age curves and injury history.
Also computes per-player consistency grades and runs a full RP vs SP roster
mix simulation across 78 weeks of actual data.

Run:  python scripts/generate_projections.py
Output: src/data/projections.json, src/data/rpStrategy.json
"""

import json
import urllib.request
import os
import time
import math
from datetime import datetime, timedelta
from collections import defaultdict
from statistics import mean, median, stdev

# =============================================================================
# CONFIG
# =============================================================================
SEASONS = [2022, 2023, 2024]
YEAR_WEIGHTS = {2024: 5, 2023: 3, 2022: 2}  # 50/30/20
BLEND_FACTORS = {3: 0.60, 2: 0.45, 1: 0.30, 0: 0.0}  # years -> hist weight

# Expected full-season games
EXPECTED_GAMES = {'batter': 155, 'SP': 31, 'RP': 65}

ACTIVE_PITCHERS = 9  # BSB pitching staff size

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache', 'gamelogs')
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# =============================================================================
# BSB SCORING — PER GAME (identical to generate_weekly_variance.py)
# =============================================================================
def calc_game_batter_fpts(s):
    """BSB batting FPTS from a single MLB Stats API game log stat dict."""
    h = s.get('hits', 0) or 0
    d = s.get('doubles', 0) or 0
    t = s.get('triples', 0) or 0
    hr = s.get('homeRuns', 0) or 0
    singles = h - d - t - hr
    tb = singles + 2 * d + 3 * t + 4 * hr
    r = s.get('runs', 0) or 0
    rbi = s.get('rbi', 0) or 0
    bb = s.get('baseOnBalls', 0) or 0
    sb = s.get('stolenBases', 0) or 0
    return round(r + tb + bb + rbi + sb, 1)


def calc_game_pitcher_fpts(s):
    """BSB pitching FPTS from a single MLB Stats API game log stat dict."""
    ip_str = s.get('inningsPitched', '0')
    ip = float(ip_str) if ip_str else 0
    er = s.get('earnedRuns', 0) or 0
    so = s.get('strikeOuts', 0) or 0
    bb = s.get('baseOnBalls', 0) or 0
    w = s.get('wins', 0) or 0
    sv = s.get('saves', 0) or 0
    h = s.get('hits', 0) or 0
    hld = s.get('holds', 0) or 0
    gs = s.get('gamesStarted', 0) or 0
    cg = s.get('completeGames', 0) or 0
    qs = 1 if (gs == 1 and ip >= 6.0 and er <= 3) else 0
    ir = s.get('inheritedRunners', 0) or 0
    irs = s.get('inheritedRunnersScored', 0) or 0
    irstr = max(0, ir - irs)
    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irstr * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
        1
    )


# =============================================================================
# AGE CURVE ADJUSTMENTS
# =============================================================================
def batter_age_adj(age):
    if age is None:
        return 1.0
    if age <= 23: return 0.92
    if age <= 25: return 0.97
    if age <= 29: return 1.00
    if age <= 31: return 0.97
    if age <= 33: return 0.93
    if age <= 35: return 0.88
    return 0.82


def pitcher_age_adj(age, role='SP'):
    if age is None:
        return 1.0
    if role == 'RP':
        if age <= 24: return 0.94
        if age <= 26: return 0.98
        if age <= 30: return 1.00
        if age <= 33: return 0.96
        if age <= 35: return 0.91
        return 0.85
    else:  # SP
        if age <= 24: return 0.93
        if age <= 27: return 0.98
        if age <= 29: return 1.00
        if age <= 31: return 0.96
        if age <= 33: return 0.91
        if age <= 35: return 0.85
        return 0.78


def age_curve_label(age, is_pitcher):
    if age is None:
        return 'Unknown'
    if is_pitcher:
        if age <= 24: return 'Pre-Peak'
        if age <= 29: return 'Peak'
        if age <= 33: return 'Declining'
        return 'Late Career'
    else:
        if age <= 25: return 'Pre-Peak'
        if age <= 29: return 'Peak'
        if age <= 33: return 'Declining'
        return 'Late Career'


# =============================================================================
# FANGRAPHS — RESOLVE MLBAM IDs
# =============================================================================
def resolve_mlbam_ids(batters_json, pitchers_json):
    """Fetch FanGraphs Steamer to build FG playerid -> xMLBAMID mapping."""
    print("Fetching FanGraphs Steamer projections for MLBAM ID resolution...")

    bat_raw = fetch_json(
        "https://www.fangraphs.com/api/projections"
        "?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all"
    )
    pit_raw = fetch_json(
        "https://www.fangraphs.com/api/projections"
        "?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all"
    )

    # Build FG playerid -> xMLBAMID map
    fg_to_mlbam = {}
    for b in bat_raw:
        pid = str(b.get('playerid', ''))
        mlbam = b.get('xMLBAMID')
        if pid and mlbam:
            fg_to_mlbam[pid] = int(mlbam)

    for p in pit_raw:
        pid = str(p.get('playerid', ''))
        mlbam = p.get('xMLBAMID')
        if pid and mlbam:
            fg_to_mlbam[pid] = int(mlbam)

    # Also build name -> mlbam for fallback matching
    name_to_mlbam = {}
    for b in bat_raw:
        name = b.get('PlayerName', '').strip()
        mlbam = b.get('xMLBAMID')
        if name and mlbam:
            name_to_mlbam[name.lower()] = int(mlbam)
    for p in pit_raw:
        name = p.get('PlayerName', '').strip()
        mlbam = p.get('xMLBAMID')
        if name and mlbam:
            name_to_mlbam[name.lower()] = int(mlbam)

    # Match players from our JSON data
    matched = 0
    unmatched = []
    all_players = []

    for b in batters_json:
        mlbam = fg_to_mlbam.get(b['id'])
        if not mlbam:
            mlbam = name_to_mlbam.get(b['name'].lower())
        if mlbam:
            all_players.append({**b, 'mlbam_id': mlbam, 'player_type': 'batter'})
            matched += 1
        else:
            unmatched.append(b['name'])
            all_players.append({**b, 'mlbam_id': None, 'player_type': 'batter'})

    for p in pitchers_json:
        mlbam = fg_to_mlbam.get(p['id'])
        if not mlbam:
            mlbam = name_to_mlbam.get(p['name'].lower())
        if mlbam:
            all_players.append({**p, 'mlbam_id': mlbam, 'player_type': 'pitcher'})
            matched += 1
        else:
            unmatched.append(p['name'])
            all_players.append({**p, 'mlbam_id': None, 'player_type': 'pitcher'})

    print(f"  Matched {matched}/{len(all_players)} players to MLBAM IDs")
    if unmatched:
        print(f"  Unmatched ({len(unmatched)}): {', '.join(unmatched[:10])}{'...' if len(unmatched) > 10 else ''}")

    return all_players


# =============================================================================
# GAME LOG FETCHING (cache-aware, reuses variance pipeline cache)
# =============================================================================
def fetch_game_log(mlbam_id, season, group):
    """Fetch game log for a player/season/group. Uses disk cache."""
    cache_key = f"{mlbam_id}_{season}_{group}"
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.json")

    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)

    url = (
        f"https://statsapi.mlb.com/api/v1/people/{mlbam_id}/stats"
        f"?stats=gameLog&season={season}&group={group}"
    )
    try:
        data = fetch_json(url)
        games = []
        for stat_group in data.get('stats', []):
            for split in stat_group.get('splits', []):
                date_str = split.get('date', '')
                stat = split.get('stat', {})
                if date_str and stat:
                    games.append({'date': date_str, 'stat': stat})
        with open(cache_path, 'w') as f:
            json.dump(games, f, separators=(',', ':'))
        return games
    except Exception:
        return []


def fetch_all_game_logs(players):
    """Fetch game logs for all players across all seasons.

    Returns dict keyed by player 'id' (not mlbam_id) to avoid collisions
    when a player appears in both batters and pitchers (e.g., Ohtani).
    """
    players_with_id = [p for p in players if p.get('mlbam_id')]
    total = len(players_with_id) * len(SEASONS)
    done = 0
    fetched_new = 0

    print(f"\nFetching game logs ({total} player-seasons, cache-aware)...")

    logs = {}  # player_id -> {season -> [games]}
    for p in players_with_id:
        pid = p['id']  # unique player ID from JSON (avoids Ohtani collision)
        mid = p['mlbam_id']
        group = 'pitching' if p['player_type'] == 'pitcher' else 'hitting'
        logs[pid] = {}
        for season in SEASONS:
            cache_path = os.path.join(CACHE_DIR, f"{mid}_{season}_{group}.json")
            was_cached = os.path.exists(cache_path)
            games = fetch_game_log(mid, season, group)
            logs[pid][season] = games
            done += 1
            if not was_cached:
                fetched_new += 1
                time.sleep(0.25)  # rate limit only for new fetches
        if done % 75 == 0:
            print(f"  {done}/{total} processed ({fetched_new} new fetches)...")

    print(f"  ✅ {done}/{total} game logs processed ({fetched_new} new API calls)")
    return logs


# =============================================================================
# COMPUTE EXACT SEASON FPTS FROM GAME LOGS
# =============================================================================
def compute_season_fpts(games, calc_fn):
    """Sum per-game BSB FPTS for a season."""
    total = 0.0
    for g in games:
        total += calc_fn(g['stat'])
    return round(total, 1)


def compute_games_played(games, is_sp=False):
    """Count games played (or games started for SP)."""
    if is_sp:
        return sum(1 for g in games if (g['stat'].get('gamesStarted', 0) or 0) >= 1)
    return len(games)


# =============================================================================
# WEEKLY AGGREGATION FOR CONSISTENCY
# =============================================================================
def get_week_start(date_str):
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime('%Y-%m-%d')


def compute_player_weekly_cv(all_games, calc_fn, min_games_per_week=1, min_weeks=10):
    """Compute weekly CV for a player across all seasons."""
    weeks = defaultdict(lambda: {'fpts': 0.0, 'games': 0})
    for g in all_games:
        fpts = calc_fn(g['stat'])
        week = get_week_start(g['date'])
        weeks[week]['fpts'] += fpts
        weeks[week]['games'] += 1

    weekly_vals = [w['fpts'] for w in weeks.values() if w['games'] >= min_games_per_week]

    if len(weekly_vals) < min_weeks:
        return None, None, None

    m = mean(weekly_vals)
    sd = stdev(weekly_vals)
    cv = round(sd / m, 3) if m > 0 else 0
    return round(m, 1), round(sd, 1), cv


def consistency_grade(score):
    if score >= 75: return 'A'
    if score >= 55: return 'B'
    if score >= 35: return 'C'
    if score >= 15: return 'D'
    return 'F'


# =============================================================================
# PROJECTION ENGINE
# =============================================================================
def compute_projections(players, game_logs):
    """Compute BSB custom projections for all players."""
    print("\nComputing BSB custom projections...")

    results = {}  # player id -> projection data

    for p in players:
        pid = p['id']
        is_pitcher = p['player_type'] == 'pitcher'
        calc_fn = calc_game_pitcher_fpts if is_pitcher else calc_game_batter_fpts
        role = p.get('role', 'SP') if is_pitcher else 'batter'
        age = p.get('age')
        steamer_fpts = p.get('fpts', 0)

        # --- Exact historical FPTS from game logs ---
        hist_exact = {}
        games_played = {}
        all_games = []

        if pid in game_logs:
            for season in SEASONS:
                season_games = game_logs[pid].get(season, [])
                if season_games:
                    hist_exact[str(season)] = compute_season_fpts(season_games, calc_fn)
                    is_sp = (role == 'SP')
                    games_played[str(season)] = compute_games_played(season_games, is_sp)
                    all_games.extend(season_games)

        # --- Weighted historical average ---
        years_with_data = len(hist_exact)
        if years_with_data > 0:
            weighted_sum = 0
            weight_total = 0
            for yr_str, fpts_val in hist_exact.items():
                yr = int(yr_str)
                w = YEAR_WEIGHTS.get(yr, 1)
                weighted_sum += fpts_val * w
                weight_total += w
            hist_weighted = weighted_sum / weight_total if weight_total > 0 else 0
        else:
            hist_weighted = 0

        # --- Blend with Steamer ---
        blend = BLEND_FACTORS.get(years_with_data, 0.0)
        raw_proj = (hist_weighted * blend) + (steamer_fpts * (1 - blend))

        # --- Age adjustment ---
        if is_pitcher:
            age_adj = pitcher_age_adj(age, role)
        else:
            age_adj = batter_age_adj(age)

        # --- Injury / Health adjustment ---
        expected = EXPECTED_GAMES.get(role, 155)
        health_pcts = []
        for yr_str in ['2022', '2023', '2024']:
            gp = games_played.get(yr_str)
            if gp is not None:
                health_pcts.append(min(1.0, gp / expected))

        avg_health = mean(health_pcts) if health_pcts else 1.0

        # For players with only 1 year of data, be less aggressive with
        # health penalties — they might be rookies, not injured veterans
        if years_with_data <= 1:
            # Only flag if that single year was genuinely short
            health_adj = min(1.0, 0.85 + (avg_health * 0.15))
        else:
            health_adj = min(1.0, 0.7 + (avg_health * 0.3))

        # Injury flag — require 2+ years of data for SEVERE/MODERATE
        if years_with_data <= 1:
            # With limited data, only flag if clearly short season
            if avg_health >= 0.70:
                injury_flag = 'HEALTHY'
            elif avg_health >= 0.45:
                injury_flag = 'MINOR'
            else:
                injury_flag = 'MODERATE'
        else:
            if avg_health >= 0.90:
                injury_flag = 'HEALTHY'
            elif avg_health >= 0.75:
                injury_flag = 'MINOR'
            elif avg_health >= 0.55:
                injury_flag = 'MODERATE'
            else:
                injury_flag = 'SEVERE'

        # --- Final projection ---
        bsb_fpts = round(raw_proj * age_adj * health_adj, 1)
        bsb_delta = round(bsb_fpts - steamer_fpts, 1)

        # --- Consistency metrics ---
        if is_pitcher:
            weekly_mean, weekly_sd, weekly_cv = compute_player_weekly_cv(
                all_games, calc_fn, min_games_per_week=1, min_weeks=10
            )
        else:
            weekly_mean, weekly_sd, weekly_cv = compute_player_weekly_cv(
                all_games, calc_fn, min_games_per_week=3, min_weeks=15
            )

        # Consistency score (0-100, higher = more consistent)
        if weekly_cv is not None:
            if is_pitcher:
                con_score = round(max(0, min(100, (1.30 - weekly_cv) / 0.80 * 100)))
            else:
                con_score = round(max(0, min(100, (0.70 - weekly_cv) / 0.35 * 100)))
            con_grade = consistency_grade(con_score)
        else:
            con_score = None
            con_grade = None

        # --- Age curve label ---
        age_label = age_curve_label(age, is_pitcher)

        results[pid] = {
            'bsbFpts': bsb_fpts,
            'bsbDelta': bsb_delta,
            'projectionYears': years_with_data,
            'histExact': hist_exact,
            'injuryFlag': injury_flag,
            'healthPct': round(avg_health, 3),
            'gamesPlayed': games_played,
            'weeklyCV': weekly_cv,
            'weeklyMean': weekly_mean,
            'consistencyGrade': con_grade,
            'consistencyScore': con_score,
            'ageCurve': age_label,
            'ageAdj': age_adj,
        }

    print(f"  ✅ Computed projections for {len(results)} players")
    return results


# =============================================================================
# RP STRATEGY ANALYSIS
# =============================================================================
def percentile(data, p):
    if not data:
        return 0
    s = sorted(data)
    k = (len(s) - 1) * (p / 100)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def analyze_rp_strategy(pitchers_json, game_logs, players):
    """Full RP vs SP strategy analysis with weekly simulation."""
    print("\nRunning RP strategy analysis...")

    # Separate SP and RP from pitchers_json
    sp_list = [p for p in pitchers_json if p.get('role') == 'SP']
    rp_list = [p for p in pitchers_json if p.get('role') == 'RP']

    print(f"  {len(sp_list)} SP, {len(rp_list)} RP in pitcher pool")

    # Build player id set for pitchers with game logs
    pitcher_ids_with_logs = set()
    for p in players:
        if p['player_type'] == 'pitcher' and p['id'] in game_logs:
            pitcher_ids_with_logs.add(p['id'])

    # --- Season total FPTS by role ---
    sp_season_fpts = sorted([p['fpts'] for p in sp_list], reverse=True)
    rp_season_fpts = sorted([p['fpts'] for p in rp_list], reverse=True)

    # --- RP tier breakdown ---
    closers = [p for p in rp_list if (p.get('sv', 0) or 0) >= 15]
    setup = [p for p in rp_list if (p.get('sv', 0) or 0) < 15 and (p.get('hld', 0) or 0) >= 8]
    middle = [p for p in rp_list if p not in closers and p not in setup]

    def tier_stats(group, label):
        if not group:
            return {'count': 0, 'avgFpts': 0, 'avgIP': 0, 'avgFptsPerIP': 0}
        avg_fpts = round(mean([p['fpts'] for p in group]), 1)
        avg_ip = round(mean([p.get('ip', 0) or 0 for p in group]), 1)
        fpts_per_ip = round(avg_fpts / avg_ip, 2) if avg_ip > 0 else 0

        result = {
            'count': len(group),
            'avgFpts': avg_fpts,
            'avgIP': avg_ip,
            'avgFptsPerIP': fpts_per_ip,
        }

        # Add role-specific point sources
        if label == 'closers':
            result['avgSvPts'] = round(mean([(p.get('sv', 0) or 0) * 8 for p in group]), 1)
        elif label == 'setup':
            result['avgHldPts'] = round(mean([(p.get('hld', 0) or 0) * 6 for p in group]), 1)

        return result

    rp_tiers = {
        'closers': tier_stats(closers, 'closers'),
        'setup': tier_stats(setup, 'setup'),
        'middle': tier_stats(middle, 'middle'),
    }

    # --- SP vs RP efficiency comparison ---
    sp_with_ip = [p for p in sp_list if (p.get('ip', 0) or 0) > 0]
    rp_with_ip = [p for p in rp_list if (p.get('ip', 0) or 0) > 0]

    sp_avg_fpts = round(mean([p['fpts'] for p in sp_with_ip[:30]]), 1) if sp_with_ip else 0
    sp_avg_ip = round(mean([p.get('ip', 0) or 0 for p in sp_with_ip[:30]]), 1) if sp_with_ip else 0
    rp_avg_fpts = round(mean([p['fpts'] for p in rp_with_ip[:30]]), 1) if rp_with_ip else 0
    rp_avg_ip = round(mean([p.get('ip', 0) or 0 for p in rp_with_ip[:30]]), 1) if rp_with_ip else 0

    sp_fpts_per_ip = round(sp_avg_fpts / sp_avg_ip, 2) if sp_avg_ip > 0 else 0
    rp_fpts_per_ip = round(rp_avg_fpts / rp_avg_ip, 2) if rp_avg_ip > 0 else 0

    sp_vs_rp = {
        'spAvgFpts': sp_avg_fpts,
        'spAvgIP': sp_avg_ip,
        'spAvgFptsPerIP': sp_fpts_per_ip,
        'rpAvgFpts': rp_avg_fpts,
        'rpAvgIP': rp_avg_ip,
        'rpAvgFptsPerIP': rp_fpts_per_ip,
    }

    # --- Weekly simulation across 78 weeks ---
    print("  Simulating weekly roster configurations...")

    # Build per-player weekly data from game logs (keyed by player id)
    sp_weekly = {}  # player_id -> {week -> fpts}
    rp_weekly = {}

    for p in sp_list:
        pid = p['id']
        if pid not in game_logs:
            continue
        weeks = defaultdict(float)
        for season in SEASONS:
            for g in game_logs[pid].get(season, []):
                fpts = calc_game_pitcher_fpts(g['stat'])
                week = get_week_start(g['date'])
                weeks[week] += fpts
        if weeks:
            sp_weekly[pid] = {w: round(v, 1) for w, v in weeks.items()}

    for p in rp_list:
        pid = p['id']
        if pid not in game_logs:
            continue
        weeks = defaultdict(float)
        for season in SEASONS:
            for g in game_logs[pid].get(season, []):
                fpts = calc_game_pitcher_fpts(g['stat'])
                week = get_week_start(g['date'])
                weeks[week] += fpts
        if weeks:
            rp_weekly[pid] = {w: round(v, 1) for w, v in weeks.items()}

    # Collect all weeks
    all_weeks = set()
    for pw in sp_weekly.values():
        all_weeks.update(pw.keys())
    for pw in rp_weekly.values():
        all_weeks.update(pw.keys())
    all_weeks = sorted(all_weeks)

    print(f"  {len(all_weeks)} weeks of data, {len(sp_weekly)} SP, {len(rp_weekly)} RP with game logs")

    # Roster configurations to simulate
    configs = [
        {'name': '9 SP', 'sp': 9, 'rp': 0},
        {'name': '8 SP + 1 CL', 'sp': 8, 'rp': 1, 'rp_detail': '1 Closer'},
        {'name': '7 SP + 2 RP', 'sp': 7, 'rp': 2, 'rp_detail': '1 CL + 1 Setup'},
        {'name': '6 SP + 3 RP', 'sp': 6, 'rp': 3, 'rp_detail': '2 CL + 1 Setup'},
        {'name': '5 SP + 4 RP', 'sp': 5, 'rp': 4, 'rp_detail': '2 CL + 2 Setup'},
        {'name': '4 SP + 5 RP', 'sp': 4, 'rp': 5, 'rp_detail': '2 CL + 3 Setup'},
        {'name': '9 RP', 'sp': 0, 'rp': 9},
    ]

    config_results = []

    for cfg in configs:
        n_sp = cfg['sp']
        n_rp = cfg['rp']
        weekly_totals = []

        for week in all_weeks:
            # Get all SP weekly FPTS for this week, sorted descending
            sp_fpts_list = sorted(
                [pw.get(week, 0) for pw in sp_weekly.values()],
                reverse=True
            )
            rp_fpts_list = sorted(
                [pw.get(week, 0) for pw in rp_weekly.values()],
                reverse=True
            )

            # Take top N SP + top M RP
            sp_total = sum(sp_fpts_list[:n_sp]) if n_sp > 0 else 0
            rp_total = sum(rp_fpts_list[:n_rp]) if n_rp > 0 else 0
            weekly_totals.append(round(sp_total + rp_total, 1))

        if len(weekly_totals) >= 2:
            m = mean(weekly_totals)
            sd = stdev(weekly_totals)
            config_results.append({
                'name': cfg['name'],
                'sp': n_sp,
                'rp': n_rp,
                'detail': cfg.get('rp_detail', ''),
                'seasonFpts': round(sum(weekly_totals) / len(SEASONS), 0),
                'weeklyMean': round(m, 1),
                'weeklyMedian': round(median(weekly_totals), 1),
                'weeklyCV': round(sd / m, 3) if m > 0 else 0,
                'weeklyP10': round(percentile(weekly_totals, 10), 1),
                'weeklyP90': round(percentile(weekly_totals, 90), 1),
                'weeklyMin': round(min(weekly_totals), 1),
                'weeklyMax': round(max(weekly_totals), 1),
            })

    # Rank configs by weekly mean (primary) with CV tiebreak
    config_results.sort(key=lambda x: (-x['weeklyMean'], x['weeklyCV']))
    for i, c in enumerate(config_results):
        c['rank'] = i + 1

    # --- Determine recommendation ---
    # Best config balances high mean with reasonable CV
    # Score = weeklyMean - (weeklyCV * 100)  # penalize high variance
    best = max(config_results, key=lambda x: x['weeklyMean'] - (x['weeklyCV'] * 80))

    # --- Key insights ---
    insights = []
    if sp_fpts_per_ip > 0 and rp_fpts_per_ip > 0:
        insights.append(
            f"SP produce {sp_fpts_per_ip} FPTS/IP vs {rp_fpts_per_ip} for RP — "
            f"RPs are {round(rp_fpts_per_ip/sp_fpts_per_ip, 1)}x more efficient per inning"
        )
    if sp_avg_ip > 0 and rp_avg_ip > 0:
        insights.append(
            f"But SP average {sp_avg_ip} IP vs {rp_avg_ip} for RP — "
            f"{round(sp_avg_ip/rp_avg_ip, 1)}x more volume"
        )
    if rp_tiers['closers']['count'] > 0:
        insights.append(
            f"Top closers generate {rp_tiers['closers'].get('avgSvPts', 0):.0f} FPTS from saves alone "
            f"({rp_tiers['closers']['avgFpts']:.0f} total)"
        )
    if len(config_results) >= 2:
        top2 = config_results[:2]
        insights.append(
            f"Best config: {top2[0]['name']} ({top2[0]['weeklyMean']:.1f} avg/wk, CV={top2[0]['weeklyCV']:.3f})"
        )

    recommendation = {
        'config': best['name'],
        'detail': best.get('detail', ''),
        'weeklyMean': best['weeklyMean'],
        'weeklyCV': best['weeklyCV'],
        'rationale': (
            f"{best['name']} maximizes weekly production ({best['weeklyMean']:.1f} avg FPTS/week) "
            f"while maintaining reasonable consistency (CV={best['weeklyCV']:.3f}). "
            f"SP volume (IP×3 + K + QS + W bonuses) dominates season totals, but "
            f"{'adding elite RPs provides SV/HLD points that SPs cannot generate, diversifying FPTS sources.' if best['rp'] > 0 else 'pure SP maximizes volume-based scoring.'}"
        ),
    }

    print(f"  ✅ Recommendation: {best['name']}")

    return {
        'meta': {
            'generated': datetime.now().isoformat(),
            'seasons': SEASONS,
            'nSP': len(sp_list),
            'nRP': len(rp_list),
            'weeksAnalyzed': len(all_weeks),
        },
        'recommendation': recommendation,
        'configs': config_results,
        'rpTiers': rp_tiers,
        'spVsRpComparison': sp_vs_rp,
        'keyInsights': insights,
    }


# =============================================================================
# MAIN
# =============================================================================
def main():
    print("=" * 60)
    print("  BSB Custom Projection Engine")
    print("=" * 60)

    # Load existing player data
    print("\nLoading player data...")
    with open(os.path.join(DATA_DIR, 'batters.json')) as f:
        batters_json = json.load(f)
    with open(os.path.join(DATA_DIR, 'pitchers.json')) as f:
        pitchers_json = json.load(f)
    print(f"  {len(batters_json)} batters, {len(pitchers_json)} pitchers loaded")

    # Resolve MLBAM IDs via FanGraphs
    all_players = resolve_mlbam_ids(batters_json, pitchers_json)

    # Fetch game logs for all players
    game_logs = fetch_all_game_logs(all_players)

    # Compute projections
    projections = compute_projections(all_players, game_logs)

    # RP Strategy analysis
    rp_strategy = analyze_rp_strategy(pitchers_json, game_logs, all_players)

    # --- Write projections.json ---
    proj_output = {
        'meta': {
            'generated': datetime.now().isoformat(),
            'seasons': SEASONS,
            'weights': YEAR_WEIGHTS,
            'blendFactors': BLEND_FACTORS,
            'nBatters': len(batters_json),
            'nPitchers': len(pitchers_json),
        },
        'players': projections,
    }

    proj_path = os.path.join(OUTPUT_DIR, 'projections.json')
    with open(proj_path, 'w') as f:
        json.dump(proj_output, f, separators=(',', ':'))
    proj_size = os.path.getsize(proj_path) // 1024
    print(f"\n  Wrote {proj_path} ({proj_size}KB)")

    # --- Write rpStrategy.json ---
    rp_path = os.path.join(OUTPUT_DIR, 'rpStrategy.json')
    with open(rp_path, 'w') as f:
        json.dump(rp_strategy, f, separators=(',', ':'))
    rp_size = os.path.getsize(rp_path) // 1024
    print(f"  Wrote {rp_path} ({rp_size}KB)")

    # --- Console Summary ---
    print(f"\n{'=' * 60}")
    print(f"  PROJECTION SUMMARY")
    print(f"{'=' * 60}")

    # Top 10 biggest BSB vs Steamer deltas (positive)
    sorted_proj = sorted(projections.items(), key=lambda x: x[1]['bsbDelta'], reverse=True)
    print(f"\n  Top 10 BSB > Steamer (biggest positive delta):")
    count = 0
    for pid, proj in sorted_proj:
        if count >= 10:
            break
        name = next((p['name'] for p in all_players if p['id'] == pid), '?')
        print(f"    {name:25s}  BSB={proj['bsbFpts']:>7.1f}  Steamer={proj['bsbFpts']-proj['bsbDelta']:>7.1f}  Δ={proj['bsbDelta']:>+6.1f}")
        count += 1

    # Top 10 biggest negative deltas
    print(f"\n  Top 10 BSB < Steamer (biggest negative delta):")
    count = 0
    for pid, proj in reversed(sorted_proj):
        if count >= 10:
            break
        name = next((p['name'] for p in all_players if p['id'] == pid), '?')
        print(f"    {name:25s}  BSB={proj['bsbFpts']:>7.1f}  Steamer={proj['bsbFpts']-proj['bsbDelta']:>7.1f}  Δ={proj['bsbDelta']:>+6.1f}")
        count += 1

    # Injury flags
    injury_counts = defaultdict(int)
    for proj in projections.values():
        injury_counts[proj['injuryFlag']] += 1
    print(f"\n  Injury Flags: {dict(injury_counts)}")

    # Consistency grades
    grade_counts = defaultdict(int)
    for proj in projections.values():
        g = proj.get('consistencyGrade')
        if g:
            grade_counts[g] += 1
    print(f"  Consistency Grades: {dict(sorted(grade_counts.items()))}")

    # Age curve distribution
    age_counts = defaultdict(int)
    for proj in projections.values():
        age_counts[proj.get('ageCurve', 'Unknown')] += 1
    print(f"  Age Curves: {dict(age_counts)}")

    # RP Strategy
    print(f"\n  RP STRATEGY RESULTS:")
    print(f"  {'Config':20s} {'Mean/Wk':>8s} {'CV':>6s} {'P10':>6s} {'P90':>6s} {'Rank':>5s}")
    print(f"  {'-'*50}")
    for c in rp_strategy['configs']:
        marker = ' ◀' if c['name'] == rp_strategy['recommendation']['config'] else ''
        print(f"  {c['name']:20s} {c['weeklyMean']:>8.1f} {c['weeklyCV']:>6.3f} {c['weeklyP10']:>6.1f} {c['weeklyP90']:>6.1f} {c['rank']:>5d}{marker}")

    print(f"\n  Recommendation: {rp_strategy['recommendation']['config']}")
    print(f"  {rp_strategy['recommendation']['rationale']}")

    print(f"\n✅ Done!")


if __name__ == '__main__':
    main()
