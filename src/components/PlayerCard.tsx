'use client'
import { Player } from '@/hooks/useDraftStore'
import { NewsItem } from '@/hooks/useNewsStore'
import { PosBadge } from './PosBadge'
import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────
// Tier label + color
// ─────────────────────────────────────────
function tierLabel(tier?: number): { text: string; cls: string } {
  switch (tier) {
    case 1: return { text: 'ELITE', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' }
    case 2: return { text: 'GREAT', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' }
    case 3: return { text: 'SOLID', cls: 'bg-white/10 text-white/70 border-white/20' }
    case 4: return { text: 'AVG', cls: 'bg-white/5 text-white/40 border-white/10' }
    default: return { text: 'BELOW', cls: 'bg-white/5 text-white/25 border-white/10' }
  }
}

// ─────────────────────────────────────────
// Hand display helper
// ─────────────────────────────────────────
function handLabel(code?: string): string {
  if (!code) return '—'
  switch (code) {
    case 'R': return 'Right'
    case 'L': return 'Left'
    case 'S': return 'Switch'
    default: return code
  }
}

// ─────────────────────────────────────────
// Debut year helper
// ─────────────────────────────────────────
function debutYear(debut?: string): string {
  if (!debut) return '—'
  return debut.split('-')[0]
}

function mlbYears(debut?: string): string {
  if (!debut) return '—'
  const yr = parseInt(debut.split('-')[0])
  if (isNaN(yr)) return '—'
  const years = new Date().getFullYear() - yr
  return `${years} yr${years !== 1 ? 's' : ''}`
}

// ─────────────────────────────────────────
// Mini bar chart for historical FPTS
// ─────────────────────────────────────────
function FptsHistoryChart({ histFpts, currentFpts }: { histFpts?: Record<string, number>; currentFpts: number }) {
  const seasons = ['2022', '2023', '2024']
  const allVals = [...seasons.map(s => histFpts?.[s] || 0), currentFpts]
  const maxVal = Math.max(...allVals, 1)

  return (
    <div className="flex items-end gap-1.5 h-28">
      {seasons.map(yr => {
        const val = histFpts?.[yr]
        const height = val ? Math.max((val / maxVal) * 100, 8) : 0
        return (
          <div key={yr} className="flex flex-col items-center gap-0.5 flex-1">
            {val ? (
              <>
                <span className="text-[9px] text-bsb-dim font-mono">{Math.round(val)}</span>
                <div
                  className="w-full rounded-t bg-blue-500/40 border border-blue-400/30 transition-all"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                />
              </>
            ) : (
              <>
                <span className="text-[9px] text-white/15">—</span>
                <div className="w-full rounded-t bg-white/5 border border-white/5" style={{ height: '8%', minHeight: '4px' }} />
              </>
            )}
            <span className="text-[9px] text-bsb-dim">{yr}</span>
          </div>
        )
      })}
      {/* 2025 projection */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <span className="text-[9px] text-bsb-gold font-bold font-mono">{Math.round(currentFpts)}</span>
        <div
          className="w-full rounded-t bg-bsb-gold/40 border border-bsb-gold/50 transition-all"
          style={{ height: `${Math.max((currentFpts / maxVal) * 100, 8)}%`, minHeight: '4px' }}
        />
        <span className="text-[9px] text-bsb-gold font-bold">'25</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Stat row — shows category, raw stat, points
// ─────────────────────────────────────────
function StatLine({ label, value, multiplier, suffix }: {
  label: string; value: number | undefined; multiplier: number; suffix?: string
}) {
  const raw = value || 0
  const pts = Math.round(raw * multiplier * 10) / 10
  const isNeg = multiplier < 0
  const isHighImpact = Math.abs(pts) >= 50
  return (
    <div className={`flex items-center justify-between py-[2px] ${isHighImpact ? 'bg-white/5 rounded px-1 -mx-1' : ''}`}>
      <span className="text-[11px] text-bsb-dim w-12">{label}</span>
      <span className="text-[11px] text-white/70 font-mono w-10 text-right">{typeof value === 'number' ? (suffix ? value.toFixed(1) : Math.round(value)) : '—'}</span>
      <span className="text-[9px] text-white/30 w-6 text-center">×{Math.abs(multiplier)}</span>
      <span className={`text-[11px] font-mono font-bold w-12 text-right ${
        isNeg ? 'text-red-400/80' : pts > 0 ? 'text-green-400/80' : 'text-white/25'
      }`}>
        {isNeg && pts !== 0 ? '' : '+'}{pts.toFixed(0)}{suffix || ''}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────
// PLAYER CARD COMPONENT
// ─────────────────────────────────────────
export function PlayerCard({
  player,
  pana,
  onClose,
  onDraft,
  allPlayers,
  playerNews,
}: {
  player: Player
  pana: number
  onClose: () => void
  onDraft: (id: string) => void
  allPlayers: Player[]
  playerNews?: NewsItem[]
}) {
  const isPitcher = player.pos === 'P'
  const tier = tierLabel(player.tier)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Close on click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Find comparable — closest FPTS at same position who isn't this player
  const comparable = allPlayers
    .filter(p =>
      p.id !== player.id &&
      !p.drafted &&
      (isPitcher ? p.role === player.role : p.positions.includes(player.pos))
    )
    .sort((a, b) => Math.abs(a.fpts - player.fpts) - Math.abs(b.fpts - player.fpts))
    .slice(0, 1)[0]

  // Next available at position
  const nextAvail = allPlayers
    .filter(p =>
      p.id !== player.id &&
      !p.drafted &&
      (isPitcher ? p.role === player.role : p.positions.includes(player.pos)) &&
      p.fpts < player.fpts
    )
    .sort((a, b) => b.fpts - a.fpts)[0]

  // Trend: is the projection up or down vs last actual year?
  const lastActualYear = ['2024', '2023', '2022'].find(yr => player.histFpts?.[yr])
  const lastActualFpts = lastActualYear ? player.histFpts?.[lastActualYear] : undefined
  const trend = lastActualFpts ? player.fpts - lastActualFpts : undefined

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-bsb-dark border border-white/15 rounded-xl shadow-2xl shadow-black/50 w-[520px] max-h-[90vh] overflow-y-auto">
        {/* ── HEADER ── */}
        <div className={`relative px-5 pt-5 pb-4 rounded-t-xl ${
          player.tier === 1 ? 'bg-gradient-to-br from-yellow-900/30 to-transparent' :
          player.tier === 2 ? 'bg-gradient-to-br from-blue-900/20 to-transparent' : ''
        }`}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/30 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-all"
          >✕</button>

          {/* Name + Position badges */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white truncate">{player.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                {isPitcher ? (
                  <PosBadge pos={player.role || 'P'} posRank={player.posRank} />
                ) : (
                  player.positions.map(p => (
                    <PosBadge key={p} pos={p} posRank={p === player.pos ? player.posRank : undefined} />
                  ))
                )}
                <span className="text-sm text-bsb-dim font-bold">{player.team}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${tier.cls}`}>
                  {tier.text}
                </span>
              </div>
            </div>
          </div>

          {/* Bio row */}
          <div className="flex items-center gap-3 mt-3 text-xs text-bsb-dim flex-wrap">
            {player.age && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">AGE</span>
                <span className="text-white/80 font-bold">{player.age}</span>
              </span>
            )}
            {!isPitcher && player.bats && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">BATS</span>
                <span className="text-white/80 font-bold">{handLabel(player.bats)}</span>
              </span>
            )}
            {player.throws && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">THR</span>
                <span className="text-white/80 font-bold">{handLabel(player.throws)}</span>
              </span>
            )}
            {player.height && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">HT</span>
                <span className="text-white/80 font-bold">{player.height}</span>
              </span>
            )}
            {player.weight && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">WT</span>
                <span className="text-white/80 font-bold">{player.weight}</span>
              </span>
            )}
            {player.mlbDebut && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">DEBUT</span>
                <span className="text-white/80 font-bold">{debutYear(player.mlbDebut)}</span>
                <span className="text-white/25">({mlbYears(player.mlbDebut)})</span>
              </span>
            )}
            {player.birthCountry && player.birthCountry !== 'USA' && (
              <span className="flex items-center gap-1">
                <span className="text-white/30">FROM</span>
                <span className="text-white/80 font-bold">{player.birthCountry}</span>
              </span>
            )}
          </div>

          {/* Profile badges: injury, consistency, age curve */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {player.injuryFlag && player.injuryFlag !== 'HEALTHY' && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                player.injuryFlag === 'SEVERE' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                player.injuryFlag === 'MODERATE' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
              }`}>
                {player.injuryFlag === 'SEVERE' ? '⚠ INJURY RISK' :
                 player.injuryFlag === 'MODERATE' ? '⚠ INJURY PRONE' : 'MINOR INJ'}
              </span>
            )}
            {player.consistencyGrade && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                player.consistencyGrade === 'A' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                player.consistencyGrade === 'B' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                player.consistencyGrade === 'C' ? 'bg-white/10 text-white/50 border-white/20' :
                'bg-red-500/10 text-red-400/70 border-red-500/30'
              }`}>
                CON: {player.consistencyGrade}
              </span>
            )}
            {player.ageCurve && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                player.ageCurve === 'Peak' ? 'bg-green-500/10 text-green-400/70 border-green-500/20' :
                player.ageCurve === 'Pre-Peak' ? 'bg-blue-500/10 text-blue-300/70 border-blue-500/20' :
                player.ageCurve === 'Declining' ? 'bg-orange-500/10 text-orange-400/70 border-orange-500/20' :
                'bg-red-500/10 text-red-400/70 border-red-500/20'
              }`}>
                {player.ageCurve}
              </span>
            )}
          </div>
        </div>

        {/* ── BSB SCORE HERO ── */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-bsb-dim uppercase tracking-wider">BSB Fantasy Points</div>
              <div className="text-3xl font-black text-bsb-gold leading-tight">{player.fpts}</div>
              {trend !== undefined && (
                <div className={`text-[11px] font-bold mt-0.5 ${
                  trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-bsb-dim'
                }`}>
                  {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(Math.round(trend))} pts vs {lastActualYear} actual
                </div>
              )}
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-[10px] text-bsb-dim uppercase">VORP</div>
                <div className={`text-lg font-black ${
                  (player.vorp || 0) > 30 ? 'text-green-400' : (player.vorp || 0) > 10 ? 'text-yellow-400' : 'text-white/30'
                }`}>
                  {(player.vorp || 0) > 0 ? `+${Math.round(player.vorp || 0)}` : Math.round(player.vorp || 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-bsb-dim uppercase">PANA</div>
                <div className={`text-lg font-black ${
                  pana >= 20 ? 'text-red-400' : pana >= 10 ? 'text-orange-400' : 'text-white/40'
                }`}>
                  {pana > 0 ? `+${pana}` : pana}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-bsb-dim uppercase">WAR</div>
                <div className="text-lg font-black text-white/60">{player.war || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BSB PROJECTION vs STEAMER ── */}
        {player.bsbFpts != null && (
          <div className="px-5 py-3 border-t border-white/10">
            <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">BSB Custom Projection</div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-bsb-gold">{player.bsbFpts}</div>
                <div className="text-[9px] text-bsb-dim">BSB Proj</div>
              </div>
              <div className="text-white/15 text-lg">vs</div>
              <div className="text-center">
                <div className="text-2xl font-black text-white/40">{player.fpts}</div>
                <div className="text-[9px] text-bsb-dim">Steamer</div>
              </div>
              <div className={`text-sm font-bold ml-1 ${
                (player.bsbDelta || 0) > 0 ? 'text-green-400' :
                (player.bsbDelta || 0) < 0 ? 'text-red-400' : 'text-white/30'
              }`}>
                {(player.bsbDelta || 0) > 0 ? '+' : ''}{player.bsbDelta}
              </div>
              <div className="ml-auto text-right">
                <div className="text-[9px] text-white/30">{player.projectionYears || 0}yr data</div>
                {player.ageAdj != null && player.ageAdj !== 1.0 && (
                  <div className="text-[9px] text-white/25">
                    age adj: {player.ageAdj < 1 ? '' : '+'}{Math.round((player.ageAdj - 1) * 100)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 3-YEAR HISTORY ── */}
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">BSB Fantasy Points History</div>
          <FptsHistoryChart histFpts={player.histFpts} currentFpts={player.fpts} />
        </div>

        {/* ── DURABILITY & CONSISTENCY ── */}
        {(player.gamesPlayed || player.weeklyCV != null) && (
          <div className="px-5 py-3 border-t border-white/10">
            <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">Durability & Consistency</div>
            {player.gamesPlayed && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {['2022', '2023', '2024'].map(yr => {
                  const gp = player.gamesPlayed?.[yr]
                  const expected = isPitcher
                    ? (player.role === 'SP' ? 31 : 65)
                    : 155
                  const pct = gp != null ? Math.min(gp / expected, 1.0) : 0
                  return (
                    <div key={yr} className="bg-white/5 rounded p-2">
                      <div className="text-[9px] text-bsb-dim">{yr}</div>
                      <div className="text-xs font-bold text-white/80">{gp != null ? `${gp} ${isPitcher ? (player.role === 'SP' ? 'GS' : 'G') : 'G'}` : '—'}</div>
                      <div className="h-1.5 bg-white/10 rounded mt-1">
                        <div
                          className={`h-full rounded ${pct >= 0.9 ? 'bg-green-500/60' : pct >= 0.7 ? 'bg-yellow-500/60' : pct > 0 ? 'bg-red-500/60' : 'bg-white/5'}`}
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center gap-4">
              {player.weeklyCV != null && (
                <div>
                  <div className="text-[9px] text-bsb-dim">Weekly CV</div>
                  <div className="text-sm font-bold text-white/70">{player.weeklyCV.toFixed(2)}</div>
                </div>
              )}
              {player.weeklyMean != null && (
                <div>
                  <div className="text-[9px] text-bsb-dim">Avg/Week</div>
                  <div className="text-sm font-bold text-bsb-gold">{player.weeklyMean.toFixed(1)}</div>
                </div>
              )}
              {player.consistencyGrade && (
                <div>
                  <div className="text-[9px] text-bsb-dim">Consistency</div>
                  <div className={`text-sm font-bold ${
                    player.consistencyGrade === 'A' ? 'text-green-400' :
                    player.consistencyGrade === 'B' ? 'text-blue-300' :
                    player.consistencyGrade === 'C' ? 'text-white/50' :
                    'text-red-400/70'
                  }`}>{player.consistencyGrade}</div>
                </div>
              )}
              {player.healthPct != null && (
                <div>
                  <div className="text-[9px] text-bsb-dim">Health</div>
                  <div className={`text-sm font-bold ${
                    player.healthPct >= 0.9 ? 'text-green-400' :
                    player.healthPct >= 0.75 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>{Math.round(player.healthPct * 100)}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SCORING BREAKDOWN ── */}
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-1.5">
            {isPitcher ? 'Pitching' : 'Batting'} Scoring Breakdown
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            {!isPitcher ? (
              <>
                <div>
                  <StatLine label="R" value={player.r} multiplier={1} />
                  <StatLine label="TB" value={player.tb} multiplier={1} />
                  <StatLine label="BB" value={player.bb} multiplier={1} />
                </div>
                <div>
                  <StatLine label="RBI" value={player.rbi} multiplier={1} />
                  <StatLine label="SB" value={player.sb} multiplier={1} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <StatLine label="IP" value={player.ip} multiplier={3} suffix="" />
                  <StatLine label="K" value={player.so} multiplier={1} />
                  <StatLine label="W" value={player.w} multiplier={10} />
                  <StatLine label="SV" value={player.sv} multiplier={8} />
                  <StatLine label="HLD" value={player.hld} multiplier={6} />
                  <StatLine label="QS" value={player.qs} multiplier={4} />
                </div>
                <div>
                  <StatLine label="ER" value={player.era ? Math.round((player.era / 9) * (player.ip || 0)) : undefined} multiplier={-2} />
                  <StatLine label="BB" value={player.bb} multiplier={-1} />
                  <StatLine label="H" value={player.h} multiplier={-1} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ADVANCED STATS ── */}
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">Advanced</div>
          <div className="grid grid-cols-4 gap-2">
            {!isPitcher ? (
              <>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">AVG</div>
                  <div className="text-sm font-bold text-white/80">{player.avg?.toFixed(3) || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">OBP</div>
                  <div className="text-sm font-bold text-white/80">{player.obp?.toFixed(3) || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">SLG</div>
                  <div className="text-sm font-bold text-white/80">{player.slg?.toFixed(3) || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">OPS</div>
                  <div className="text-sm font-bold text-white/80">{player.ops?.toFixed(3) || '—'}</div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">ERA</div>
                  <div className="text-sm font-bold text-white/80">{player.era || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">WHIP</div>
                  <div className="text-sm font-bold text-white/80">{player.whip || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">K/9</div>
                  <div className="text-sm font-bold text-white/80">{player.kper9 || '—'}</div>
                </div>
                <div className="bg-white/5 rounded px-2 py-1.5 text-center">
                  <div className="text-[9px] text-white/30 uppercase">K/BB</div>
                  <div className="text-sm font-bold text-white/80">
                    {player.so && player.bb ? (player.so / player.bb).toFixed(1) : '—'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── DRAFT CONTEXT ── */}
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">Draft Context</div>
          <div className="space-y-1.5">
            {/* Next available at position */}
            {nextAvail && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-bsb-dim">Next at {isPitcher ? player.role : player.pos}</span>
                <span className="text-white/70">
                  {nextAvail.name} <span className="text-bsb-dim">({nextAvail.fpts} pts, -{Math.round(player.fpts - nextAvail.fpts)})</span>
                </span>
              </div>
            )}
            {/* Comparable */}
            {comparable && comparable.id !== nextAvail?.id && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-bsb-dim">Comparable</span>
                <span className="text-white/70">
                  {comparable.name} <span className="text-bsb-dim">({comparable.fpts} pts)</span>
                </span>
              </div>
            )}
            {/* Position rank */}
            {player.posRank && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-bsb-dim">{isPitcher ? player.role : player.pos} Rank</span>
                <span className="text-white/70 font-bold">#{player.posRank}</span>
              </div>
            )}
            {/* Draft status */}
            {player.drafted && player.draftedBy !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-bsb-dim">Drafted by</span>
                <span className={`font-bold ${player.draftedBy === 0 ? 'text-bsb-gold' : 'text-bsb-accent'}`}>
                  {player.draftedBy === 0 ? 'YOU' : `Team ${player.draftedBy}`}
                  {player.draftCategory && <span className="text-bsb-dim font-normal ml-1">({player.draftCategory})</span>}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── PLAYER NEWS ── */}
        {playerNews && playerNews.length > 0 && (
          <div className="px-5 py-3 border-t border-white/10">
            <div className="text-[10px] text-bsb-dim uppercase tracking-wider mb-2">
              Recent News <span className="text-white/25">({playerNews.length})</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {playerNews.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${
                    item.severity === 'high' ? 'bg-red-400' :
                    item.severity === 'medium' ? 'bg-orange-400' : 'bg-blue-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-white/80 leading-snug">{item.headline}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/25">
                      <span>{(() => {
                        const mins = Math.round((Date.now() - item.timestamp) / 60000)
                        if (mins < 60) return `${mins}m ago`
                        const hrs = Math.round(mins / 60)
                        if (hrs < 24) return `${hrs}h ago`
                        return `${Math.round(hrs / 24)}d ago`
                      })()}</span>
                      <span className="capitalize px-1 rounded bg-white/5">
                        {item.category.replace('-', ' ')}
                      </span>
                      <span>{item.source === 'mlb-transactions' ? 'MLB' : 'RotoWire'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTION BAR ── */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-bsb-dim hover:text-white hover:bg-white/5 rounded transition-all"
          >Close</button>
          {!player.drafted && (
            <button
              onClick={() => { onDraft(player.id); onClose() }}
              className="px-5 py-2 text-sm font-bold bg-bsb-gold/20 text-bsb-gold border border-bsb-gold/30 hover:bg-bsb-gold/30 hover:scale-[1.02] active:scale-[0.98] rounded transition-all"
            >
              Draft to My Team
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
