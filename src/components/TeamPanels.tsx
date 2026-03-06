'use client'
import { useState, useMemo } from 'react'
import { Player } from '@/hooks/useDraftStore'
import { PosBadge } from './PosBadge'
import { TEAM_NAMES, teamColor, teamBgColor } from './constants'

// ─────────────────────────────────────────
// My Team Position Grid
// ─────────────────────────────────────────
export function MyTeamPositionGrid({ myPlayers, onUndraft }: { myPlayers: Player[]; onUndraft: (id: string) => void }) {
  const positions: Record<string, { players: Player[]; slots: number }> = {
    C: { players: [], slots: 1 },
    '1B': { players: [], slots: 1 },
    '2B': { players: [], slots: 1 },
    '3B': { players: [], slots: 1 },
    SS: { players: [], slots: 1 },
    OF: { players: [], slots: 3 },
    U: { players: [], slots: 1 },
    DH: { players: [], slots: 1 },
    SP: { players: [], slots: 5 },
    RP: { players: [], slots: 4 },
  }
  const bench: Player[] = []

  myPlayers.forEach(p => {
    if (p.pos === 'P') {
      const role = p.role === 'SP' ? 'SP' : 'RP'
      if (positions[role] && positions[role].players.length < positions[role].slots) {
        positions[role].players.push(p)
      } else {
        bench.push(p)
      }
    } else {
      let placed = false
      if (positions[p.pos] && positions[p.pos].players.length < positions[p.pos].slots) {
        positions[p.pos].players.push(p)
        placed = true
      }
      if (!placed) {
        for (const altPos of p.positions) {
          if (altPos !== p.pos && positions[altPos] && positions[altPos].players.length < positions[altPos].slots) {
            positions[altPos].players.push(p)
            placed = true
            break
          }
        }
      }
      if (!placed && positions['U'].players.length < positions['U'].slots) {
        positions['U'].players.push(p)
        placed = true
      }
      if (!placed && positions['DH'].players.length < positions['DH'].slots) {
        positions['DH'].players.push(p)
        placed = true
      }
      if (!placed) {
        bench.push(p)
      }
    }
  })

  const renderSlot = (pos: string, widthClass = 'w-16') => {
    const { players, slots } = positions[pos]
    return (
      <div className={`flex flex-col items-center gap-0.5 ${widthClass}`}>
        <span className={`text-[10px] font-bold mt-1 pos-text-${pos}`}><PosBadge pos={pos} small /></span>
        <div className="flex flex-col gap-0.5 w-full">
          {players.sort((a, b) => b.fpts - a.fpts).map(p => (
            <div
              key={p.id}
              className={`w-full truncate text-[10px] text-center bg-white/10 border border-white/5 rounded px-1 py-[2px] cursor-pointer hover:bg-red-500/20 hover:border-red-500/50 transition-colors ${pos === 'OF' || pos === 'SP' || pos === 'RP' ? 'max-w-[80px] mx-auto' : ''}`}
              onClick={() => onUndraft(p.id)}
              title={`${p.name} (${p.fpts} pts) — Click to undraft`}
            >
              <span className="text-white/90">{p.name.split(' ')[0][0] + '.'} {p.name.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, slots - players.length) }).map((_, i) => (
            <div key={`emp-${pos}-${i}`} className={`w-full text-center text-[10px] bg-black/20 border border-white/5 rounded py-[2px] text-white/10 ${pos === 'OF' || pos === 'SP' || pos === 'RP' ? 'max-w-[80px] mx-auto' : ''}`}>
              Empty
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-950/20 rounded-lg border border-green-500/20 p-3 pt-4 relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {/* Diamond background lines */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-32 h-32 border border-white/5 rotate-45 rounded-sm pointer-events-none"></div>

        {/* OF */}
        <div className="flex justify-center relative z-10">{renderSlot('OF', 'w-full')}</div>
        {/* Infield Top */}
        <div className="flex justify-between px-8 mt-2 relative z-10">
          {renderSlot('SS', 'w-20')}
          {renderSlot('2B', 'w-20')}
        </div>
        {/* Infield Corners */}
        <div className="flex justify-between mt-4 relative z-10">
          {renderSlot('3B', 'w-20')}
          {renderSlot('1B', 'w-20')}
        </div>
        {/* Home Plate */}
        <div className="flex justify-center mt-4 relative z-10">{renderSlot('C', 'w-24')}</div>
        {/* U and DH */}
        <div className="flex justify-center gap-6 mt-4 relative z-10 border-t border-white/10 pt-3">
          {renderSlot('U', 'w-20')}
          {renderSlot('DH', 'w-20')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-white/[0.02] rounded-lg border border-white/5 p-2">
        {renderSlot('SP', 'w-full')}
        {renderSlot('RP', 'w-full')}
      </div>

      {bench.length > 0 && (
        <div className="mt-4 bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <h3 className="text-xs font-bold text-bsb-dim uppercase tracking-wider mb-2">Reserves / Bench</h3>
          <div className="space-y-1">
            {bench.sort((a, b) => b.fpts - a.fpts).map(p => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-[10px] py-0.5 px-1 hover:bg-white/5 rounded cursor-pointer transition-colors"
                onClick={() => onUndraft(p.id)}
                title="Click to undraft"
              >
                <PosBadge pos={p.pos === 'P' ? (p.role || 'P') : p.pos} small />
                <span className="flex-1 text-white/90 truncate">{p.name}</span>
                {p.positions && p.positions.length > 1 && (
                  <span className="text-[9px] text-bsb-dim truncate max-w-[60px]">{p.positions.filter(alt => alt !== p.pos).join(',')}</span>
                )}
                <span className="font-mono text-bsb-gold">{p.fpts}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// All Teams Panel — with strength meter
// ─────────────────────────────────────────
export function AllTeamsPanel({
  allPlayers, onUndraft
}: {
  allPlayers: Player[]
  onUndraft: (id: string) => void
}) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)

  const teamRosters = useMemo(() => {
    const rosters: Record<number, Player[]> = {}
    for (let i = 0; i <= 16; i++) rosters[i] = []
    allPlayers.filter(p => p.drafted && p.draftedBy !== undefined).forEach(p => {
      const team = p.draftedBy!
      if (!rosters[team]) rosters[team] = []
      rosters[team].push(p)
    })
    Object.values(rosters).forEach(r => r.sort((a, b) => b.fpts - a.fpts))
    return rosters
  }, [allPlayers])

  const maxTeamFpts = useMemo(() => {
    return Math.max(
      ...Object.entries(teamRosters)
        .filter(([k]) => Number(k) >= 1)
        .map(([, roster]) => roster.reduce((s, p) => s + p.fpts, 0)),
      1
    )
  }, [teamRosters])

  return (
    <div className="space-y-1">
      {Array.from({ length: 16 }, (_, i) => i + 1).map(num => {
        const roster = teamRosters[num] || []
        const total = roster.reduce((s, p) => s + p.fpts, 0)
        const isExpanded = expandedTeam === num
        const strengthPct = (total / maxTeamFpts) * 100

        return (
          <div key={num} className={`rounded border ${teamBgColor(num)}`}>
            <button
              onClick={() => setExpandedTeam(isExpanded ? null : num)}
              className="w-full px-2 py-1.5 flex items-center gap-2 text-left"
            >
              <span className={`text-xs font-bold ${teamColor(num)} w-24 truncate shrink-0`}>
                {TEAM_NAMES[num]}
              </span>
              {/* Strength bar */}
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${strengthPct}%` }} />
              </div>
              <span className="text-[10px] text-bsb-dim font-mono shrink-0">{roster.length}p</span>
              <span className="text-[10px] font-mono text-bsb-gold font-bold shrink-0 w-10 text-right">{total.toFixed(0)}</span>
              <span className="text-[10px] text-bsb-dim shrink-0">{isExpanded ? '▲' : '▼'}</span>
            </button>
            {isExpanded && roster.length > 0 && (
              <div className="px-2 pb-1.5 space-y-0.5">
                {roster.map(p => (
                  <div key={p.id}
                    className="flex items-center gap-1 text-[11px] py-0.5 hover:bg-white/5 rounded px-0.5 cursor-pointer"
                    onClick={() => onUndraft(p.id)}
                    title="Click to undraft"
                  >
                    <PosBadge pos={p.pos === 'P' ? (p.role || 'P') : p.pos} small />
                    <span className="flex-1 truncate text-white/80">{p.name}</span>
                    <span className="text-[9px] text-bsb-dim">{p.draftCategory?.replace('Mega ', 'M-').replace('Mini ', 'm-')}</span>
                    <span className="font-mono text-bsb-gold w-10 text-right">{p.fpts}</span>
                  </div>
                ))}
              </div>
            )}
            {isExpanded && roster.length === 0 && (
              <div className="px-2 pb-1.5 text-[10px] text-bsb-dim italic">No picks yet</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
