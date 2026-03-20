'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useDraftStore, Player } from '@/hooks/useDraftStore'
import { TEAM_NAMES } from '@/components/constants'
import { MegaCategoryCard } from '@/components/MegaCategoryCard'
import { RosterNeedsPanel } from '@/components/RosterNeedsPanel'

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

function computePickNumbers(position: number, rounds: number): number[] {
  const picks: number[] = []
  for (let r = 1; r <= rounds; r++) {
    if (r % 2 === 1) picks.push((r - 1) * 16 + position)
    else picks.push(r * 16 - position + 1)
  }
  return picks
}

function pickPosColor(pos: number): string {
  if (pos <= 3) return 'text-green-400'
  if (pos <= 5) return 'text-green-300'
  if (pos <= 8) return 'text-bsb-gold'
  if (pos <= 11) return 'text-orange-400'
  if (pos <= 13) return 'text-red-300'
  return 'text-red-400'
}

function pickPosBg(pos: number): string {
  if (pos <= 3) return 'bg-green-400/10 border-green-400/30'
  if (pos <= 5) return 'bg-green-300/10 border-green-300/30'
  if (pos <= 8) return 'bg-bsb-gold/10 border-bsb-gold/30'
  if (pos <= 11) return 'bg-orange-400/10 border-orange-400/30'
  if (pos <= 13) return 'bg-red-300/10 border-red-300/30'
  return 'bg-red-400/10 border-red-400/30'
}

// ─── Map positions to mega categories for roster needs ───
function getPositionMegaCat(pos: string): string | null {
  const map: Record<string, string> = {
    C: 'Mega C', '1B': 'Mega 1B', '2B': 'Mega 2B', '3B': 'Mega 3B',
    SS: 'Mega SS', OF: 'Mega OF', SP: 'Mega Pitch', RP: 'Mega Pitch',
  }
  return map[pos] || null
}

export default function MegaPrepPage() {
  const store = useDraftStore()
  const [activeNav, setActiveNav] = useState('overview')

  const myTeam = store.myTeamNumber ?? 0
  const teamName = TEAM_NAMES[myTeam] || 'My Team'
  const template = store.draftState.myTemplate

  // Get template picks for mega categories only
  const megaPicks = useMemo(() => {
    if (!template || !store.templates[template]) return {}
    const tpl = store.templates[template]
    const result: Record<string, number> = {}
    for (const [key, pos] of Object.entries(tpl)) {
      if (key.startsWith('Mega')) result[key] = pos
    }
    return result
  }, [template, store.templates])

  // Get mega categories only
  const megaCategories = useMemo(() =>
    store.categories.filter(c => c.key.startsWith('Mega')),
    [store.categories]
  )

  // Sort by pick position (best picks first)
  const sortedCategories = useMemo(() =>
    [...megaCategories].sort((a, b) => (megaPicks[a.key] || 99) - (megaPicks[b.key] || 99)),
    [megaCategories, megaPicks]
  )

  // Get my rostered players by position
  const myRoster = useMemo(() => {
    const myPlayers = store.allPlayers.filter(p => p.drafted && p.draftedBy === myTeam)
    const byPos: Record<string, Player[]> = {
      C: [], '1B': [], '2B': [], '3B': [], SS: [], OF: [], SP: [], RP: [], P: [],
    }
    myPlayers.forEach(p => {
      if (p.pos === 'P') {
        if (p.role === 'SP') byPos.SP.push(p)
        else byPos.RP.push(p)
        byPos.P.push(p) // also track all pitchers
      } else {
        // Add to primary position
        if (byPos[p.pos]) byPos[p.pos].push(p)
        // Also add to all matching positions
        p.positions?.forEach(pos => {
          if (pos !== p.pos && byPos[pos]) byPos[pos].push(p)
        })
      }
    })
    return byPos
  }, [store.allPlayers, myTeam])

  // Get mini roster for a mega category
  function getMiniRosterForCategory(catKey: string): Player[] {
    const cat = store.categories.find(c => c.key === catKey)
    if (!cat) return []
    if (cat.type === 'pitcher') return [...(myRoster.SP || []), ...(myRoster.RP || [])]
    if (cat.posFilter) return myRoster[cat.posFilter] || []
    // "any" - return all
    return store.allPlayers.filter(p => p.drafted && p.draftedBy === myTeam)
  }

  const teamStrength = store.getMyTeamStrength()
  const totalFpts = useMemo(() =>
    store.allPlayers.filter(p => p.drafted && p.draftedBy === myTeam).reduce((s, p) => s + p.fpts, 0),
    [store.allPlayers, myTeam]
  )

  // Nav items
  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'targets', label: 'Targets' },
    { id: 'roster-needs', label: 'Roster Needs' },
    { id: 'strategy', label: 'Strategy' },
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

  // Strategy insights based on template
  const strategyInsights = useMemo(() => {
    const insights: { emoji: string; title: string; detail: string; priority: 'high' | 'medium' | 'low' }[] = []

    for (const cat of sortedCategories) {
      const pos = megaPicks[cat.key]
      if (!pos) continue
      const posLabel = cat.posFilter || (cat.type === 'pitcher' ? 'Pitching' : 'Any')
      const roster = getMiniRosterForCategory(cat.key)

      if (pos <= 3) {
        insights.push({
          emoji: '👑',
          title: `${cat.key} (#${pos}) — Crown Jewel`,
          detail: `You pick ${pos === 1 ? 'FIRST' : pos === 2 ? '2nd' : '3rd'} in ${posLabel}. This is premium value — target the absolute best available.${
            roster.length > 0 ? ` Already have: ${roster.map(p => p.name.split(' ').pop()).join(', ')}.` : ''
          }`,
          priority: 'high',
        })
      } else if (pos <= 8) {
        const hasPlayers = roster.length > 0
        insights.push({
          emoji: hasPlayers ? '📋' : '🎯',
          title: `${cat.key} (#${pos}) — ${hasPlayers ? 'Solid Depth Pick' : 'Key Need'}`,
          detail: `Mid-round pick at ${posLabel}.${
            hasPlayers
              ? ` You have ${roster.map(p => `${p.name.split(' ').pop()} (${Math.round(p.fpts)})`).join(', ')} — draft for upside/depth.`
              : ` No ${posLabel} on roster — this is an important pick to fill the gap.`
          }`,
          priority: hasPlayers ? 'medium' : 'high',
        })
      } else {
        insights.push({
          emoji: pos >= 14 ? '⚠️' : '📉',
          title: `${cat.key} (#${pos}) — ${pos >= 14 ? 'Late Pick' : 'Below Average'}`,
          detail: `Pick #${pos} of 16 at ${posLabel}. Top talent will be gone. ${
            roster.length > 0
              ? `Good news: you already have ${roster.map(p => p.name.split(' ').pop()).join(', ')} from mini draft.`
              : `Focus on finding value — look for high-upside or undervalued players.`
          }`,
          priority: 'low',
        })
      }
    }

    return insights
  }, [sortedCategories, megaPicks])

  if (!template) {
    return (
      <div className="min-h-screen bg-bsb-navy text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-bsb-dim text-sm mb-4">No template selected</div>
          <Link href="/" className="text-bsb-accent hover:text-bsb-accent/80 text-sm">
            Go to Draft Board to select your team &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bsb-navy text-white">
      {/* ─── FLOATING NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bsb-dark/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-lg font-black text-white">
              BSB<span className="text-bsb-accent">DRAFT</span>
            </span>
            <span className="text-[10px] text-bsb-dim group-hover:text-bsb-gold transition-colors">&larr; Back to Draft</span>
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
            <Link href="/insights" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded-full transition-all">
              Insights
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

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-32">
        {/* ═══════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════ */}
        <Section>
          <div className="text-center py-10">
            <div className="text-[11px] text-bsb-accent font-bold uppercase tracking-widest mb-3">Mega Draft Preparation</div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
              {teamName}
              <span className="block text-2xl md:text-3xl bg-gradient-to-r from-bsb-gold to-bsb-accent bg-clip-text text-transparent mt-1">
                Template {template} — Pick Map
              </span>
            </h1>
            <p className="text-bsb-dim text-sm max-w-xl mx-auto leading-relaxed">
              Your pick positions across all 8 mega draft categories, likely targets at each pick,
              and roster needs analysis. {megaCategories.reduce((s, c) => s + c.rounds, 0)} total rounds,{' '}
              {megaCategories.reduce((s, c) => s + c.rounds, 0)} picks to make.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-2xl font-black text-bsb-gold">{Math.round(totalFpts)}</span>
                <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">Current FPTS</span>
              </div>
              <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-2xl font-black text-bsb-accent">{template}</span>
                <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">Template</span>
              </div>
              <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-2xl font-black text-green-400">
                  {Object.values(megaPicks).filter(p => p <= 5).length}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">Top-5 Picks</span>
              </div>
              <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-2xl font-black text-white">8</span>
                <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">Mini Players</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* OVERVIEW GRID */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="overview" className="pt-8">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">🗺️</span> Pick Position Overview
            </h2>
            <p className="text-bsb-dim text-xs mb-6">
              Your pick position in each mega draft category, sorted from best to worst.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sortedCategories.map(cat => {
                const pos = megaPicks[cat.key]
                if (!pos) return null
                const picks = computePickNumbers(pos, cat.rounds)
                const roster = getMiniRosterForCategory(cat.key)
                const posLabel = cat.posFilter || (cat.type === 'pitcher' ? 'P' : 'Any')

                return (
                  <a
                    key={cat.key}
                    href="#targets"
                    className={`rounded-xl border p-4 transition-all hover:scale-[1.02] cursor-pointer ${pickPosBg(pos)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white/80">{cat.key.replace('Mega ', '')}</span>
                      <span className={`text-lg font-black font-mono ${pickPosColor(pos)}`}>#{pos}</span>
                    </div>
                    <div className="text-[10px] text-white/40 mb-1">
                      {cat.rounds}R &middot; {posLabel}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono">
                      Picks: {picks.join(', ')}
                    </div>
                    {roster.length > 0 ? (
                      <div className="text-[10px] text-bsb-gold mt-2 truncate">
                        Have: {roster.map(p => p.name.split(' ').pop()).join(', ')}
                      </div>
                    ) : (
                      <div className="text-[10px] text-red-400 font-bold mt-2">NEED</div>
                    )}
                  </a>
                )
              })}
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* PER-CATEGORY TARGET BOARDS */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="targets" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">🎯</span> Target Boards
            </h2>
            <p className="text-bsb-dim text-xs mb-6">
              For each category, players ranked by projected FPTS. The highlighted &ldquo;target&rdquo; is the player
              most likely available at your pick position, with a window of alternatives.
            </p>

            <div className="space-y-3">
              {sortedCategories.map(cat => {
                const pos = megaPicks[cat.key]
                if (!pos) return null
                const available = store.getAvailableForCategory(cat.key)
                const miniRoster = getMiniRosterForCategory(cat.key)

                return (
                  <MegaCategoryCard
                    key={cat.key}
                    category={cat}
                    pickPosition={pos}
                    availablePlayers={available}
                    miniRoster={miniRoster}
                    defaultExpanded={pos <= 5}
                  />
                )
              })}
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* ROSTER NEEDS */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="roster-needs" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">📊</span> Roster Needs
            </h2>
            <p className="text-bsb-dim text-xs mb-6">
              Current roster strength by position from the mini draft. Positions marked &ldquo;NEED&rdquo; have no
              players drafted yet.
            </p>

            <RosterNeedsPanel
              teamStrength={teamStrength}
              megaPicks={megaPicks}
            />
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* STRATEGY */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={100}>
          <div id="strategy" className="pt-16">
            <h2 className="text-xl font-black mb-2">
              <span className="text-bsb-gold">🧠</span> Draft Strategy
            </h2>
            <p className="text-bsb-dim text-xs mb-6">
              Category-by-category strategy based on your pick position and current roster.
            </p>

            <div className="space-y-3">
              {strategyInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-5 flex gap-4 items-start ${
                    insight.priority === 'high'
                      ? 'bg-bsb-gold/[0.04] border-bsb-gold/20'
                      : insight.priority === 'medium'
                        ? 'bg-white/[0.03] border-white/[0.06]'
                        : 'bg-white/[0.02] border-white/[0.04]'
                  }`}
                >
                  <span className="text-xl shrink-0">{insight.emoji}</span>
                  <div>
                    <div className={`text-sm font-bold ${
                      insight.priority === 'high' ? 'text-bsb-gold' : 'text-white/80'
                    }`}>{insight.title}</div>
                    <p className="text-xs text-white/60 leading-relaxed mt-1">{insight.detail}</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full ${
                    insight.priority === 'high'
                      ? 'bg-bsb-gold/20 text-bsb-gold'
                      : insight.priority === 'medium'
                        ? 'bg-white/10 text-white/50'
                        : 'bg-white/5 text-white/30'
                  }`}>
                    {insight.priority}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom line */}
            <div className="mt-8 bg-gradient-to-r from-green-500/5 via-bsb-gold/5 to-red-500/5 border border-white/10 rounded-2xl p-6">
              <div className="text-[10px] text-bsb-dim uppercase tracking-widest mb-4 text-center">Template {template} Summary</div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-green-400 text-xs font-bold uppercase mb-2">Strengths</div>
                  <div className="text-white/70 text-xs leading-relaxed">
                    {sortedCategories.filter(c => (megaPicks[c.key] || 99) <= 5).map(c =>
                      `${c.key.replace('Mega ', '')} (#${megaPicks[c.key]})`
                    ).join(', ') || 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-bsb-gold text-xs font-bold uppercase mb-2">Mid-Round</div>
                  <div className="text-white/70 text-xs leading-relaxed">
                    {sortedCategories.filter(c => {
                      const p = megaPicks[c.key] || 99
                      return p > 5 && p <= 11
                    }).map(c =>
                      `${c.key.replace('Mega ', '')} (#${megaPicks[c.key]})`
                    ).join(', ') || 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-red-400 text-xs font-bold uppercase mb-2">Late Picks</div>
                  <div className="text-white/70 text-xs leading-relaxed">
                    {sortedCategories.filter(c => (megaPicks[c.key] || 0) > 11).map(c =>
                      `${c.key.replace('Mega ', '')} (#${megaPicks[c.key]})`
                    ).join(', ') || 'None'}
                  </div>
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
              Mega Draft Prep for {teamName} (Template {template}).
              Player projections based on BSB custom scoring.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/guide" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">League Guide</Link>
              <Link href="/insights" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">Insights</Link>
              <Link href="/advanced-stats" className="text-xs text-bsb-dim hover:text-bsb-gold transition-all">Advanced Stats</Link>
              <Link href="/" className="text-xs text-bsb-accent hover:text-bsb-accent/80 transition-all">Draft Board</Link>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
