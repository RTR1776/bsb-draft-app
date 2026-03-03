'use client'
import { Player } from '@/hooks/useDraftStore'
import { PosBadge } from './PosBadge'
import { GRID_COLS, tierRowBg, teamAbbrev } from './constants'

export function PlayerRow({
  player, rank, onDraft, onUndraft, onRightClick, onNameClick, showRole, isRecommended, recRank, pana, prevTier, hasNews, newsSeverity, myTeamNumber, battingOrder, rotationNumber
}: {
  player: Player; rank: number
  onDraft: (id: string) => void
  onUndraft: (id: string) => void
  onRightClick: (e: React.MouseEvent, player: Player) => void
  onNameClick: (player: Player) => void
  showRole?: boolean
  isRecommended?: boolean
  recRank?: number
  pana: number
  prevTier?: number
  hasNews?: boolean
  newsSeverity?: 'high' | 'medium' | 'low'
  myTeamNumber?: number | null
  battingOrder?: number
  rotationNumber?: number
}) {
  const myNum = myTeamNumber ?? 0
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

  // Tier divider — show border when tier changes
  const showTierDivider = prevTier !== undefined && player.tier !== prevTier && !player.drafted

  return (
    <div
      className={`player-row grid items-center px-2 py-1 text-xs font-mono ${
        player.drafted ? 'drafted' : ''
      } ${tierBg} ${recBorder} ${rank % 2 === 0 && !tierBg ? 'bg-white/[0.02]' : ''} ${showTierDivider ? 'border-t border-white/10' : ''}`}
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
      {/* Name + rec badge — clicking the name opens the player card */}
      <span className={`text-sm truncate min-w-0 pr-1 flex items-center gap-1 ${player.drafted ? 'text-bsb-dim' : 'text-white'}`} style={{ fontFamily: 'inherit' }}>
        {hasNews && !player.drafted && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            newsSeverity === 'high' ? 'bg-red-400 animate-pulse' :
            newsSeverity === 'medium' ? 'bg-orange-400' : 'bg-blue-400'
          }`} title="Has recent news" />
        )}
        <span
          className="truncate hover:text-bsb-gold hover:underline cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); onNameClick(player) }}
          title="View player card"
        >{player.name}</span>
        {!player.drafted && battingOrder !== undefined && (
          <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-400/80 font-bold shrink-0 tabular-nums" title={`Projected batting ${battingOrder} spot`}>
            🏏{battingOrder}
          </span>
        )}
        {!player.drafted && rotationNumber !== undefined && (
          <span className="text-[9px] px-1 rounded bg-sky-500/15 text-sky-400/80 font-bold shrink-0 tabular-nums" title={`Projected #${rotationNumber} starter`}>
            ⚾{rotationNumber}
          </span>
        )}
        {isRecommended && !player.drafted && (
          <span className="text-[8px] px-1 rounded bg-bsb-gold/20 text-bsb-gold font-bold shrink-0">REC</span>
        )}
        {pana >= 20 && !player.drafted && !isRecommended && (
          <span className="text-[8px] px-1 text-red-400 font-bold shrink-0" title={`${pana}pt drop-off to next`}>▼</span>
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
            player.draftedBy === myNum
              ? 'bg-bsb-gold/20 text-bsb-gold'
              : 'bg-bsb-accent/20 text-bsb-accent'
          }`}>
            {player.draftedBy === myNum ? 'ME' : teamAbbrev(player.draftedBy)}
          </span>
        )}
      </span>
    </div>
  )
}
