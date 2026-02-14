'use client'
import { Player } from '@/hooks/useDraftStore'

export function DashboardStrip({
  myTeamTotal, myTeamCount, picksUntil, topRec, activeCatKey, categoryPickCount, activeCatRounds
}: {
  myTeamTotal: number
  myTeamCount: number
  picksUntil: number | null
  topRec: Player | null
  activeCatKey: string | null
  categoryPickCount: number
  activeCatRounds: number
}) {
  const totalCatPicks = activeCatRounds * 16
  const catProgress = totalCatPicks > 0 ? (categoryPickCount / totalCatPicks) * 100 : 0

  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-bsb-dark/80 border-b border-white/10 text-[11px] font-mono">
      {/* My Team FPTS */}
      <div className="flex items-center gap-1.5 bg-white/[0.03] rounded px-2.5 py-0.5">
        <span className="text-bsb-dim">MY TEAM</span>
        <span className="text-bsb-gold font-bold">{myTeamTotal.toFixed(0)}</span>
        <span className="text-white/30">({myTeamCount}p)</span>
      </div>

      {/* Top recommendation — promoted to 2nd position */}
      {topRec && (
        <div className="flex items-center gap-1 bg-bsb-gold/10 rounded px-2.5 py-0.5">
          <span className="text-bsb-dim">TOP REC</span>
          <span className="text-bsb-gold font-bold">{topRec.name}</span>
          <span className="text-white/40">({topRec.fpts})</span>
        </div>
      )}

      {/* Category progress */}
      {activeCatKey && (
        <div className="flex items-center gap-1.5 bg-white/[0.03] rounded px-2.5 py-0.5">
          <span className="text-bsb-dim">CAT</span>
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-bsb-accent transition-all" style={{ width: `${catProgress}%` }} />
          </div>
          <span className="text-white/40">{categoryPickCount}/{totalCatPicks}</span>
        </div>
      )}

      {/* Pick countdown */}
      {picksUntil !== null && picksUntil >= 0 && (
        <div className={`flex items-center gap-1 ml-auto bg-white/[0.03] rounded px-2.5 py-0.5 ${picksUntil === 0 ? 'animate-pulse !bg-bsb-gold/15' : ''}`}>
          {picksUntil === 0 ? (
            <span className="text-bsb-gold font-bold text-xs">→ YOUR PICK!</span>
          ) : (
            <>
              <span className="text-bsb-dim">YOU PICK IN</span>
              <span className={`font-bold ${picksUntil <= 3 ? 'text-bsb-accent' : 'text-white'}`}>{picksUntil}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
