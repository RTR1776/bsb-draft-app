'use client'
import { useState } from 'react'
import { TEAM_NAMES, teamColor, teamBgColor } from './constants'

export function TeamSelector({ onSelect }: { onSelect: (teamNum: number) => void }) {
  const [hoveredTeam, setHoveredTeam] = useState<number | null>(null)

  // All 16 teams (0-15), excluding 16 (Unassigned)
  const teams = Array.from({ length: 16 }, (_, i) => i)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-bsb-dark border border-white/20 rounded-2xl shadow-2xl shadow-black/60 max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-white/10">
          <div className="text-3xl mb-2">⚾</div>
          <h2 className="text-xl font-black text-white">
            BSB<span className="text-bsb-accent">DRAFT</span>
          </h2>
          <p className="text-sm text-bsb-dim mt-2">
            Select your team to get started
          </p>
        </div>

        {/* Team Grid */}
        <div className="p-4 grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {teams.map(num => (
            <button
              key={num}
              onClick={() => onSelect(num)}
              onMouseEnter={() => setHoveredTeam(num)}
              onMouseLeave={() => setHoveredTeam(null)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left
                ${hoveredTeam === num
                  ? `${teamBgColor(num)} scale-[1.02]`
                  : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }
              `}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                hoveredTeam === num ? 'bg-current' : 'bg-white/20'
              } ${teamColor(num)}`} />
              <span className={`text-sm font-bold truncate ${
                hoveredTeam === num ? teamColor(num) : 'text-white/80'
              }`}>
                {TEAM_NAMES[num]}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 text-center">
          <p className="text-[10px] text-bsb-dim">
            Your selection is saved locally and persists between sessions.
          </p>
        </div>
      </div>
    </div>
  )
}
