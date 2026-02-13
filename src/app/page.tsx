'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useDraftStore, Player } from '@/hooks/useDraftStore'
import Fuse from 'fuse.js'

// Components
import { TEAM_NAMES, GRID_COLS, teamAbbrev, teamColor } from '@/components/constants'
import { PlayerRow } from '@/components/PlayerRow'
import { TemplatePanel, TemplateDetail } from '@/components/TemplatePanel'
import { CategorySelector } from '@/components/CategorySelector'
import { DashboardStrip } from '@/components/DashboardStrip'
import { TeamContextMenu } from '@/components/TeamContextMenu'
import { ScarcityBar } from '@/components/ScarcityBar'
import { MyTeamPositionGrid, AllTeamsPanel } from '@/components/TeamPanels'

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
export default function Home() {
  const store = useDraftStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [posFilter, setPosFilter] = useState<string | null>(null)
  const [showAllPlayers, setShowAllPlayers] = useState(false)
  const [showDrafted, setShowDrafted] = useState(true)
  const [rightPanel, setRightPanel] = useState<'myteam' | 'allteams'>('myteam')
  const searchRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; playerId: string; playerName: string
  } | null>(null)

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

    return players.sort((a, b) => b.fpts - a.fpts)
  }, [searchQuery, store.draftState.activeCategory, posFilter, store, fuse, showAllPlayers, showDrafted])

  // Max FPTS for spark bar scaling
  const maxFpts = useMemo(() => {
    const undrafted = displayPlayers.filter(p => !p.drafted)
    return undrafted.length > 0 ? undrafted[0].fpts : 1
  }, [displayPlayers])

  // Live scarcity
  const { scarcity, remaining } = store.getLiveScarcity()
  const maxScarcity = Math.max(...Object.values(scarcity), 1)

  // My team
  const myTeamPlayers = useMemo(() =>
    store.allPlayers.filter(p => p.drafted && p.draftedBy === 0),
    [store.allPlayers]
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

  // Determine if we're showing pitchers for header
  const showingPitchers = (store.draftState.activeCategory && !showAllPlayers)
    ? (activeCat?.type === 'pitcher')
    : (posFilter === 'SP' || posFilter === 'RP' || posFilter === 'P')

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Context Menu */}
      {contextMenu && (
        <TeamContextMenu
          x={contextMenu.x} y={contextMenu.y}
          playerId={contextMenu.playerId} playerName={contextMenu.playerName}
          onDraft={store.draftPlayer} onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-bsb-dark border-b border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-white">
            BSB<span className="text-bsb-accent">DRAFT</span>
          </h1>
          <span className="text-xs text-bsb-dim">{store.draftedCount} drafted</span>
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
                <span className={`text-[10px] font-bold font-mono px-1 rounded ${
                  myPickInCategory === activePickInRound
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
            className={`px-2 py-1 text-xs rounded transition-all ${
              showDrafted ? 'text-bsb-dim hover:bg-white/5' : 'bg-bsb-mid text-white'
            }`}
          >
            {showDrafted ? 'Hide Drafted' : 'Show Drafted'}
          </button>
          <button
            onClick={() => { if (confirm('Reset entire draft? This cannot be undone.')) store.resetDraft() }}
            className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded"
          >Reset</button>
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
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-64 bg-bsb-dark border-r border-white/10 overflow-y-auto p-3 hidden lg:block">
          <TemplatePanel
            templates={store.templates} analysis={store.analysis}
            selected={store.draftState.myTemplate} onSelect={store.setMyTemplate}
          />
          {store.draftState.myTemplate && store.templates[store.draftState.myTemplate] && (
            <TemplateDetail
              template={store.draftState.myTemplate}
              picks={store.templates[store.draftState.myTemplate]}
              activeCategory={store.draftState.activeCategory}
            />
          )}

          <div className="mt-4">
            <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mb-2">Live Scarcity</h3>
            <div className="space-y-1.5">
              {Object.entries(scarcity).sort(([, a], [, b]) => b - a).map(([pos, val]) => (
                <ScarcityBar key={pos} label={pos} value={val} max={maxScarcity} />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mb-2">Pool Depth</h3>
            <div className="space-y-0.5 text-xs">
              {Object.entries(remaining).sort(([, a], [, b]) => a.length - b.length).map(([pos, pool]) => (
                <div key={pos} className="flex justify-between text-bsb-dim">
                  <span>{pos}</span>
                  <span className={`font-mono ${pool.length < 16 ? 'text-red-400 font-bold' : ''}`}>
                    {pool.length} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

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
                  <>
                    <span className="text-[10px] text-bsb-dim mr-1">FILTER:</span>
                    {['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'].map(pos => (
                      <button key={pos}
                        onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          posFilter === pos ? `pos-${pos} text-white` : 'bg-white/5 text-bsb-dim hover:bg-white/10'
                        }`}
                      >{pos}</button>
                    ))}
                    {posFilter && (
                      <button onClick={() => setPosFilter(null)} className="text-[10px] text-bsb-dim hover:text-white ml-1">Clear</button>
                    )}
                  </>
                )}
                {store.draftState.activeCategory && (
                  <button
                    onClick={() => setShowAllPlayers(!showAllPlayers)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      showAllPlayers ? 'bg-bsb-mid text-white border border-white/20' : 'bg-white/5 text-bsb-dim hover:bg-white/10'
                    }`}
                  >{showAllPlayers ? '← Back to Category' : 'View All Players'}</button>
                )}
              </div>
              <div className="text-[10px] text-bsb-dim">
                {displayPlayers.length} players {!showDrafted && '(hiding drafted)'}
              </div>
            </div>
          </div>

          {/* Player list header — same grid as rows */}
          <div
            className="grid items-center px-2 py-1 bg-white/[0.03] border-b border-white/5 text-[10px] text-bsb-dim uppercase tracking-wider font-mono"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span className="text-right">#</span>
            <span className="text-center">Pos</span>
            <span>Player</span>
            <span className="text-center">Tm</span>
            <span className="text-right">Pts</span>
            <span className="text-right text-green-400/60">VORP</span>
            {/* 5 scoring columns — switch labels based on context */}
            {!showingPitchers ? (
              <>
                <span className="text-right">R</span>
                <span className="text-right">TB</span>
                <span className="text-right">BB</span>
                <span className="text-right">RBI</span>
                <span className="text-right">SB</span>
              </>
            ) : (
              <>
                <span className="text-right">IP</span>
                <span className="text-right">K</span>
                <span className="text-right">W</span>
                <span className="text-right">SV</span>
                <span className="text-right">HLD</span>
              </>
            )}
            {/* Separator */}
            <span></span>
            {/* 4 traditional columns */}
            {!showingPitchers ? (
              <>
                <span className="text-right text-white/25">AVG</span>
                <span className="text-right text-white/25">OPS</span>
                <span className="text-right text-white/25">HR</span>
                <span className="text-right text-white/25">SB</span>
              </>
            ) : (
              <>
                <span className="text-right text-white/25">ERA</span>
                <span className="text-right text-white/25">WHIP</span>
                <span className="text-right text-white/25">K/9</span>
                <span className="text-right text-white/25">QS</span>
              </>
            )}
            {/* Tag column */}
            <span></span>
          </div>

          {/* Scrollable player list */}
          <div className="flex-1 overflow-y-auto">
            {displayPlayers.map((player, i) => (
              <PlayerRow
                key={player.id} player={player} rank={i + 1}
                onDraft={(id) => store.draftPlayer(id, 0)}
                onUndraft={(id) => store.undraftPlayer(id)}
                onRightClick={handleRightClick}
                showRole={player.pos === 'P'}
                isRecommended={recIds.has(player.id)}
                recRank={recommendations.findIndex(r => r.id === player.id) + 1}
                maxFpts={maxFpts}
                pana={panaMap[player.id] || 0}
              />
            ))}
            {displayPlayers.length === 0 && (
              <div className="p-8 text-center text-bsb-dim">
                {searchQuery ? `No players found for "${searchQuery}"` : 'No players available'}
              </div>
            )}
          </div>

          {/* Hint bar */}
          <div className="px-3 py-1 bg-bsb-dark/80 border-t border-white/5 text-[10px] text-bsb-dim flex items-center gap-4">
            <span><kbd className="px-1 bg-white/10 rounded">Click</kbd> = draft to {TEAM_NAMES[0]}</span>
            <span><kbd className="px-1 bg-white/10 rounded">Right-click</kbd> = assign to team</span>
            <span><kbd className="px-1 bg-white/10 rounded">/</kbd> = search</span>
            <span className="hidden lg:inline ml-auto">
              <span className="text-bsb-gold/50">REC</span> = recommended
              <span className="mx-1">·</span>
              <span className="text-green-400/50">VORP</span> = value over replacement
              <span className="mx-1">·</span>
              <span className="text-red-400/50">▼</span> = big drop-off
            </span>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="w-80 bg-bsb-dark border-l border-white/10 overflow-y-auto hidden xl:block">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10 sticky top-0 bg-bsb-dark z-10">
            <button
              onClick={() => setRightPanel('myteam')}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                rightPanel === 'myteam'
                  ? 'text-bsb-gold border-b-2 border-bsb-gold'
                  : 'text-bsb-dim hover:text-white'
              }`}
            >{TEAM_NAMES[0]} ({myTeamPlayers.length})</button>
            <button
              onClick={() => setRightPanel('allteams')}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                rightPanel === 'allteams'
                  ? 'text-bsb-accent border-b-2 border-bsb-accent'
                  : 'text-bsb-dim hover:text-white'
              }`}
            >All Teams</button>
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
                          {log.team === 0 ? 'ME' : teamAbbrev(log.team)}
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
              <AllTeamsPanel allPlayers={store.allPlayers} onUndraft={store.undraftPlayer} />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
