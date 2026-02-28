'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import varianceData from '@/data/weeklyVariance.json'
import rpStrategyData from '@/data/rpStrategy.json'

// ─── Types ──────────────────────────────────────────
type DistSummary = {
  mean: number; median: number; stdev: number; cv: number
  min: number; max: number; p10: number; p25: number; p75: number; p90: number
  count: number
}
type ConsistencyEntry = {
  name: string; meanWeekly: number; stdev: number; cv: number
  weeksPlayed: number; role?: string; gamesPerWeek?: number
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
      { threshold: 0.15 }
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

// ─── Stat Pill ──────────────────────────────────────
function StatPill({ label, value, color = 'bsb-gold' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <span className={`text-2xl font-black text-${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">{label}</span>
    </div>
  )
}

// ─── Comparison Metric Card ─────────────────────────
function ComparisonMetric({ label, hitVal, pitVal, unit, lowerBetter }: {
  label: string; hitVal: number; pitVal: number; unit?: string; lowerBetter?: boolean
}) {
  const hitWins = lowerBetter ? hitVal < pitVal : hitVal > pitVal
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
      <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-3">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-center flex-1">
          <div className={`text-xl font-black ${hitWins ? 'text-blue-400' : 'text-white/30'}`}>
            {hitVal.toFixed(1)}{unit || ''}
          </div>
          <div className="text-[9px] text-bsb-dim mt-1">HITTING</div>
        </div>
        <div className="text-bsb-dim text-[10px] font-bold px-2 pb-1">vs</div>
        <div className="text-center flex-1">
          <div className={`text-xl font-black ${!hitWins ? 'text-red-400' : 'text-white/30'}`}>
            {pitVal.toFixed(1)}{unit || ''}
          </div>
          <div className="text-[9px] text-bsb-dim mt-1">PITCHING</div>
        </div>
      </div>
    </div>
  )
}

// ─── Histogram Chart ────────────────────────────────
function HistogramChart({ data }: { data: { bins: string[]; hitting: number[]; pitching: number[] } }) {
  const maxCount = Math.max(...data.hitting, ...data.pitching, 1)
  const [hoveredBin, setHoveredBin] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-5 text-[10px] mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500/60" />
          <span className="text-bsb-dim">Hitting Weeks</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/60" />
          <span className="text-bsb-dim">Pitching Weeks</span>
        </span>
      </div>
      <div className="flex gap-[2px] h-52">
        {data.bins.map((bin, i) => (
          <div
            key={bin}
            className="flex-1 flex items-end gap-[1px] relative cursor-pointer h-full"
            onMouseEnter={() => setHoveredBin(i)}
            onMouseLeave={() => setHoveredBin(null)}
          >
            <div
              className="flex-1 bg-blue-500/50 border border-blue-400/20 rounded-t transition-all hover:bg-blue-500/70"
              style={{ height: `${Math.max((data.hitting[i] / maxCount) * 100, 0)}%`, minHeight: data.hitting[i] > 0 ? '3px' : '0px' }}
            />
            <div
              className="flex-1 bg-red-500/50 border border-red-400/20 rounded-t transition-all hover:bg-red-500/70"
              style={{ height: `${Math.max((data.pitching[i] / maxCount) * 100, 0)}%`, minHeight: data.pitching[i] > 0 ? '3px' : '0px' }}
            />
            {hoveredBin === i && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-bsb-dark border border-white/20 rounded-lg px-3 py-2 text-[10px] whitespace-nowrap z-20 shadow-xl">
                <div className="text-white/60 font-bold mb-1">{bin} FPTS</div>
                <div className="text-blue-400">Hitting: {data.hitting[i]} weeks</div>
                <div className="text-red-400">Pitching: {data.pitching[i]} weeks</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px]">
        {data.bins.map((bin, i) => (
          <div key={bin} className="flex-1 text-center">
            {i % 4 === 0 && <span className="text-[8px] text-bsb-dim">{bin.split('-')[0]}</span>}
          </div>
        ))}
      </div>
      <div className="text-center text-[9px] text-bsb-dim">Weekly Team FPTS</div>
    </div>
  )
}

// ─── Box Plot Comparison ────────────────────────────
function BoxPlotComparison({ hitting, pitching }: { hitting: DistSummary; pitching: DistSummary }) {
  const globalMin = Math.min(hitting.min, pitching.min) - 20
  const globalMax = Math.max(hitting.max, pitching.max) + 20
  const scale = (v: number) => ((v - globalMin) / (globalMax - globalMin)) * 100

  const renderBox = (d: DistSummary, label: string, barColor: string, boxBg: string) => (
    <div className="mb-8">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${barColor}`}>{label}</span>
      <div className="relative h-6 mt-2 mx-4">
        {/* Whisker: min to max */}
        <div className="absolute top-1/2 h-[1px] -translate-y-1/2 bg-white/15"
          style={{ left: `${scale(d.p10)}%`, width: `${scale(d.p90) - scale(d.p10)}%` }} />
        {/* Whisker caps */}
        <div className="absolute top-1 h-4 w-[1px] bg-white/20" style={{ left: `${scale(d.p10)}%` }} />
        <div className="absolute top-1 h-4 w-[1px] bg-white/20" style={{ left: `${scale(d.p90)}%` }} />
        {/* Box: p25 to p75 */}
        <div className={`absolute top-0 h-full rounded border ${boxBg}`}
          style={{ left: `${scale(d.p25)}%`, width: `${Math.max(scale(d.p75) - scale(d.p25), 1)}%` }} />
        {/* Median line */}
        <div className={`absolute top-0 h-full w-[2px] rounded ${barColor.includes('blue') ? 'bg-blue-400' : 'bg-red-400'}`}
          style={{ left: `${scale(d.median)}%` }} />
        {/* Labels */}
        <div className="absolute -bottom-4 text-[8px] text-bsb-dim" style={{ left: `${scale(d.p10)}%`, transform: 'translateX(-50%)' }}>{d.p10.toFixed(0)}</div>
        <div className="absolute -bottom-4 text-[8px] font-bold" style={{ left: `${scale(d.median)}%`, transform: 'translateX(-50%)' }}>
          <span className={barColor}>{d.median.toFixed(0)}</span>
        </div>
        <div className="absolute -bottom-4 text-[8px] text-bsb-dim" style={{ left: `${scale(d.p90)}%`, transform: 'translateX(-50%)' }}>{d.p90.toFixed(0)}</div>
      </div>
    </div>
  )

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 pt-5">
      <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-6">Distribution Range (P10 — Median — P90)</div>
      {renderBox(hitting, 'Hitting', 'text-blue-400', 'bg-blue-500/15 border-blue-400/30')}
      {renderBox(pitching, 'Pitching', 'text-red-400', 'bg-red-500/15 border-red-400/30')}
    </div>
  )
}

// ─── Two-Start Bars ─────────────────────────────────
function TwoStartBars({ oneStart, twoStart, boost, boostPct }: {
  oneStart: { mean: number; stdev: number; count: number }
  twoStart: { mean: number; stdev: number; count: number }
  boost: number; boostPct: number
}) {
  const maxVal = twoStart.mean + twoStart.stdev
  const barMaxH = 140 // max bar height in px
  const oneH = Math.round((oneStart.mean / maxVal) * barMaxH)
  const twoH = Math.round((twoStart.mean / maxVal) * barMaxH)
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-12 mb-4">
        {/* 1-Start */}
        <div className="flex flex-col items-center gap-1.5 w-28">
          <span className="text-sm text-white/60 font-mono">{oneStart.mean.toFixed(1)}</span>
          <div className="w-full rounded-t-lg bg-white/[0.08] border border-white/15 relative overflow-hidden"
            style={{ height: `${oneH}px` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent" />
          </div>
          <span className="text-[10px] text-bsb-dim font-bold uppercase tracking-wide">1-Start</span>
          <span className="text-[9px] text-white/30">{oneStart.count.toLocaleString()} weeks</span>
        </div>
        {/* 2-Start */}
        <div className="flex flex-col items-center gap-1.5 w-28">
          <span className="text-sm text-bsb-gold font-mono font-bold">{twoStart.mean.toFixed(1)}</span>
          <div className="w-full rounded-t-lg bg-bsb-gold/20 border border-bsb-gold/40 relative overflow-hidden"
            style={{ height: `${twoH}px` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-bsb-gold/10 to-transparent" />
          </div>
          <span className="text-[10px] text-bsb-gold font-bold uppercase tracking-wide">2-Start</span>
          <span className="text-[9px] text-white/30">{twoStart.count.toLocaleString()} weeks</span>
        </div>
      </div>
      {/* Boost callout */}
      <div className="bg-bsb-gold/10 border border-bsb-gold/30 rounded-xl px-5 py-3 text-center">
        <span className="text-bsb-gold text-2xl font-black">+{boostPct.toFixed(0)}%</span>
        <span className="text-bsb-dim text-xs ml-2">FPTS boost in two-start weeks</span>
        <div className="text-[10px] text-white/40 mt-1">+{boost.toFixed(1)} avg FPTS per SP</div>
      </div>
    </div>
  )
}

// ─── Consistency Table ──────────────────────────────
function ConsistencyTable({ title, players, color }: {
  title: string; players: ConsistencyEntry[]; color: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className={`px-4 py-2.5 border-b border-white/[0.06] bg-gradient-to-r ${color} to-transparent`}>
        <h3 className="text-xs font-black uppercase tracking-wider">{title}</h3>
      </div>
      <div className="text-[9px] uppercase tracking-wider text-bsb-dim grid grid-cols-5 gap-1 px-4 py-2 border-b border-white/[0.04]">
        <span className="col-span-2">Player</span>
        <span className="text-right">Avg/Wk</span>
        <span className="text-right">StDev</span>
        <span className="text-right">CV</span>
      </div>
      {players.map((p) => (
        <div key={p.name} className="grid grid-cols-5 gap-1 px-4 py-2 border-b border-white/[0.04] text-sm">
          <span className="col-span-2 text-white/80 truncate text-xs">{p.name}</span>
          <span className="text-right font-mono text-bsb-gold text-xs">{p.meanWeekly.toFixed(1)}</span>
          <span className="text-right font-mono text-white/40 text-xs">{p.stdev.toFixed(1)}</span>
          <span className={`text-right font-mono font-bold text-xs ${
            p.cv < 0.4 ? 'text-green-400' : p.cv > 0.7 ? 'text-red-400' : 'text-white/50'
          }`}>{p.cv.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Year Selector ──────────────────────────────────
function YearSelector({ years, selected, onSelect }: {
  years: string[]; selected: string; onSelect: (y: string) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          selected === 'all' ? 'bg-bsb-accent/30 text-bsb-accent' : 'text-bsb-dim hover:text-white'
        }`}
      >All</button>
      {years.map(y => (
        <button
          key={y}
          onClick={() => onSelect(y)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            selected === y ? 'bg-bsb-accent/30 text-bsb-accent' : 'text-bsb-dim hover:text-white'
          }`}
        >{y}</button>
      ))}
    </div>
  )
}


// =============================================================================
// MAIN PAGE
// =============================================================================
export default function InsightsPage() {
  const [activeNav, setActiveNav] = useState('overview')
  const [selectedYear, setSelectedYear] = useState('all')

  const d = varianceData as any
  const combined = d.combined
  const histogram = d.histogram
  const twoStart = d.twoStartEffect
  const consistency = d.consistency
  const implications = d.draftImplications
  const meta = d.meta

  // Get year-specific data or combined
  const activeHitting: DistSummary = selectedYear === 'all'
    ? combined.hitting
    : d.byYear?.[selectedYear]?.hitting || combined.hitting
  const activePitching: DistSummary = selectedYear === 'all'
    ? combined.pitching
    : d.byYear?.[selectedYear]?.pitching || combined.pitching

  // Nav scroll spy
  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'distributions', label: 'Distributions' },
    { id: 'two-start', label: '2-Start Effect' },
    { id: 'consistency', label: 'Consistency' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'pitcher-mix', label: 'Pitcher Mix' },
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveNav(entry.target.id)
        })
      },
      { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' }
    )
    navItems.forEach(item => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-bsb-navy text-white">
      {/* ─── FLOATING NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bsb-dark/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-lg font-black text-white">
              BSB<span className="text-bsb-accent">DRAFT</span>
            </span>
            <span className="text-[10px] text-bsb-dim group-hover:text-bsb-gold transition-colors">← Back to Draft</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a key={item.id} href={`#${item.id}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  activeNav === item.id ? 'bg-bsb-accent/20 text-bsb-accent' : 'text-bsb-dim hover:text-white hover:bg-white/5'
                }`}
              >{item.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/guide" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded-full transition-all">
              Guide
            </Link>
            <Link href="/advanced-stats" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded-full transition-all">
              Advanced
            </Link>
            <Link href="/" className="px-4 py-1.5 bg-bsb-accent/20 border border-bsb-accent/40 rounded-full text-xs font-bold text-bsb-accent hover:bg-bsb-accent/30 transition-all">
              Draft Board &rarr;
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        {/* ═══════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════ */}
        <Section>
          <div className="text-center py-12">
            <div className="text-[11px] text-bsb-accent font-bold uppercase tracking-widest mb-3">Weekly Variance Deep Dive</div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
              Hitting vs Pitching
              <span className="block bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent">
                Weekly Scoring Analysis
              </span>
            </h1>
            <p className="text-bsb-dim text-sm max-w-xl mx-auto leading-relaxed">
              Three-year lookback ({meta.seasons[0]}-{meta.seasons[meta.seasons.length - 1]}) using actual MLB game logs
              with BSB scoring. How much does weekly variance affect the value of hitters vs pitchers
              in our ranked scoring format?
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <StatPill label="Weeks Analyzed" value={String(meta.totalWeeks)} />
              <StatPill label="Batters Tracked" value={String(meta.nBatters)} color="blue-400" />
              <StatPill label="Pitchers Tracked" value={String(meta.nPitchers)} color="red-400" />
              <StatPill label="Seasons" value={meta.seasons.length.toString()} color="bsb-accent" />
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* OVERVIEW */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="overview" className="pt-8">
            <h2 className="text-xl font-black mb-6">
              <span className="text-bsb-gold">📊</span> Overview
            </h2>

            {/* Key insight callout */}
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-red-500/10 border border-white/10 rounded-2xl p-6 mb-8">
              <div className="text-center">
                <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-2">Key Finding</div>
                <div className="text-lg font-black">
                  Pitching is <span className="text-red-400">{implications.varianceRatio}×</span> more
                  volatile than hitting week-to-week
                </div>
                <p className="text-bsb-dim text-xs mt-2 max-w-lg mx-auto">
                  At the individual player level, SPs have 50-70% higher coefficient of variation than batters.
                  Two-start pitcher weeks amplify this — producing {twoStart.boostPct.toFixed(0)}% more FPTS per SP.
                </p>
              </div>
            </div>

            {/* Year selector */}
            <div className="flex justify-center mb-6">
              <YearSelector
                years={meta.seasons.map(String)}
                selected={selectedYear}
                onSelect={setSelectedYear}
              />
            </div>

            {/* Comparison metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ComparisonMetric label="Mean FPTS/Week" hitVal={activeHitting.mean} pitVal={activePitching.mean} />
              <ComparisonMetric label="Median" hitVal={activeHitting.median} pitVal={activePitching.median} />
              <ComparisonMetric label="Std Deviation" hitVal={activeHitting.stdev} pitVal={activePitching.stdev} lowerBetter />
              <ComparisonMetric label="CV (Volatility)" hitVal={activeHitting.cv} pitVal={activePitching.cv} lowerBetter />
            </div>

            {/* Floor / Ceiling */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
                <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">Weekly Floor (P10)</div>
                <div className="flex justify-between">
                  <div><span className="text-blue-400 font-black text-lg">{activeHitting.p10.toFixed(0)}</span><span className="text-[10px] text-bsb-dim ml-1">HIT</span></div>
                  <div><span className="text-red-400 font-black text-lg">{activePitching.p10.toFixed(0)}</span><span className="text-[10px] text-bsb-dim ml-1">PIT</span></div>
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
                <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">Weekly Ceiling (P90)</div>
                <div className="flex justify-between">
                  <div><span className="text-blue-400 font-black text-lg">{activeHitting.p90.toFixed(0)}</span><span className="text-[10px] text-bsb-dim ml-1">HIT</span></div>
                  <div><span className="text-red-400 font-black text-lg">{activePitching.p90.toFixed(0)}</span><span className="text-[10px] text-bsb-dim ml-1">PIT</span></div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* DISTRIBUTIONS */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="distributions" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">📈</span> Weekly FPTS Distributions
            </h2>
            <p className="text-bsb-dim text-xs mb-8">
              How often each weekly FPTS total occurs for a team&apos;s top-{meta.activeBatters} batters vs top-{meta.activePitchers} pitchers.
              Wider spread = more volatile.
            </p>

            {/* Histogram */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
              <HistogramChart data={histogram} />
            </div>

            {/* Box plot */}
            <div className="mt-6">
              <BoxPlotComparison hitting={combined.hitting} pitching={combined.pitching} />
            </div>

            {/* Range comparison */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-center">
                <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1">Hitting P10-P90 Range</div>
                <div className="text-2xl font-black text-blue-400">{(combined.hitting.p90 - combined.hitting.p10).toFixed(0)}</div>
                <div className="text-[9px] text-bsb-dim mt-1">FPTS spread (80% of weeks)</div>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">Pitching P10-P90 Range</div>
                <div className="text-2xl font-black text-red-400">{(combined.pitching.p90 - combined.pitching.p10).toFixed(0)}</div>
                <div className="text-[9px] text-bsb-dim mt-1">FPTS spread (80% of weeks)</div>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* TWO-START EFFECT */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="two-start" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">⚡</span> Two-Start Pitcher Effect
            </h2>
            <p className="text-bsb-dim text-xs mb-8">
              When an SP gets two starts in one week, their weekly output nearly doubles.
              This is the single biggest source of pitching volatility.
            </p>

            {twoStart.oneStart && twoStart.twoStart && (
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-8">
                <TwoStartBars
                  oneStart={twoStart.oneStart}
                  twoStart={twoStart.twoStart}
                  boost={twoStart.boost}
                  boostPct={twoStart.boostPct}
                />
              </div>
            )}

            {/* Context card */}
            <div className="mt-6 bg-white/[0.02] rounded-xl border border-white/[0.06] p-5">
              <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-3">What This Means</div>
              <div className="space-y-2 text-xs text-white/70 leading-relaxed">
                <p>• A top SP averaging <span className="text-bsb-gold font-bold">{twoStart.oneStart?.mean.toFixed(0)} FPTS</span> in a 1-start week
                  jumps to <span className="text-bsb-gold font-bold">{twoStart.twoStart?.mean.toFixed(0)} FPTS</span> with two starts — enough to swing a weekly pitching rank by 1-2 positions.</p>
                <p>• Teams with multiple SPs in a 2-start week can put up <span className="text-white font-bold">massive</span> pitching totals,
                  dominating the ranked scoring. But the reverse is equally true — 1-start weeks can leave you short.</p>
                <p>• This is why pitching has more extreme outcomes: more top-1 AND bottom-1 weekly finishes than hitting.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* CONSISTENCY */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="consistency" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">🎯</span> Player Consistency Rankings
            </h2>
            <p className="text-bsb-dim text-xs mb-3">
              Coefficient of Variation (CV) = StDev ÷ Mean. <span className="text-green-400 font-bold">Lower = more consistent</span>.
              A CV of 0.40 means weekly output varies by ~40% from the average.
            </p>
            <p className="text-bsb-dim text-xs mb-8">
              Note how even the most consistent SPs ({((consistency.mostConsistentPitchers as ConsistencyEntry[])?.[0]?.cv || 0).toFixed(2)} CV) are far
              more volatile than consistent batters ({((consistency.mostConsistentBatters as ConsistencyEntry[])?.[0]?.cv || 0).toFixed(2)} CV).
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <ConsistencyTable
                  title="Most Consistent Batters"
                  players={consistency.mostConsistentBatters as ConsistencyEntry[]}
                  color="from-green-500/20"
                />
                <ConsistencyTable
                  title="Least Consistent Batters"
                  players={consistency.leastConsistentBatters as ConsistencyEntry[]}
                  color="from-orange-500/20"
                />
              </div>
              <div className="space-y-4">
                <ConsistencyTable
                  title="Most Consistent SPs"
                  players={consistency.mostConsistentPitchers as ConsistencyEntry[]}
                  color="from-green-500/20"
                />
                <ConsistencyTable
                  title="Least Consistent SPs"
                  players={consistency.leastConsistentPitchers as ConsistencyEntry[]}
                  color="from-orange-500/20"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* STRATEGY */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="strategy" className="pt-16">
            <h2 className="text-xl font-black mb-6">
              <span className="text-bsb-gold">🧠</span> Draft Strategy Implications
            </h2>

            {/* Insight cards */}
            <div className="space-y-4">
              {(implications.keyInsights as string[]).map((insight: string, i: number) => (
                <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5 flex gap-4 items-start">
                  <span className="text-bsb-gold text-lg font-black shrink-0">{i + 1}</span>
                  <p className="text-sm text-white/80 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>

            {/* Floor vs Ceiling summary */}
            <div className="mt-8 bg-gradient-to-r from-blue-500/5 to-red-500/5 border border-white/10 rounded-2xl p-6">
              <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4 text-center">The Bottom Line</div>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-blue-400 text-xs font-bold uppercase mb-2">Hitting Strategy</div>
                  <div className="text-white/70 text-xs leading-relaxed">
                    Hitting is your <span className="text-blue-400 font-bold">floor</span>. Consistent weekly output
                    means reliable rank placement. Invest in a strong batting foundation first —
                    it protects you during pitching bust weeks.
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 text-xs font-bold uppercase mb-2">Pitching Strategy</div>
                  <div className="text-white/70 text-xs leading-relaxed">
                    Pitching is your <span className="text-red-400 font-bold">ceiling</span>. Two-start weeks can
                    dominate the rankings. Target high-upside SPs with favorable schedules —
                    but don&apos;t sacrifice hitting stability for pitching upside.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* PITCHER MIX — RP STRATEGY */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="pitcher-mix" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">⚾</span> Optimal Pitcher Mix
            </h2>
            <p className="text-bsb-dim text-xs mb-8">
              Should you roster all starters, mix in relievers, or go bullpen-heavy?
              Simulated {rpStrategyData.meta.weeksAnalyzed} weeks of actual game-log data across {rpStrategyData.meta.nSP} SPs and {rpStrategyData.meta.nRP} RPs
              to find the answer.
            </p>

            {/* ── Recommendation Card ── */}
            <div className="bg-gradient-to-br from-bsb-gold/10 to-bsb-gold/[0.02] border border-bsb-gold/30 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="text-[10px] text-bsb-gold uppercase tracking-widest font-bold">Recommended Configuration</div>
                  <div className="text-white text-lg font-black">{rpStrategyData.recommendation.config}
                    <span className="text-bsb-dim text-xs font-normal ml-2">({rpStrategyData.recommendation.detail})</span>
                  </div>
                </div>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">{rpStrategyData.recommendation.rationale}</p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-white/[0.04] rounded-lg p-3 text-center">
                  <div className="text-bsb-gold text-xl font-black">{rpStrategyData.recommendation.weeklyMean.toFixed(1)}</div>
                  <div className="text-[9px] text-bsb-dim uppercase">Avg FPTS/Week</div>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3 text-center">
                  <div className="text-bsb-gold text-xl font-black">{(rpStrategyData.recommendation.weeklyCV * 100).toFixed(1)}%</div>
                  <div className="text-[9px] text-bsb-dim uppercase">Weekly Variability (CV)</div>
                </div>
              </div>
            </div>

            {/* ── Roster Config Comparison Table ── */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 mb-8">
              <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4">All Configurations Ranked</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-bsb-dim font-bold">#</th>
                      <th className="text-left py-2 text-bsb-dim font-bold">Config</th>
                      <th className="text-right py-2 text-bsb-dim font-bold">Season</th>
                      <th className="text-right py-2 text-bsb-dim font-bold">Avg/Wk</th>
                      <th className="text-right py-2 text-bsb-dim font-bold">CV</th>
                      <th className="text-right py-2 text-bsb-dim font-bold">Floor (P10)</th>
                      <th className="text-right py-2 text-bsb-dim font-bold">Ceiling (P90)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rpStrategyData.configs.map((cfg, i) => (
                      <tr key={cfg.name} className={`border-b border-white/[0.04] ${i === 0 ? 'bg-bsb-gold/[0.06]' : ''}`}>
                        <td className={`py-2.5 font-black ${i === 0 ? 'text-bsb-gold' : 'text-bsb-dim'}`}>{cfg.rank}</td>
                        <td className="py-2.5">
                          <span className={`font-bold ${i === 0 ? 'text-white' : 'text-white/70'}`}>{cfg.name}</span>
                          {cfg.detail && <span className="text-bsb-dim ml-1.5 text-[10px]">{cfg.detail}</span>}
                        </td>
                        <td className="py-2.5 text-right text-white/60 tabular-nums">{cfg.seasonFpts.toLocaleString()}</td>
                        <td className={`py-2.5 text-right tabular-nums font-bold ${i === 0 ? 'text-bsb-gold' : 'text-white/80'}`}>{cfg.weeklyMean.toFixed(1)}</td>
                        <td className="py-2.5 text-right text-white/60 tabular-nums">{(cfg.weeklyCV * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right text-white/60 tabular-nums">{cfg.weeklyP10.toFixed(0)}</td>
                        <td className="py-2.5 text-right text-white/60 tabular-nums">{cfg.weeklyP90.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── FPTS/IP Efficiency ── */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
                <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4">FPTS per Inning Pitched</div>
                <p className="text-[10px] text-bsb-dim mb-4">RPs are more <span className="text-green-400 font-bold">efficient</span> per inning, but SPs throw far more innings.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Closers', value: rpStrategyData.rpTiers.closers.avgFptsPerIP, color: 'bg-red-500', max: 7 },
                    { label: 'RP (All)', value: rpStrategyData.spVsRpComparison.rpAvgFptsPerIP, color: 'bg-orange-400', max: 7 },
                    { label: 'Setup', value: rpStrategyData.rpTiers.setup.avgFptsPerIP, color: 'bg-amber-400', max: 7 },
                    { label: 'SP (All)', value: rpStrategyData.spVsRpComparison.spAvgFptsPerIP, color: 'bg-blue-500', max: 7 },
                    { label: 'Middle RP', value: rpStrategyData.rpTiers.middle.avgFptsPerIP, color: 'bg-gray-400', max: 7 },
                  ].map(bar => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-white/70">{bar.label}</span>
                        <span className="text-white font-bold tabular-nums">{bar.value.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full ${bar.color} rounded-full transition-all`}
                          style={{ width: `${(bar.value / bar.max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
                <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4">Volume: Avg Innings Pitched</div>
                <p className="text-[10px] text-bsb-dim mb-4">SPs throw <span className="text-blue-400 font-bold">2.4×</span> more innings than RPs — volume wins.</p>
                <div className="space-y-3">
                  {[
                    { label: 'SP (All)', value: rpStrategyData.spVsRpComparison.spAvgIP, color: 'bg-blue-500', max: 200 },
                    { label: 'Middle RP', value: rpStrategyData.rpTiers.middle.avgIP, color: 'bg-gray-400', max: 200 },
                    { label: 'Closers', value: rpStrategyData.rpTiers.closers.avgIP, color: 'bg-red-500', max: 200 },
                    { label: 'Setup', value: rpStrategyData.rpTiers.setup.avgIP, color: 'bg-amber-400', max: 200 },
                  ].map(bar => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-white/70">{bar.label}</span>
                        <span className="text-white font-bold tabular-nums">{bar.value.toFixed(1)} IP</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full ${bar.color} rounded-full transition-all`}
                          style={{ width: `${(bar.value / bar.max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RP Tier Breakdown ── */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 mb-8">
              <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4">RP Value by Tier</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 text-center">
                  <div className="text-red-400 text-[10px] font-bold uppercase mb-2">Closers</div>
                  <div className="text-white text-2xl font-black">{rpStrategyData.rpTiers.closers.avgFpts.toFixed(0)}</div>
                  <div className="text-[9px] text-bsb-dim">Avg Season FPTS</div>
                  <div className="mt-2 text-red-400 text-xs font-bold">{rpStrategyData.rpTiers.closers.avgSvPts.toFixed(0)} SV pts</div>
                  <div className="text-[9px] text-bsb-dim">{rpStrategyData.rpTiers.closers.count} pitchers</div>
                </div>
                <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4 text-center">
                  <div className="text-amber-400 text-[10px] font-bold uppercase mb-2">Setup</div>
                  <div className="text-white text-2xl font-black">{rpStrategyData.rpTiers.setup.avgFpts.toFixed(0)}</div>
                  <div className="text-[9px] text-bsb-dim">Avg Season FPTS</div>
                  <div className="mt-2 text-amber-400 text-xs font-bold">{rpStrategyData.rpTiers.setup.avgHldPts.toFixed(0)} HLD pts</div>
                  <div className="text-[9px] text-bsb-dim">{rpStrategyData.rpTiers.setup.count} pitchers</div>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-white/60 text-[10px] font-bold uppercase mb-2">Middle</div>
                  <div className="text-white text-2xl font-black">{rpStrategyData.rpTiers.middle.avgFpts.toFixed(0)}</div>
                  <div className="text-[9px] text-bsb-dim">Avg Season FPTS</div>
                  <div className="mt-2 text-white/50 text-xs font-bold">{rpStrategyData.rpTiers.middle.avgFptsPerIP.toFixed(2)} FPTS/IP</div>
                  <div className="text-[9px] text-bsb-dim">{rpStrategyData.rpTiers.middle.count} pitchers</div>
                </div>
              </div>
            </div>

            {/* ── Key Insights ── */}
            <div className="space-y-3 mb-8">
              {rpStrategyData.keyInsights.map((insight, i) => (
                <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 flex gap-3 items-start">
                  <span className="text-bsb-gold text-sm font-black shrink-0">→</span>
                  <p className="text-xs text-white/80 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>

            {/* ── SP vs RP Head-to-Head ── */}
            <div className="bg-gradient-to-r from-blue-500/5 to-red-500/5 border border-white/10 rounded-2xl p-6">
              <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4 text-center">SP vs RP — Head to Head</div>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-blue-400 text-xs font-bold uppercase mb-2">Starting Pitchers</div>
                  <div className="text-3xl font-black text-blue-400">{rpStrategyData.spVsRpComparison.spAvgFpts.toFixed(0)}</div>
                  <div className="text-[9px] text-bsb-dim mb-2">Avg Season FPTS</div>
                  <div className="text-white/60 text-xs">
                    {rpStrategyData.spVsRpComparison.spAvgIP.toFixed(0)} IP &middot; {rpStrategyData.spVsRpComparison.spAvgFptsPerIP.toFixed(2)} FPTS/IP
                  </div>
                  <div className="text-white/50 text-[10px] mt-1">Volume advantage: IP × 3 scoring</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 text-xs font-bold uppercase mb-2">Relief Pitchers</div>
                  <div className="text-3xl font-black text-red-400">{rpStrategyData.spVsRpComparison.rpAvgFpts.toFixed(0)}</div>
                  <div className="text-[9px] text-bsb-dim mb-2">Avg Season FPTS</div>
                  <div className="text-white/60 text-xs">
                    {rpStrategyData.spVsRpComparison.rpAvgIP.toFixed(0)} IP &middot; {rpStrategyData.spVsRpComparison.rpAvgFptsPerIP.toFixed(2)} FPTS/IP
                  </div>
                  <div className="text-white/50 text-[10px] mt-1">Efficiency edge: SV/HLD bonus pts</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div className="text-center pt-16 pb-8">
            <p className="text-bsb-dim text-xs">
              Analysis based on {meta.totalWeeks} weeks of MLB data ({meta.seasons.join(', ')}) using BSB custom scoring.
              Top {meta.nBatters} batters and {meta.nPitchers} pitchers by projected FPTS.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/guide" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">📖 League Guide</Link>
              <Link href="/advanced-stats" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">🔬 Advanced Stats</Link>
              <Link href="/" className="text-xs text-bsb-accent hover:text-bsb-accent/80 transition-all">🏠 Draft Board</Link>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
