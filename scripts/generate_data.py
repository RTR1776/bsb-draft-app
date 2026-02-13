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
# Pitching: IP*3 + K(1) + W(10) + SV(8) + HLD(6) + QS(4) + CG(5) + IRS(2)
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
    irs = relief_apps * 0.45 * 0.70  # estimated
    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irs * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
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
    irs = round(relief_apps * 0.45 * 0.70, 1)
    return round(
        (er * -2) + (ip * 3) + (so * 1) + (bb * -1) + (w * 10) +
        (sv * 8) + (irs * 2) + (qs * 4) + (cg * 5) + (h * -1) + (hld * 6),
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
        irs = round(relief_apps * 0.45 * 0.70, 1)
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
            'irs': irs,
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
# POST-MINI SCARCITY ANALYSIS
# =============================================================================
def analyze_scarcity(batters, pitchers):
    MINI_SIZE = 64

    mini_batters = set(b['name'] for b in batters[:MINI_SIZE])
    mini_pitchers = set(p['name'] for p in pitchers[:MINI_SIZE])

    remaining_bat = [b for b in batters if b['name'] not in mini_batters]
    remaining_pit = [p for p in pitchers if p['name'] not in mini_pitchers]

    scarcity = {}
    pos_pools = {}

    for pos in ['C', '1B', '2B', '3B', 'SS', 'OF']:
        pool = [b for b in remaining_bat if pos in b['positions']]
        pool.sort(key=lambda x: x['fpts'], reverse=True)
        pos_pools[pos] = pool[:40]
        if len(pool) >= 16:
            scarcity[pos] = round(pool[0]['fpts'] - pool[15]['fpts'])

    sp_rem = [p for p in remaining_pit if p['role'] == 'SP']
    rp_rem = [p for p in remaining_pit if p['role'] == 'RP']
    if len(sp_rem) >= 16:
        scarcity['SP'] = round(sp_rem[0]['fpts'] - sp_rem[15]['fpts'])
    if len(rp_rem) >= 16:
        scarcity['RP'] = round(rp_rem[0]['fpts'] - rp_rem[15]['fpts'])

    # Template scoring
    cat_scarcity = {
        'Mini Bat': 50, 'Mini Pitch': 80,
        'Mega Pitch': scarcity.get('SP', 34),
        'Mega OF': scarcity.get('OF', 64),
        'Mega 1B': scarcity.get('1B', 292),
        'Mega 2B': scarcity.get('2B', 161),
        'Mega 3B': scarcity.get('3B', 159),
        'Mega SS': scarcity.get('SS', 203),
        'Mega C': scarcity.get('C', 165),
        'Mega Any': 80,
    }
    round_counts = {
        'Mini Bat': 4, 'Mini Pitch': 4, 'Mega Pitch': 6, 'Mega OF': 4,
        'Mega 1B': 2, 'Mega 2B': 2, 'Mega 3B': 2, 'Mega SS': 2,
        'Mega C': 2, 'Mega Any': 2,
    }

    template_scores = {}
    for tname, picks in TEMPLATES.items():
        total = 0
        for cat, pick_num in picks.items():
            scar = cat_scarcity.get(cat, 50)
            rounds = round_counts.get(cat, 2)
            advantage = (8.5 - pick_num) * (scar / 15) * rounds
            total += advantage
        template_scores[tname] = round(total, 1)

    template_order = sorted(template_scores.keys(), key=lambda t: template_scores[t], reverse=True)

    return {
        'scarcity': scarcity,
        'templateScores': template_scores,
        'templateOrder': template_order,
        'miniPoaching': dict(Counter(b['pos'] for b in batters[:MINI_SIZE])),
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
            'CG': 5, 'IRS': 2, 'ER': -2, 'BB': -1, 'H': -1,
        },
    })

    print(f"\n✅ Done! {len(batters[:300])} batters, {len(pitchers[:300])} pitchers")
    print(f"Top batter: {batters[0]['name']} ({batters[0]['fpts']} FPTS)")
    print(f"Top pitcher: {pitchers[0]['name']} ({pitchers[0]['fpts']} FPTS)")
    print(f"Template ranking: {', '.join(analysis['templateOrder'][:5])}...")
    print(f"Post-Mini scarcity: {json.dumps(analysis['scarcity'])}")


if __name__ == '__main__':
    main()
