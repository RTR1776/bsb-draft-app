'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import advancedData from '@/data/advancedStats.json'

// ─── Types ──────────────────────────────────────────
type BatterYearStats = {
  exit_velo: number; barrel_pct: number; hard_hit_pct: number;
  launch_angle: number; xba: number; xslg: number;
  sprint_speed: number; k_pct: number; bb_pct: number;
  wrc_plus: number; babip: number; whiff_pct: number; chase_rate: number;
}
type PitcherYearStats = {
  fb_velo: number; spin_rate: number; whiff_pct: number;
  k_pct: number; bb_pct: number; csw_pct: number;
  stuff_plus: number; location_plus: number;
  xera: number; fip: number;
  barrel_against: number; hard_hit_against: number;
  gb_pct: number; chase_rate: number;
}
type BatterEntry = { id: string; name: string; team: string; pos: string; age: number; fpts: number; '2022': BatterYearStats | null; '2023': BatterYearStats | null; '2024': BatterYearStats | null; '2025': BatterYearStats | null }
type PitcherEntry = { id: string; name: string; team: string; role: string; age: number; fpts: number; '2022': PitcherYearStats | null; '2023': PitcherYearStats | null; '2024': PitcherYearStats | null; '2025': PitcherYearStats | null }
type BatterFlat = BatterYearStats & { id: string; name: string; team: string; pos: string; age: number; fpts: number; has2022: boolean; has2023: boolean; has2024: boolean; has2025: boolean }
type PitcherFlat = PitcherYearStats & { id: string; name: string; team: string; role: string; age: number; fpts: number; has2022: boolean; has2023: boolean; has2024: boolean; has2025: boolean }
type SortDir = 'asc' | 'desc'
type PlayerType = 'batters' | 'pitchers'
type StatYear = '2022' | '2023' | '2024' | '2025'

const YEARS: StatYear[] = ['2022', '2023', '2024', '2025']

// ─── Pre-computed flattened data (computed once at module load) ─────
const _batterCache: Record<string, BatterFlat[]> = {}
const _pitcherCache: Record<string, PitcherFlat[]> = {}

function flattenBatters(year: StatYear): BatterFlat[] {
  if (_batterCache[year]) return _batterCache[year]
  _batterCache[year] = (advancedData.batters as BatterEntry[])
    .filter(b => b[year] != null)
    .map(b => ({
      ...b[year]!,
      id: b.id, name: b.name, team: b.team, pos: b.pos, age: b.age, fpts: b.fpts,
      has2022: b['2022'] != null, has2023: b['2023'] != null, has2024: b['2024'] != null, has2025: b['2025'] != null,
    }))
  return _batterCache[year]
}

function flattenPitchers(year: StatYear): PitcherFlat[] {
  if (_pitcherCache[year]) return _pitcherCache[year]
  _pitcherCache[year] = (advancedData.pitchers as PitcherEntry[])
    .filter(p => p[year] != null)
    .map(p => ({
      ...p[year]!,
      id: p.id, name: p.name, team: p.team, role: p.role, age: p.age, fpts: p.fpts,
      has2022: p['2022'] != null, has2023: p['2023'] != null, has2024: p['2024'] != null, has2025: p['2025'] != null,
    }))
  return _pitcherCache[year]
}

// ─── Pagination constants ───────────────────────────
const STATS_PAGE_SIZE = 50

// Get trend arrow for a stat across years
function getTrend(entry: BatterEntry | PitcherEntry, stat: string, invert = false): string {
  const vals: number[] = []
  for (const yr of YEARS) {
    const d = (entry as any)[yr]
    if (d && d[stat] != null) vals.push(d[stat])
  }
  if (vals.length < 2) return ''
  const last = vals[vals.length - 1]
  const prev = vals[vals.length - 2]
  const diff = last - prev
  const threshold = Math.abs(prev) * 0.03 // 3% change threshold
  if (Math.abs(diff) < threshold) return ''
  const improving = invert ? diff < -threshold : diff > threshold
  return improving ? '↑' : '↓'
}

// ─── Animated section wrapper ───────────────────────
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  )
}

// ─── Stat color helpers ─────────────────────────────
function pctColor(val: number, low: number, mid: number, high: number, invert = false) {
  if (invert) {
    if (val <= low) return 'text-green-400'
    if (val <= mid) return 'text-yellow-300'
    return 'text-red-400'
  }
  if (val >= high) return 'text-green-400'
  if (val >= mid) return 'text-yellow-300'
  return 'text-red-400'
}

// ─── Batter Stats Table Columns ─────────────────────
const BATTER_COLS = [
  { key: 'name', label: 'Player', width: 'w-40', align: 'text-left' as const },
  { key: 'pos', label: 'Pos', width: 'w-12', align: 'text-center' as const },
  { key: 'team', label: 'Team', width: 'w-12', align: 'text-center' as const },
  { key: 'age', label: 'Age', width: 'w-10', align: 'text-center' as const },
  { key: 'fpts', label: 'FPTS', width: 'w-14', align: 'text-right' as const },
  { key: 'exit_velo', label: 'EV', width: 'w-12', align: 'text-right' as const },
  { key: 'barrel_pct', label: 'Brl%', width: 'w-12', align: 'text-right' as const },
  { key: 'hard_hit_pct', label: 'HH%', width: 'w-12', align: 'text-right' as const },
  { key: 'launch_angle', label: 'LA', width: 'w-12', align: 'text-right' as const },
  { key: 'xba', label: 'xBA', width: 'w-14', align: 'text-right' as const },
  { key: 'xslg', label: 'xSLG', width: 'w-14', align: 'text-right' as const },
  { key: 'babip', label: 'BABIP', width: 'w-14', align: 'text-right' as const },
  { key: 'k_pct', label: 'K%', width: 'w-12', align: 'text-right' as const },
  { key: 'bb_pct', label: 'BB%', width: 'w-12', align: 'text-right' as const },
  { key: 'wrc_plus', label: 'wRC+', width: 'w-12', align: 'text-right' as const },
  { key: 'sprint_speed', label: 'Spd', width: 'w-12', align: 'text-right' as const },
  { key: 'whiff_pct', label: 'Whiff%', width: 'w-12', align: 'text-right' as const },
  { key: 'chase_rate', label: 'Chase%', width: 'w-12', align: 'text-right' as const },
]

const PITCHER_COLS = [
  { key: 'name', label: 'Player', width: 'w-40', align: 'text-left' as const },
  { key: 'role', label: 'Role', width: 'w-12', align: 'text-center' as const },
  { key: 'team', label: 'Team', width: 'w-12', align: 'text-center' as const },
  { key: 'age', label: 'Age', width: 'w-10', align: 'text-center' as const },
  { key: 'fpts', label: 'FPTS', width: 'w-14', align: 'text-right' as const },
  { key: 'fb_velo', label: 'Velo', width: 'w-12', align: 'text-right' as const },
  { key: 'spin_rate', label: 'Spin', width: 'w-14', align: 'text-right' as const },
  { key: 'whiff_pct', label: 'Whiff%', width: 'w-12', align: 'text-right' as const },
  { key: 'k_pct', label: 'K%', width: 'w-12', align: 'text-right' as const },
  { key: 'bb_pct', label: 'BB%', width: 'w-12', align: 'text-right' as const },
  { key: 'csw_pct', label: 'CSW%', width: 'w-12', align: 'text-right' as const },
  { key: 'stuff_plus', label: 'Stuff+', width: 'w-14', align: 'text-right' as const },
  { key: 'location_plus', label: 'Loc+', width: 'w-12', align: 'text-right' as const },
  { key: 'xera', label: 'xERA', width: 'w-12', align: 'text-right' as const },
  { key: 'fip', label: 'FIP', width: 'w-12', align: 'text-right' as const },
  { key: 'hard_hit_against', label: 'HH%A', width: 'w-12', align: 'text-right' as const },
  { key: 'barrel_against', label: 'Brl%A', width: 'w-12', align: 'text-right' as const },
  { key: 'gb_pct', label: 'GB%', width: 'w-12', align: 'text-right' as const },
  { key: 'chase_rate', label: 'Chase%', width: 'w-12', align: 'text-right' as const },
]

// ─── Position filter options ────────────────────────
const BAT_POS_FILTERS = ['All', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'] as const
const PIT_ROLE_FILTERS = ['All', 'SP', 'RP'] as const

// ─── Stat Glossary ──────────────────────────────────
const GLOSSARY: Record<string, string> = {
  'EV': 'Exit Velocity — average speed of batted balls off the bat (mph)',
  'Brl%': 'Barrel Rate — % of batted balls with ideal exit velocity + launch angle combo for extra bases',
  'HH%': 'Hard Hit Rate — % of batted balls with exit velocity 95+ mph',
  'LA': 'Launch Angle — average vertical angle of batted balls (degrees)',
  'xBA': 'Expected Batting Average — based on exit velocity and launch angle, removes defense/luck',
  'xSLG': 'Expected Slugging — based on quality of contact, removes luck',
  'BABIP': 'Batting Avg on Balls In Play — excludes HR/K/BB, extreme values often regress to mean (~.300)',
  'ISO': 'Isolated Power — SLG minus AVG, pure extra-base power',
  'K%': 'Strikeout Rate — strikeouts per plate appearance',
  'BB%': 'Walk Rate — walks per plate appearance',
  'wRC+': 'Weighted Runs Created Plus — overall offense, 100 is average, 150 = 50% better than avg',
  'Spd': 'Sprint Speed — feet per second, 27 ft/s is average, 30+ is elite',
  'Whiff%': 'Whiff Rate — % of swings that miss entirely (batter or pitcher context)',
  'Chase%': 'Chase Rate — % of pitches outside the zone swung at (lower is better for hitters, higher for pitchers)',
  'GB%': 'Ground Ball Rate — % of batted balls on the ground',
  'Velo': 'Fastball Velocity — average fastball speed (mph)',
  'Spin': 'Spin Rate — average fastball RPM, more spin = more movement',
  'CSW%': 'Called Strikes + Whiffs — % of total pitches that are called strikes or whiffs',
  'Stuff+': 'Stuff Plus — pitch quality metric, 100 is average, higher is better',
  'Loc+': 'Location Plus — command quality metric, 100 is average, higher is better',
  'xERA': 'Expected ERA — ERA based on quality of contact allowed, removes luck/defense',
  'FIP': 'Fielding Independent Pitching — ERA based only on K, BB, HR (things pitcher controls)',
  'HH%A': 'Hard Hit Rate Against — % of batted balls with 95+ mph EV allowed',
  'Brl%A': 'Barrel Rate Against — % of barrels allowed',
}

// ─── Main Page Component ────────────────────────────
export default function AdvancedStatsPage() {
  const [playerType, setPlayerType] = useState<PlayerType>('batters')
  const [sortKey, setSortKey] = useState<string>('fpts')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('All')
  const [showGlossary, setShowGlossary] = useState(false)
  const [statYear, setStatYear] = useState<StatYear>('2025')
  const [statsVisible, setStatsVisible] = useState(STATS_PAGE_SIZE)
  const searchRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearch('')
        setShowGlossary(false)
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Sort handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  // Filtered and sorted data
  const battersSorted = useMemo(() => {
    let data = flattenBatters(statYear)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(b => b.name.toLowerCase().includes(q) || b.team.toLowerCase().includes(q))
    }
    if (posFilter !== 'All') {
      data = data.filter(b => b.pos === posFilter)
    }
    data.sort((a, b) => {
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return data
  }, [search, posFilter, sortKey, sortDir, statYear])

  const pitchersSorted = useMemo(() => {
    let data = flattenPitchers(statYear)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(p => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
    }
    if (posFilter !== 'All') {
      data = data.filter(p => p.role === posFilter)
    }
    data.sort((a, b) => {
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return data
  }, [search, posFilter, sortKey, sortDir, statYear])

  // Reset pagination when filters change
  useEffect(() => {
    setStatsVisible(STATS_PAGE_SIZE)
  }, [playerType, search, posFilter, sortKey, sortDir, statYear])

  const cols = playerType === 'batters' ? BATTER_COLS : PITCHER_COLS
  const posFilters = playerType === 'batters' ? BAT_POS_FILTERS : PIT_ROLE_FILTERS
  const currentData = playerType === 'batters' ? battersSorted : pitchersSorted

  return (
    <div className="min-h-screen bg-bsb-navy text-white">
      {/* ─── FLOATING NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bsb-dark/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-lg font-black text-white">
              BSB<span className="text-bsb-accent">DRAFT</span>
            </span>
            <span className="text-[10px] text-bsb-dim group-hover:text-bsb-gold transition-colors">&larr; Back to Draft</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/guide" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded-full transition-all">
              Guide
            </Link>
            <Link href="/insights" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded-full transition-all">
              Insights
            </Link>
            <Link href="/" className="px-4 py-1.5 bg-bsb-accent/20 border border-bsb-accent/40 rounded-full text-xs font-bold text-bsb-accent hover:bg-bsb-accent/30 transition-all">
              Draft Board &rarr;
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 pt-24 pb-32">
        {/* ═══════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════ */}
        <Section>
          <div className="text-center py-8">
            <div className="text-[11px] text-bsb-accent font-bold uppercase tracking-widest mb-3">Advanced Analytics Deep Dive</div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-bsb-accent to-bsb-gold">Advanced Stats</span>
            </h1>
            <p className="text-bsb-dim max-w-2xl mx-auto text-sm leading-relaxed">
              Statcast metrics, expected stats, plate discipline, and pitch quality data
              for every player in the BSB draft pool.
            </p>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* CONTROLS BAR */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div className="sticky top-[57px] z-40 bg-bsb-navy/95 backdrop-blur-sm border-b border-white/10 py-4 -mx-6 px-6 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Player type toggle */}
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => { setPlayerType('batters'); setPosFilter('All'); setSortKey('fpts') }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    playerType === 'batters' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-bsb-dim hover:text-white'
                  }`}
                >Hitters</button>
                <button
                  onClick={() => { setPlayerType('pitchers'); setPosFilter('All'); setSortKey('fpts') }}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    playerType === 'pitchers' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-bsb-dim hover:text-white'
                  }`}
                >Pitchers</button>
              </div>

              {/* Year selector */}
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                {YEARS.map(yr => (
                  <button key={yr}
                    onClick={() => setStatYear(yr)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      statYear === yr ? 'bg-bsb-gold/20 text-bsb-gold border border-bsb-gold/30' : 'text-bsb-dim hover:text-white'
                    }`}
                  >{yr}</button>
                ))}
              </div>

              {/* Position filter */}
              <div className="flex items-center gap-1">
                {posFilters.map(p => (
                  <button key={p}
                    onClick={() => setPosFilter(p)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      posFilter === p ? 'bg-bsb-gold/20 text-bsb-gold border border-bsb-gold/30' : 'text-bsb-dim hover:text-white hover:bg-white/5'
                    }`}
                  >{p}</button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search players... (/ or Ctrl+K)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-bsb-dim focus:outline-none focus:border-bsb-accent focus:bg-white/10 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-bsb-dim hover:text-white text-xs">&times;</button>
                )}
              </div>

              {/* Glossary toggle */}
              <button
                onClick={() => setShowGlossary(!showGlossary)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showGlossary ? 'bg-bsb-gold/20 text-bsb-gold border border-bsb-gold/30' : 'text-bsb-dim hover:text-white bg-white/5 border border-white/10'
                }`}
              >?</button>
            </div>

            {/* Glossary Panel */}
            {showGlossary && (
              <div className="mt-4 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] max-h-64 overflow-y-auto">
                <h3 className="text-xs font-bold text-bsb-gold mb-3 uppercase tracking-wider">Stat Glossary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(GLOSSARY).map(([k, v]) => (
                    <div key={k} className="text-[11px]">
                      <span className="text-bsb-accent font-bold">{k}</span>
                      <span className="text-bsb-dim"> — {v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* STATS TABLE VIEW */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={200}>
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-2 py-3 text-left text-[10px] text-bsb-dim font-bold uppercase tracking-wider sticky left-0 bg-bsb-dark/90 z-10 w-8">#</th>
                      {cols.map(col => (
                        <th key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-2 py-3 ${col.align} text-[10px] text-bsb-dim font-bold uppercase tracking-wider cursor-pointer hover:text-bsb-gold transition-colors whitespace-nowrap ${
                            col.key === 'name' ? 'sticky left-8 bg-bsb-dark/90 z-10' : ''
                          }`}
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span className="ml-0.5 text-bsb-accent">{sortDir === 'desc' ? '\u25BC' : '\u25B2'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.slice(0, statsVisible).map((row, i) => (
                        <tr key={row.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="px-2 py-2 text-bsb-dim sticky left-0 bg-bsb-navy/90 z-10">{i + 1}</td>
                          {cols.map(col => {
                            const val = (row as any)[col.key]
                            let colorClass = ''
                            let displayVal = val

                            // Color coding for key stats
                            if (playerType === 'batters') {
                              if (col.key === 'exit_velo') colorClass = pctColor(val, 87, 89, 92)
                              else if (col.key === 'barrel_pct') colorClass = pctColor(val, 5, 8, 12)
                              else if (col.key === 'hard_hit_pct') colorClass = pctColor(val, 32, 38, 44)
                              else if (col.key === 'xba') colorClass = pctColor(val, 0.230, 0.255, 0.280)
                              else if (col.key === 'xslg') colorClass = pctColor(val, 0.370, 0.420, 0.480)
                              else if (col.key === 'babip') colorClass = val > 0.340 ? 'text-yellow-300' : val < 0.260 ? 'text-yellow-300' : 'text-white'
                              else if (col.key === 'k_pct') colorClass = pctColor(val, 15, 22, 28, true)
                              else if (col.key === 'bb_pct') colorClass = pctColor(val, 6, 9, 12)
                              else if (col.key === 'wrc_plus') colorClass = pctColor(val, 90, 110, 130)
                              else if (col.key === 'sprint_speed') colorClass = pctColor(val, 26, 27.5, 29)
                              else if (col.key === 'whiff_pct') colorClass = pctColor(val, 15, 22, 28, true)
                              else if (col.key === 'chase_rate') colorClass = pctColor(val, 22, 27, 32, true)
                              else if (col.key === 'fpts') colorClass = 'text-bsb-gold font-bold'
                            } else {
                              if (col.key === 'fb_velo') colorClass = pctColor(val, 92, 95, 97)
                              else if (col.key === 'whiff_pct') colorClass = pctColor(val, 20, 25, 30)
                              else if (col.key === 'k_pct') colorClass = pctColor(val, 20, 25, 30)
                              else if (col.key === 'bb_pct') colorClass = pctColor(val, 5, 7, 9, true)
                              else if (col.key === 'csw_pct') colorClass = pctColor(val, 26, 29, 32)
                              else if (col.key === 'stuff_plus') colorClass = pctColor(val, 90, 105, 120)
                              else if (col.key === 'location_plus') colorClass = pctColor(val, 90, 105, 115)
                              else if (col.key === 'xera') colorClass = pctColor(val, 3.0, 3.5, 4.2, true)
                              else if (col.key === 'fip') colorClass = pctColor(val, 3.0, 3.5, 4.2, true)
                              else if (col.key === 'hard_hit_against') colorClass = pctColor(val, 28, 33, 38, true)
                              else if (col.key === 'barrel_against') colorClass = pctColor(val, 5, 7, 9, true)
                              else if (col.key === 'gb_pct') colorClass = pctColor(val, 38, 44, 50)
                              else if (col.key === 'chase_rate') colorClass = pctColor(val, 28, 32, 36)
                              else if (col.key === 'fpts') colorClass = 'text-bsb-gold font-bold'
                            }

                            // Format display values
                            if (typeof val === 'number') {
                              if (['xba', 'xslg', 'babip'].includes(col.key)) {
                                displayVal = val.toFixed(3)
                              } else if (['xera', 'fip'].includes(col.key)) {
                                displayVal = val.toFixed(2)
                              } else if (['exit_velo', 'fb_velo', 'launch_angle', 'sprint_speed'].includes(col.key)) {
                                displayVal = val.toFixed(1)
                              } else if (['k_pct', 'bb_pct', 'hard_hit_pct', 'barrel_pct', 'gb_pct', 'whiff_pct', 'csw_pct', 'hard_hit_against', 'barrel_against', 'chase_rate'].includes(col.key)) {
                                displayVal = val.toFixed(1)
                              }
                            }

                            return (
                              <td key={col.key}
                                className={`px-2 py-2 ${col.align} ${colorClass || 'text-white'} whitespace-nowrap ${
                                  col.key === 'name' ? 'sticky left-8 bg-bsb-navy/90 z-10 font-semibold' : ''
                                }`}
                              >
                                {col.key === 'name' ? (
                                  <span>{displayVal}</span>
                                ) : col.key === 'role' ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    val === 'SP' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                  }`}>{displayVal}</span>
                                ) : col.key === 'pos' ? (
                                  <span className="text-bsb-dim font-medium">{displayVal}</span>
                                ) : (
                                  displayVal
                                )}
                              </td>
                            )
                          })}
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-bsb-dim">
                  Showing {Math.min(statsVisible, currentData.length)} of {currentData.length} {playerType} &middot; Click column headers to sort &middot; Green = elite, Yellow = above avg, Red = below avg
                </span>
                {statsVisible < currentData.length && (
                  <button
                    onClick={() => setStatsVisible(v => v + STATS_PAGE_SIZE)}
                    className="px-4 py-1.5 bg-bsb-accent/20 border border-bsb-accent/40 rounded-full text-[11px] font-bold text-bsb-accent hover:bg-bsb-accent/30 transition-all"
                  >
                    Load {Math.min(STATS_PAGE_SIZE, currentData.length - statsVisible)} more
                  </button>
                )}
              </div>
            </div>
          </Section>

        {/* ═══════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={300}>
          <div className="text-center mt-16 pt-8 border-t border-white/[0.06]">
            <p className="text-bsb-dim text-xs">
              Advanced stats derived from Statcast-style metrics, expected stats models, and pitch quality grades.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/guide" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">League Guide</Link>
              <Link href="/insights" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">Variance Insights</Link>
              <Link href="/" className="text-xs text-bsb-accent hover:text-bsb-accent/80 transition-all">Draft Board</Link>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
