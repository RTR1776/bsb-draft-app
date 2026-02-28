'use client'
import { useRef, useEffect } from 'react'
import { TEAM_NAMES, teamColor } from './constants'

export function TeamContextMenu({
  x, y, playerId, playerName, onDraft, onClose, myTeamNumber
}: {
  x: number; y: number; playerId: string; playerName: string
  onDraft: (id: string, team: number) => void; onClose: () => void
  myTeamNumber?: number | null
}) {
  const myNum = myTeamNumber ?? 0
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const adjustedY = Math.min(y, window.innerHeight - 500)
  const adjustedX = Math.min(x, window.innerWidth - 220)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bsb-dark border border-white/20 rounded-lg shadow-2xl shadow-black/50 py-1 min-w-[200px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-1.5 text-[10px] text-bsb-dim uppercase tracking-wider border-b border-white/10 truncate max-w-[240px]">
        Draft {playerName}
      </div>
      <button
        onClick={() => { onDraft(playerId, myNum); onClose() }}
        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-bsb-accent/20 font-bold flex items-center gap-2 ${teamColor(myNum)}`}
      >
        <span className="w-2 h-2 rounded-full bg-current"></span>
        {TEAM_NAMES[myNum]} (Me)
      </button>
      <div className="border-t border-white/10 my-0.5" />
      <div className="max-h-[380px] overflow-y-auto">
        {Array.from({ length: 16 }, (_, i) => i).filter(n => n !== myNum).map(num => (
          <button
            key={num}
            onClick={() => { onDraft(playerId, num); onClose() }}
            className={`w-full px-3 py-1 text-left text-sm hover:bg-white/5 flex items-center gap-2 ${teamColor(num)}`}
          >
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span className="truncate">{TEAM_NAMES[num]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
