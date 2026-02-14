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
    C: { players: [], slots: 2 },
    '1B': { players: [], slots: 2 },
    '2B': { players: [], slots: 2 },
    '3B': { players: [], slots: 2 },
    SS: { players: [], slots: 2 },
    OF: { players: [], slots: 4 },
    SP: { players: [], slots: 6 },
    RP: { players: [], slots: 4 },
  }

  myPlayers.forEach(p => {
    if (p.pos === 'P') {
      const role = p.role === 'SP' ? 'SP' : 'RP'
      positions[role].players.push(p)
    } else if (positions[p.pos]) {
      positions[p.pos].players.push(p)
    }
  })

  return (
    <div className="space-y-1.5">
      {Object.entries(positions).map(([pos, { players, slots }]) => (
        <div key={pos} className="flex items-start gap-1.5">
          <span className={`w-7 text-right text-[10px] font-bold shrink-0 mt-0.5 pos-text-${pos}`}>
            <PosBadge pos={pos} small />
          </span>
          <div className="flex-1 flex flex-wrap gap-0.5">
            {players.sort((a, b) => b.fpts - a.fpts).map(p => (
              <div
                key={p.id}
                className="flex items-center gap-0.5 bg-white/5 rounded px-1 py-0.5 text-[10px] cursor-pointer hover:bg-white/10"
                onClick={() => onUndraft(p.id)}
                title={`${p.name} (${p.fpts} FPTS) — click to undraft`}
              >
                <span className="text-white/80 truncate max-w-[95px]">{p.name.split(' ')[0][0] + '. ' + p.name.split(' ').slice(1).join(' ')}</span>
                <span className="text-bsb-gold font-bold">{p.fpts}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, slots - players.length) }).map((_, i) => (
              <div key={`empty-${pos}-${i}`} className="flex items-center bg-white/[0.02] rounded px-2 py-0.5 text-[10px] text-white/15">
                —
              </div>
            ))}
          </div>
        </div>
      ))}
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
