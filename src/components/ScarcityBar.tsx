'use client'

export function ScarcityBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = pct > 66 ? 'bg-red-500' : pct > 33 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right font-mono text-bsb-dim">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`scarcity-bar h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 font-mono text-bsb-dim">{value}</span>
    </div>
  )
}
