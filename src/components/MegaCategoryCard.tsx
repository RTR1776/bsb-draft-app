'use client'

import { useState } from 'react'
import { Player, DraftCategory } from '@/hooks/useDraftStore'
import { tierBadge } from '@/components/constants'

function computePickNumbers(position: number, rounds: number): number[] {
  const picks: number[] = []
  for (let r = 1; r <= rounds; r++) {
    if (r % 2 === 1) {
      picks.push((r - 1) * 16 + position)
    } else {
      picks.push(r * 16 - position + 1)
    }
  }
  return picks
}

function pickPosColor(pos: number): string {
  if (pos <= 3) return 'text-green-400'
  if (pos <= 5) return 'text-green-300'
  if (pos <= 8) return 'text-bsb-gold'
  if (pos <= 11) return 'text-orange-400'
  if (pos <= 13) return 'text-red-300'
  return 'text-red-400'
}

function pickPosBg(pos: number): string {
  if (pos <= 3) return 'bg-green-400/10 border-green-400/30'
  if (pos <= 5) return 'bg-green-300/10 border-green-300/30'
  if (pos <= 8) return 'bg-bsb-gold/10 border-bsb-gold/30'
  if (pos <= 11) return 'bg-orange-400/10 border-orange-400/30'
  if (pos <= 13) return 'bg-red-300/10 border-red-300/30'
  return 'bg-red-400/10 border-red-400/30'
}

type TargetWindow = {
  round: number
  pickNumber: number
  targetIndex: number
  window: Player[]
}

export function MegaCategoryCard({
  category,
  pickPosition,
  availablePlayers,
  miniRoster,
  defaultExpanded,
}: {
  category: DraftCategory
  pickPosition: number
  availablePlayers: Player[]
  miniRoster: Player[]
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const pickNumbers = computePickNumbers(pickPosition, category.rounds)

  // Sort available by FPTS desc
  const sorted = [...availablePlayers].sort((a, b) => b.fpts - a.fpts)

  // Compute target windows per round
  const targets: TargetWindow[] = pickNumbers.map((pickNum, roundIdx) => {
    const targetIdx = pickNum - 1 // 0-indexed into the sorted list
    const windowRadius = 3
    const windowStart = Math.max(0, targetIdx - windowRadius)
    const windowEnd = Math.min(sorted.length - 1, targetIdx + windowRadius)
    return {
      round: roundIdx + 1,
      pickNumber: pickNum,
      targetIndex: targetIdx,
      window: sorted.slice(windowStart, windowEnd + 1),
    }
  })

  const posLabel = category.posFilter || (category.type === 'pitcher' ? 'Pitchers' : 'Any')

  return (
    <div className={`rounded-2xl border transition-all ${
      expanded ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.08]'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border font-black text-lg ${pickPosBg(pickPosition)}`}>
            <span className={pickPosColor(pickPosition)}>#{pickPosition}</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">{category.key}</div>
            <div className="text-[10px] text-bsb-dim">
              {posLabel} &middot; {category.rounds} rounds &middot; Picks: {pickNumbers.join(', ')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {miniRoster.length > 0 && (
            <div className="text-[10px] text-bsb-dim text-right">
              <span className="text-white/40">Have:</span>{' '}
              {miniRoster.map(p => p.name.split(' ').pop()).join(', ')}
            </div>
          )}
          <span className={`text-bsb-dim text-sm transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Mini roster callout */}
          {miniRoster.length > 0 && (
            <div className="bg-bsb-gold/[0.06] border border-bsb-gold/20 rounded-lg px-4 py-2.5">
              <div className="text-[10px] text-bsb-gold uppercase tracking-wider font-bold mb-1">Already Rostered</div>
              {miniRoster.map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-white/80">{p.name} <span className="text-bsb-dim">({p.team})</span></span>
                  <span className="text-bsb-gold font-mono">{Math.round(p.fpts)} FPTS</span>
                </div>
              ))}
            </div>
          )}

          {/* Round-by-round targets */}
          {targets.map(target => {
            // The actual index within the window array that is the bullseye
            const windowStart = Math.max(0, target.targetIndex - 3)
            const bullseyeIdx = target.targetIndex - windowStart

            return (
              <div key={target.round} className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
                <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.04] flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70">
                    Round {target.round}
                  </span>
                  <span className="text-[10px] text-bsb-dim font-mono">
                    Overall Pick #{target.pickNumber}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {target.window.map((player, i) => {
                    const isBullseye = i === bullseyeIdx
                    const globalRank = sorted.indexOf(player) + 1
                    return (
                      <div
                        key={player.id}
                        className={`px-4 py-2 flex items-center gap-3 text-xs ${
                          isBullseye
                            ? 'bg-bsb-gold/[0.08] border-l-2 border-l-bsb-gold'
                            : 'border-l-2 border-l-transparent'
                        }`}
                      >
                        <span className={`w-6 text-right font-mono text-[10px] ${
                          isBullseye ? 'text-bsb-gold font-bold' : 'text-white/30'
                        }`}>
                          {globalRank}
                        </span>
                        <span className={`flex-1 font-medium ${isBullseye ? 'text-white' : 'text-white/70'}`}>
                          {player.name}
                        </span>
                        <span className="text-white/40 w-8 text-center">{player.team}</span>
                        <span className="text-white/40 w-8 text-center">{player.pos}</span>
                        {player.tier && (
                          <span className={`w-4 text-center text-[10px] font-bold ${tierBadge(player.tier)}`}>
                            T{player.tier}
                          </span>
                        )}
                        <span className={`w-14 text-right font-mono font-bold ${
                          isBullseye ? 'text-bsb-gold' : 'text-white/60'
                        }`}>
                          {Math.round(player.fpts)}
                        </span>
                        {isBullseye && (
                          <span className="text-[9px] text-bsb-gold font-bold uppercase tracking-wider">Target</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Full available list (top 20) */}
          <details className="group">
            <summary className="text-[10px] text-bsb-dim cursor-pointer hover:text-white/60 transition-colors py-1">
              View all available ({sorted.length} players) &#9654;
            </summary>
            <div className="mt-2 bg-white/[0.02] rounded-lg border border-white/[0.04] max-h-64 overflow-y-auto">
              <div className="divide-y divide-white/[0.03]">
                {sorted.slice(0, 32).map((player, i) => (
                  <div key={player.id} className="px-3 py-1.5 flex items-center gap-2 text-[11px]">
                    <span className="w-5 text-right font-mono text-white/30">{i + 1}</span>
                    <span className="flex-1 text-white/70">{player.name}</span>
                    <span className="text-white/30 w-8 text-center">{player.team}</span>
                    <span className="text-white/30 w-8 text-center">{player.pos}</span>
                    <span className="w-12 text-right font-mono text-white/50">{Math.round(player.fpts)}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
