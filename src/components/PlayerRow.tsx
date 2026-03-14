import { useState, useEffect, useRef } from 'react'
import { Player } from '@/hooks/useDraftStore'
import { PosBadge } from './PosBadge'
import { GRID_COLS, tierRowBg, teamAbbrev } from './constants'
import advancedStatsData from '@/data/advancedStats.json'

const advBatMap = Object.fromEntries(
  (advancedStatsData.batters as any[]).map(b => [b.id, b['2025'] || {}])
)
const advPitMap = Object.fromEntries(
  (advancedStatsData.pitchers as any[]).map(p => [p.id, p['2025'] || {}])
)

function formatPct(value?: number | null, scale = 1, digits = 0): string {
  if (value === undefined || value === null) return '—'
  return `${(value * scale).toFixed(digits)}%`
}

function formatDecimal(value?: number | null, digits = 1): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(digits)
}

function formatAvg(value?: number | null): string {
  if (value === undefined || value === null) return '.000'
  return value.toFixed(3).replace(/^0\./, '.')
}

export function PlayerRow({
  player, rank, onDraft, onUndraft, onRightClick, onNameClick, onToggleWatch, showRole, isRecommended, recRank, pana, prevTier, hasNews, newsSeverity, myTeamNumber, battingOrder, rotationNumber
}: {
  player: Player; rank: number
  onDraft: (id: string) => void
  onUndraft: (id: string) => void
  onRightClick: (e: React.MouseEvent, player: Player) => void
  onNameClick: (player: Player) => void
  onToggleWatch?: (id: string) => void
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

  // Animation state for drafting
  const [justDrafted, setJustDrafted] = useState(false)
  const prevDraftedRef = useRef(player.drafted)

  useEffect(() => {
    if (player.drafted && !prevDraftedRef.current) {
      setJustDrafted(true)
    }
    prevDraftedRef.current = player.drafted
  }, [player.drafted])

  useEffect(() => {
    if (justDrafted) {
      const t = setTimeout(() => setJustDrafted(false), 800)
      return () => clearTimeout(t)
    }
  }, [justDrafted])

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
    : player.watched && !player.drafted ? 'border-l-2 border-l-emerald-400' : ''

  // Watched row highlight
  const watchedBg = player.watched && !player.drafted ? 'bg-emerald-500/[0.08]' : ''

  // ADP value color - show how ADP compares to our rank
  const adpColor = !player.adp ? 'text-white/20' :
    player.adp < rank ? 'text-green-400' :  // undervalued by ADP (ADP higher than our rank)
    player.adp > rank + 20 ? 'text-red-400' : // overvalued by ADP
    'text-white/50'

  // Tier divider — show border when tier changes
  const showTierDivider = prevTier !== undefined && player.tier !== prevTier && !player.drafted

  const advStats = isPitcher ? (advPitMap[player.id] || {}) : (advBatMap[player.id] || {})

  return (
    <div
      className={`player-row grid items-center px-4 py-1.5 tabular-nums text-sm font-mono w-full group hover:bg-white/5 transition-colors cursor-pointer ${player.drafted ? 'drafted' : ''
        } ${watchedBg || tierBg} ${recBorder} ${rank % 2 === 0 && !tierBg && !watchedBg ? 'bg-white/[0.02]' : ''} ${showTierDivider ? 'border-t border-white/10' : ''}`}
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
      <span className={`text-sm min-w-0 pr-1 flex items-center gap-1 ${player.drafted ? 'text-bsb-dim' : 'text-white'}`} style={{ fontFamily: 'inherit' }}>
        {hasNews && !player.drafted && (
          <span className={`w-2 h-2 rounded-full shrink-0 ${newsSeverity === 'high' ? 'bg-red-400' :
            newsSeverity === 'medium' ? 'bg-orange-400' : 'bg-blue-400'
            }`} title="Has recent news" />
        )}
        <span
          className="truncate min-w-0 hover:text-bsb-gold hover:underline cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); onNameClick(player) }}
          title="View player card"
        >{player.name}</span>
        {!player.drafted && battingOrder !== undefined && (
          <span className="text-[10px] px-1 rounded bg-amber-500/15 text-amber-400/80 font-bold shrink-0 tabular-nums" title={`Projected batting ${battingOrder} spot`}>
            BO{battingOrder}
          </span>
        )}
        {!player.drafted && rotationNumber !== undefined && (
          <span className="text-[10px] px-1 rounded bg-sky-500/15 text-sky-400/80 font-bold shrink-0 tabular-nums" title={`Projected #${rotationNumber} starter`}>
            SP{rotationNumber}
          </span>
        )}
        {isRecommended && !player.drafted && (
          <span className="text-[10px] px-1.5 rounded bg-bsb-gold/20 text-bsb-gold font-bold shrink-0">REC</span>
        )}
        {pana >= 20 && !player.drafted && !isRecommended && (
          <span className="text-[10px] px-1 text-red-400 font-bold shrink-0" title={`${pana}pt drop-off to next`}>▼</span>
        )}
      </span>
      {/* Team */}
      <span className="text-[11px] text-bsb-dim text-center">{player.team}</span>
      {/* ADP */}
      <span className={`text-right text-xs font-bold ${player.drafted ? 'text-white/15' : adpColor}`}
        title={player.adp ? `Consensus ADP: ${player.adp}` : 'No ADP data'}>
        {player.adp || '—'}
      </span>
      {/* FPTS */}
      <span className={`text-right text-[15px] font-bold transition-all ${player.drafted ? 'text-white/20 font-normal' : 'text-bsb-gold'}`}>
        {player.fpts}
      </span>
      {/* TWV and CONS */}
      <span className={`text-right text-[13px] font-bold ${player.drafted ? 'text-white/15' : 'text-sky-400'}`} title={`TWV Delta: ${player.twvDelta && player.twvDelta > 0 ? '+' : ''}${player.twvDelta || 0}`}>
        {player.twv ? player.twv.toFixed(1) : player.fpts}
      </span>
      <span className={`text-center text-xs font-bold ${player.drafted ? 'text-white/15' :
        player.consistencyGrade === 'A' ? 'text-yellow-400' :
          player.consistencyGrade === 'B' ? 'text-emerald-400' :
            player.consistencyGrade === 'C' ? 'text-white/50' :
              player.consistencyGrade === 'D' ? 'text-orange-400' :
                player.consistencyGrade === 'F' ? 'text-red-400' : 'text-white/15'
        }`} title={`Score: ${player.consistencyScore || 0} | CV: ${player.cv || 'N/A'} | Mean: ${player.weeklyMean || 'N/A'}`}>
        {player.consistencyGrade || '—'}
      </span>
      {/* VORP */}
      <span className={`text-right text-xs font-bold ${player.drafted ? 'text-white/15' : vorpColor}`}>
        {(player.vorp || 0) > 0 ? `+${Math.round(player.vorp || 0)}` : Math.round(player.vorp || 0)}
      </span>
      {/* 14 dynamic columns */}
      {!isPitcher ? (
        <>
          <span className="text-right text-white/80" title="PA">{player.pa || 0}</span>
          <span className="text-right text-white/80" title="AVG">{formatAvg(player.avg)}</span>
          <span className="text-right text-white/80" title="R">{player.r || 0}</span>
          <span className="text-right text-white/80" title="BB">{player.bb || 0}</span>
          <span className="text-right text-white/80" title="HR">{player.hr || 0}</span>
          <span className="text-right text-white/80" title="RBI">{player.rbi || 0}</span>
          <span className="text-right text-white/80" title="SB">{player.sb || 0}</span>
          <span className="text-right text-white/80" title="K%">{formatPct(advStats.k_pct)}</span>
          <span className="text-right text-white/80" title="EV">{formatDecimal(advStats.exit_velo)}</span>
          <span className="text-right text-white/80" title="HH%">{formatPct(advStats.hard_hit_pct, 100)}</span>
          <span className="text-right text-white/80" title="BABIP">{formatAvg(advStats.babip)}</span>
          <span className="text-right text-white/80" title="wRC+">{formatDecimal(advStats.wrc_plus, 0)}</span>
          <span className="text-right text-white/80" title="Whiff%">{formatPct(advStats.whiff_pct)}</span>
          <span aria-hidden="true">&nbsp;</span>
        </>
      ) : (
        <>
          <span className="text-right text-white/80" title="IP">{player.ip?.toFixed(1) || 0}</span>
          <span className="text-right text-white/80" title="W">{player.w || 0}</span>
          <span className="text-right text-white/80" title="SV">{player.sv || 0}</span>
          <span className="text-right text-white/80" title="HLD">{player.hld || 0}</span>
          <span className="text-right text-white/80" title="K">{player.so || 0}</span>
          <span className="text-right text-white/80" title="CG">{player.cg || 0}</span>
          <span className="text-right text-white/80" title="IRS">{player.irstr?.toFixed(1) || 0}</span>
          <span className="text-right text-white/80" title="Velo">{formatDecimal(advStats.fb_velo)}</span>
          <span className="text-right text-white/80" title="Stuff+">{formatDecimal(advStats.stuff_plus, 0)}</span>
          <span className="text-right text-white/80" title="Loc+">{formatDecimal(advStats.location_plus, 0)}</span>
          <span className="text-right text-white/80" title="xERA">{formatDecimal(advStats.xera, 2)}</span>
          <span className="text-right text-white/80" title="HH%">{formatPct(advStats.hard_hit_against, 100)}</span>
          <span className="text-right text-white/80" title="BRL%">{formatPct(advStats.barrel_against, 100, 1)}</span>
          <span className="text-right text-white/80" title="Chase%">{formatPct(advStats.chase_rate)}</span>
        </>
      )}
      {/* Draft tag / Watch toggle */}
      <span className="flex justify-end items-center gap-1">
        {player.drafted && player.draftedBy !== undefined ? (
          <span className={`text-[10px] px-1.5 rounded font-bold ${player.draftedBy === myNum
            ? 'bg-bsb-gold/20 text-bsb-gold'
            : 'bg-bsb-accent/20 text-bsb-accent'
            }`}>
            {player.draftedBy === myNum ? 'ME' : teamAbbrev(player.draftedBy)}
          </span>
        ) : (
          <button
            className={`text-[11px] px-1 rounded transition-colors ${player.watched
              ? 'bg-emerald-500/25 text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
              : 'text-white/15 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            onClick={(e) => { e.stopPropagation(); onToggleWatch?.(player.id) }}
            title={player.watched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {player.watched ? '★' : '☆'}
          </button>
        )}
      </span>
    </div>
  )
}
