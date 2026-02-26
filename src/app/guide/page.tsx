'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ─── Animated section wrapper ─────────────────────
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

// ─── Stat pill ────────────────────────────────────
function StatPill({ label, value, color = 'bsb-gold' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <span className={`text-2xl font-black text-${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-bsb-dim mt-1">{label}</span>
    </div>
  )
}

// ─── Score table row ──────────────────────────────
function ScoreRow({ action, pts, accent }: { action: string; pts: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 border-b border-white/[0.04] text-sm ${accent ? 'bg-red-500/5' : ''}`}>
      <span className="text-white/80">{action}</span>
      <span className={`font-mono font-bold ${accent ? 'text-red-400' : 'text-bsb-gold'}`}>{pts}</span>
    </div>
  )
}

// ─── Tier row ─────────────────────────────────────
function TierRow({ tier, label, pct, color }: { tier: number; label: string; pct: string; color: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${color}`}>{tier}</span>
      <div className="flex-1">
        <span className="text-white text-sm font-semibold">{label}</span>
        <span className="text-bsb-dim text-xs ml-2">({pct})</span>
      </div>
    </div>
  )
}

// ─── Category row ─────────────────────────────────
function CatRow({ name, rounds, who, total }: { name: string; rounds: number; who: string; total: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-2.5 px-3 border-b border-white/[0.04] text-sm">
      <span className="text-bsb-accent font-bold">{name}</span>
      <span className="text-white/70 text-center">{rounds}</span>
      <span className="text-white/70">{who}</span>
      <span className="text-bsb-dim text-center font-mono">{total}</span>
    </div>
  )
}

// ─── Team row ─────────────────────────────────────
function TeamRow({ num, name, isYou }: { num: number; name: string; isYou?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-1.5 px-3 rounded-lg text-sm ${isYou ? 'bg-bsb-gold/10 border border-bsb-gold/30' : 'hover:bg-white/[0.03]'}`}>
      <span className={`w-6 text-right font-mono text-xs ${isYou ? 'text-bsb-gold font-bold' : 'text-bsb-dim'}`}>{num}</span>
      <span className={isYou ? 'text-bsb-gold font-bold' : 'text-white/80'}>{name}</span>
      {isYou && <span className="ml-auto text-[10px] bg-bsb-gold/20 text-bsb-gold px-2 py-0.5 rounded-full font-bold">YOU</span>}
    </div>
  )
}

// ─── Quick Tip card ───────────────────────────────
function Tip({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-bsb-accent/30 transition-all duration-300">
      <div className="text-2xl mb-2">{emoji}</div>
      <h4 className="text-white font-bold text-sm mb-1">{title}</h4>
      <p className="text-bsb-dim text-xs leading-relaxed">{children}</p>
    </div>
  )
}

// ─── Keyboard shortcut ────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[11px] font-mono text-white/70">{children}</kbd>
}

// ═════════════════════════════════════════════════
// MAIN GUIDE PAGE
// ═════════════════════════════════════════════════
export default function GuidePage() {
  const [activeNav, setActiveNav] = useState('')
  const sectionsRef = useRef<Map<string, HTMLElement>>(new Map())

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveNav(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    sectionsRef.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const registerSection = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionsRef.current.set(id, el)
  }

  const navItems = [
    { id: 'scoring', label: 'Scoring' },
    { id: 'smart-numbers', label: 'Smart Numbers' },
    { id: 'draft-format', label: 'Draft Format' },
    { id: 'how-to-use', label: 'How to Use' },
    { id: 'player-cards', label: 'Player Cards' },
    { id: 'sidebars', label: 'Sidebars' },
    { id: 'recommendations', label: 'Recs' },
    { id: 'teams', label: 'Teams' },
  ]

  return (
    <div className="min-h-screen bg-bsb-navy">
      {/* ── FLOATING NAV ── */}
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
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  activeNav === item.id
                    ? 'bg-bsb-accent/20 text-bsb-accent'
                    : 'text-bsb-dim hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <Link href="/insights" className="px-3 py-1.5 text-xs text-bsb-dim hover:text-blue-400 hover:bg-white/5 rounded-full transition-all">
            📊 Insights
          </Link>
          <Link href="/" className="px-4 py-1.5 bg-bsb-accent/20 border border-bsb-accent/40 rounded-full text-xs font-bold text-bsb-accent hover:bg-bsb-accent/30 transition-all">
            Open Draft Board →
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        {/* ═══════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════ */}
        <Section>
          <div className="text-center py-16">
            <div className="inline-block mb-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-bsb-accent font-bold px-4 py-1.5 rounded-full border border-bsb-accent/30 bg-bsb-accent/10">
                2025 Season
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 leading-tight">
              BSB Draft<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-bsb-gold via-amber-400 to-yellow-300">
                Command Center
              </span>
            </h1>
            <p className="text-lg text-bsb-dim max-w-xl mx-auto leading-relaxed">
              Your personal war room for the Box Score Baseball Kentucky Derby Style draft.
              Real projections. Custom analytics. One goal — win.
            </p>
            <div className="flex justify-center gap-3 mt-8">
              <StatPill label="Players" value="600" />
              <StatPill label="Teams" value="16" />
              <StatPill label="Categories" value="10" />
              <StatPill label="Rounds" value="30" />
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════ */}
        {/* SCORING SYSTEM */}
        {/* ═══════════════════════════════════════ */}
        <section id="scoring" ref={registerSection('scoring')} className="pt-16">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">⚾</span>
              <div>
                <h2 className="text-3xl font-black text-white">How Our Scoring Works</h2>
                <p className="text-bsb-dim text-sm mt-1">Every player earns fantasy points based on what they do in real games.</p>
              </div>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Batting */}
            <Section delay={100}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-white/[0.06]">
                  <h3 className="text-sm font-black uppercase tracking-wider text-blue-400">🏏 Batting</h3>
                </div>
                <div>
                  <ScoreRow action="Run Scored (R)" pts="+1" />
                  <ScoreRow action="Total Base (TB)" pts="+1 per base" />
                  <ScoreRow action="Walk (BB)" pts="+1" />
                  <ScoreRow action="RBI" pts="+1" />
                  <ScoreRow action="Stolen Base (SB)" pts="+1" />
                </div>
                <div className="px-5 py-3 bg-white/[0.02]">
                  <p className="text-xs text-bsb-dim leading-relaxed">
                    <span className="text-bsb-gold font-bold">Example:</span> A home run = +4 (total bases) +1 (run) +1 (RBI) = <span className="text-bsb-gold font-bold">6 pts</span> on one swing. A walk is worth the same as a single (1 pt each) — that&apos;s why OBP guys matter.
                  </p>
                </div>
              </div>
            </Section>

            {/* Pitching */}
            <Section delay={200}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-red-500/10 to-transparent border-b border-white/[0.06]">
                  <h3 className="text-sm font-black uppercase tracking-wider text-red-400">🔥 Pitching</h3>
                </div>
                <div>
                  <ScoreRow action="Inning Pitched (IP)" pts="+3" />
                  <ScoreRow action="Strikeout (K)" pts="+1" />
                  <ScoreRow action="Win (W)" pts="+10" />
                  <ScoreRow action="Save (SV)" pts="+8" />
                  <ScoreRow action="Hold (HLD)" pts="+6" />
                  <ScoreRow action="Quality Start (QS)" pts="+4" />
                  <ScoreRow action="Complete Game (CG)" pts="+5" />
                  <ScoreRow action="Inherited Runners Stranded (IRSTR)" pts="+2" />
                  <ScoreRow action="Earned Run (ER)" pts="-2" accent />
                  <ScoreRow action="Walk Allowed (BB)" pts="-1" accent />
                  <ScoreRow action="Hit Allowed (H)" pts="-1" accent />
                </div>
                <div className="px-5 py-3 bg-white/[0.02]">
                  <p className="text-xs text-bsb-dim leading-relaxed">
                    <span className="text-bsb-gold font-bold">Example:</span> A starter who goes 7 IP, 8 K, and a Win = 21+8+10 = <span className="text-bsb-gold font-bold">39+ pts</span> in one game. Wins are king at +10 each.
                  </p>
                </div>
              </div>
            </Section>
          </div>

          {/* FPTS callout */}
          <Section delay={300}>
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-bsb-gold/10 via-amber-500/5 to-transparent border border-bsb-gold/20 p-6">
              <div className="flex items-start gap-4">
                <span className="text-4xl">🏆</span>
                <div>
                  <h3 className="text-white font-bold text-lg">The FPTS Number</h3>
                  <p className="text-bsb-dim text-sm mt-1 leading-relaxed">
                    The gold number next to every player&apos;s name is their <span className="text-bsb-gold font-bold">projected total fantasy points for the 2025 season</span> using our exact scoring formula. This is the single most important number in the app. Higher FPTS = more valuable player.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* SMART NUMBERS */}
        {/* ═══════════════════════════════════════ */}
        <section id="smart-numbers" ref={registerSection('smart-numbers')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🧠</span>
              <div>
                <h2 className="text-3xl font-black text-white">Understanding the Smart Numbers</h2>
                <p className="text-bsb-dim text-sm mt-1">The app calculates custom analytics so you can make smarter picks.</p>
              </div>
            </div>
          </Section>

          {/* VORP */}
          <Section delay={100}>
            <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-black">VORP</span>
                <span className="text-white font-bold">Value Over Replacement Player</span>
              </div>
              <p className="text-bsb-dim text-sm leading-relaxed mb-4">
                How many more points this player is projected to score compared to the 17th-best player at his position (the &ldquo;replacement level&rdquo; in a 16-team league). A shortstop at 400 pts might be more valuable than an outfielder at 450 pts — because there are fewer good shortstops.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10">
                  <span className="w-3 h-3 rounded-full bg-green-400"></span>
                  <div>
                    <span className="text-green-400 text-xs font-bold">+30 or more</span>
                    <p className="text-[10px] text-bsb-dim">Elite value</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10">
                  <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                  <div>
                    <span className="text-yellow-400 text-xs font-bold">+10 to +30</span>
                    <p className="text-[10px] text-bsb-dim">Good value</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5">
                  <span className="w-3 h-3 rounded-full bg-white/30"></span>
                  <div>
                    <span className="text-white/50 text-xs font-bold">Under +10</span>
                    <p className="text-[10px] text-bsb-dim">Minimal edge</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* PANA */}
          <Section delay={200}>
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-black">PANA</span>
                <span className="text-white font-bold">Points Above Next Available</span>
              </div>
              <p className="text-bsb-dim text-sm leading-relaxed mb-4">
                The gap between this player and the very next undrafted player at the same position. It updates live as players get drafted. A PANA of +40 means the next guy is 40 points worse — that&apos;s a huge cliff. Draft now or lose that value forever.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10">
                  <span className="text-red-400 text-sm font-bold">▼</span>
                  <div>
                    <span className="text-red-400 text-xs font-bold">+20 or more</span>
                    <p className="text-[10px] text-bsb-dim">Draft NOW</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/10">
                  <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                  <div>
                    <span className="text-orange-400 text-xs font-bold">+10 to +20</span>
                    <p className="text-[10px] text-bsb-dim">Keep an eye</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5">
                  <span className="w-3 h-3 rounded-full bg-white/30"></span>
                  <div>
                    <span className="text-white/50 text-xs font-bold">Under +10</span>
                    <p className="text-[10px] text-bsb-dim">Safe to wait</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Tiers */}
          <Section delay={300}>
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📊</span>
                <span className="text-white font-bold">Player Tiers (1–5)</span>
              </div>
              <p className="text-bsb-dim text-sm leading-relaxed mb-4">
                Every player is ranked within their position group and placed into a tier. Grab Tier 1 and 2 guys whenever you can. Once a position is down to Tier 4–5, you&apos;ve missed the window.
              </p>
              <div className="space-y-1">
                <TierRow tier={1} label="Elite" pct="Top 6%" color="bg-gradient-to-r from-amber-500 to-yellow-400 text-black" />
                <TierRow tier={2} label="Great" pct="Next 12%" color="bg-gradient-to-r from-blue-500 to-cyan-400 text-white" />
                <TierRow tier={3} label="Solid" pct="Next 20%" color="bg-white/10 text-white/80" />
                <TierRow tier={4} label="Average" pct="Next 25%" color="bg-white/5 text-white/50" />
                <TierRow tier={5} label="Below Average" pct="Bottom 37%" color="bg-white/[0.03] text-white/30" />
              </div>
            </div>
          </Section>

          {/* Position Rank */}
          <Section delay={400}>
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ background: '#16a34a' }}>SS3</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ background: '#0f766e' }}>OF12</span>
                </div>
                <div>
                  <span className="text-white font-bold text-sm">Position Rank</span>
                  <p className="text-bsb-dim text-xs">The number on each badge = rank at their position. SS3 = 3rd-best shortstop. Lower = better.</p>
                </div>
              </div>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* DRAFT FORMAT */}
        {/* ═══════════════════════════════════════ */}
        <section id="draft-format" ref={registerSection('draft-format')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏇</span>
              <div>
                <h2 className="text-3xl font-black text-white">The Kentucky Derby Draft</h2>
                <p className="text-bsb-dim text-sm mt-1">10 categories, 16 picks per round, templates that determine everything.</p>
              </div>
            </div>
          </Section>

          <Section delay={100}>
            <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="grid grid-cols-4 gap-2 py-2.5 px-3 bg-white/[0.04] border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-bsb-dim font-bold">
                <span>Category</span>
                <span className="text-center">Rounds</span>
                <span>Eligible</span>
                <span className="text-center">Picks</span>
              </div>
              <CatRow name="Mini Bat" rounds={4} who="Any batter" total={64} />
              <CatRow name="Mini Pitch" rounds={4} who="Any pitcher" total={64} />
              <CatRow name="Mega Pitch" rounds={6} who="Any pitcher" total={96} />
              <CatRow name="Mega OF" rounds={4} who="Outfielders" total={64} />
              <CatRow name="Mega 1B" rounds={2} who="First basemen" total={32} />
              <CatRow name="Mega 2B" rounds={2} who="Second basemen" total={32} />
              <CatRow name="Mega 3B" rounds={2} who="Third basemen" total={32} />
              <CatRow name="Mega SS" rounds={2} who="Shortstops" total={32} />
              <CatRow name="Mega C" rounds={2} who="Catchers" total={32} />
              <CatRow name="Mega Any" rounds={2} who="Anyone" total={32} />
            </div>
          </Section>

          {/* Templates */}
          <Section delay={200}>
            <div className="mt-6 rounded-2xl bg-gradient-to-r from-bsb-mid/30 to-transparent border border-white/[0.08] p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🎫</span>
                <h3 className="text-white font-bold text-lg">Templates (A through P)</h3>
              </div>
              <p className="text-bsb-dim text-sm leading-relaxed mb-4">
                Before the draft, each team selects a template letter (A–P). Your template determines your pick number in every category. Template A might give you pick #1 in Mini Bat but #16 in Mini Pitch. It&apos;s all about tradeoffs.
              </p>
              <p className="text-bsb-dim text-sm leading-relaxed">
                The app ranks templates by calculating a <span className="text-bsb-gold font-bold">Template Score</span> based on post-Mini scarcity. Templates that give you early picks at scarce positions rank higher. The left sidebar shows this ranking to help you choose.
              </p>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* HOW TO USE */}
        {/* ═══════════════════════════════════════ */}
        <section id="how-to-use" ref={registerSection('how-to-use')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎮</span>
              <div>
                <h2 className="text-3xl font-black text-white">How to Use the App</h2>
                <p className="text-bsb-dim text-sm mt-1">Everything you need to know for draft day.</p>
              </div>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Before */}
            <Section delay={100}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-black">1</span>
                  Before the Draft
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="text-bsb-gold shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Browse players</strong> — Scroll the main board to see all 600 players ranked by FPTS.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-gold shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Filter by position</strong> — Click the position buttons (C, 1B, 2B, 3B, SS, OF, SP, RP).</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-gold shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Search</strong> — Press <Kbd>/</Kbd> or <Kbd>Ctrl+K</Kbd> and type any player name or team.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-gold shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Pick your template</strong> — Click a template letter in the left sidebar.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-gold shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Study player cards</strong> — Click any player&apos;s name to open their full scouting card.</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* During */}
            <Section delay={200}>
              <div className="rounded-2xl border border-bsb-accent/20 bg-bsb-accent/[0.03] p-6">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-bsb-accent/20 text-bsb-accent flex items-center justify-center text-xs font-black">2</span>
                  During the Draft
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="text-bsb-accent shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Select the category</strong> — Click the category button that&apos;s currently being drafted. The board auto-filters.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-accent shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Someone else picks</strong> — Right-click the player and assign to their team. Keeps scarcity numbers accurate.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-accent shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Your pick</strong> — Look for the gold <span className="text-bsb-gold font-bold">&ldquo;YOUR PICK!&rdquo;</span> indicator and the <span className="text-bsb-gold">REC</span> badges. Click a row to draft.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-accent shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Track progress</strong> — Dashboard strip shows team total, category progress, and pick countdown.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-bsb-accent shrink-0">→</span>
                    <span className="text-white/80"><strong className="text-white">Check your roster</strong> — Right sidebar shows your full team + draft log.</span>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Controls */}
          <Section delay={300}>
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-white font-bold text-lg mb-4">⌨️ Quick Controls</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-bsb-dim">Click player&apos;s name</span>
                  <span className="flex-1 border-b border-dashed border-white/10"></span>
                  <span className="text-white font-semibold">Open player card</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-bsb-dim">Click anywhere else on row</span>
                  <span className="flex-1 border-b border-dashed border-white/10"></span>
                  <span className="text-white font-semibold">Draft to your team</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-bsb-dim">Right-click a player</span>
                  <span className="flex-1 border-b border-dashed border-white/10"></span>
                  <span className="text-white font-semibold">Assign to another team</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-bsb-dim"><Kbd>/</Kbd> or <Kbd>Ctrl+K</Kbd></span>
                  <span className="flex-1 border-b border-dashed border-white/10"></span>
                  <span className="text-white font-semibold">Jump to search</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-bsb-dim"><Kbd>Escape</Kbd></span>
                  <span className="flex-1 border-b border-dashed border-white/10"></span>
                  <span className="text-white font-semibold">Clear search / close modals</span>
                </div>
              </div>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* PLAYER CARDS */}
        {/* ═══════════════════════════════════════ */}
        <section id="player-cards" ref={registerSection('player-cards')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🃏</span>
              <div>
                <h2 className="text-3xl font-black text-white">Player Cards</h2>
                <p className="text-bsb-dim text-sm mt-1">Click any player&apos;s name to open a detailed scouting card.</p>
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
            <Section delay={50}><Tip emoji="👤" title="Bio">Age, bats/throws, height &amp; weight, MLB debut year, years of service, birth country.</Tip></Section>
            <Section delay={100}><Tip emoji="🏆" title="BSB Fantasy Score">The big gold FPTS number, trend arrow (up or down vs last season), VORP, PANA, and WAR at a glance.</Tip></Section>
            <Section delay={150}><Tip emoji="📈" title="3-Year History">Bar chart showing actual BSB fantasy points for 2022, 2023, 2024 plus the 2025 projection — all using our exact scoring.</Tip></Section>
            <Section delay={200}><Tip emoji="🔢" title="Scoring Breakdown">Every category listed with raw stat, multiplier, and points earned. See exactly where a player&apos;s value comes from.</Tip></Section>
            <Section delay={250}><Tip emoji="📊" title="Advanced Stats">Traditional metrics for context. Batters: AVG, OBP, SLG, OPS. Pitchers: ERA, WHIP, K/9, K:BB ratio.</Tip></Section>
            <Section delay={300}><Tip emoji="🎯" title="Draft Context">Next available player at this position and the drop-off, a comparable player, position rank, and draft status.</Tip></Section>
          </div>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* SIDEBARS */}
        {/* ═══════════════════════════════════════ */}
        <section id="sidebars" ref={registerSection('sidebars')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📐</span>
              <div>
                <h2 className="text-3xl font-black text-white">The Sidebars</h2>
                <p className="text-bsb-dim text-sm mt-1">Two sidebars with everything you need at a glance.</p>
              </div>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <Section delay={100}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 h-full">
                <h3 className="text-white font-bold text-lg mb-1">◀ Left Sidebar</h3>
                <p className="text-bsb-dim text-xs mb-4">Strategy headquarters</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-bsb-gold font-bold">Template Rankings</span>
                    <p className="text-bsb-dim text-xs mt-0.5">All 16 templates ranked by strategic value. Click to select yours.</p>
                  </div>
                  <div>
                    <span className="text-bsb-gold font-bold">Template Detail</span>
                    <p className="text-bsb-dim text-xs mt-0.5">Your pick number in every category, once selected.</p>
                  </div>
                  <div>
                    <span className="text-bsb-gold font-bold">Live Scarcity</span>
                    <p className="text-bsb-dim text-xs mt-0.5">Bar chart showing value spread at each position. Taller bar = more urgency. Shrinks as the position levels out.</p>
                  </div>
                  <div>
                    <span className="text-bsb-gold font-bold">Pool Depth</span>
                    <p className="text-bsb-dim text-xs mt-0.5">Undrafted players left per position. Red when below 16 — you&apos;re running out.</p>
                  </div>
                </div>
              </div>
            </Section>
            <Section delay={200}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 h-full">
                <h3 className="text-white font-bold text-lg mb-1">▶ Right Sidebar</h3>
                <p className="text-bsb-dim text-xs mb-4">Two tabs</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-bsb-accent font-bold">My Team Tab</span>
                    <p className="text-bsb-dim text-xs mt-0.5">Your drafted roster by position (C, 1B, 2B, 3B, SS, OF, SP, RP), running FPTS total, and full draft log with every pick in order.</p>
                  </div>
                  <div>
                    <span className="text-bsb-accent font-bold">All Teams Tab</span>
                    <p className="text-bsb-dim text-xs mt-0.5">Every team with their total FPTS, player count, and a strength meter. Click any team to expand and see who they&apos;ve drafted.</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* RECOMMENDATIONS */}
        {/* ═══════════════════════════════════════ */}
        <section id="recommendations" ref={registerSection('recommendations')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">✨</span>
              <div>
                <h2 className="text-3xl font-black text-white">The Recommendations</h2>
                <p className="text-bsb-dim text-sm mt-1">When a category is active, the app highlights its top 3 recommended picks.</p>
              </div>
            </div>
          </Section>

          <Section delay={100}>
            <div className="mt-8 rounded-2xl border border-bsb-gold/20 bg-bsb-gold/[0.03] p-6">
              <p className="text-bsb-dim text-sm leading-relaxed mb-6">
                Look for the gold <span className="text-[10px] px-1.5 rounded bg-bsb-gold/20 text-bsb-gold font-bold">REC</span> badge. The recommendation engine considers three things:
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-white/[0.04]">
                  <span className="text-3xl font-black text-bsb-gold">40%</span>
                  <p className="text-white font-bold text-sm mt-1">VORP</p>
                  <p className="text-bsb-dim text-[10px] mt-0.5">Better than replacement?</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/[0.04]">
                  <span className="text-3xl font-black text-bsb-accent">35%</span>
                  <p className="text-white font-bold text-sm mt-1">PANA</p>
                  <p className="text-bsb-dim text-[10px] mt-0.5">How big is the cliff?</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/[0.04]">
                  <span className="text-3xl font-black text-blue-400">25%</span>
                  <p className="text-white font-bold text-sm mt-1">Raw FPTS</p>
                  <p className="text-bsb-dim text-[10px] mt-0.5">Pure production</p>
                </div>
              </div>
              <p className="text-bsb-dim text-xs leading-relaxed mt-4">
                This means the app won&apos;t always recommend the highest-FPTS player. Sometimes it&apos;ll recommend a slightly lower-scoring player at a position about to dry up. <span className="text-bsb-gold font-bold">Trust the recs — they account for scarcity.</span>
              </p>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* TEAMS */}
        {/* ═══════════════════════════════════════ */}
        <section id="teams" ref={registerSection('teams')} className="pt-24">
          <Section>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏟️</span>
              <div>
                <h2 className="text-3xl font-black text-white">The 16 Teams</h2>
                <p className="text-bsb-dim text-sm mt-1">The BSB league roster.</p>
              </div>
            </div>
          </Section>

          <Section delay={100}>
            <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                <TeamRow num={0} name="Frequent Fliers" isYou />
                <TeamRow num={1} name="Deuces Wild" />
                <TeamRow num={2} name="El Guapo Gato" />
                <TeamRow num={3} name="Fulton's Folly" />
                <TeamRow num={4} name="Hubschs Hackers" />
                <TeamRow num={5} name="Kansas City Monarchs" />
                <TeamRow num={6} name="Kline Drives" />
                <TeamRow num={7} name="No Soup for You" />
                <TeamRow num={8} name="14-30-8-24-5-15-13-20" />
                <TeamRow num={9} name="Betty White Sox" />
                <TeamRow num={10} name="Dirty Water All-Stars" />
                <TeamRow num={11} name="Hot Dog Junkies" />
                <TeamRow num={12} name="Mesa Joses" />
                <TeamRow num={13} name="Sedition Brothers" />
                <TeamRow num={14} name="Silly Santos" />
                <TeamRow num={15} name="St. Louis Browns" />
              </div>
            </div>
          </Section>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* FOOTER CTA */}
        {/* ═══════════════════════════════════════ */}
        <Section delay={200}>
          <div className="mt-24 text-center py-16 rounded-3xl bg-gradient-to-br from-bsb-mid/20 via-transparent to-bsb-accent/5 border border-white/[0.06]">
            <span className="text-5xl mb-4 block">🎯</span>
            <h2 className="text-3xl font-black text-white mb-2">Ready to Draft?</h2>
            <p className="text-bsb-dim text-sm mb-6">Open the draft board and dominate.</p>
            <Link href="/" className="inline-block px-8 py-3 bg-bsb-accent text-white font-bold rounded-full hover:bg-bsb-accent/80 transition-all hover:scale-105 transform">
              Open Draft Board →
            </Link>
            <p className="text-bsb-dim/50 text-xs mt-8">Built for the BSB league. Good luck on draft day.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}
