import { useState, useEffect } from 'react'
import { Player } from '@/hooks/useDraftStore'
import { PosBadge } from './PosBadge'
import { GRID_COLS, tierRowBg, teamAbbrev } from './constants'

function getStatColor(stat: string, val: number | string | undefined | null, isPitcher: boolean, isDim: boolean = false): string {
  if (val == null || val === '—') return isDim ? 'text-white/25' : 'text-bsb-dim'
  const v = Number(val)
  if (isNaN(v)) return isDim ? 'text-white/25' : 'text-bsb-dim'

  // Batters
  if (!isPitcher) {
    if (stat === 'hr') return v >= 35 ? 'text-fuchsia-400 font-bold drop-shadow-[0_0_3px_rgba(232,121,249,0.5)]' : v >= 25 ? 'text-pink-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'sb') return v >= 40 ? 'text-emerald-400 font-bold drop-shadow-[0_0_3px_rgba(52,211,153,0.5)]' : v >= 20 ? 'text-green-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'avg') return v >= 0.290 ? 'text-yellow-400 font-bold drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]' : v >= 0.275 ? 'text-amber-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'ops') return v >= 0.880 ? 'text-orange-400 font-bold drop-shadow-[0_0_3px_rgba(251,146,60,0.5)]' : v >= 0.800 ? 'text-orange-300' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'r' || stat === 'rbi') return v >= 100 ? 'text-sky-400 font-bold' : v >= 85 ? 'text-sky-300' : isDim ? 'text-white/25' : 'text-bsb-dim'
  } else {
    // Pitchers
    if (stat === 'so') return v >= 200 ? 'text-cyan-400 font-bold drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]' : v >= 160 ? 'text-cyan-300' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'sv') return v >= 30 ? 'text-purple-400 font-bold drop-shadow-[0_0_3px_rgba(192,132,252,0.5)]' : v >= 15 ? 'text-fuchsia-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'hld') return v >= 20 ? 'text-indigo-400 font-bold' : v >= 10 ? 'text-indigo-300' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'era') return v <= 3.30 && v > 0 ? 'text-emerald-400 font-bold drop-shadow-[0_0_3px_rgba(52,211,153,0.5)]' : v <= 3.70 && v > 0 ? 'text-green-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'whip') return v <= 1.15 && v > 0 ? 'text-emerald-400 font-bold' : v <= 1.25 && v > 0 ? 'text-green-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'kper9') return v >= 10.0 ? 'text-cyan-400 font-bold' : v >= 9.0 ? 'text-sky-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
    if (stat === 'w') return v >= 15 ? 'text-yellow-400 font-bold' : v >= 12 ? 'text-amber-400' : isDim ? 'text-white/25' : 'text-bsb-dim'
  }

  return isDim ? 'text-white/25' : 'text-bsb-dim'
}

function TrendSparkline({ histFpts, currentFpts }: { histFpts?: Record<string, number>; currentFpts: number }) {
  if (!histFpts || Object.keys(histFpts).length === 0) return null;
  const seasons = ['2022', '2023', '2024'];
  const allVals = [...seasons.map(s => histFpts[s] || 0), currentFpts];
  const maxVal = Math.max(...allVals, 1);
  return (
    <div className="flex items-end gap-[1px] h-3 w-[18px] shrink-0 opacity-60 ml-1.5 align-middle hidden sm:flex" title="3-yr FPTS trajectory + '25 Proj">
      {seasons.map(yr => {
        const val = histFpts[yr];
        const height = val ? Math.max((val / maxVal) * 100, 10) : 0;
        return (
          <div key={yr} className="flex-1 rounded-t-[1px] bg-white opacity-70" style={{ height: `${height}%`, minHeight: val ? '2px' : '0' }} />
        )
      })}
      {/* 2025 proj */}
      <div className="flex-1 rounded-t-[1px] bg-bsb-gold" style={{ height: `${Math.max((currentFpts / maxVal) * 100, 10)}%`, minHeight: '2px' }} />
    </div>
  )
}

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

  return (
    <div
      className={`player-row grid items-center px-1 py-[2px] tabular-nums text-[11px] lg:text-xs font-mono max-w-[1050px] mx-auto w-full ${player.drafted ? 'drafted' : ''
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
        {!player.drafted && <TrendSparkline histFpts={player.histFpts} currentFpts={player.fpts} />}
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
      {/* VORP */}
      <span className={`text-right text-[10px] font-bold ${player.drafted ? 'text-white/15' : vorpColor}`}>
        {(player.vorp || 0) > 0 ? `+${Math.round(player.vorp || 0)}` : Math.round(player.vorp || 0)}
      </span>
      {/* 5 scoring stat columns */}
      {!isPitcher ? (
        <>
          <span className={`text-right ${getStatColor('r', player.r, false)}`} title="Runs">{player.r}</span>
          <span className={`text-right ${getStatColor('tb', player.tb, false)}`} title="TB">{player.tb}</span>
          <span className={`text-right ${getStatColor('bb', player.bb, false)}`} title="BB">{player.bb}</span>
          <span className={`text-right ${getStatColor('rbi', player.rbi, false)}`} title="RBI">{player.rbi}</span>
          <span className={`text-right ${getStatColor('sb', player.sb, false)}`} title="SB">{player.sb}</span>
        </>
      ) : (
        <>
          <span className={`text-right ${getStatColor('ip', player.ip, true)}`} title="IP">{player.ip}</span>
          <span className={`text-right ${getStatColor('so', player.so, true)}`} title="K">{player.so}</span>
          <span className={`text-right ${getStatColor('w', player.w, true)}`} title="W">{player.w}</span>
          <span className={`text-right ${getStatColor('sv', player.sv, true)}`} title="SV">{player.sv || 0}</span>
          <span className={`text-right ${getStatColor('hld', player.hld, true)}`} title="HLD">{player.hld || 0}</span>
        </>
      )}
      {/* Separator */}
      <span className="text-center text-white/15">│</span>
      {/* 4 traditional stat columns (dimmed defaults) */}
      {!isPitcher ? (
        <>
          <span className={`text-right ${getStatColor('avg', player.avg?.toFixed(3), false, true)}`} title="AVG">{player.avg?.toFixed(3)}</span>
          <span className={`text-right ${getStatColor('ops', player.ops?.toFixed(3), false, true)}`} title="OPS">{player.ops?.toFixed(3)}</span>
          <span className={`text-right ${getStatColor('hr', player.hr, false, true)}`} title="HR">{player.hr}</span>
          <span className={`text-right ${getStatColor('sb', player.sb, false, true)}`} title="SB">{player.sb}</span>
        </>
      ) : (
        <>
          <span className={`text-right ${getStatColor('era', player.era, true, true)}`} title="ERA">{player.era}</span>
          <span className={`text-right ${getStatColor('whip', player.whip, true, true)}`} title="WHIP">{player.whip ?? '—'}</span>
          <span className={`text-right ${getStatColor('kper9', player.kper9, true, true)}`} title="K/9">{player.kper9 ?? '—'}</span>
          <span className={`text-right ${getStatColor('qs', player.qs, true, true)}`} title="QS">{player.qs || 0}</span>
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
