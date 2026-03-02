'use client'

import { DraftCategory } from '@/hooks/useDraftStore'

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

export function MyPicksPanel({
  templatePicks,
  categories,
  activeCategory,
  categoryPickCounts,
}: {
  templatePicks: Record<string, number>
  categories: DraftCategory[]
  activeCategory: string | null
  categoryPickCounts: Record<string, number>
}) {
  // Sort categories: active first, then by pick position (best picks first)
  const sorted = [...categories].sort((a, b) => {
    if (a.key === activeCategory) return -1
    if (b.key === activeCategory) return 1
    return (templatePicks[a.key] || 99) - (templatePicks[b.key] || 99)
  })

  const totalPicks = categories.reduce((s, c) => s + c.rounds, 0)
  const totalMade = Object.values(categoryPickCounts).reduce((s, n) => s + n, 0)

  return (
    <div>
      <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mb-1">
        My Pick Schedule
        <span className="text-white/30 font-normal ml-1">({totalPicks} picks)</span>
      </h3>
      <p className="text-[9px] text-bsb-dim mb-2 leading-tight">
        Your pick position and overall pick numbers in each category.
      </p>
      <div className="space-y-1">
        {sorted.map(cat => {
          const pos = templatePicks[cat.key]
          if (!pos) return null
          const picks = computePickNumbers(pos, cat.rounds)
          const isActive = activeCategory === cat.key
          const picksMade = categoryPickCounts[cat.key] || 0
          const posColor = pos <= 3 ? 'text-green-400' : pos >= 14 ? 'text-red-400' : 'text-white/70'

          return (
            <div
              key={cat.key}
              className={`rounded px-2 py-1 transition-all ${
                isActive
                  ? 'bg-bsb-accent/15 ring-1 ring-bsb-accent/40'
                  : 'bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${isActive ? 'text-bsb-accent' : 'text-white/60'}`}>
                  {cat.key}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono font-bold ${posColor}`}>
                    #{pos}
                  </span>
                  <span className="text-[9px] text-bsb-dim">
                    of 16
                  </span>
                </div>
              </div>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {picks.map((pick, i) => {
                  const rd = i + 1
                  const isDone = picksMade >= rd * 16
                  const isCurrentRound = picksMade >= (rd - 1) * 16 && picksMade < rd * 16
                  return (
                    <span
                      key={pick}
                      className={`text-[10px] font-mono px-1 rounded ${
                        isDone
                          ? 'text-white/20 line-through'
                          : isCurrentRound
                            ? 'bg-bsb-gold/20 text-bsb-gold font-bold'
                            : 'text-white/40'
                      }`}
                      title={`Round ${rd}: Pick ${pick}`}
                    >
                      {pick}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-between text-[10px] text-bsb-dim">
        <span>Best: {sorted[0]?.key} (#{templatePicks[sorted[0]?.key]})</span>
        <span>{totalMade}/{totalPicks * 16} drafted</span>
      </div>
    </div>
  )
}
