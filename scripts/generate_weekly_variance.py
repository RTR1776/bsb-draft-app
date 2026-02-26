#!/usr/bin/env python3
"""
BSB Draft App — Weekly Variance Analysis
Fetches 3-year (2022-2024) game-log data from MLB Stats API, applies BSB
scoring per game, groups into weeks, and computes hitting vs pitching
weekly variance analysis.

Run: python scripts/generate_weekly_variance.py
Output: src/data/weeklyVariance.json
"""

import json
import urllib.request
import os
import time
import math
import hashlib
from datetime import datetime, timedelta
from collections import defaultdict
from statistics import mean, median, stdev

# =============================================================================
# CONFIG
# =============================================================================
SEASONS = [2022, 2023, 2024]
TOP_N_BATTERS = 50
TOP_N_PITCHERS = 50
ACTIVE_BATTERS = 10   # BSB lineup: C,1B,2B,SS,3B,3OF,DH,U
ACTIVE_PITCHERS = 9   # BSB pitching staff

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache', 'gamelogs')
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# =============================================================================
# BSB SCORING — PER GAME
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
    """BSB pitching FPTS from a single MLB Stats API game log stat dict.

    Key advantage over seasonal estimates: QS, CG, IRSTR computed exactly.
    """
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

    # QS: exact computation from game stats
    qs = 1 if (gs == 1 and ip >= 6.0 and er <= 3) else 0

    # IRSTR: from actual inherited runner data (relievers)
    ir = s.get('inheritedRunners', 0) or 0
    irs = s.get('inheritedRunnersScored', 0) or 0
    irstr = max(0, ir - irs)

    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irstr * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
        1
    )


# =============================================================================
# FANGRAPHS — GET PLAYER LIST WITH MLB IDS
# =============================================================================
def get_player_ids():
    """Fetch FanGraphs Steamer projections to get top players + xMLBAMID."""
    print("Fetching FanGraphs Steamer projections for player IDs...")

    bat_raw = fetch_json(
        "https://www.fangraphs.com/api/projections"
        "?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all"
    )
    pit_raw = fetch_json(
        "https://www.fangraphs.com/api/projections"
        "?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all"
    )

    # Process batters — same scoring as generate_data.py
    batters = []
    for b in bat_raw:
        pa = b.get('PA', 0) or 0
        if pa < 100:
            continue
        mlbam = b.get('xMLBAMID')
        if not mlbam:
            continue
        r = b.get('R', 0) or 0
        rbi = b.get('RBI', 0) or 0
        bb = b.get('BB', 0) or 0
        sb = b.get('SB', 0) or 0
        s = b.get('1B', 0) or 0
        d = b.get('2B', 0) or 0
        t = b.get('3B', 0) or 0
        hr = b.get('HR', 0) or 0
        tb = s + 2*d + 3*t + 4*hr
        fpts = round(r + tb + bb + rbi + sb, 1)
        batters.append({
            'name': b['PlayerName'], 'mlbam_id': int(mlbam),
            'fpts': fpts, 'type': 'bat',
        })
    batters.sort(key=lambda x: x['fpts'], reverse=True)

    # Process pitchers
    batter_ids = set(b['mlbam_id'] for b in batters)
    pitchers = []
    for p in pit_raw:
        ip = p.get('IP', 0) or 0
        if ip < 20:
            continue
        mlbam = p.get('xMLBAMID')
        if not mlbam or int(mlbam) in batter_ids:
            continue
        gs = p.get('GS', 0) or 0
        g = p.get('G', 0) or 0
        role = 'SP' if gs > g * 0.5 else 'RP'
        # Calc FPTS same as generate_data.py
        er = p.get('ER', 0) or 0
        so = p.get('SO', 0) or 0
        bb = p.get('BB', 0) or 0
        w = p.get('W', 0) or 0
        sv = p.get('SV', 0) or 0
        hld = p.get('HLD', 0) or 0
        h = p.get('H', 0) or 0
        qs_est = round(gs * 0.55)
        cg_est = round(gs * 0.02)
        relief_apps = g - gs
        irstr_est = round(relief_apps * 0.45 * 0.70, 1)
        fpts = round(
            (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
            (sv * 8) + (irstr_est * 2) + (qs_est * 4) + (cg_est * 5) +
            (h * -1) + (hld * 6), 1
        )
        pitchers.append({
            'name': p['PlayerName'], 'mlbam_id': int(mlbam),
            'fpts': fpts, 'role': role, 'type': 'pit',
        })
    pitchers.sort(key=lambda x: x['fpts'], reverse=True)

    top_bat = batters[:TOP_N_BATTERS]
    top_pit = pitchers[:TOP_N_PITCHERS]

    print(f"  Top {len(top_bat)} batters, top {len(top_pit)} pitchers selected")
    return top_bat, top_pit


# =============================================================================
# MLB STATS API — GAME LOGS
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

        # Cache to disk
        with open(cache_path, 'w') as f:
            json.dump(games, f, separators=(',', ':'))
        return games
    except Exception as e:
        # Return empty on error (player might not have played that season)
        return []


def fetch_all_game_logs(batters, pitchers):
    """Fetch game logs for all players across all seasons."""
    total = (len(batters) + len(pitchers)) * len(SEASONS)
    done = 0

    print(f"\nFetching game logs ({total} requests, ~{total * 0.3:.0f}s)...")

    bat_logs = {}  # mlbam_id -> {season -> [games]}
    for b in batters:
        bat_logs[b['mlbam_id']] = {}
        for season in SEASONS:
            games = fetch_game_log(b['mlbam_id'], season, 'hitting')
            bat_logs[b['mlbam_id']][season] = games
            done += 1
            time.sleep(0.2)
        if done % 30 == 0:
            print(f"  {done}/{total} fetched...")

    pit_logs = {}
    for p in pitchers:
        pit_logs[p['mlbam_id']] = {}
        for season in SEASONS:
            games = fetch_game_log(p['mlbam_id'], season, 'pitching')
            pit_logs[p['mlbam_id']][season] = games
            done += 1
            time.sleep(0.2)
        if done % 30 == 0:
            print(f"  {done}/{total} fetched...")

    print(f"  ✅ {done}/{total} game logs fetched")
    return bat_logs, pit_logs


# =============================================================================
# WEEKLY AGGREGATION
# =============================================================================
def get_week_start(date_str):
    """Return the Monday of the week for a given date string (YYYY-MM-DD)."""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime('%Y-%m-%d')


def build_player_weekly(games, calc_fpts_fn):
    """Group games into weeks and sum FPTS per week."""
    weeks = defaultdict(lambda: {'fpts': 0.0, 'games': 0})
    for g in games:
        fpts = calc_fpts_fn(g['stat'])
        week = get_week_start(g['date'])
        weeks[week]['fpts'] += fpts
        weeks[week]['games'] += 1
    # Round FPTS
    for w in weeks.values():
        w['fpts'] = round(w['fpts'], 1)
    return dict(weeks)


def build_sp_start_data(games):
    """Track individual SP starts and count starts per week."""
    weeks = defaultdict(lambda: {'starts': 0, 'fpts': 0.0})
    for g in games:
        stat = g['stat']
        gs = stat.get('gamesStarted', 0) or 0
        if gs == 1:
            week = get_week_start(g['date'])
            fpts = calc_game_pitcher_fpts(stat)
            weeks[week]['starts'] += 1
            weeks[week]['fpts'] += fpts
    for w in weeks.values():
        w['fpts'] = round(w['fpts'], 1)
    return dict(weeks)


# =============================================================================
# TEAM-LEVEL SIMULATION
# =============================================================================
def simulate_team_weeks(player_weekly_data, n_active):
    """
    For each week, take the top-N players by that week's FPTS
    to simulate a BSB team's active lineup total.
    Returns list of weekly team FPTS values.
    """
    # Collect all weeks
    all_weeks = set()
    for pw in player_weekly_data.values():
        all_weeks.update(pw.keys())

    team_weeks = []
    for week in sorted(all_weeks):
        # Get all players' FPTS this week
        player_fpts = []
        for pid, pw in player_weekly_data.items():
            if week in pw:
                player_fpts.append(pw[week]['fpts'])
        # Sort descending, take top N
        player_fpts.sort(reverse=True)
        team_total = sum(player_fpts[:n_active])
        team_weeks.append(round(team_total, 1))

    return team_weeks


# =============================================================================
# STATISTICAL ANALYSIS
# =============================================================================
def percentile(data, p):
    """Compute the p-th percentile of data."""
    if not data:
        return 0
    s = sorted(data)
    k = (len(s) - 1) * (p / 100)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def distribution_summary(data):
    """Compute full distribution summary for a list of values."""
    if len(data) < 2:
        return {'mean': 0, 'median': 0, 'stdev': 0, 'cv': 0,
                'min': 0, 'max': 0, 'p10': 0, 'p25': 0, 'p75': 0, 'p90': 0,
                'count': len(data)}
    m = mean(data)
    sd = stdev(data)
    return {
        'mean': round(m, 1),
        'median': round(median(data), 1),
        'stdev': round(sd, 1),
        'cv': round(sd / m, 3) if m > 0 else 0,
        'min': round(min(data), 1),
        'max': round(max(data), 1),
        'p10': round(percentile(data, 10), 1),
        'p25': round(percentile(data, 25), 1),
        'p75': round(percentile(data, 75), 1),
        'p90': round(percentile(data, 90), 1),
        'count': len(data),
    }


def build_histogram(hit_data, pit_data, bin_width=25):
    """Build aligned histogram bins for hitting and pitching data."""
    all_vals = hit_data + pit_data
    if not all_vals:
        return {'bins': [], 'hitting': [], 'pitching': []}
    lo = int(math.floor(min(all_vals) / bin_width) * bin_width)
    hi = int(math.ceil(max(all_vals) / bin_width) * bin_width)

    bins = []
    hit_counts = []
    pit_counts = []
    for edge in range(lo, hi, bin_width):
        label = f"{edge}-{edge + bin_width}"
        bins.append(label)
        hit_counts.append(sum(1 for v in hit_data if edge <= v < edge + bin_width))
        pit_counts.append(sum(1 for v in pit_data if edge <= v < edge + bin_width))

    return {'bins': bins, 'hitting': hit_counts, 'pitching': pit_counts}


# =============================================================================
# MAIN
# =============================================================================
def main():
    batters, pitchers = get_player_ids()
    bat_logs, pit_logs = fetch_all_game_logs(batters, pitchers)

    # --- Build player weekly data ---
    print("\nProcessing weekly aggregations...")

    # Batters: weekly FPTS per player per season
    bat_weekly_all = {}     # mlbam_id -> {week -> {fpts, games}}
    bat_weekly_by_year = defaultdict(dict)  # season -> {mlbam_id -> {week -> ...}}
    for b in batters:
        mid = b['mlbam_id']
        combined = {}
        for season in SEASONS:
            games = bat_logs.get(mid, {}).get(season, [])
            weekly = build_player_weekly(games, calc_game_batter_fpts)
            combined.update(weekly)
            bat_weekly_by_year[season][mid] = weekly
        bat_weekly_all[mid] = combined

    # Pitchers: weekly FPTS per player per season
    pit_weekly_all = {}
    pit_weekly_by_year = defaultdict(dict)
    for p in pitchers:
        mid = p['mlbam_id']
        combined = {}
        for season in SEASONS:
            games = pit_logs.get(mid, {}).get(season, [])
            weekly = build_player_weekly(games, calc_game_pitcher_fpts)
            combined.update(weekly)
            pit_weekly_by_year[season][mid] = weekly
        pit_weekly_all[mid] = combined

    # --- Team-level weekly simulation ---
    print("Simulating team-level weekly totals...")

    # Combined across all years
    team_hit_weeks = simulate_team_weeks(bat_weekly_all, ACTIVE_BATTERS)
    team_pit_weeks = simulate_team_weeks(pit_weekly_all, ACTIVE_PITCHERS)

    # Per year
    team_hit_by_year = {}
    team_pit_by_year = {}
    for season in SEASONS:
        team_hit_by_year[season] = simulate_team_weeks(
            bat_weekly_by_year[season], ACTIVE_BATTERS)
        team_pit_by_year[season] = simulate_team_weeks(
            pit_weekly_by_year[season], ACTIVE_PITCHERS)

    # --- 2-Start SP Analysis ---
    print("Analyzing two-start pitcher effect...")

    one_start_fpts = []   # individual SP weekly FPTS in 1-start weeks
    two_start_fpts = []   # individual SP weekly FPTS in 2-start weeks
    sp_players = [p for p in pitchers if p.get('role') == 'SP']

    for p in sp_players:
        mid = p['mlbam_id']
        for season in SEASONS:
            games = pit_logs.get(mid, {}).get(season, [])
            sp_weeks = build_sp_start_data(games)
            for week, data in sp_weeks.items():
                if data['starts'] == 1:
                    one_start_fpts.append(data['fpts'])
                elif data['starts'] >= 2:
                    two_start_fpts.append(data['fpts'])

    # --- Player Consistency ---
    print("Computing player consistency metrics...")

    # Batters
    bat_consistency = []
    for b in batters:
        mid = b['mlbam_id']
        weekly_vals = [w['fpts'] for w in bat_weekly_all.get(mid, {}).values()
                       if w['games'] >= 3]  # min 3 games in a week to count
        weekly_games = [w['games'] for w in bat_weekly_all.get(mid, {}).values()
                        if w['games'] >= 3]
        if len(weekly_vals) >= 20:  # need enough weeks
            m = mean(weekly_vals)
            sd = stdev(weekly_vals)
            bat_consistency.append({
                'name': b['name'],
                'meanWeekly': round(m, 1),
                'stdev': round(sd, 1),
                'cv': round(sd / m, 3) if m > 0 else 0,
                'gamesPerWeek': round(mean(weekly_games), 1),
                'weeksPlayed': len(weekly_vals),
            })

    # Pitchers
    pit_consistency = []
    for p in pitchers:
        mid = p['mlbam_id']
        weekly_vals = [w['fpts'] for w in pit_weekly_all.get(mid, {}).values()
                       if w['games'] >= 1]
        if len(weekly_vals) >= 20:
            m = mean(weekly_vals)
            sd = stdev(weekly_vals)
            pit_consistency.append({
                'name': p['name'],
                'role': p.get('role', '?'),
                'meanWeekly': round(m, 1),
                'stdev': round(sd, 1),
                'cv': round(sd / m, 3) if m > 0 else 0,
                'weeksPlayed': len(weekly_vals),
            })

    # Sort by CV
    bat_by_cv = sorted(bat_consistency, key=lambda x: x['cv'])
    pit_by_cv = sorted(pit_consistency, key=lambda x: x['cv'])

    # --- Draft Implications ---
    hit_summary = distribution_summary(team_hit_weeks)
    pit_summary = distribution_summary(team_pit_weeks)

    variance_ratio = round(pit_summary['cv'] / hit_summary['cv'], 2) if hit_summary['cv'] > 0 else 0

    one_start_summary = distribution_summary(one_start_fpts) if one_start_fpts else None
    two_start_summary = distribution_summary(two_start_fpts) if two_start_fpts else None
    boost = round(two_start_summary['mean'] - one_start_summary['mean'], 1) if (one_start_summary and two_start_summary) else 0
    boost_pct = round((boost / one_start_summary['mean']) * 100, 1) if (one_start_summary and one_start_summary['mean'] > 0) else 0

    key_insights = []
    key_insights.append(
        f"Pitching weekly variance is {variance_ratio}× higher than hitting "
        f"(CV: {pit_summary['cv']:.3f} vs {hit_summary['cv']:.3f})"
    )
    key_insights.append(
        f"Team hitting ranges from {hit_summary['p10']:.0f} to {hit_summary['p90']:.0f} FPTS/week "
        f"(80% of weeks). Pitching ranges {pit_summary['p10']:.0f} to {pit_summary['p90']:.0f}."
    )
    if two_start_summary:
        key_insights.append(
            f"Two-start SP weeks average {two_start_summary['mean']:.1f} FPTS vs "
            f"{one_start_summary['mean']:.1f} for one-start — a {boost_pct:.0f}% boost."
        )
    key_insights.append(
        "In ranked scoring, hitting consistency produces steadier week-to-week rank placement. "
        "Pitching volatility means more extreme outcomes — more top-1 and bottom-1 finishes."
    )
    key_insights.append(
        "Draft implication: invest in a strong hitting floor first, then add high-upside pitching. "
        "A consistent hitting base protects against pitching bust weeks."
    )

    # --- Build Output ---
    print("\nBuilding output...")

    output = {
        'meta': {
            'generated': datetime.now().isoformat(),
            'seasons': SEASONS,
            'nBatters': len(batters),
            'nPitchers': len(pitchers),
            'activeBatters': ACTIVE_BATTERS,
            'activePitchers': ACTIVE_PITCHERS,
            'totalWeeks': len(team_hit_weeks),
        },
        'combined': {
            'hitting': hit_summary,
            'pitching': pit_summary,
        },
        'byYear': {},
        'histogram': build_histogram(team_hit_weeks, team_pit_weeks),
        'twoStartEffect': {
            'oneStart': one_start_summary,
            'twoStart': two_start_summary,
            'boost': boost,
            'boostPct': boost_pct,
        },
        'consistency': {
            'mostConsistentBatters': bat_by_cv[:10],
            'leastConsistentBatters': bat_by_cv[-10:][::-1],
            'mostConsistentPitchers': [p for p in pit_by_cv if p.get('role') == 'SP'][:10],
            'leastConsistentPitchers': [p for p in pit_by_cv[::-1] if p.get('role') == 'SP'][:10],
        },
        'draftImplications': {
            'varianceRatio': variance_ratio,
            'hittingFloor': hit_summary['p10'],
            'hittingCeiling': hit_summary['p90'],
            'pitchingFloor': pit_summary['p10'],
            'pitchingCeiling': pit_summary['p90'],
            'keyInsights': key_insights,
        },
    }

    # Per-year breakdowns
    for season in SEASONS:
        h_weeks = team_hit_by_year.get(season, [])
        p_weeks = team_pit_by_year.get(season, [])
        output['byYear'][str(season)] = {
            'hitting': distribution_summary(h_weeks),
            'pitching': distribution_summary(p_weeks),
        }

    # --- Write Output ---
    out_path = os.path.join(OUTPUT_DIR, 'weeklyVariance.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))
    size_kb = len(json.dumps(output)) // 1024
    print(f"\n  Wrote {out_path} ({size_kb}KB)")

    # --- Console Summary ---
    print(f"\n{'='*60}")
    print(f"  WEEKLY VARIANCE ANALYSIS ({SEASONS[0]}-{SEASONS[-1]})")
    print(f"  {len(batters)} batters, {len(pitchers)} pitchers, {len(team_hit_weeks)} weeks")
    print(f"{'='*60}")
    print(f"\n  {'':20s}  {'HITTING':>10s}  {'PITCHING':>10s}")
    print(f"  {'-'*45}")
    print(f"  {'Mean FPTS/week':20s}  {hit_summary['mean']:>10.1f}  {pit_summary['mean']:>10.1f}")
    print(f"  {'Median':20s}  {hit_summary['median']:>10.1f}  {pit_summary['median']:>10.1f}")
    print(f"  {'Std Dev':20s}  {hit_summary['stdev']:>10.1f}  {pit_summary['stdev']:>10.1f}")
    print(f"  {'CV (lower=stable)':20s}  {hit_summary['cv']:>10.3f}  {pit_summary['cv']:>10.3f}")
    print(f"  {'P10 (floor)':20s}  {hit_summary['p10']:>10.1f}  {pit_summary['p10']:>10.1f}")
    print(f"  {'P90 (ceiling)':20s}  {hit_summary['p90']:>10.1f}  {pit_summary['p90']:>10.1f}")
    print(f"  {'Range':20s}  {hit_summary['max']-hit_summary['min']:>10.1f}  {pit_summary['max']-pit_summary['min']:>10.1f}")

    if one_start_summary and two_start_summary:
        print(f"\n  Two-Start SP Effect:")
        print(f"    1-start week: {one_start_summary['mean']:.1f} avg FPTS ({one_start_summary['count']} weeks)")
        print(f"    2-start week: {two_start_summary['mean']:.1f} avg FPTS ({two_start_summary['count']} weeks)")
        print(f"    Boost: +{boost:.1f} FPTS (+{boost_pct:.0f}%)")

    print(f"\n  Variance ratio: Pitching is {variance_ratio}× more volatile than hitting")

    print(f"\n  Most consistent batters (by CV):")
    for p in bat_by_cv[:5]:
        print(f"    {p['name']:25s}  avg={p['meanWeekly']:.1f}/wk  CV={p['cv']:.3f}")
    print(f"\n  Most consistent SP (by CV):")
    for p in [x for x in pit_by_cv if x.get('role') == 'SP'][:5]:
        print(f"    {p['name']:25s}  avg={p['meanWeekly']:.1f}/wk  CV={p['cv']:.3f}")

    print(f"\n✅ Done!")


if __name__ == '__main__':
    main()
