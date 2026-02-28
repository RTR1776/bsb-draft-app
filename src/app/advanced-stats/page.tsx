'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import advancedData from '@/data/advancedStats.json'
import analysesData from '@/data/playerAnalyses.json'
import battersData from '@/data/batters.json'
import pitchersData from '@/data/pitchers.json'

// ─── Types ──────────────────────────────────────────
type BatterAdv = typeof advancedData.batters[number]
type PitcherAdv = typeof advancedData.pitchers[number]
type AnalysisEntry = { valuation: string; age_phase: string; value_tag: string; breakout: boolean; type: string }
type SortDir = 'asc' | 'desc'
type PlayerType = 'batters' | 'pitchers'
type SubTab = 'stats' | 'analysis'

const analyses = analysesData as Record<string, AnalysisEntry>

// ─── Batter core data lookup ────────────────────────
const batterCore = Object.fromEntries((battersData as any[]).map(b => [b.id, b]))
const pitcherCore = Object.fromEntries((pitchersData as any[]).map(p => [p.id, p]))

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

function valuationColor(v: string) {
  if (v.includes('UNDER')) return 'text-green-400'
  if (v.includes('OVER')) return 'text-red-400'
  return 'text-bsb-dim'
}

function valuationBg(v: string) {
  if (v.includes('UNDER')) return 'bg-green-500/10 border-green-500/20'
  if (v.includes('OVER')) return 'bg-red-500/10 border-red-500/20'
  return 'bg-white/[0.03] border-white/[0.06]'
}

function tierBadge(tag: string) {
  const colors: Record<string, string> = {
    'ELITE': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'PREMIUM': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'SOLID': 'bg-green-500/20 text-green-300 border-green-500/30',
    'AVERAGE': 'bg-white/10 text-bsb-dim border-white/10',
    'REPLACEMENT': 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return colors[tag] || 'bg-white/10 text-bsb-dim border-white/10'
}

// ─── Bar Chart Component ────────────────────────────
function StatBar({ value, max, color = 'bg-bsb-accent' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Generate analysis text ─────────────────────────
function generateBatterAnalysis(b: BatterAdv, core: any, a: AnalysisEntry): string {
  const hist = core.histFpts || {}
  const histVals = Object.entries(hist).sort(([a],[b]) => a.localeCompare(b))
  const trendText = histVals.length >= 2
    ? (histVals[histVals.length-1][1] as number) > (histVals[histVals.length-2][1] as number)
      ? 'on an upward trajectory'
      : 'trending downward'
    : 'with limited track record'

  const parts: string[] = []

  // Lead with most interesting stat
  if (b.barrel_pct >= 15) {
    parts.push(`${b.name} is an elite barrel machine at ${b.barrel_pct}% barrel rate, ranking among the top power threats in the game.`)
  } else if (b.sprint_speed >= 29.5) {
    parts.push(`${b.name} is a true speed demon with a ${b.sprint_speed} ft/s sprint speed, making him a weapon on the basepaths.`)
  } else if (b.exit_velo >= 92) {
    parts.push(`${b.name} consistently drives the ball with authority, posting a ${b.exit_velo} mph exit velocity that ranks among the elite.`)
  } else if (b.wrc_plus >= 140) {
    parts.push(`${b.name} is an offensive force with a ${b.wrc_plus} wRC+, meaning he produces ${b.wrc_plus - 100}% more run value than the average hitter.`)
  } else if (b.bb_pct >= 12 && b.k_pct <= 18) {
    parts.push(`${b.name} has an elite plate approach with a ${b.bb_pct}% walk rate against just a ${b.k_pct}% strikeout rate — a rare discipline combo.`)
  } else if (b.contact_pct >= 88) {
    parts.push(`${b.name} is a contact wizard at ${b.contact_pct}% contact rate, rarely giving away at-bats and consistently putting the ball in play.`)
  } else {
    parts.push(`${b.name} projects for ${core.fpts} FPTS this season as a ${core.pos} for ${core.team}.`)
  }

  // xStats comparison
  if (b.xba > core.avg + 0.012) {
    parts.push(`His expected batting average of ${b.xba} exceeds his projected ${core.avg} AVG, suggesting his batted ball quality deserves a higher average — there's upside here.`)
  } else if (b.xba < core.avg - 0.012) {
    parts.push(`His xBA of ${b.xba} sits below his projected ${core.avg} AVG, hinting that some BABIP luck may be baked into his projections.`)
  }

  if (b.xslg > core.slg + 0.025) {
    parts.push(`His xSLG of ${b.xslg} outpaces his projected ${core.slg} SLG, meaning his raw power metrics support even more production.`)
  }

  // BABIP flag
  if (b.babip >= 0.350) {
    parts.push(`A ${b.babip} BABIP is elevated and could regress, though his ${b.hard_hit_pct}% hard hit rate may sustain it.`)
  } else if (b.babip <= 0.260) {
    parts.push(`A ${b.babip} BABIP looks unlucky and could bounce back — this is a buy-low indicator.`)
  }

  // Age / trajectory
  if (a.age_phase === 'pre-peak') {
    parts.push(`At just ${b.age}, he's still entering his physical prime and ${trendText} — the ceiling hasn't been reached yet.`)
  } else if (a.age_phase === 'prime') {
    parts.push(`At ${b.age}, he's squarely in his prime years and ${trendText}.`)
  } else if (a.age_phase === 'late career') {
    parts.push(`At ${b.age}, the aging curve is working against him, and ${trendText} — manage expectations accordingly.`)
  }

  // Breakout flag
  if (a.breakout) {
    parts.push(`BREAKOUT CANDIDATE: The combination of age, trajectory, and batted-ball quality makes him a prime breakout pick who could significantly outperform projections.`)
  }

  // BSB scoring insight
  if (core.sb >= 20 && core.hr >= 25) {
    parts.push(`In BSB scoring, his ${core.hr} HR and ${core.sb} SB combo is gold — total bases + stolen bases create a high weekly floor.`)
  } else if (core.bb >= 80) {
    parts.push(`His ${core.bb} projected walks are a hidden gem in BSB scoring where walks count as +1 each — that's ${core.bb} free points most drafters overlook.`)
  }

  // Final verdict
  parts.push(`Verdict: ${a.valuation} for BSB drafts.`)

  return parts.join(' ')
}

function generatePitcherAnalysis(p: PitcherAdv, core: any, a: AnalysisEntry): string {
  const hist = core.histFpts || {}
  const histVals = Object.entries(hist).sort(([a],[b]) => a.localeCompare(b))
  const trendText = histVals.length >= 2
    ? (histVals[histVals.length-1][1] as number) > (histVals[histVals.length-2][1] as number)
      ? 'on an upward trajectory'
      : 'trending downward'
    : 'with limited track record'

  const parts: string[] = []

  // Lead with most interesting stat
  if (p.stuff_plus >= 130) {
    parts.push(`${p.name} has absolutely elite stuff with a ${p.stuff_plus} Stuff+ rating, possessing the kind of pitch arsenal that dominates lineups.`)
  } else if (p.whiff_pct >= 30) {
    parts.push(`${p.name} is a swing-and-miss monster at ${p.whiff_pct}% whiff rate, generating strikeouts at an elite clip.`)
  } else if (p.fb_velo >= 98) {
    parts.push(`${p.name} brings the heat at ${p.fb_velo} mph average fastball velocity, blowing hitters away with pure gas.`)
  } else if (p.xera <= 2.5) {
    parts.push(`${p.name} is a pitching machine with a ${p.xera} xERA that validates his elite run prevention.`)
  } else if (p.k_pct >= 28 && p.bb_pct <= 5) {
    parts.push(`${p.name} has an outstanding K-BB profile: ${p.k_pct}% strikeout rate with just ${p.bb_pct}% walks — that's elite command paired with dominance.`)
  } else if (p.gb_pct >= 52) {
    parts.push(`${p.name} is a ground ball artist at ${p.gb_pct}% GB rate, keeping the ball on the ground and limiting damage.`)
  } else {
    parts.push(`${p.name} projects for ${core.fpts} FPTS this season as a ${core.role} for ${core.team}.`)
  }

  // xERA vs ERA
  if (p.xera < core.era - 0.2) {
    parts.push(`His xERA of ${p.xera} significantly undercuts his projected ${core.era} ERA, suggesting he's been somewhat unlucky or his underlying metrics support better results.`)
  } else if (p.xera > core.era + 0.25) {
    parts.push(`Watch out: his xERA of ${p.xera} sits above his projected ${core.era} ERA, meaning some regression could be coming.`)
  }

  // FIP analysis
  if (Math.abs(p.fip - core.era) > 0.3) {
    if (p.fip < core.era) {
      parts.push(`His ${p.fip} FIP is better than his ERA — a sign that his fielding-independent metrics are strong and he may be due for positive regression.`)
    } else {
      parts.push(`His ${p.fip} FIP is worse than his ERA, which could indicate some ERA regression ahead.`)
    }
  }

  // Spin and velo
  if (p.spin_rate >= 2500) {
    parts.push(`A ${p.spin_rate} RPM spin rate on his fastball generates elite movement and deception.`)
  }
  if (p.hard_hit_against <= 28) {
    parts.push(`Opponents manage just ${p.hard_hit_against}% hard contact against him, reflecting true dominance.`)
  } else if (p.hard_hit_against >= 38) {
    parts.push(`A ${p.hard_hit_against}% hard hit rate allowed is concerning and suggests the underlying quality may not match the surface stats.`)
  }

  // Age / trajectory
  if (a.age_phase === 'pre-peak') {
    parts.push(`At just ${p.age}, he's still developing and ${trendText} — there's room to grow.`)
  } else if (a.age_phase === 'late career') {
    parts.push(`At ${p.age}, age is a factor, and ${trendText} — velocity and stamina declines are real risks.`)
  }

  // Breakout
  if (a.breakout) {
    parts.push(`BREAKOUT CANDIDATE: His combination of stuff, age, and trajectory make him a prime candidate to take a major leap forward.`)
  }

  // BSB scoring insight
  if (core.role === 'SP') {
    const ipPts = Math.round(core.ip * 3)
    const kPts = core.so
    parts.push(`In BSB scoring, his ${core.ip} projected IP (+3 each = ${ipPts} pts) plus ${core.so} K's makes him a ${core.fpts >= 550 ? 'workhorse ace' : 'solid innings eater'}.`)
  } else {
    if (core.sv > 0) {
      const svPts = core.sv * 8
      parts.push(`As a closer, his ${core.sv} projected saves at +8 each (${svPts} pts) make him extremely valuable in BSB scoring — saves are premium currency.`)
    } else if (core.hld > 0) {
      const hldPts = core.hld * 6
      parts.push(`His ${core.hld} projected holds at +6 each (${hldPts} pts) plus IRSTR bonuses make him a sneaky BSB value as a setup man.`)
    }
  }

  parts.push(`Verdict: ${a.valuation} for BSB drafts.`)

  return parts.join(' ')
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
  { key: 'iso', label: 'ISO', width: 'w-14', align: 'text-right' as const },
  { key: 'k_pct', label: 'K%', width: 'w-12', align: 'text-right' as const },
  { key: 'bb_pct', label: 'BB%', width: 'w-12', align: 'text-right' as const },
  { key: 'wrc_plus', label: 'wRC+', width: 'w-12', align: 'text-right' as const },
  { key: 'sprint_speed', label: 'Spd', width: 'w-12', align: 'text-right' as const },
  { key: 'contact_pct', label: 'Cnt%', width: 'w-12', align: 'text-right' as const },
  { key: 'o_swing_pct', label: 'O-Sw%', width: 'w-12', align: 'text-right' as const },
  { key: 'gb_pct', label: 'GB%', width: 'w-12', align: 'text-right' as const },
  { key: 'fb_pct', label: 'FB%', width: 'w-12', align: 'text-right' as const },
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
  { key: 'swstr_pct', label: 'SwStr%', width: 'w-12', align: 'text-right' as const },
  { key: 'stuff_plus', label: 'Stuff+', width: 'w-14', align: 'text-right' as const },
  { key: 'location_plus', label: 'Loc+', width: 'w-12', align: 'text-right' as const },
  { key: 'xera', label: 'xERA', width: 'w-12', align: 'text-right' as const },
  { key: 'fip', label: 'FIP', width: 'w-12', align: 'text-right' as const },
  { key: 'xfip', label: 'xFIP', width: 'w-12', align: 'text-right' as const },
  { key: 'siera', label: 'SIERA', width: 'w-12', align: 'text-right' as const },
  { key: 'hard_hit_against', label: 'HH%A', width: 'w-12', align: 'text-right' as const },
  { key: 'barrel_against', label: 'Brl%A', width: 'w-12', align: 'text-right' as const },
  { key: 'gb_pct', label: 'GB%', width: 'w-12', align: 'text-right' as const },
  { key: 'babip_against', label: 'BABIP', width: 'w-14', align: 'text-right' as const },
  { key: 'lob_pct', label: 'LOB%', width: 'w-12', align: 'text-right' as const },
  { key: 'hr_per_9', label: 'HR/9', width: 'w-12', align: 'text-right' as const },
  { key: 'o_swing_pct', label: 'O-Sw%', width: 'w-12', align: 'text-right' as const },
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
  'Cnt%': 'Contact Rate — % of swings making contact',
  'O-Sw%': 'Chase Rate — % of pitches outside the zone that the batter swings at (lower is better for hitters)',
  'GB%': 'Ground Ball Rate — % of batted balls on the ground',
  'FB%': 'Fly Ball Rate — % of batted balls in the air',
  'Velo': 'Fastball Velocity — average fastball speed (mph)',
  'Spin': 'Spin Rate — average fastball RPM, more spin = more movement',
  'Whiff%': 'Whiff Rate — % of swings that miss entirely',
  'CSW%': 'Called Strikes + Whiffs — % of total pitches that are called strikes or whiffs',
  'SwStr%': 'Swinging Strike Rate — % of all pitches that result in swinging strikes',
  'Stuff+': 'Stuff Plus — pitch quality metric, 100 is average, higher is better',
  'Loc+': 'Location Plus — command quality metric, 100 is average, higher is better',
  'xERA': 'Expected ERA — ERA based on quality of contact allowed, removes luck/defense',
  'FIP': 'Fielding Independent Pitching — ERA based only on K, BB, HR (things pitcher controls)',
  'xFIP': 'Expected FIP — FIP with normalized HR/FB rate',
  'SIERA': 'Skill-Interactive ERA — advanced ERA estimator using K%, BB%, GB%',
  'HH%A': 'Hard Hit Rate Against — % of batted balls with 95+ mph EV allowed',
  'Brl%A': 'Barrel Rate Against — % of barrels allowed',
  'LOB%': 'Left on Base % — % of baserunners who don\'t score, extreme values regress to ~72%',
  'HR/9': 'Home Runs per 9 Innings — rate of HR allowed',
}

// ─── Main Page Component ────────────────────────────
export default function AdvancedStatsPage() {
  const [playerType, setPlayerType] = useState<PlayerType>('batters')
  const [subTab, setSubTab] = useState<SubTab>('stats')
  const [sortKey, setSortKey] = useState<string>('fpts')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('All')
  const [showGlossary, setShowGlossary] = useState(false)
  const [analysisFilter, setAnalysisFilter] = useState<string>('all')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
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
        setExpandedPlayer(null)
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
    let data = [...advancedData.batters]
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
  }, [search, posFilter, sortKey, sortDir])

  const pitchersSorted = useMemo(() => {
    let data = [...advancedData.pitchers]
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
  }, [search, posFilter, sortKey, sortDir])

  // Analysis data
  const analysisPlayers = useMemo(() => {
    const isB = playerType === 'batters'
    const items = isB ? advancedData.batters : advancedData.pitchers
    let filtered = items.map(p => ({
      ...p,
      analysis: analyses[p.id],
      core: isB ? batterCore[p.id] : pitcherCore[p.id],
    })).filter(p => p.analysis)

    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
    }

    if (posFilter !== 'All') {
      filtered = filtered.filter(p => isB ? (p as any).pos === posFilter : (p as any).role === posFilter)
    }

    if (analysisFilter === 'undervalued') {
      filtered = filtered.filter(p => p.analysis.valuation.includes('UNDER'))
    } else if (analysisFilter === 'overvalued') {
      filtered = filtered.filter(p => p.analysis.valuation.includes('OVER'))
    } else if (analysisFilter === 'breakout') {
      filtered = filtered.filter(p => p.analysis.breakout)
    }

    // Sort by FPTS desc by default for analysis
    filtered.sort((a, b) => b.fpts - a.fpts)
    return filtered
  }, [playerType, search, posFilter, analysisFilter])

  const navItems = [
    { id: 'stats', label: 'Stat Tables' },
    { id: 'analysis', label: 'Player Analysis' },
  ]

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
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button key={item.id}
                onClick={() => setSubTab(item.id as SubTab)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  subTab === item.id ? 'bg-bsb-accent/20 text-bsb-accent' : 'text-bsb-dim hover:text-white hover:bg-white/5'
                }`}
              >{item.label}</button>
            ))}
          </div>
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
              Advanced Stats &<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-bsb-accent to-bsb-gold">Player Analysis</span>
            </h1>
            <p className="text-bsb-dim max-w-2xl mx-auto text-sm leading-relaxed">
              Statcast metrics, expected stats, plate discipline, pitch quality data, and personalized analysis
              for every player in the BSB draft pool. Find undervalued gems and avoid overpriced busts.
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

              {/* Sub-tab toggle (mobile) */}
              <div className="flex md:hidden bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setSubTab('stats')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    subTab === 'stats' ? 'bg-bsb-accent/20 text-bsb-accent' : 'text-bsb-dim'
                  }`}
                >Stats</button>
                <button
                  onClick={() => setSubTab('analysis')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    subTab === 'analysis' ? 'bg-bsb-accent/20 text-bsb-accent' : 'text-bsb-dim'
                  }`}
                >Analysis</button>
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

              {/* Analysis filters (when in analysis mode) */}
              {subTab === 'analysis' && (
                <div className="flex items-center gap-1 ml-auto">
                  {[
                    { key: 'all', label: 'All', color: 'bsb-dim' },
                    { key: 'undervalued', label: 'Undervalued', color: 'green-400' },
                    { key: 'overvalued', label: 'Overvalued', color: 'red-400' },
                    { key: 'breakout', label: 'Breakout', color: 'yellow-300' },
                  ].map(f => (
                    <button key={f.key}
                      onClick={() => setAnalysisFilter(f.key)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                        analysisFilter === f.key
                          ? `bg-${f.color}/20 text-${f.color} border border-${f.color}/30`
                          : 'text-bsb-dim hover:text-white hover:bg-white/5'
                      }`}
                    >{f.label}</button>
                  ))}
                </div>
              )}

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
        {subTab === 'stats' && (
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
                    {currentData.map((row, i) => {
                      const a = analyses[row.id]
                      return (
                        <tr key={row.id}
                          className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors ${
                            a?.breakout ? 'bg-yellow-500/[0.03]' : ''
                          }`}
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
                              else if (col.key === 'iso') colorClass = pctColor(val, 0.130, 0.175, 0.220)
                              else if (col.key === 'contact_pct') colorClass = pctColor(val, 72, 78, 84)
                              else if (col.key === 'o_swing_pct') colorClass = pctColor(val, 25, 30, 35, true)
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
                              else if (col.key === 'xfip') colorClass = pctColor(val, 3.0, 3.6, 4.2, true)
                              else if (col.key === 'siera') colorClass = pctColor(val, 3.0, 3.5, 4.0, true)
                              else if (col.key === 'hard_hit_against') colorClass = pctColor(val, 28, 33, 38, true)
                              else if (col.key === 'barrel_against') colorClass = pctColor(val, 5, 7, 9, true)
                              else if (col.key === 'swstr_pct') colorClass = pctColor(val, 10, 12, 14)
                              else if (col.key === 'gb_pct') colorClass = pctColor(val, 38, 44, 50)
                              else if (col.key === 'hr_per_9') colorClass = pctColor(val, 0.8, 1.1, 1.4, true)
                              else if (col.key === 'fpts') colorClass = 'text-bsb-gold font-bold'
                            }

                            // Format display values
                            if (typeof val === 'number') {
                              if (['xba', 'xslg', 'babip', 'iso', 'babip_against'].includes(col.key)) {
                                displayVal = val.toFixed(3)
                              } else if (['xera', 'fip', 'xfip', 'siera', 'hr_per_9'].includes(col.key)) {
                                displayVal = val.toFixed(2)
                              } else if (['exit_velo', 'fb_velo', 'launch_angle'].includes(col.key)) {
                                displayVal = val.toFixed(1)
                              } else if (['k_pct', 'bb_pct', 'hard_hit_pct', 'barrel_pct', 'o_swing_pct', 'contact_pct', 'pull_pct', 'gb_pct', 'fb_pct', 'whiff_pct', 'csw_pct', 'swstr_pct', 'hard_hit_against', 'barrel_against', 'lob_pct'].includes(col.key)) {
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
                                  <div className="flex items-center gap-1.5">
                                    <span>{displayVal}</span>
                                    {a?.breakout && <span className="text-yellow-400 text-[9px]" title="Breakout Candidate">&#9733;</span>}
                                    {a?.valuation.includes('UNDER') && <span className="text-green-400 text-[9px]" title={a.valuation}>&#9650;</span>}
                                    {a?.valuation.includes('OVER') && <span className="text-red-400 text-[9px]" title={a.valuation}>&#9660;</span>}
                                  </div>
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-white/[0.06] text-[10px] text-bsb-dim">
                Showing {currentData.length} {playerType} &middot; Click column headers to sort &middot; Green = elite, Yellow = above avg, Red = below avg
              </div>
            </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* ANALYSIS VIEW */}
        {/* ═══════════════════════════════════════ */}
        {subTab === 'analysis' && (
          <Section delay={200}>
            <div className="space-y-3">
              {/* Summary strip */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex-1 min-w-[160px] bg-green-500/[0.06] border border-green-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-green-400">
                    {analysisPlayers.filter(p => p.analysis.valuation.includes('UNDER')).length}
                  </div>
                  <div className="text-[10px] text-green-400/70 uppercase tracking-wider mt-1">Undervalued</div>
                </div>
                <div className="flex-1 min-w-[160px] bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-red-400">
                    {analysisPlayers.filter(p => p.analysis.valuation.includes('OVER')).length}
                  </div>
                  <div className="text-[10px] text-red-400/70 uppercase tracking-wider mt-1">Overvalued</div>
                </div>
                <div className="flex-1 min-w-[160px] bg-yellow-500/[0.06] border border-yellow-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-yellow-300">
                    {analysisPlayers.filter(p => p.analysis.breakout).length}
                  </div>
                  <div className="text-[10px] text-yellow-300/70 uppercase tracking-wider mt-1">Breakout Candidates</div>
                </div>
                <div className="flex-1 min-w-[160px] bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-bsb-dim">
                    {analysisPlayers.filter(p => p.analysis.valuation === 'FAIRLY VALUED').length}
                  </div>
                  <div className="text-[10px] text-bsb-dim/70 uppercase tracking-wider mt-1">Fairly Valued</div>
                </div>
              </div>

              {/* Player Analysis Cards */}
              {analysisPlayers.map(player => {
                const isB = playerType === 'batters'
                const a = player.analysis
                const core = player.core
                const expanded = expandedPlayer === player.id
                const analysisText = isB
                  ? generateBatterAnalysis(player as any, core, a)
                  : generatePitcherAnalysis(player as any, core, a)

                return (
                  <div key={player.id}
                    className={`rounded-xl border transition-all cursor-pointer ${valuationBg(a.valuation)} ${
                      expanded ? 'ring-1 ring-bsb-accent/40' : ''
                    }`}
                    onClick={() => setExpandedPlayer(expanded ? null : player.id)}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{player.name}</span>
                          <span className="text-[10px] text-bsb-dim">{player.team}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isB
                              ? 'bg-blue-500/15 text-blue-400'
                              : (player as any).role === 'SP' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'
                          }`}>{isB ? (player as any).pos : (player as any).role}</span>
                          <span className="text-[10px] text-bsb-dim">Age {player.age}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${tierBadge(a.value_tag)}`}>
                            {a.value_tag}
                          </span>
                          <span className={`text-[10px] font-bold ${valuationColor(a.valuation)}`}>
                            {a.valuation}
                          </span>
                          {a.breakout && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                              BREAKOUT
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-bsb-gold">{player.fpts}</div>
                        <div className="text-[9px] text-bsb-dim uppercase">FPTS</div>
                      </div>
                      <div className="text-bsb-dim text-xs ml-2">
                        {expanded ? '\u25B2' : '\u25BC'}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {expanded && (
                      <div className="px-4 pb-4 border-t border-white/[0.06]">
                        {/* Key stats mini-grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 mb-4">
                          {isB ? (
                            <>
                              <MiniStat label="EV" value={`${(player as any).exit_velo}`} color={pctColor((player as any).exit_velo, 87, 89, 92)} />
                              <MiniStat label="Barrel%" value={`${(player as any).barrel_pct}`} color={pctColor((player as any).barrel_pct, 5, 8, 12)} />
                              <MiniStat label="HardHit%" value={`${(player as any).hard_hit_pct}`} color={pctColor((player as any).hard_hit_pct, 32, 38, 44)} />
                              <MiniStat label="xBA" value={(player as any).xba.toFixed(3)} color={pctColor((player as any).xba, 0.230, 0.255, 0.280)} />
                              <MiniStat label="BABIP" value={(player as any).babip.toFixed(3)} color="text-white" />
                              <MiniStat label="wRC+" value={`${(player as any).wrc_plus}`} color={pctColor((player as any).wrc_plus, 90, 110, 130)} />
                            </>
                          ) : (
                            <>
                              <MiniStat label="Velo" value={`${(player as any).fb_velo}`} color={pctColor((player as any).fb_velo, 92, 95, 97)} />
                              <MiniStat label="Whiff%" value={`${(player as any).whiff_pct}`} color={pctColor((player as any).whiff_pct, 20, 25, 30)} />
                              <MiniStat label="Stuff+" value={`${(player as any).stuff_plus}`} color={pctColor((player as any).stuff_plus, 90, 105, 120)} />
                              <MiniStat label="xERA" value={(player as any).xera.toFixed(2)} color={pctColor((player as any).xera, 3.0, 3.5, 4.2, true)} />
                              <MiniStat label="FIP" value={(player as any).fip.toFixed(2)} color={pctColor((player as any).fip, 3.0, 3.5, 4.2, true)} />
                              <MiniStat label="K%" value={`${(player as any).k_pct}`} color={pctColor((player as any).k_pct, 20, 25, 30)} />
                            </>
                          )}
                        </div>

                        {/* Analysis paragraph */}
                        <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
                          <div className="text-[10px] text-bsb-accent font-bold uppercase tracking-wider mb-2">Analysis</div>
                          <p className="text-sm text-white/90 leading-relaxed">{analysisText}</p>
                        </div>

                        {/* Historical FPTS */}
                        {core.histFpts && Object.keys(core.histFpts).length > 0 && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-[10px] text-bsb-dim uppercase tracking-wider">History:</span>
                            {Object.entries(core.histFpts).sort(([a],[b]) => a.localeCompare(b)).map(([yr, val]) => (
                              <div key={yr} className="flex items-center gap-1">
                                <span className="text-[10px] text-bsb-dim">{yr}:</span>
                                <span className="text-xs font-bold text-white">{String(val)}</span>
                              </div>
                            ))}
                            <span className="text-[10px] text-bsb-dim">|</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-bsb-gold uppercase">2025 Proj:</span>
                              <span className="text-xs font-bold text-bsb-gold">{core.fpts}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {analysisPlayers.length === 0 && (
                <div className="text-center py-12 text-bsb-dim">
                  No players match your filters.
                </div>
              )}
            </div>
          </Section>
        )}

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

// ─── Mini Stat Component ────────────────────────────
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.04] rounded-lg p-2 text-center border border-white/[0.06]">
      <div className={`text-sm font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-bsb-dim uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}
