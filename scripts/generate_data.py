#!/usr/bin/env python3
"""
BSB Draft App - Data Pipeline
Pulls projections from FanGraphs Steamer, applies custom BSB scoring,
calculates post-Mini scarcity, fetches player bios & historical stats
from MLB Stats API, and outputs JSON for the webapp.

Run: python scripts/generate_data.py
Output: src/data/*.json
"""

import json
import urllib.request
import os
import math
import time
import random
from collections import Counter

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Historical seasons to pull for player cards
HISTORY_SEASONS = ['2022', '2023', '2024']

# =============================================================================
# BSB CUSTOM SCORING
# =============================================================================
# Batting: R(1) + TB(1) + BB(1) + RBI(1) + SB(1)
# Pitching: IP*3 + K(1) + W(10) + SV(8) + HLD(6) + QS(4) + CG(5) + IRSTR(2)
#           - ER(2) - BB(1) - H(1)

def calc_batter_fpts(b):
    r = b.get('R', 0) or 0
    rbi = b.get('RBI', 0) or 0
    bb = b.get('BB', 0) or 0
    sb = b.get('SB', 0) or 0
    s = b.get('1B', 0) or 0
    d = b.get('2B', 0) or 0
    t = b.get('3B', 0) or 0
    hr = b.get('HR', 0) or 0
    tb = s + 2*d + 3*t + 4*hr
    return round(r + tb + bb + rbi + sb, 1)


def calc_pitcher_fpts(p):
    er = p.get('ER', 0) or 0
    ip = p.get('IP', 0) or 0
    so = p.get('SO', 0) or 0
    bb = p.get('BB', 0) or 0
    w = p.get('W', 0) or 0
    sv = p.get('SV', 0) or 0
    h = p.get('H', 0) or 0
    hld = p.get('HLD', 0) or 0
    qs = p.get('QS', 0) or 0
    gs = p.get('GS', 0) or 0
    g = p.get('G', 0) or 0
    cg = gs * 0.02
    relief_apps = g - gs
    irstr = relief_apps * 0.45 * 0.70  # estimated
    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irstr * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
        1
    )


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def normalize_pos(pos):
    if pos in ('LF', 'CF', 'RF'):
        return 'OF'
    return pos


# =============================================================================
# MLB STATS API — Bio + Historical Stats for Player Cards
# =============================================================================
def calc_historical_batter_fpts(s):
    """Calculate BSB FPTS from MLB Stats API hitting stats dict."""
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


def calc_historical_pitcher_fpts(s):
    """Calculate BSB FPTS from MLB Stats API pitching stats dict."""
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
    g = s.get('gamesPlayed', 0) or 0
    # Estimate QS: ~70% of GS for top starters, ~50% average
    qs = round(gs * 0.55) if gs > 0 else 0
    cg = s.get('completeGames', 0) or 0
    relief_apps = g - gs
    irstr = round(relief_apps * 0.45 * 0.70, 1)
    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irstr * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
        1
    )


def fetch_mlb_bios_and_history(batters, pitchers):
    """
    Fetch bio info (age, bats, throws, height, weight, debut) and
    historical stats (last 3 years of BSB FPTS) from MLB Stats API.
    Enriches player dicts in-place.
    """
    # Build xMLBAMID mapping from FanGraphs data
    # We stored mlbam_id during processing
    all_players = batters + pitchers
    mlb_ids = [p['mlbam_id'] for p in all_players if p.get('mlbam_id')]

    if not mlb_ids:
        print("  ⚠ No MLBAM IDs found, skipping bio/history fetch")
        return

    print(f"  Fetching bios & history for {len(mlb_ids)} players from MLB Stats API...")

    # Batch fetch in groups of 100
    bio_map = {}  # mlbam_id -> { age, bats, throws, ... }
    batch_size = 100

    for i in range(0, len(mlb_ids), batch_size):
        batch = mlb_ids[i:i + batch_size]
        ids_str = ",".join(str(x) for x in batch)
        url = (
            f"https://statsapi.mlb.com/api/v1/people?personIds={ids_str}"
            f"&hydrate=stats(group=[hitting,pitching],type=[yearByYear])"
        )
        try:
            data = fetch_json(url)
            for person in data.get('people', []):
                pid = person.get('id')
                bio = {
                    'age': person.get('currentAge'),
                    'bats': person.get('batSide', {}).get('code'),
                    'throws': person.get('pitchHand', {}).get('code'),
                    'height': person.get('height'),
                    'weight': person.get('weight'),
                    'birthDate': person.get('birthDate'),
                    'mlbDebut': person.get('mlbDebutDate'),
                    'birthCountry': person.get('birthCountry'),
                }
                # Extract historical stats
                hit_history = {}
                pitch_history = {}
                for stat_group in person.get('stats', []):
                    group = stat_group.get('group', {}).get('displayName', '')
                    for split in stat_group.get('splits', []):
                        season = split.get('season', '')
                        # Only MLB stats (sport.id == 1), skip minor leagues
                        sport = split.get('sport', {})
                        if sport and sport.get('id') != 1:
                            continue
                        if season in HISTORY_SEASONS:
                            s = split.get('stat', {})
                            group_lower = group.lower()
                            if group_lower == 'hitting':
                                hit_history[season] = calc_historical_batter_fpts(s)
                            elif group_lower == 'pitching':
                                pitch_history[season] = calc_historical_pitcher_fpts(s)
                bio['hitHistory'] = hit_history
                bio['pitchHistory'] = pitch_history
                bio_map[pid] = bio
        except Exception as e:
            print(f"    ⚠ Error fetching batch {i}-{i+batch_size}: {e}")

        # Be polite to the API
        if i + batch_size < len(mlb_ids):
            time.sleep(0.3)

    # Enrich players
    enriched = 0
    for p in all_players:
        mlbam = p.get('mlbam_id')
        if mlbam and mlbam in bio_map:
            bio = bio_map[mlbam]
            p['age'] = bio.get('age')
            p['bats'] = bio.get('bats')
            p['throws'] = bio.get('throws')
            p['height'] = bio.get('height')
            p['weight'] = bio.get('weight')
            p['mlbDebut'] = bio.get('mlbDebut')
            p['birthCountry'] = bio.get('birthCountry')
            # Historical FPTS — use hitting for batters, pitching for pitchers
            is_pitcher = p.get('pos') == 'P'
            history = bio.get('pitchHistory', {}) if is_pitcher else bio.get('hitHistory', {})
            p['histFpts'] = {yr: history.get(yr) for yr in HISTORY_SEASONS if yr in history}
            enriched += 1

    # Clean up temp field
    for p in all_players:
        p.pop('mlbam_id', None)

    print(f"  ✅ Enriched {enriched}/{len(all_players)} players with bio & history")


# =============================================================================
# FETCH PROJECTIONS
# =============================================================================
def fetch_projections():
    print("Fetching Steamer batting projections...")
    batters_raw = fetch_json(
        "https://www.fangraphs.com/api/projections?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all"
    )
    print(f"  Got {len(batters_raw)} batters")

    print("Fetching Steamer pitching projections...")
    pitchers_raw = fetch_json(
        "https://www.fangraphs.com/api/projections?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all"
    )
    print(f"  Got {len(pitchers_raw)} pitchers")

    return batters_raw, pitchers_raw


# =============================================================================
# PROCESS BATTERS
# =============================================================================
def process_batters(batters_raw):
    results = []
    for b in batters_raw:
        pa = b.get('PA', 0) or 0
        if pa < 100:
            continue
        fpts = calc_batter_fpts(b)
        pos = normalize_pos(b.get('minpos', 'DH'))
        # Handle multi-position designations from FanGraphs
        pos_parts = pos.split('/')
        primary_pos = normalize_pos(pos_parts[0])
        all_positions = list(set(normalize_pos(p) for p in pos_parts))

        results.append({
            'id': str(b.get('playerid', '')),
            'mlbam_id': b.get('xMLBAMID'),  # MLB Stats API ID — used for bio fetch, removed later
            'name': b['PlayerName'],
            'team': b.get('Team', ''),
            'pos': primary_pos,
            'positions': all_positions,
            'fpts': fpts,
            'pa': round(pa),
            'r': round(b.get('R', 0) or 0),
            'hr': round(b.get('HR', 0) or 0),
            'rbi': round(b.get('RBI', 0) or 0),
            'sb': round(b.get('SB', 0) or 0),
            'bb': round(b.get('BB', 0) or 0),
            'avg': round(b.get('AVG', 0) or 0, 3),
            'tb': round(
                (b.get('1B', 0) or 0) + 2 * (b.get('2B', 0) or 0) +
                3 * (b.get('3B', 0) or 0) + 4 * (b.get('HR', 0) or 0)
            ),
            'obp': round(b.get('OBP', 0) or 0, 3),
            'slg': round(b.get('SLG', 0) or 0, 3),
            'ops': round((b.get('OBP', 0) or 0) + (b.get('SLG', 0) or 0), 3),
            'war': round(b.get('WAR', 0) or 0, 1),
            'drafted': False,
            'draftRound': None,
        })
    results.sort(key=lambda x: x['fpts'], reverse=True)
    return results


# =============================================================================
# PROCESS PITCHERS
# =============================================================================
def process_pitchers(pitchers_raw, batter_ids=None):
    """Process pitchers. batter_ids is a set of batter IDs to detect duplicates (e.g. Ohtani)."""
    if batter_ids is None:
        batter_ids = set()
    results = []
    for p in pitchers_raw:
        ip = p.get('IP', 0) or 0
        if ip < 20:
            continue
        fpts = calc_pitcher_fpts(p)
        gs = p.get('GS', 0) or 0
        g = p.get('G', 0) or 0
        role = 'SP' if gs > g * 0.5 else 'RP'
        relief_apps = g - gs
        irstr = round(relief_apps * 0.45 * 0.70, 1)
        bb = round(p.get('BB', 0) or 0)
        h = round(p.get('H', 0) or 0)

        # Calculate WHIP and K/9
        whip = round((h + bb) / ip, 2) if ip > 0 else 0.0
        so = p.get('SO', 0) or 0
        kper9 = round((so / ip) * 9, 1) if ip > 0 else 0.0

        # If this pitcher's ID also exists as a batter (e.g. Ohtani),
        # give the pitcher version a unique ID with 'p' suffix
        pid = str(p.get('playerid', ''))
        if pid in batter_ids:
            pid = pid + 'p'

        results.append({
            'id': pid,
            'mlbam_id': p.get('xMLBAMID'),  # MLB Stats API ID — used for bio fetch, removed later
            'name': p['PlayerName'],
            'team': p.get('Team', ''),
            'role': role,
            'pos': 'P',
            'positions': ['P'],
            'fpts': fpts,
            'ip': round(ip, 1),
            'w': round(p.get('W', 0) or 0, 1),
            'sv': round(p.get('SV', 0) or 0, 1),
            'hld': round(p.get('HLD', 0) or 0, 1),
            'qs': round(p.get('QS', 0) or 0, 1),
            'so': round(p.get('SO', 0) or 0),
            'era': round(p.get('ERA', 0) or 0, 2),
            'whip': whip,
            'kper9': kper9,
            'bb': bb,
            'h': h,
            'irstr': irstr,
            'g': round(g),
            'gs': round(gs),
            'war': round(p.get('WAR', 0) or 0, 1),
            'drafted': False,
            'draftRound': None,
        })
    results.sort(key=lambda x: x['fpts'], reverse=True)
    return results


# =============================================================================
# KDS TEMPLATES
# =============================================================================
TEMPLATES = {
    'A': {'Mini Bat': 1, 'Mini Pitch': 16, 'Mega Pitch': 8, 'Mega OF': 9, 'Mega 1B': 13, 'Mega 2B': 4, 'Mega 3B': 5, 'Mega SS': 12, 'Mega C': 14, 'Mega Any': 3},
    'B': {'Mini Bat': 2, 'Mini Pitch': 15, 'Mega Pitch': 7, 'Mega OF': 10, 'Mega 1B': 14, 'Mega 2B': 3, 'Mega 3B': 6, 'Mega SS': 11, 'Mega C': 13, 'Mega Any': 4},
    'C': {'Mini Bat': 3, 'Mini Pitch': 14, 'Mega Pitch': 6, 'Mega OF': 11, 'Mega 1B': 15, 'Mega 2B': 2, 'Mega 3B': 7, 'Mega SS': 10, 'Mega C': 12, 'Mega Any': 5},
    'D': {'Mini Bat': 4, 'Mini Pitch': 13, 'Mega Pitch': 5, 'Mega OF': 12, 'Mega 1B': 16, 'Mega 2B': 1, 'Mega 3B': 8, 'Mega SS': 9, 'Mega C': 11, 'Mega Any': 6},
    'E': {'Mini Bat': 5, 'Mini Pitch': 12, 'Mega Pitch': 4, 'Mega OF': 13, 'Mega 1B': 1, 'Mega 2B': 16, 'Mega 3B': 9, 'Mega SS': 8, 'Mega C': 10, 'Mega Any': 7},
    'F': {'Mini Bat': 6, 'Mini Pitch': 11, 'Mega Pitch': 3, 'Mega OF': 14, 'Mega 1B': 2, 'Mega 2B': 15, 'Mega 3B': 10, 'Mega SS': 7, 'Mega C': 9, 'Mega Any': 8},
    'G': {'Mini Bat': 7, 'Mini Pitch': 10, 'Mega Pitch': 2, 'Mega OF': 15, 'Mega 1B': 3, 'Mega 2B': 14, 'Mega 3B': 11, 'Mega SS': 6, 'Mega C': 8, 'Mega Any': 9},
    'H': {'Mini Bat': 8, 'Mini Pitch': 9, 'Mega Pitch': 1, 'Mega OF': 16, 'Mega 1B': 4, 'Mega 2B': 13, 'Mega 3B': 12, 'Mega SS': 5, 'Mega C': 7, 'Mega Any': 10},
    'I': {'Mini Bat': 9, 'Mini Pitch': 8, 'Mega Pitch': 16, 'Mega OF': 1, 'Mega 1B': 5, 'Mega 2B': 12, 'Mega 3B': 13, 'Mega SS': 4, 'Mega C': 6, 'Mega Any': 11},
    'J': {'Mini Bat': 10, 'Mini Pitch': 7, 'Mega Pitch': 15, 'Mega OF': 2, 'Mega 1B': 6, 'Mega 2B': 11, 'Mega 3B': 14, 'Mega SS': 3, 'Mega C': 5, 'Mega Any': 12},
    'K': {'Mini Bat': 11, 'Mini Pitch': 6, 'Mega Pitch': 14, 'Mega OF': 3, 'Mega 1B': 7, 'Mega 2B': 10, 'Mega 3B': 15, 'Mega SS': 2, 'Mega C': 4, 'Mega Any': 13},
    'L': {'Mini Bat': 12, 'Mini Pitch': 5, 'Mega Pitch': 13, 'Mega OF': 4, 'Mega 1B': 8, 'Mega 2B': 9, 'Mega 3B': 16, 'Mega SS': 1, 'Mega C': 3, 'Mega Any': 14},
    'M': {'Mini Bat': 13, 'Mini Pitch': 4, 'Mega Pitch': 12, 'Mega OF': 5, 'Mega 1B': 9, 'Mega 2B': 8, 'Mega 3B': 1, 'Mega SS': 16, 'Mega C': 2, 'Mega Any': 15},
    'N': {'Mini Bat': 14, 'Mini Pitch': 3, 'Mega Pitch': 11, 'Mega OF': 6, 'Mega 1B': 10, 'Mega 2B': 7, 'Mega 3B': 2, 'Mega SS': 15, 'Mega C': 1, 'Mega Any': 16},
    'O': {'Mini Bat': 15, 'Mini Pitch': 2, 'Mega Pitch': 10, 'Mega OF': 7, 'Mega 1B': 11, 'Mega 2B': 6, 'Mega 3B': 3, 'Mega SS': 14, 'Mega C': 16, 'Mega Any': 1},
    'P': {'Mini Bat': 16, 'Mini Pitch': 1, 'Mega Pitch': 9, 'Mega OF': 8, 'Mega 1B': 12, 'Mega 2B': 5, 'Mega 3B': 4, 'Mega SS': 13, 'Mega C': 15, 'Mega Any': 2},
}

DRAFT_CATEGORIES = [
    {'key': 'Mini Bat', 'rounds': 4, 'type': 'batter', 'posFilter': None},
    {'key': 'Mini Pitch', 'rounds': 4, 'type': 'pitcher', 'posFilter': None},
    {'key': 'Mega Pitch', 'rounds': 6, 'type': 'pitcher', 'posFilter': None},
    {'key': 'Mega OF', 'rounds': 4, 'type': 'batter', 'posFilter': 'OF'},
    {'key': 'Mega 1B', 'rounds': 2, 'type': 'batter', 'posFilter': '1B'},
    {'key': 'Mega 2B', 'rounds': 2, 'type': 'batter', 'posFilter': '2B'},
    {'key': 'Mega 3B', 'rounds': 2, 'type': 'batter', 'posFilter': '3B'},
    {'key': 'Mega SS', 'rounds': 2, 'type': 'batter', 'posFilter': 'SS'},
    {'key': 'Mega C', 'rounds': 2, 'type': 'batter', 'posFilter': 'C'},
    {'key': 'Mega Any', 'rounds': 2, 'type': 'any', 'posFilter': None},
]


# =============================================================================
# SNAKE DRAFT PICK VALUATION
# =============================================================================
def get_snake_picks(pick_position, num_rounds, num_teams=16):
    """
    Return 0-indexed overall pick indices for a given draft position
    in a snake draft.
    E.g. pick_position=1, num_rounds=4, num_teams=16
    → Round 1: pick 0, Round 2 (reversed): pick 31, Round 3: pick 32, Round 4: pick 63
    """
    picks = []
    for rnd in range(num_rounds):
        if rnd % 2 == 0:  # odd rounds (1,3,5): normal order
            overall = rnd * num_teams + (pick_position - 1)
        else:             # even rounds (2,4,6): reversed
            overall = rnd * num_teams + (num_teams - pick_position)
        picks.append(overall)
    return picks


def snake_value(pool, pick_position, num_rounds, num_teams=16):
    """Sum FPTS of players at snake pick positions from a sorted pool."""
    indices = get_snake_picks(pick_position, num_rounds, num_teams)
    total = 0
    for idx in indices:
        if idx < len(pool):
            total += pool[idx]['fpts']
    return round(total, 1)


def build_category_pool(batters, pitchers, cat, post_mini_bat=None, post_mini_pit=None):
    """Build the eligible player pool for a draft category, sorted by FPTS desc."""
    ptype = cat['type']
    pos_filter = cat['posFilter']
    is_mega = cat['key'].startswith('Mega')

    if ptype == 'pitcher':
        pool = list(post_mini_pit if is_mega and post_mini_pit is not None else pitchers)
    elif ptype == 'batter':
        pool = list(post_mini_bat if is_mega and post_mini_bat is not None else batters)
        if pos_filter:
            pool = [b for b in pool if pos_filter in b['positions']]
    else:  # 'any'
        bat = post_mini_bat if is_mega and post_mini_bat is not None else batters
        pit = post_mini_pit if is_mega and post_mini_pit is not None else pitchers
        pool = list(bat) + list(pit)

    pool.sort(key=lambda x: x['fpts'], reverse=True)
    return pool


# =============================================================================
# POST-MINI SCARCITY & TEMPLATE ANALYSIS
# =============================================================================

def get_players_at_picks(pool, pick_position, num_rounds, num_teams=16):
    """Return actual player dicts at each snake pick position from a sorted pool."""
    indices = get_snake_picks(pick_position, num_rounds, num_teams)
    players = []
    for idx in indices:
        if idx < len(pool):
            players.append(pool[idx])
    return players


def assign_optimal_lineup(all_batters, all_pitchers):
    """
    Given all batters and pitchers on a roster, assign to the optimal
    starting lineup to maximize total starting FPTS.

    Active lineup: C(1), 1B(1), 2B(1), SS(1), 3B(1), OF(3), DH(1), U(1), P(9)
    Bench contributes 0 to weekly scoring.

    Uses a greedy-by-constraint approach: fill the most position-scarce
    slots first, then flex slots (DH/U) with the best remaining batters.

    Returns (hit_start_fpts, pit_start_fpts, lineup_detail).
    """
    sorted_bat = sorted(all_batters, key=lambda x: x['fpts'], reverse=True)
    assigned = set()  # indices into sorted_bat
    lineup = {}

    # Fill single-position constrained slots (most scarce first)
    # Order: C is scarcest, then 2B, 3B, SS, 1B
    for pos in ['C', '2B', '3B', 'SS', '1B']:
        for i, b in enumerate(sorted_bat):
            if i not in assigned and pos in b.get('positions', []):
                lineup[pos] = b
                assigned.add(i)
                break

    # Fill OF (3 slots)
    of_count = 0
    for i, b in enumerate(sorted_bat):
        if i not in assigned and 'OF' in b.get('positions', []):
            lineup[f'OF{of_count+1}'] = b
            assigned.add(i)
            of_count += 1
            if of_count >= 3:
                break

    # Fill DH and U (best 2 remaining, any position)
    flex_count = 0
    for i, b in enumerate(sorted_bat):
        if i not in assigned:
            slot = 'DH' if flex_count == 0 else 'U'
            lineup[slot] = b
            assigned.add(i)
            flex_count += 1
            if flex_count >= 2:
                break

    hit_start = sum(p['fpts'] for p in lineup.values())

    # Pitchers: start best 9
    sorted_pit = sorted(all_pitchers, key=lambda x: x['fpts'], reverse=True)
    pit_start = sum(p['fpts'] for p in sorted_pit[:9])

    return round(hit_start, 1), round(pit_start, 1), lineup


def analyze_scarcity(batters, pitchers):
    MINI_SIZE = 64

    mini_batters = set(b['name'] for b in batters[:MINI_SIZE])
    mini_pitchers = set(p['name'] for p in pitchers[:MINI_SIZE])

    remaining_bat = [b for b in batters if b['name'] not in mini_batters]
    remaining_pit = [p for p in pitchers if p['name'] not in mini_pitchers]

    # Position scarcity (1st vs 16th gap) — kept for sidebar display
    scarcity = {}
    for pos in ['C', '1B', '2B', '3B', 'SS', 'OF']:
        pool = sorted([b for b in remaining_bat if pos in b['positions']],
                       key=lambda x: x['fpts'], reverse=True)
        if len(pool) >= 16:
            scarcity[pos] = round(pool[0]['fpts'] - pool[15]['fpts'])

    sp_rem = sorted([p for p in remaining_pit if p['role'] == 'SP'],
                     key=lambda x: x['fpts'], reverse=True)
    rp_rem = sorted([p for p in remaining_pit if p['role'] == 'RP'],
                     key=lambda x: x['fpts'], reverse=True)
    if len(sp_rem) >= 16:
        scarcity['SP'] = round(sp_rem[0]['fpts'] - sp_rem[15]['fpts'])
    if len(rp_rem) >= 16:
        scarcity['RP'] = round(rp_rem[0]['fpts'] - rp_rem[15]['fpts'])

    # --- Snake-aware value curves ---
    # For each category, compute the total FPTS at each pick position
    # (1-16) using actual snake pick indices into the sorted pool.
    snake_curves = {}
    category_pools = {}
    for cat in DRAFT_CATEGORIES:
        pool = build_category_pool(batters, pitchers, cat, remaining_bat, remaining_pit)
        category_pools[cat['key']] = pool
        curve = {}
        for pick_pos in range(1, 17):
            curve[str(pick_pos)] = snake_value(pool, pick_pos, cat['rounds'])
        snake_curves[cat['key']] = curve

    # Category importance: how much variance between best and worst pick position
    category_importance = {}
    for cat_key, curve in snake_curves.items():
        vals = list(curve.values())
        max_v, min_v = max(vals), min(vals)
        category_importance[cat_key] = {
            'spread': round(max_v - min_v, 1),
            'best': round(max_v, 1),
            'worst': round(min_v, 1),
            'bestPick': int(max(curve, key=lambda k: curve[k])),
            'worstPick': int(min(curve, key=lambda k: curve[k])),
        }

    # =====================================================================
    # ROSTER-AWARE TEMPLATE SCORING with STRATEGIC MINI BAT
    # =====================================================================
    # Core insights:
    # 1. Mini Bat picks cover roster positions. If your Mini Bat already
    #    gives you a C, your Mega C pick becomes BACKUP (bench/DH/U).
    # 2. Smart drafters should AVOID positions where they have valuable
    #    Mega picks, and TARGET positions where Mega picks are weak.
    # 3. Multi-position players have extra value — they provide lineup
    #    flexibility and avoid "locking in" position coverage.
    #
    # BSB weekly ranked format: 8-team division, rank 0-7 for hitting
    # AND 0-7 for pitching separately. Max 14 "wins" per week.
    # Balance between hitting and pitching is critical.
    #
    # Active lineup: C, 1B, 2B, SS, 3B, DH, U, 3 OF (10 batter slots)
    #                + 9 P (pitcher slots)
    # =====================================================================

    # Map category key to its rounds count
    cat_rounds = {cat['key']: cat['rounds'] for cat in DRAFT_CATEGORIES}

    # Map position to Mega category name
    MEGA_POS_MAP = {'C': 'Mega C', '1B': 'Mega 1B', '2B': 'Mega 2B',
                    '3B': 'Mega 3B', 'SS': 'Mega SS'}

    def dedup_players(player_list):
        """Remove duplicate players (same ID appearing in multiple pools)."""
        seen = set()
        result = []
        for p in player_list:
            pid = p.get('id', p.get('name'))
            if pid not in seen:
                seen.add(pid)
                result.append(p)
        return result

    def identify_protect_positions(picks, curves):
        """
        Identify positions to PROTECT (avoid in Mini Bat) because the
        template has an above-median Mega pick value there.
        """
        protect = set()
        for pos, mega_key in MEGA_POS_MAP.items():
            if mega_key not in curves:
                continue
            pick_num = picks.get(mega_key)
            if pick_num is None:
                continue
            curve = curves[mega_key]
            my_value = curve[str(pick_num)]
            vals = sorted(curve.values(), reverse=True)
            median_val = vals[len(vals) // 2]
            if my_value >= median_val:
                protect.add(pos)
        return protect

    def strategic_mini_bat(pool, pick_position, num_rounds, protect_positions,
                           num_teams=16):
        """
        Select Mini Bat players strategically: at each snake pick, take the
        best available player who does NOT conflict with a protected Mega
        position, unless skipping costs >50 FPTS.

        Returns list of selected players.
        """
        indices = get_snake_picks(pick_position, num_rounds, num_teams)
        selected = []
        taken_ids = set()

        for idx in indices:
            if idx >= len(pool):
                continue

            natural = pool[idx]
            # Skip if already taken by an earlier pick of ours
            if natural.get('id', natural.get('name')) in taken_ids:
                # Find next available
                for j in range(idx + 1, min(idx + 10, len(pool))):
                    if pool[j].get('id', pool[j].get('name')) not in taken_ids:
                        natural = pool[j]
                        break

            # Does the natural pick conflict with a protected position?
            # Multi-position players only conflict if ALL their positions
            # are protected (a 1B/OF player with only 1B protected is fine
            # because they can play OF)
            player_positions = set(natural.get('positions', []))
            # Remove DH from conflict check (DH is always fine)
            check_positions = player_positions - {'DH'}
            conflicts = check_positions & protect_positions
            # Only a conflict if EVERY non-DH position is protected
            has_conflict = len(conflicts) > 0 and conflicts == check_positions

            if has_conflict:
                # Find best non-conflicting alternative nearby
                best_alt = None
                for j in range(idx, min(idx + 10, len(pool))):
                    candidate = pool[j]
                    cid = candidate.get('id', candidate.get('name'))
                    if cid in taken_ids:
                        continue
                    cand_positions = set(candidate.get('positions', [])) - {'DH'}
                    cand_conflicts = cand_positions & protect_positions
                    cand_has_conflict = (len(cand_conflicts) > 0 and
                                        cand_conflicts == cand_positions)
                    if not cand_has_conflict:
                        best_alt = candidate
                        break

                if best_alt and (natural['fpts'] - best_alt['fpts'] < 50):
                    selected.append(best_alt)
                    taken_ids.add(best_alt.get('id', best_alt.get('name')))
                else:
                    # Natural pick is too good to skip
                    selected.append(natural)
                    taken_ids.add(natural.get('id', natural.get('name')))
            else:
                selected.append(natural)
                taken_ids.add(natural.get('id', natural.get('name')))

        return selected

    def build_full_roster(mini_bat_players, mini_pit_players, picks,
                          cat_pools, cat_rnds):
        """Build full roster from Mini Bat picks + all Mega categories."""
        mega_of = get_players_at_picks(
            cat_pools['Mega OF'], picks['Mega OF'], cat_rnds['Mega OF'])
        mega_1b = get_players_at_picks(
            cat_pools['Mega 1B'], picks['Mega 1B'], cat_rnds['Mega 1B'])
        mega_2b = get_players_at_picks(
            cat_pools['Mega 2B'], picks['Mega 2B'], cat_rnds['Mega 2B'])
        mega_3b = get_players_at_picks(
            cat_pools['Mega 3B'], picks['Mega 3B'], cat_rnds['Mega 3B'])
        mega_ss = get_players_at_picks(
            cat_pools['Mega SS'], picks['Mega SS'], cat_rnds['Mega SS'])
        mega_c = get_players_at_picks(
            cat_pools['Mega C'], picks['Mega C'], cat_rnds['Mega C'])
        mega_pit = get_players_at_picks(
            cat_pools['Mega Pitch'], picks['Mega Pitch'], cat_rnds['Mega Pitch'])

        mega_any_players = get_players_at_picks(
            cat_pools['Mega Any'], picks['Mega Any'], cat_rnds['Mega Any'])
        mega_any_bat = [p for p in mega_any_players if p.get('pos') != 'P']
        mega_any_pit = [p for p in mega_any_players if p.get('pos') == 'P']

        all_bat = dedup_players(
            mini_bat_players + mega_of + mega_1b + mega_2b +
            mega_3b + mega_ss + mega_c + mega_any_bat)
        all_pit = dedup_players(
            mini_pit_players + mega_pit + mega_any_pit)

        return all_bat, all_pit, mega_any_players

    # --- Score each template under BOTH strategies, pick the better ---
    template_totals = {}
    template_hit_pit = {}
    template_mini_picks = {}
    template_strategy = {}  # strategy info per template

    for tname, picks in TEMPLATES.items():
        mini_pool = category_pools['Mini Bat']
        mini_pit_pool = category_pools['Mini Pitch']

        # Mini Pitch is the same regardless of batting strategy
        mini_pit_players = get_players_at_picks(
            mini_pit_pool, picks['Mini Pitch'], cat_rounds['Mini Pitch'])

        # ---- Scenario 1: Best Available (greedy FPTS) ----
        default_mini_bat = get_players_at_picks(
            mini_pool, picks['Mini Bat'], cat_rounds['Mini Bat'])
        def_bat, def_pit, def_any = build_full_roster(
            default_mini_bat, mini_pit_players, picks,
            category_pools, cat_rounds)
        def_hit, def_pit_fpts, _ = assign_optimal_lineup(def_bat, def_pit)
        default_total = def_hit + def_pit_fpts

        # ---- Scenario 2: Strategic (avoid strong Mega positions) ----
        protect_pos = identify_protect_positions(picks, snake_curves)
        smart_mini_bat = strategic_mini_bat(
            mini_pool, picks['Mini Bat'], cat_rounds['Mini Bat'], protect_pos)
        smart_bat, smart_pit, smart_any = build_full_roster(
            smart_mini_bat, mini_pit_players, picks,
            category_pools, cat_rounds)
        smart_hit, smart_pit_fpts, smart_lineup = assign_optimal_lineup(
            smart_bat, smart_pit)
        smart_total = smart_hit + smart_pit_fpts

        # Pick the better scenario
        if smart_total >= default_total:
            use_strategic = True
            mini_bat_players = smart_mini_bat
            hit_fpts, pit_fpts = smart_hit, smart_pit_fpts
            lineup = smart_lineup
            mega_any_players = smart_any
        else:
            use_strategic = False
            mini_bat_players = default_mini_bat
            hit_fpts, pit_fpts = def_hit, def_pit_fpts
            mega_any_players = def_any

        total = hit_fpts + pit_fpts
        template_totals[tname] = round(total, 1)

        # Track Mini Bat details
        mini_positions = set()
        for p in mini_bat_players:
            mini_positions.update(p.get('positions', []))

        # Multi-position count for each player
        mini_player_info = []
        for p in mini_bat_players:
            pos_list = p.get('positions', [])
            mini_player_info.append({
                'name': p['name'], 'pos': p['pos'], 'fpts': p['fpts'],
                'positions': pos_list,
                'multiPos': len(pos_list) > 1,
            })

        template_mini_picks[tname] = {
            'players': mini_player_info,
            'coveredPositions': sorted(list(mini_positions)),
        }

        # Strategy recommendation
        target_positions = set()
        for pos, mega_key in MEGA_POS_MAP.items():
            if pos not in protect_pos:
                target_positions.add(pos)

        template_strategy[tname] = {
            'protectPositions': sorted(protect_pos),
            'targetPositions': sorted(target_positions),
            'usedStrategic': use_strategic,
            'defaultTotal': round(default_total, 1),
            'smartTotal': round(smart_total, 1),
            'improvement': round(smart_total - default_total, 1),
        }

        template_hit_pit[tname] = {
            'hitFpts': round(hit_fpts, 1),
            'pitFpts': round(pit_fpts, 1),
            'anyFpts': round(sum(p['fpts'] for p in mega_any_players), 1),
        }

    # --- Enrich hit/pit data with advantages ---
    avg_hit = sum(v['hitFpts'] for v in template_hit_pit.values()) / len(template_hit_pit)
    avg_pit = sum(v['pitFpts'] for v in template_hit_pit.values()) / len(template_hit_pit)
    for t in template_hit_pit:
        hp = template_hit_pit[t]
        hit_adv = hp['hitFpts'] - avg_hit
        pit_adv = hp['pitFpts'] - avg_pit
        hp['hitAdv'] = round(hit_adv, 1)
        hp['pitAdv'] = round(pit_adv, 1)
        hp['weaker'] = 'HIT' if hit_adv < pit_adv else 'PIT'

    # --- Monte Carlo Weekly Standings Simulation ---
    # In BSB ranked scoring, each week you earn 0-7 pts for hitting rank +
    # 0-7 pts for pitching rank in your 8-team division.
    # Winning by 100 = winning by 1. Balance matters more than raw totals.
    N_SEASONS = 20000
    N_WEEKS = 27
    DIV_SIZE = 8

    # Team-level weekly CVs (individual CV / sqrt(n_players) + correlation)
    HIT_CV = 0.12   # ~15 batters, individual CV ~0.45
    PIT_CV = 0.25   # ~9 pitchers, individual CV ~0.70, 2-start volatility

    t_names = sorted(template_hit_pit.keys())
    hit_means = {t: template_hit_pit[t]['hitFpts'] / N_WEEKS for t in t_names}
    pit_means = {t: template_hit_pit[t]['pitFpts'] / N_WEEKS for t in t_names}

    season_totals = {t: 0.0 for t in t_names}
    hit_rank_totals = {t: 0.0 for t in t_names}
    pit_rank_totals = {t: 0.0 for t in t_names}

    random.seed(42)  # Reproducible results
    for _ in range(N_SEASONS):
        shuffled = t_names[:]
        random.shuffle(shuffled)
        div1 = shuffled[:DIV_SIZE]
        div2 = shuffled[DIV_SIZE:]

        season_pts = {t: 0 for t in t_names}
        season_hit_pts = {t: 0 for t in t_names}
        season_pit_pts = {t: 0 for t in t_names}

        for _ in range(N_WEEKS):
            weekly_hit = {t: random.gauss(hit_means[t], hit_means[t] * HIT_CV) for t in t_names}
            weekly_pit = {t: random.gauss(pit_means[t], pit_means[t] * PIT_CV) for t in t_names}

            for div_teams in [div1, div2]:
                hit_ranked = sorted(div_teams, key=lambda t: weekly_hit[t], reverse=True)
                pit_ranked = sorted(div_teams, key=lambda t: weekly_pit[t], reverse=True)
                for rank, t in enumerate(hit_ranked):
                    pts = DIV_SIZE - 1 - rank  # 7,6,5,4,3,2,1,0
                    season_pts[t] += pts
                    season_hit_pts[t] += pts
                for rank, t in enumerate(pit_ranked):
                    pts = DIV_SIZE - 1 - rank
                    season_pts[t] += pts
                    season_pit_pts[t] += pts

        for t in t_names:
            season_totals[t] += season_pts[t]
            hit_rank_totals[t] += season_hit_pts[t]
            pit_rank_totals[t] += season_pit_pts[t]

    # Average per-week standings points
    template_scores = {}
    standings_detail = {}
    for t in t_names:
        avg_total = season_totals[t] / N_SEASONS / N_WEEKS
        avg_hit_pts = hit_rank_totals[t] / N_SEASONS / N_WEEKS
        avg_pit_pts = pit_rank_totals[t] / N_SEASONS / N_WEEKS
        template_scores[t] = round(avg_total, 2)
        standings_detail[t] = {
            'weeklyPts': round(avg_total, 2),
            'hitPts': round(avg_hit_pts, 2),
            'pitPts': round(avg_pit_pts, 2),
            'seasonPts': round(season_totals[t] / N_SEASONS, 1),
        }

    template_order = sorted(template_scores.keys(),
                            key=lambda t: template_scores[t], reverse=True)

    return {
        'scarcity': scarcity,
        'templateScores': template_scores,
        'templateOrder': template_order,
        'templateTotals': template_totals,
        'templateHitPit': template_hit_pit,
        'standingsDetail': standings_detail,
        'templateMiniPicks': template_mini_picks,
        'templateStrategy': template_strategy,
        'miniPoaching': dict(Counter(b['pos'] for b in batters[:MINI_SIZE])),
        'snakeCurves': snake_curves,
        'categoryImportance': category_importance,
    }


# =============================================================================
# ENRICH: posRank, VORP, Tier
# =============================================================================
REPLACEMENT_LEVEL = 17  # 16-team league: 17th player is replacement

def assign_tier(rank, pool_size):
    """Assign tier 1-5 based on percentile rank within pool."""
    if pool_size == 0:
        return 5
    pct = rank / pool_size
    if pct <= 0.06:
        return 1   # elite ~top 6%
    elif pct <= 0.18:
        return 2   # great ~next 12%
    elif pct <= 0.38:
        return 3   # solid ~next 20%
    elif pct <= 0.63:
        return 4   # average ~next 25%
    else:
        return 5   # below average

def enrich_players(batters, pitchers):
    """Add posRank, vorp, and tier to every player in-place."""
    # --- Batters: rank per position ---
    pos_pools = {}
    for pos in ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH']:
        pool = [b for b in batters if pos in b['positions']]
        pool.sort(key=lambda x: x['fpts'], reverse=True)
        pos_pools[pos] = pool

    for b in batters:
        best_rank = 999
        best_pos = b['pos']
        for pos in b['positions']:
            pool = pos_pools.get(pos, [])
            for i, p in enumerate(pool):
                if p['id'] == b['id']:
                    rank = i + 1
                    if rank < best_rank:
                        best_rank = rank
                        best_pos = pos
                    break
        b['posRank'] = best_rank if best_rank < 999 else None
        # VORP: fpts minus replacement-level player at best position
        pool = pos_pools.get(best_pos, [])
        if len(pool) >= REPLACEMENT_LEVEL:
            b['vorp'] = round(b['fpts'] - pool[REPLACEMENT_LEVEL - 1]['fpts'], 1)
        elif len(pool) >= 2:
            b['vorp'] = round(b['fpts'] - pool[-1]['fpts'], 1)
        else:
            b['vorp'] = 0
        # Tier
        b['tier'] = assign_tier(best_rank - 1, len(pool)) if best_rank < 999 else 5

    # --- Pitchers: rank by role (SP/RP) ---
    sp_pool = sorted([p for p in pitchers if p['role'] == 'SP'], key=lambda x: x['fpts'], reverse=True)
    rp_pool = sorted([p for p in pitchers if p['role'] == 'RP'], key=lambda x: x['fpts'], reverse=True)

    sp_lookup = {p['id']: i + 1 for i, p in enumerate(sp_pool)}
    rp_lookup = {p['id']: i + 1 for i, p in enumerate(rp_pool)}

    for p in pitchers:
        if p['role'] == 'SP':
            rank = sp_lookup.get(p['id'], 999)
            pool = sp_pool
        else:
            rank = rp_lookup.get(p['id'], 999)
            pool = rp_pool
        p['posRank'] = rank if rank < 999 else None
        # VORP
        if len(pool) >= REPLACEMENT_LEVEL:
            p['vorp'] = round(p['fpts'] - pool[REPLACEMENT_LEVEL - 1]['fpts'], 1)
        elif len(pool) >= 2:
            p['vorp'] = round(p['fpts'] - pool[-1]['fpts'], 1)
        else:
            p['vorp'] = 0
        # Tier
        p['tier'] = assign_tier(rank - 1, len(pool)) if rank < 999 else 5

    print(f"  Enriched {len(batters)} batters + {len(pitchers)} pitchers with posRank/VORP/tier")


# =============================================================================
# MAIN
# =============================================================================
def main():
    batters_raw, pitchers_raw = fetch_projections()

    batters = process_batters(batters_raw)
    batter_ids = set(b['id'] for b in batters)
    pitchers = process_pitchers(pitchers_raw, batter_ids)

    # Enrich with posRank, VORP, tier (before truncating to 300)
    enrich_players(batters, pitchers)

    # Fetch bio data & historical stats from MLB Stats API
    print("\nFetching player bios & historical stats...")
    fetch_mlb_bios_and_history(batters[:300], pitchers[:300])

    analysis = analyze_scarcity(batters, pitchers)

    # Write output files
    def write(filename, data):
        path = os.path.join(OUTPUT_DIR, filename)
        with open(path, 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        print(f"  Wrote {path} ({len(json.dumps(data))//1024}KB)")

    print("\nWriting output files...")
    write('batters.json', batters[:300])
    write('pitchers.json', pitchers[:300])
    write('templates.json', TEMPLATES)
    write('draftCategories.json', DRAFT_CATEGORIES)
    write('analysis.json', analysis)
    write('scoring.json', {
        'batting': {'R': 1, 'TB': 1, 'BB': 1, 'RBI': 1, 'SB': 1},
        'pitching': {
            'IP': 3, 'K': 1, 'W': 10, 'SV': 8, 'HLD': 6, 'QS': 4,
            'CG': 5, 'IRSTR': 2, 'ER': -2, 'BB': -1, 'H': -1,
        },
    })

    print(f"\n✅ Done! {len(batters[:300])} batters, {len(pitchers[:300])} pitchers")
    print(f"Top batter: {batters[0]['name']} ({batters[0]['fpts']} FPTS)")
    print(f"Top pitcher: {pitchers[0]['name']} ({pitchers[0]['fpts']} FPTS)")

    print(f"\n{'='*75}")
    print(f"  TEMPLATE RANKING (Monte Carlo Weekly Standings Simulation)")
    print(f"  {analysis['standingsDetail'][analysis['templateOrder'][0]].get('_meta', '20k seasons × 27 wks, random divisions, ranked 0-7 hit+pit')}")
    print(f"{'='*75}")
    print(f"  {'#':>2}  {'T':>1}  {'Pts/Wk':>7}  {'Hit':>5}  {'Pit':>5}  {'Season':>7}  "
          f"{'FPTS':>7}  {'Hit±':>5}  {'Pit±':>5}")
    print(f"  {'-'*70}")
    for i, t in enumerate(analysis['templateOrder']):
        sd = analysis['standingsDetail'][t]
        total = analysis['templateTotals'][t]
        hp = analysis['templateHitPit'][t]
        print(f"  {i+1:2}. {t}  {sd['weeklyPts']:>6.2f}  {sd['hitPts']:>5.2f}  "
              f"{sd['pitPts']:>5.2f}  {sd['seasonPts']:>6.1f}  "
              f"{total:>7,.0f}  {hp['hitAdv']:>+5.0f}  {hp['pitAdv']:>+5.0f}")

    print(f"\n  Mini Bat position coverage by template:")
    for t in analysis['templateOrder']:
        mp = analysis['templateMiniPicks'][t]
        pos_str = ', '.join(mp['coveredPositions'])
        players = ', '.join(f"{p['name']}({p['pos']})" for p in mp['players'])
        print(f"    {t}: [{pos_str}] — {players}")

    # Strategic Mini Bat analysis
    print(f"\n{'='*70}")
    print(f"  STRATEGIC MINI BAT TARGETING")
    print(f"  Protect = positions with strong Mega picks (avoid in Mini Bat)")
    print(f"  Target  = positions where Mega picks are weak (draft in Mini Bat)")
    print(f"{'='*70}")
    print(f"  {'T':>1}  {'Protect':18s}  {'Target':18s}  {'Strat?':>5}  {'Improve':>7}")
    print(f"  {'-'*60}")
    for t in analysis['templateOrder']:
        strat = analysis['templateStrategy'][t]
        protect = ', '.join(strat['protectPositions']) or '—'
        target = ', '.join(strat['targetPositions']) or '—'
        used = '  ✓' if strat['usedStrategic'] else '  —'
        imp = strat['improvement']
        imp_str = f"{imp:>+6.1f}" if imp != 0 else '     0'
        print(f"  {t}  {protect:18s}  {target:18s}  {used:>5}  {imp_str}")

    print(f"\nPost-Mini scarcity: {json.dumps(analysis['scarcity'])}")
    print(f"\nCategory importance (spread between best & worst pick):")
    for cat_key, info in sorted(analysis['categoryImportance'].items(),
                                 key=lambda x: x[1]['spread'], reverse=True):
        side = 'PIT' if cat_key in ('Mini Pitch', 'Mega Pitch') else ('ANY' if cat_key == 'Mega Any' else 'HIT')
        print(f"  [{side:3s}] {cat_key:12s}: {info['spread']:5.0f} FPTS spread  "
              f"(best=pick {info['bestPick']}, worst=pick {info['worstPick']})")


if __name__ == '__main__':
    main()
