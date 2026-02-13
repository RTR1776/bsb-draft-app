'use client'

export function PosBadge({ pos, posRank, small }: { pos: string; posRank?: number | null; small?: boolean }) {
  const cls = small ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0.5'
  return (
    <span className={`pos-${pos} ${cls} rounded font-bold text-white inline-flex items-center gap-0.5`}>
      {pos}
      {posRank && posRank <= 50 && (
        <span className="text-[8px] opacity-75">{posRank}</span>
      )}
    </span>
  )
}
