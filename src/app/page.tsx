'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useDraftStore, Player } from '@/hooks/useDraftStore'
import Fuse from 'fuse.js'
import Link from 'next/link'

// Components
import { TEAM_NAMES, GRID_COLS, teamAbbrev, teamColor } from '@/components/constants'
import { PlayerRow } from '@/components/PlayerRow'
import { PlayerCard } from '@/components/PlayerCard'
import { TemplatePanel, TemplateDetail } from '@/components/TemplatePanel'
import { CategorySelector } from '@/components/CategorySelector'
import { DashboardStrip } from '@/components/DashboardStrip'
import { TeamContextMenu } from '@/components/TeamContextMenu'
import { ScarcityBar } from '@/components/ScarcityBar'
import { MyTeamPositionGrid } from '@/components/TeamPanels'
import { AllTeamsRoster } from '@/components/AllTeamsRoster'
import { TeamSelector } from '@/components/TeamSelector'
import { useNewsStore } from '@/hooks/useNewsStore'
import { NewsFeed } from '@/components/NewsFeed'
import { MyPicksPanel } from '@/components/MyPicksPanel'
import openingDayData from '@/data/openingDay.json'

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
export default function Home() {
  const store = useDraftStore()
  const newsStore = useNewsStore(store.allPlayers)
  const [searchQuery, setSearchQuery] = useState('')
  const [posFilter, setPosFilter] = useState<string | null>(null)
  const [showAllPlayers, setShowAllPlayers] = useState(false)
  const [showDrafted, setShowDrafted] = useState(true)
  const [showLeftSidebar, setShowLeftSidebar] = useState(false)
  const [rightPanel, setRightPanel] = useState<'myteam' | 'allteams' | 'news'>('myteam')
  const [showRightSidebar, setShowRightSidebar] = useState(false)
  const [showHints, setShowHints] = useState(true)
  const searchRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; playerId: string; playerName: string
  } | null>(null)

  // Player card modal state
  const [cardPlayer, setCardPlayer] = useState<Player | null>(null)

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'desc' | 'asc' } | null>(null)

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchQuery('')
        setContextMenu(null)
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fuse.js for fuzzy search
  const fuse = useMemo(() => new Fuse(store.allPlayers, {
    keys: ['name', 'team'],
    threshold: 0.3,
    minMatchCharLength: 2,
  }), [store.allPlayers])

  // Filtered player list
  const displayPlayers = useMemo(() => {
    let players: Player[]

    if (searchQuery.length >= 2) {
      players = fuse.search(searchQuery).map(r => r.item)
    } else if (store.draftState.activeCategory && !showAllPlayers) {
      players = store.getAvailableForCategory(store.draftState.activeCategory)
    } else if (posFilter) {
      if (posFilter === 'SP' || posFilter === 'RP') {
        players = store.pitchers.filter(p => p.role === posFilter)
      } else if (posFilter === 'P') {
        players = store.pitchers
      } else {
        players = store.batters.filter(b => b.positions.includes(posFilter))
      }
    } else {
      players = store.allPlayers
    }

    if (!showDrafted && !searchQuery) {
      players = players.filter(p => !p.drafted)
    }

    if (sortConfig) {
      players.sort((a, b) => {
        const valA = (a as any)[sortConfig.key] ?? 0
        const valB = (b as any)[sortConfig.key] ?? 0
        if (sortConfig.direction === 'desc') return valB - valA
        return valA - valB
      })
    } else {
      players.sort((a, b) => b.fpts - a.fpts)
    }

    return players
  }, [searchQuery, store.draftState.activeCategory, posFilter, store, fuse, showAllPlayers, showDrafted, sortConfig])

  // Live scarcity
  const { scarcity, remaining } = store.getLiveScarcity()
  const maxScarcity = Math.max(...Object.values(scarcity), 1)

  // My team number (null = needs to select)
  const myNum = store.myTeamNumber

  // My team
  const myTeamPlayers = useMemo(() =>
    store.allPlayers.filter(p => p.drafted && p.draftedBy === myNum),
    [store.allPlayers, myNum]
  )
  const myTeamTotal = useMemo(() =>
    myTeamPlayers.reduce((s, p) => s + p.fpts, 0),
    [myTeamPlayers]
  )

  // Recommendations
  const recommendations = store.getRecommendations()
  const recIds = useMemo(() => new Set(recommendations.map(p => p.id)), [recommendations])

  // Pick countdown
  const picksUntil = store.getPicksUntilMyPick()

  // PANA cache for visible players (compute for top 80 to avoid perf issues)
  const panaMap = useMemo(() => {
    const map: Record<string, number> = {}
    displayPlayers.slice(0, 80).forEach(p => {
      if (!p.drafted) {
        map[p.id] = store.getPANA(p)
      }
    })
    return map
  }, [displayPlayers, store])

  // Right click handler
  const handleRightClick = useCallback((e: React.MouseEvent, player: Player) => {
    setContextMenu({ x: e.clientX, y: e.clientY, playerId: player.id, playerName: player.name })
  }, [])

  // Active category info
  const activeCat = store.categories.find(c => c.key === store.draftState.activeCategory)
  const activeRound = store.draftState.activeCategory
    ? store.getCategoryRound(store.draftState.activeCategory) : 0
  const activePickInRound = store.draftState.activeCategory
    ? store.getCategoryPickInRound(store.draftState.activeCategory) : 0
  const myPickInCategory = store.draftState.myTemplate && store.draftState.activeCategory
    ? store.templates[store.draftState.myTemplate]?.[store.draftState.activeCategory] : null
  const activeCatPickCount = store.draftState.activeCategory
    ? store.getCategoryPickCount(store.draftState.activeCategory) : 0

  // Header Sorting Helper
  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' }
        return null // turn off sorting
      }
      return { key, direction: 'desc' }
    })
  }, [])

  const SortHeader = useCallback(({ label, sortKey, align = 'right', className = '' }: { label: React.ReactNode, sortKey: string, align?: 'left' | 'center' | 'right', className?: string }) => {
    const isActive = sortConfig?.key === sortKey
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className={`flex items-center gap-0.5 hover:text-white transition-colors cursor-pointer outline-none ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
          } ${isActive ? 'text-white' : ''} ${className}`}
      >
        {label}
        {isActive && (
          <span className="text-[8px] text-bsb-accent leading-none block pt-[1px]">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
        )}
      </button>
    )
  }, [sortConfig, handleSort])

  // Determine header mode: 'batter' | 'pitcher' | 'mixed'
  const headerMode: 'batter' | 'pitcher' | 'mixed' = (() => {
    if (store.draftState.activeCategory && !showAllPlayers) {
      return activeCat?.type === 'pitcher' ? 'pitcher' : 'batter'
    }
    if (posFilter === 'SP' || posFilter === 'RP' || posFilter === 'P') return 'pitcher'
    if (posFilter && posFilter !== 'SP' && posFilter !== 'RP' && posFilter !== 'P') return 'batter'
    return 'mixed'
  })()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Team Selector — shown on first visit */}
      {myNum === null && (
        <TeamSelector onSelect={store.setMyTeamNumber} />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <TeamContextMenu
          x={contextMenu.x} y={contextMenu.y}
          playerId={contextMenu.playerId} playerName={contextMenu.playerName}
          onDraft={store.draftPlayer} onClose={() => setContextMenu(null)}
          myTeamNumber={myNum}
        />
      )}

      {/* Player Card Modal */}
      {cardPlayer && (
        <PlayerCard
          player={cardPlayer}
          pana={panaMap[cardPlayer.id] || store.getPANA(cardPlayer)}
          onClose={() => setCardPlayer(null)}
          onDraft={(id) => store.draftPlayer(id, myNum ?? 0)}
          allPlayers={store.allPlayers}
          playerNews={newsStore.newsForPlayer(cardPlayer.id)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-bsb-dark/80 backdrop-blur-xl border-b border-white/10 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-white">
            BSB<span className="text-bsb-accent">DRAFT</span>
          </h1>
          <span className="text-xs text-bsb-dim">{store.draftedCount} drafted</span>
          {myNum !== null && (
            <button
              onClick={() => {
                const newTeam = prompt('Switch team? Enter team number (0-15):')
                if (newTeam !== null && !isNaN(Number(newTeam)) && Number(newTeam) >= 0 && Number(newTeam) <= 15) {
                  store.setMyTeamNumber(Number(newTeam))
                }
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border border-white/10 hover:border-white/30 transition-all ${teamColor(myNum)}`}
              title="Click to switch team"
            >
              ⚾ {TEAM_NAMES[myNum]}
            </button>
          )}
          {store.draftState.myTemplate && (
            <span className="px-1.5 py-0.5 bg-bsb-gold/20 rounded text-[10px] text-bsb-gold font-bold">
              TPL {store.draftState.myTemplate}
            </span>
          )}
          {store.draftState.activeCategory && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-bsb-accent/20 border border-bsb-accent rounded text-xs text-bsb-accent font-bold">
                {store.draftState.activeCategory}
              </span>
              <span className="text-[10px] text-bsb-dim font-mono">
                Rd {activeRound}{activeCat ? `/${activeCat.rounds}` : ''}
              </span>
              <span className="text-[10px] text-bsb-dim font-mono">
                Pick {activePickInRound}/16
              </span>
              {myPickInCategory && (
                <span className={`text-[10px] font-bold font-mono px-1 rounded ${myPickInCategory === activePickInRound
                  ? 'bg-bsb-gold/30 text-bsb-gold animate-pulse'
                  : myPickInCategory > activePickInRound
                    ? 'text-bsb-dim' : 'text-bsb-dim line-through'
                  }`}>
                  {myPickInCategory === activePickInRound ? '→ YOUR PICK!' : `You: #${myPickInCategory}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input
              ref={searchRef} type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search players... (/ or Ctrl+K)"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-bsb-dim focus:outline-none focus:border-bsb-accent focus:bg-white/10 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-bsb-dim hover:text-white text-xs">✕</button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDrafted(!showDrafted)}
            className={`px-2 py-1 text-xs rounded transition-all ${showDrafted ? 'text-bsb-dim hover:bg-white/5' : 'bg-bsb-mid text-white'
              }`}
          >
            {showDrafted ? 'Hide Drafted' : 'Show Drafted'}
          </button>
          <button
            onClick={() => { if (confirm('Reset entire draft? This cannot be undone.')) store.resetDraft() }}
            className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded"
          >Reset</button>
          <Link href="/guide" className="px-3 py-1 text-xs text-bsb-dim hover:text-bsb-gold hover:bg-white/5 rounded transition-all" title="League Guide">
            📖 Guide
          </Link>
          <Link href="/insights" className="px-3 py-1 text-xs text-bsb-dim hover:text-bsb-gold hover:bg-white/5 rounded transition-all" title="Weekly Variance Insights">
            📊 Insights
          </Link>
          <Link href="/advanced-stats" className="px-3 py-1 text-xs text-bsb-dim hover:text-bsb-gold hover:bg-white/5 rounded transition-all" title="Advanced Stats & Player Analysis">
            🔬 Advanced
          </Link>
        </div>
      </header>

      {/* ── DASHBOARD STRIP ── */}
      <DashboardStrip
        myTeamTotal={myTeamTotal}
        myTeamCount={myTeamPlayers.length}
        picksUntil={picksUntil}
        topRec={recommendations[0] || null}
        activeCatKey={store.draftState.activeCategory}
        categoryPickCount={activeCatPickCount}
        activeCatRounds={activeCat?.rounds || 0}
      />

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden bg-bsb-navy relative">
        {/* Mobile Overlays */}
        {showLeftSidebar && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden" onClick={() => setShowLeftSidebar(false)} />
        )}
        {showRightSidebar && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] xl:hidden" onClick={() => setShowRightSidebar(false)} />
        )}



        {/* ── CENTER: Draft Board ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-bsb-dark/50 border-b border-white/10 space-y-2">
            <CategorySelector
              categories={store.categories}
              active={store.draftState.activeCategory}
              onSelect={(cat) => { store.setActiveCategory(cat); setShowAllPlayers(false) }}
              getCategoryRound={store.getCategoryRound}
              getCategoryPickCount={store.getCategoryPickCount}
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-1 items-center">
                {!store.draftState.activeCategory && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-bsb-dim mr-1">FILTER:</span>
                    {['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'].map(pos => {
                      const count = remaining[pos]?.length || 0
                      const isLow = count > 0 && count < 16
                      const isActive = posFilter === pos
                      // Base styles for the pill
                      let pillClass = 'px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border '
                      if (isActive) {
                        pillClass += `pos-${pos} text-white border-transparent shadow-[0_0_10px_rgba(255,255,255,0.2)]`
                      } else {
                        pillClass += isLow
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                          : 'bg-white/5 text-bsb-dim border-white/10 hover:bg-white/10 hover:text-white'
                      }

                      return (
                        <button key={pos}
                          onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                          className={pillClass}
                          title={`${count} un-drafted players remaining`}
                        >
                          {pos} <span className={`opacity-70 ml-0.5 ${isActive ? 'text-white' : ''}`}>({count})</span>
                        </button>
                      )
                    })}
                    {posFilter && (
                      <button onClick={() => setPosFilter(null)} className="text-[10px] text-bsb-dim hover:text-white ml-2 underline underline-offset-2">Clear</button>
                    )}
                  </div>
                )}
                {store.draftState.activeCategory && (
                  <button
                    onClick={() => setShowAllPlayers(!showAllPlayers)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${showAllPlayers ? 'bg-bsb-mid text-white border border-white/20' : 'bg-white/5 text-bsb-dim hover:bg-white/10'
                      }`}
                  >{showAllPlayers ? '← Back to Category' : 'View All Players'}</button>
                )}
              </div>
              <div className="text-[10px] text-bsb-dim">
                {displayPlayers.length} players {!showDrafted && '(hiding drafted)'}
              </div>
            </div>
          </div>

          {/* Scrollable player list */}
          <div className="flex-1 overflow-y-auto relative">
            {/* Player list header — same grid as rows */}
            <div className="bg-bsb-dark/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-20 shadow-lg">
              <div
                className="grid items-center px-2 py-1 text-[10px] text-bsb-dim uppercase tracking-wider font-mono max-w-[1050px] mx-auto w-full tabular-nums"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <span className="text-right">#</span>
                <span className="text-center">Pos</span>
                <span>Player</span>
                <span className="text-center">Tm</span>
                <SortHeader label="Pts" sortKey="fpts" className="text-bsb-gold hover:text-bsb-gold/80" />
                <SortHeader label="TWV" sortKey="twv" className="text-sky-400/80 hover:text-sky-400" />
                <SortHeader label="Cons" sortKey="consistencyScore" className="text-white/50 hover:text-white/80" />
                <SortHeader label="VORP" sortKey="vorp" className="text-green-400/60 hover:text-green-400/80" />
                {/* 14 dynamic columns */}
                {headerMode === 'pitcher' ? (
                  <>
                    <SortHeader label="IP" sortKey="ip" />
                    <SortHeader label="W" sortKey="w" />
                    <SortHeader label="SV" sortKey="sv" />
                    <SortHeader label="HLD" sortKey="hld" />
                    <SortHeader label="K" sortKey="so" />
                    <SortHeader label="CG" sortKey="cg" />
                    <SortHeader label="IRS" sortKey="irstr" />
                    <SortHeader label="Velo" sortKey="fb_velo" />
                    <SortHeader label="Stuff+" sortKey="stuff_plus" />
                    <SortHeader label="Loc+" sortKey="location_plus" />
                    <SortHeader label="xERA" sortKey="xera" />
                    <SortHeader label="HH%" sortKey="hard_hit_against" />
                    <SortHeader label="BRL%" sortKey="barrel_against" />
                    <SortHeader label="Chase%" sortKey="chase_rate" />
                  </>
                ) : headerMode === 'batter' ? (
                  <>
                    <SortHeader label="PA" sortKey="pa" />
                    <SortHeader label="AVG" sortKey="avg" />
                    <SortHeader label="R" sortKey="r" />
                    <SortHeader label="BB" sortKey="bb" />
                    <SortHeader label="HR" sortKey="hr" />
                    <SortHeader label="RBI" sortKey="rbi" />
                    <SortHeader label="SB" sortKey="sb" />
                    <SortHeader label="K" sortKey="so" />
                    <SortHeader label="EV" sortKey="exit_velo" />
                    <SortHeader label="HH%" sortKey="hard_hit_pct" />
                    <SortHeader label="BABIP" sortKey="babip" />
                    <SortHeader label="wRC+" sortKey="wrc_plus" />
                    <SortHeader label="Whiff%" sortKey="whiff_pct" />
                    <span></span>
                  </>
                ) : (
                  <>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="PA" sortKey="pa" align="right" /><SortHeader label="IP" sortKey="ip" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="AVG" sortKey="avg" align="right" /><SortHeader label="W" sortKey="w" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="R" sortKey="r" align="right" /><SortHeader label="SV" sortKey="sv" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="BB" sortKey="bb" align="right" /><SortHeader label="HLD" sortKey="hld" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="HR" sortKey="hr" align="right" /><SortHeader label="K" sortKey="so" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="RBI" sortKey="rbi" align="right" /><SortHeader label="CG" sortKey="cg" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="SB" sortKey="sb" align="right" /><SortHeader label="IRS" sortKey="irstr" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="K" sortKey="so" align="right" /><SortHeader label="Velo" sortKey="fb_velo" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="EV" sortKey="exit_velo" align="right" /><SortHeader label="Stuff+" sortKey="stuff_plus" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="HH%" sortKey="hard_hit_pct" align="right" /><SortHeader label="Loc+" sortKey="location_plus" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="BABIP" sortKey="babip" align="right" /><SortHeader label="xERA" sortKey="xera" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="wRC+" sortKey="wrc_plus" align="right" /><SortHeader label="HH%" sortKey="hard_hit_against" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><SortHeader label="Whiff%" sortKey="whiff_pct" align="right" /><SortHeader label="BRL%" sortKey="barrel_against" align="right" className="text-white/20 hover:text-white/50" /></span>
                    <span className="text-right flex flex-col leading-tight"><span className="text-transparent">_</span><SortHeader label="Chase%" sortKey="chase_rate" align="right" className="text-white/20 hover:text-white/50" /></span>
                  </>
                )}
                {/* Tag column */}
                <span></span>
              </div>
            </div>

            <div className="max-w-[1050px] mx-auto w-full pb-4">
              {displayPlayers.map((player, i) => (
                <PlayerRow
                  key={player.id} player={player} rank={i + 1}
                  onDraft={(id) => store.draftPlayer(id, myNum ?? 0)}
                  onUndraft={(id) => store.undraftPlayer(id)}
                  onRightClick={handleRightClick}
                  onNameClick={(p) => setCardPlayer(p)}
                  showRole={player.pos === 'P'}
                  isRecommended={recIds.has(player.id)}
                  recRank={recommendations.findIndex(r => r.id === player.id) + 1}
                  pana={panaMap[player.id] || 0}
                  prevTier={i > 0 ? displayPlayers[i - 1].tier : undefined}
                  hasNews={newsStore.hasNewsForPlayer(player.id)}
                  newsSeverity={newsStore.topSeverityForPlayer(player.id)}
                  myTeamNumber={myNum}
                  battingOrder={player.pos !== 'P' ? (openingDayData.battingOrder as Record<string, number>)[player.name] : undefined}
                  rotationNumber={player.pos === 'P' ? (openingDayData.rotation as Record<string, number>)[player.name] : undefined}
                />
              ))}
              {displayPlayers.length === 0 && (
                <div className="p-8 text-center text-bsb-dim">
                  {searchQuery ? `No players found for "${searchQuery}"` : 'No players available'}
                </div>
              )}
            </div>
          </div>

          {/* Hint bar — collapsible */}
          {showHints ? (
            <div className="px-3 py-1 bg-bsb-dark/80 border-t border-white/5 text-[10px] text-bsb-dim flex items-center gap-4">
              <span><kbd className="px-1 bg-white/10 rounded">Click name</kbd> = player card</span>
              <span><kbd className="px-1 bg-white/10 rounded">Click row</kbd> = draft to {TEAM_NAMES[myNum ?? 0]}</span>
              <span><kbd className="px-1 bg-white/10 rounded">Right-click</kbd> = assign to team</span>
              <span><kbd className="px-1 bg-white/10 rounded">/</kbd> = search</span>
              <span className="hidden lg:inline ml-auto">
                <span className="text-bsb-gold/50">REC</span> = recommended
                <span className="mx-1">·</span>
                <span className="text-green-400/50">VORP</span> = value over replacement
                <span className="mx-1">·</span>
                <span className="text-red-400/50">▼</span> = big drop-off
              </span>
              <button onClick={() => setShowHints(false)} className="ml-2 text-white/20 hover:text-white/50 transition-colors">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowHints(true)} className="px-3 py-0.5 bg-bsb-dark/80 border-t border-white/5 text-[10px] text-bsb-dim hover:text-white/50 transition-colors w-full text-left">
              ? Show hints
            </button>
          )}
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className={`fixed inset-y-0 right-0 w-[320px] bg-bsb-dark/95 backdrop-blur-2xl border-l border-white/10 overflow-y-auto transition-transform transform z-[60] xl:relative xl:translate-x-0 xl:bg-bsb-dark/60 xl:z-40 ${showRightSidebar ? 'translate-x-0 shadow-[-10px_0_30px_rgba(0,0,0,0.8)]' : 'translate-x-full xl:shadow-[-10px_0_30px_rgba(0,0,0,0.3)]'}`}>
          <div className="flex justify-between items-center p-3 xl:hidden border-b border-white/10 sticky top-0 bg-bsb-dark/95 z-20">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Draft Rosters</h2>
            <button className="text-white/50 hover:text-white" onClick={() => setShowRightSidebar(false)}>✕</button>
          </div>
          {/* Tab switcher */}
          <div className="flex border-b border-white/10 sticky xl:top-0 bg-bsb-dark/80 backdrop-blur-md z-10">
            <button
              onClick={() => setRightPanel('myteam')}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${rightPanel === 'myteam'
                ? 'text-bsb-gold border-b-2 border-bsb-gold'
                : 'text-bsb-dim hover:text-white'
                }`}
            >{TEAM_NAMES[myNum ?? 0]} ({myTeamPlayers.length})</button>
            <button
              onClick={() => setRightPanel('allteams')}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${rightPanel === 'allteams'
                ? 'text-bsb-accent border-b-2 border-bsb-accent'
                : 'text-bsb-dim hover:text-white'
                }`}
            >All Teams</button>
            <button
              onClick={() => setRightPanel('news')}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${rightPanel === 'news'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-bsb-dim hover:text-white'
                }`}
            >News {newsStore.news.length > 0 && <span className="text-white/30 ml-0.5">({newsStore.news.length})</span>}</button>
          </div>

          <div className="p-3">
            {/* MY TEAM TAB */}
            {rightPanel === 'myteam' && (
              <>
                {/* Position Grid */}
                <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mb-2">Roster Grid</h3>
                <MyTeamPositionGrid myPlayers={myTeamPlayers} onUndraft={store.undraftPlayer} />

                {myTeamPlayers.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-between text-xs font-bold">
                    <span>Total FPTS</span>
                    <span className="text-bsb-gold">{myTeamTotal.toFixed(0)}</span>
                  </div>
                )}

                {myTeamPlayers.length === 0 && (
                  <p className="text-xs text-bsb-dim italic mt-2">
                    No players drafted yet. Click a player to add to your team.
                  </p>
                )}

                <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mt-6 mb-2">
                  Draft Log <span className="text-white/40">({store.draftState.draftLog.length})</span>
                </h3>
                <div className="space-y-0.5 max-h-80 overflow-y-auto">
                  {[...store.draftState.draftLog].reverse().map((log) => {
                    const player = store.allPlayers.find(p => p.id === log.player)
                    return (
                      <div key={`${log.player}-${log.timestamp}`}
                        className="text-[11px] flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-white/5"
                      >
                        <span className="text-[9px] font-mono text-bsb-dim w-14 shrink-0">
                          {log.category.replace('Mega ', 'M-').replace('Mini ', 'm-')}
                        </span>
                        <span className="truncate flex-1 text-white/80">{player?.name || log.player}</span>
                        <span className={`text-[10px] font-bold shrink-0 ${teamColor(log.team)}`}>
                          {log.team === myNum ? 'ME' : teamAbbrev(log.team)}
                        </span>
                      </div>
                    )
                  })}
                  {store.draftState.draftLog.length === 0 && (
                    <p className="text-xs text-bsb-dim italic">No picks yet.</p>
                  )}
                </div>
              </>
            )}

            {/* ALL TEAMS TAB */}
            {rightPanel === 'allteams' && (
              <AllTeamsRoster allPlayers={store.allPlayers} />
            )}

            {/* NEWS TAB */}
            {rightPanel === 'news' && (
              <NewsFeed
                news={newsStore.news}
                allPlayers={store.allPlayers}
                isLoading={newsStore.isLoading}
                error={newsStore.error}
                onRefresh={newsStore.refresh}
                onPlayerClick={(player) => setCardPlayer(player)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
