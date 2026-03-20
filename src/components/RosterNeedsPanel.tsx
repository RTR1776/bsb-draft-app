'use client'

import { Player } from '@/hooks/useDraftStore'

type PositionStrength = { players: Player[]; totalFpts: number; grade: string }

// Map positions to their mega draft category
const POS_TO_MEGA: Record<string, string> = {
  C: 'Mega C', '1B': 'Mega 1B', '2B': 'Mega 2B', '3B': 'Mega 3B',
  SS: 'Mega SS', OF: 'Mega OF', SP: 'Mega Pitch', RP: 'Mega Pitch',
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-400 bg-green-400/15 border-green-400/30',
  B: 'text-blue-400 bg-blue-400/15 border-blue-400/30',
  C: 'text-yellow-400 bg-yellow-400/15 border-yellow-400/30',
  D: 'text-orange-400 bg-orange-400/15 border-orange-400/30',
  F: 'text-red-400 bg-red-400/15 border-red-400/30',
}

function pickColor(pos: number): string {
  if (pos <= 3) return 'text-green-400'
  if (pos <= 5) return 'text-green-300'
  if (pos <= 8) return 'text-bsb-gold'
  if (pos <= 11) return 'text-orange-400'
  if (pos <= 13) return 'text-red-300'
  return 'text-red-400'
}

export function RosterNeedsPanel({
  teamStrength,
  megaPicks,
}: {
  teamStrength: Record<string, PositionStrength>
  megaPicks: Record<string, number>
}) {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP']

  // Sort by need: empty positions first, then by grade (F first)
  const sorted = [...positions].sort((a, b) => {
    const aPlayers = teamStrength[a]?.players.length || 0
    const bPlayers = teamStrength[b]?.players.length || 0
    if (aPlayers === 0 && bPlayers > 0) return -1
    if (bPlayers === 0 && aPlayers > 0) return 1
    const gradeOrder = { F: 0, D: 1, C: 2, B: 3, A: 4 }
    return (gradeOrder[teamStrength[a]?.grade as keyof typeof gradeOrder] ?? 0) -
           (gradeOrder[teamStrength[b]?.grade as keyof typeof gradeOrder] ?? 0)
  })

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sorted.map(pos => {
          const strength = teamStrength[pos] || { players: [], totalFpts: 0, grade: 'F' }
          const megaCat = POS_TO_MEGA[pos]
          const megaPickPos = megaCat ? megaPicks[megaCat] : null
          const hasPlayers = strength.players.length > 0
          const gradeStyle = GRADE_COLORS[strength.grade] || GRADE_COLORS.F

          return (
            <div key={pos} className={`rounded-xl border p-4 transition-all ${
              hasPlayers ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-red-500/[0.04] border-red-500/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-white">{pos}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${gradeStyle}`}>
                  {strength.grade}
                </span>
              </div>

              {hasPlayers ? (
                <div className="space-y-1 mb-2">
                  {strength.players.map(p => (
                    <div key={p.id} className="flex justify-between text-[11px]">
                      <span className="text-white/80 truncate mr-2">{p.name}</span>
                      <span className="text-bsb-gold font-mono shrink-0">{Math.round(p.fpts)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-red-400 text-xs font-bold mb-2">NEED</div>
              )}

              <div className="text-[10px] text-bsb-dim border-t border-white/[0.06] pt-2 mt-1">
                <span className="text-white/40">Total:</span>{' '}
                <span className="text-white/60 font-mono">{Math.round(strength.totalFpts)} FPTS</span>
              </div>

              {megaPickPos && (
                <div className="text-[10px] mt-1">
                  <span className="text-white/40">{megaCat}:</span>{' '}
                  <span className={`font-bold font-mono ${pickColor(megaPickPos)}`}>#{megaPickPos}</span>
                  <span className="text-white/30"> of 16</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
