'use client'
import { Player } from '@/hooks/useDraftStore'
import { PosBadge } from './PosBadge'
import { GRID_COLS, tierRowBg, teamAbbrev } from './constants'

export function PlayerRow({
  player, rank, onDraft, onUndraft, onRightClick, showRole, isRecommended, recRank, pana
}: {
  player: Player; rank: number
  onDraft: (id: string) => void
  onUndraft: (id: string) => void
  onRightClick: (e: React.MouseEvent, player: Player) => void
  showRole?: boolean
  isRecommended?: boolean
  recRank?: number
  pana: number
}) {
  const isPitcher = player.pos === 'P'

  // VORP color
  const vorpColor = (player.vorp || 0) > 30
    ? 'text-green-400'
    : (player.vorp || 0) > 10
      ? 'text-yellow-400'
      : 'text-white/30'

  // Tier tint
  const tierBg = !player.drafted ? tierRowBg(player.tier) : ''

  // Recommendation left border
  const recBorder = isRecommended
    ? recRank === 1 ? 'border-l-2 border-l-bsb-gold' : 'border-l-2 border-l-white/30'
    : ''

  return (
    <div
      className={`player-row grid items-center px-2 py-1 text-xs font-mono ${
        player.drafted ? 'drafted' : ''
      } ${tierBg} ${recBorder} ${rank % 2 === 0 && !tierBg ? 'bg-white/[0.02]' : ''}`}
      style={{ gridTemplateColumns: GRID_COLS }}
      onClick={() => player.drafted ? onUndraft(player.id) : onDraft(player.id)}
      onContextMenu={(e) => {
        if (!player.drafted) {
          e.preventDefault()
          onRightClick(e, player)
        }
      }}
    >
      {/* Rank */}
      <span className="text-right text-xs text-bsb-dim">{rank}</span>
      {/* Position with posRank */}
      <span className="flex justify-center">
        {showRole && isPitcher ? (
          <PosBadge pos={player.role || 'P'} posRank={player.posRank} small />
        ) : (
          <PosBadge pos={player.pos} posRank={player.posRank} small />
        )}
      </span>
      {/* Name + rec badge */}
      <span className={`text-sm truncate min-w-0 pr-1 flex items-center gap-1 ${player.drafted ? 'text-bsb-dim' : 'text-white'}`} style={{ fontFamily: 'inherit' }}>
        <span className="truncate">{player.name}</span>
        {isRecommended && !player.drafted && (
          <span className="text-[8px] px-1 rounded bg-bsb-gold/20 text-bsb-gold font-bold shrink-0">REC</span>
        )}
        {pana >= 20 && !player.drafted && !isRecommended && (
          <span className="text-[8px] px-0.5 text-red-400 font-bold shrink-0" title={`${pana}pt drop-off to next`}>▼</span>
        )}
      </span>
      {/* Team */}
      <span className="text-[10px] text-bsb-dim text-center">{player.team}</span>
      {/* FPTS */}
      <span className={`text-right text-xs font-bold ${
        player.drafted ? 'text-bsb-dim font-normal' : 'text-bsb-gold'
      }`}>
        {player.fpts}
      </span>
      {/* VORP */}
      <span className={`text-right text-[10px] font-bold ${player.drafted ? 'text-white/15' : vorpColor}`}>
        {(player.vorp || 0) > 0 ? `+${Math.round(player.vorp || 0)}` : Math.round(player.vorp || 0)}
      </span>
      {/* 5 scoring stat columns */}
      {!isPitcher ? (
        <>
          <span className="text-right text-bsb-dim" title="Runs">{player.r}</span>
          <span className="text-right text-bsb-dim" title="TB">{player.tb}</span>
          <span className="text-right text-bsb-dim" title="BB">{player.bb}</span>
          <span className="text-right text-bsb-dim" title="RBI">{player.rbi}</span>
          <span className="text-right text-bsb-dim" title="SB">{player.sb}</span>
        </>
      ) : (
        <>
          <span className="text-right text-bsb-dim" title="IP">{player.ip}</span>
          <span className="text-right text-bsb-dim" title="K">{player.so}</span>
          <span className="text-right text-bsb-dim" title="W">{player.w}</span>
          <span className="text-right text-bsb-dim" title="SV">{player.sv || 0}</span>
          <span className="text-right text-bsb-dim" title="HLD">{player.hld || 0}</span>
        </>
      )}
      {/* Separator */}
      <span className="text-center text-white/15">│</span>
      {/* 4 traditional stat columns (dimmed) */}
      {!isPitcher ? (
        <>
          <span className="text-right text-white/25" title="AVG">{player.avg?.toFixed(3)}</span>
          <span className="text-right text-white/25" title="OPS">{player.ops?.toFixed(3)}</span>
          <span className="text-right text-white/25" title="HR">{player.hr}</span>
          <span className="text-right text-white/25" title="SB">{player.sb}</span>
        </>
      ) : (
        <>
          <span className="text-right text-white/25" title="ERA">{player.era}</span>
          <span className="text-right text-white/25" title="WHIP">{player.whip ?? '—'}</span>
          <span className="text-right text-white/25" title="K/9">{player.kper9 ?? '—'}</span>
          <span className="text-right text-white/25" title="QS">{player.qs || 0}</span>
        </>
      )}
      {/* Draft tag */}
      <span className="flex justify-end">
        {player.drafted && player.draftedBy !== undefined && (
          <span className={`text-[10px] px-1.5 rounded font-bold ${
            player.draftedBy === 0
              ? 'bg-bsb-gold/20 text-bsb-gold'
              : 'bg-bsb-accent/20 text-bsb-accent'
          }`}>
            {player.draftedBy === 0 ? 'ME' : teamAbbrev(player.draftedBy)}
          </span>
        )}
      </span>
    </div>
  )
}
