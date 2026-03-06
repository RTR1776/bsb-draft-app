import { useState, useEffect } from 'react'
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

  // Animation state for drafting
  const [justDrafted, setJustDrafted] = useState(false)
  const [prevDrafted, setPrevDrafted] = useState(player.drafted)

  if (player.drafted !== prevDrafted) {
    if (player.drafted) setJustDrafted(true)
    setPrevDrafted(player.drafted)
  }

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
    : ''

  // Tier divider — show border when tier changes
  const showTierDivider = prevTier !== undefined && player.tier !== prevTier && !player.drafted

  const advStats = isPitcher ? (advPitMap[player.id] || {}) : (advBatMap[player.id] || {})

  return (
    <div
      className={`player-row grid items-center px-1 py-1 tabular-nums text-[12px] lg:text-[13px] font-mono max-w-[1050px] mx-auto w-full group hover:bg-white/5 transition-colors cursor-pointer ${player.drafted ? 'drafted' : ''
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
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${newsSeverity === 'high' ? 'bg-red-400 animate-pulse' :
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
      <span className={`text-right text-xs font-bold transition-all ${player.drafted ? 'text-bsb-dim font-normal' :
        (pana >= 20 && !isRecommended) ? 'text-red-400 bg-red-500/20 animate-pulse rounded drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'text-bsb-gold'
        }`}>
        {player.fpts}
      </span>
      {/* TWV and CONS */}
      <span className={`text-right text-[11px] font-bold ${player.drafted ? 'text-white/15' : 'text-sky-400'}`} title={`TWV Delta: ${player.twvDelta && player.twvDelta > 0 ? '+' : ''}${player.twvDelta || 0}`}>
        {player.twv ? player.twv.toFixed(1) : player.fpts}
      </span>
      <span className={`text-center text-[10px] font-bold ${player.drafted ? 'text-white/15' :
        player.consistencyGrade === 'A' ? 'text-yellow-400' :
          player.consistencyGrade === 'B' ? 'text-emerald-400' :
            player.consistencyGrade === 'C' ? 'text-white/50' :
              player.consistencyGrade === 'D' ? 'text-orange-400' :
                player.consistencyGrade === 'F' ? 'text-red-400' : 'text-white/15'
        }`} title={`Score: ${player.consistencyScore || 0} | CV: ${player.cv || 'N/A'} | Mean: ${player.weeklyMean || 'N/A'}`}>
        {player.consistencyGrade || '—'}
      </span>
      {/* VORP */}
      <span className={`text-right text-[10px] font-bold ${player.drafted ? 'text-white/15' : vorpColor}`}>
        {(player.vorp || 0) > 0 ? `+${Math.round(player.vorp || 0)}` : Math.round(player.vorp || 0)}
      </span>
      {/* 14 dynamic columns */}
      {!isPitcher ? (
        <>
          <span className="text-right text-white/80" title="PA">{player.pa || 0}</span>
          <span className="text-right text-white/80" title="AVG">{player.avg?.toFixed(3).replace(/^0\./, '.') || '.000'}</span>
          <span className="text-right text-white/80" title="R">{player.r || 0}</span>
          <span className="text-right text-white/80" title="BB">{player.bb || 0}</span>
          <span className="text-right text-white/80" title="HR">{player.hr || 0}</span>
          <span className="text-right text-white/80" title="RBI">{player.rbi || 0}</span>
          <span className="text-right text-white/80" title="SB">{player.sb || 0}</span>
          <span className="text-right text-white/80" title="K%">{advStats.k_pct ? `${(advStats.k_pct * 100).toFixed(0)}%` : '—'}</span>
          <span className="text-right text-white/80" title="EV">{advStats.exit_velo?.toFixed(1) || '—'}</span>
          <span className="text-right text-white/80" title="HH%">{advStats.hard_hit_pct ? `${(advStats.hard_hit_pct * 100).toFixed(0)}%` : '—'}</span>
          <span className="text-right text-white/80" title="BABIP">{advStats.babip?.toFixed(3).replace(/^0\./, '.') || '—'}</span>
          <span className="text-right text-white/80" title="wRC+">{advStats.wrc_plus?.toFixed(0) || '—'}</span>
          <span className="text-right text-white/80" title="Whiff%">{advStats.whiff_pct ? `${(advStats.whiff_pct * 100).toFixed(0)}%` : '—'}</span>
          <span className="text-transparent">_</span>
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
          <span className="text-right text-white/80" title="Velo">{advStats.fb_velo?.toFixed(1) || '—'}</span>
          <span className="text-right text-white/80" title="Stuff+">{advStats.stuff_plus?.toFixed(0) || '—'}</span>
          <span className="text-right text-white/80" title="Loc+">{advStats.location_plus?.toFixed(0) || '—'}</span>
          <span className="text-right text-white/80" title="xERA">{advStats.xera?.toFixed(2) || '—'}</span>
          <span className="text-right text-white/80" title="HH%">{advStats.hard_hit_against ? `${(advStats.hard_hit_against * 100).toFixed(0)}%` : '—'}</span>
          <span className="text-right text-white/80" title="BRL%">{advStats.barrel_against ? `${(advStats.barrel_against * 100).toFixed(1)}%` : '—'}</span>
          <span className="text-right text-white/80" title="Chase%">{advStats.chase_rate ? `${(advStats.chase_rate * 100).toFixed(0)}%` : '—'}</span>
        </>
      )}
      {/* Draft tag */}
      <span className="flex justify-end">
        {player.drafted && player.draftedBy !== undefined && (
          <span className={`text-[10px] px-1.5 rounded font-bold ${player.draftedBy === myNum
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
