import os
import json
import requests
import statistics
from datetime import datetime
import asyncio
import aiohttp

# MLB API endpoints
MLB_STATS_URL = "https://statsapi.mlb.com/api/v1/people/{id}/stats?stats=gameLog&group=hitting,pitching&season={year}"

# Hardcoded Park Factors (100 is neutral. >100 is hitter friendly. <100 is pitcher friendly)
PARK_FACTORS = {
    'COL': 112, 'CIN': 109, 'BOS': 108, 'LAA': 105, 'ATL': 103,
    'CWS': 102, 'TEX': 102, 'BAL': 100, 'CHW': 102, 'KC': 101, 'KCR': 101,
    'MIL': 101, 'NYY': 101, 'PHI': 101, 'ARI': 100, 'LAD': 100,
    'MIN': 100, 'TOR': 100, 'WSH': 100, 'WSN': 100, 'HOU': 99, 'MIA': 99,
    'PIT': 98, 'SD': 98, 'SDP': 98, 'SF': 97, 'SFG': 97, 'CHC': 97,
    'CLE': 96, 'OAK': 95, 'TB': 95, 'TBR': 95, 'NYM': 95, 'DET': 94,
    'STL': 93, 'SEA': 91
}

async def fetch_game_logs(session, mlb_id, year):
    url = MLB_STATS_URL.format(id=mlb_id, year=year)
    try:
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                return mlb_id, year, data.get('stats', [])
    except Exception:
        pass
    return mlb_id, year, []

def calc_batter_game_fpts(stat):
    tb = int(stat.get('totalBases', 0) or 0)
    r = int(stat.get('runs', 0) or 0)
    rbi = int(stat.get('rbi', 0) or 0)
    sb = int(stat.get('stolenBases', 0) or 0)
    bb = int(stat.get('baseOnBalls', 0) or 0)
    so = int(stat.get('strikeOuts', 0) or 0)
    return tb + r + rbi + sb + (bb * 0.5) - (so * 0.5)

def calc_pitcher_game_fpts(stat):
    outs = float(stat.get('outs', 0) or 0)
    ip = outs / 3.0
    so = int(stat.get('strikeOuts', 0) or 0)
    w = int(stat.get('wins', 0) or 0)
    sv = int(stat.get('saves', 0) or 0)
    hld = int(stat.get('holds', 0) or 0)
    cg = int(stat.get('completeGames', 0) or 0)
    er = int(stat.get('earnedRuns', 0) or 0)
    h = int(stat.get('hits', 0) or 0)
    bb = int(stat.get('baseOnBalls', 0) or 0)
    
    # Calculate QS
    qs = 1 if (ip >= 6.0 and er <= 3) else 0
    
    # Calculate IRSTR
    ir = int(stat.get('inheritedRunners', 0) or 0)
    irs = int(stat.get('inheritedRunnersScored', 0) or 0)
    irstr = ir - irs
    
    return (ip * 3) + (so * 1) + (w * 5) + (qs * 3) + (cg * 5) + (sv * 7) + (hld * 6) + (irstr * 2) - (er * 2) - (h * 1) - (bb * 1)

async def main():
    print("Loading player bases...")
    with open('src/data/batters.json', 'r') as f:
        batters = json.load(f)
    with open('src/data/pitchers.json', 'r') as f:
        pitchers = json.load(f)
        
    all_players = batters + pitchers
    print(f"Loaded {len(all_players)} total players.")
    
    # Fetch Steamer 2026 for Team Context
    print("Fetching Steamer 2026 Projections for Context Shifts...")
    steamer_bat = requests.get('https://www.fangraphs.com/api/projections?stats=bat&type=steamer').json()
    steamer_pit = requests.get('https://www.fangraphs.com/api/projections?stats=pit&type=steamer').json()
    
    fg_projections = {}
    for p in steamer_bat + steamer_pit:
        fg_id = str(p.get('PlayerId', ''))
        fg_projections[fg_id] = p
        
    print("Fetching 3-year game logs concurrently (2023, 2024, 2025)...")
    results = {}
    async with aiohttp.ClientSession() as session:
        tasks = []
        for p in all_players:
            mlb_id = p.get('mlbam_id')
            if not mlb_id:
                mlb_id = next((x for x in p.get('playerIds', []) if len(str(x)) == 6), None)
            if mlb_id:
                for year in [2023, 2024, 2025]:
                    tasks.append(fetch_game_logs(session, mlb_id, year))
        
        # Process in chunks to avoid overwhelming the server
        chunk_size = 50
        for i in range(0, len(tasks), chunk_size):
            chunk_results = await asyncio.gather(*tasks[i:i+chunk_size])
            print(f"  Processed chunk {i//chunk_size + 1}/{len(tasks)//chunk_size + 1}")
            for m_id, yr, logs in chunk_results:
                if m_id not in results:
                    results[m_id] = {}
                results[m_id][yr] = logs

    print("Crunching Weekly Variance & TWV Matrix...")
    analysis_output = {}
    
    for p in all_players:
        p_id = p['id'] # fangraphs ID
        m_id = p.get('mlbam_id')
        if not m_id:
            m_id = next((x for x in p.get('playerIds', []) if len(str(x)) == 6), None)
            
        is_pitcher = p.get('pos') == 'P'
        base_fpts = p.get('fpts', 0)
        
        # 1. Weekly Variance Analysis
        weekly_fpts = {}
        if m_id and m_id in results:
            for yr, logs in results[m_id].items():
                for stat_group in logs:
                    for split in stat_group.get('splits', []):
                        date_str = split.get('date')
                        if not date_str: continue
                        
                        try:
                            dt = datetime.strptime(date_str, "%Y-%m-%d")
                            week_key = f"{yr}-W{dt.isocalendar()[1]:02d}"
                        except:
                            continue
                            
                        stat = split.get('stat', {})
                        if is_pitcher:
                            pts = calc_pitcher_game_fpts(stat)
                        else:
                            pts = calc_batter_game_fpts(stat)
                            
                        if week_key not in weekly_fpts:
                            weekly_fpts[week_key] = 0
                        weekly_fpts[week_key] += pts
        
        # Calculate CV
        fpts_list = [v for v in weekly_fpts.values() if v > 0] # only active weeks
        cv = 0
        consistency_score = 0
        consistency_grade = 'N/A'
        
        if len(fpts_list) >= 5:
            mean = statistics.mean(fpts_list)
            if mean > 0:
                std_dev = statistics.stdev(fpts_list) if len(fpts_list) > 1 else 0
                cv = std_dev / mean
                
                # Grade logic: smaller CV = higher consistency
                # Baseline CV varies. Hitter ~0.50, Pitcher SP ~0.40, RP ~0.80
                ideal_cv = 0.55 if not is_pitcher else (0.45 if p.get('role') == 'SP' else 0.95)
                # Cap the difference
                score = 100 - max(0, min(100, (cv - ideal_cv) * 80)) # Lessen the penalty slope
                consistency_score = round(score)
                
                if consistency_score > 90: consistency_grade = 'A'
                elif consistency_score > 75: consistency_grade = 'B'
                elif consistency_score > 55: consistency_grade = 'C'
                elif consistency_score > 35: consistency_grade = 'D'
                else: consistency_grade = 'F'
        
        # 2. Context Shift Engine
        proj = fg_projections.get(str(p_id), {})
        
        import re
        old_team_raw = p.get('team', 'FA')
        old_team = re.sub('<[^<]+>', '', old_team_raw).strip() if old_team_raw else 'FA'
        
        new_team_raw = proj.get('Team', old_team)
        new_team = re.sub('<[^<]+>', '', new_team_raw).strip() if new_team_raw and new_team_raw != 'NA' else old_team
        
        team_change = (old_team != new_team) and (new_team != 'FA')
        park_shift_pct = 0
        role_shift_bonus = 0
        
        if team_change:
            old_pf = PARK_FACTORS.get(old_team, 100)
            new_pf = PARK_FACTORS.get(new_team, 100)
            # if 110 moving to 90 -> -20 for hitters, +20 for pitchers
            delta = new_pf - old_pf
            if is_pitcher:
                park_shift_pct = -(delta / 100.0) # Pitchers want lower PF
            else:
                park_shift_pct = delta / 100.0    # Hitters want higher PF
        
        # Bullpen shifts
        is_new_closer = False
        is_new_setup = False
        if is_pitcher and p.get('role') == 'RP':
            old_sv = p.get('sv', 0)
            old_hld = p.get('hld', 0)
            new_sv = proj.get('SV', 0)
            new_hld = proj.get('HLD', 0)
            
            if new_sv > 15 and old_sv < 10:
                is_new_closer = True
                role_shift_bonus = 50 # massive flat boost
            elif new_hld > 10 and old_hld < 5 and new_sv < 10:
                is_new_setup = True
                role_shift_bonus = 20
        
        # 3. Calculate TWV
        # Base: 2025 fpts
        # Adjust by Park shift
        twv = base_fpts * (1.0 + park_shift_pct)
        # Adjust by Consistency boost (A/B = slight boost, D/F = slight penalty)
        if consistency_grade in ['A']: twv *= 1.05
        elif consistency_grade in ['B']: twv *= 1.02
        elif consistency_grade in ['D']: twv *= 0.95
        elif consistency_grade in ['F']: twv *= 0.90
            
        # Add flat role bonus
        twv += role_shift_bonus
        
        analysis_output[str(p_id)] = {
            'twv': round(twv, 1),
            'twvDelta': round(twv - base_fpts, 1),
            'consistencyScore': consistency_score,
            'consistencyGrade': consistency_grade,
            'weeklyMean': round(statistics.mean(fpts_list), 1) if len(fpts_list) > 0 else 0,
            'cv': round(cv, 2),
            'oldTeam': old_team,
            'newTeam': new_team,
            'parkShiftPct': round(park_shift_pct * 100, 1),
            'isNewCloser': is_new_closer,
            'isNewSetup': is_new_setup
        }

    out_path = 'src/data/customAnalysis.json'
    with open(out_path, 'w') as f:
        json.dump(analysis_output, f, indent=2)
    print(f"Data saved to {out_path} smoothly.")
    
    # QA checking
    print("\n--- Top TWV Upgrades ---")
    upgrades = sorted(analysis_output.items(), key=lambda x: x[1]['twvDelta'], reverse=True)[:10]
    for uid, d in upgrades:
        player = next(p for p in all_players if str(p['id']) == uid)
        print(f"{player['name']} ({d['oldTeam']}->{d['newTeam']}): +{d['twvDelta']} TWV (New Closer: {d['isNewCloser']})")
        
    print("\n--- Most Consistent Elites (A Grade) ---")
    elites = [x for x in analysis_output.items() if x[1]['consistencyGrade'] == 'A' and x[1]['weeklyMean'] > 15]
    elites = sorted(elites, key=lambda x: x[1]['cv'])[:10]
    for uid, d in elites:
        player = next(p for p in all_players if str(p['id']) == uid)
        print(f"{player['name']}: Mean {d['weeklyMean']} | CV {d['cv']}")

if __name__ == "__main__":
    asyncio.run(main())
