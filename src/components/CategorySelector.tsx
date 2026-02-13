'use client'

export function CategorySelector({
  categories, active, onSelect, getCategoryRound, getCategoryPickCount
}: {
  categories: any[]; active: string | null
  onSelect: (k: string | null) => void
  getCategoryRound: (cat: string) => number
  getCategoryPickCount: (cat: string) => number
}) {
  const miniCats = categories.filter((c: any) => c.key.startsWith('Mini'))
  const megaCats = categories.filter((c: any) => c.key.startsWith('Mega'))

  const renderCatButton = (cat: any) => {
    const picks = getCategoryPickCount(cat.key)
    const totalPicks = cat.rounds * 16
    const round = getCategoryRound(cat.key)
    const isComplete = picks >= totalPicks
    const isActive = active === cat.key

    return (
      <button
        key={cat.key}
        onClick={() => onSelect(active === cat.key ? null : cat.key)}
        className={`px-2 py-1 rounded text-xs font-bold transition-all relative ${
          isActive
            ? 'active-category bg-bsb-accent text-white'
            : isComplete
              ? 'bg-green-900/30 text-green-400 border border-green-500/30'
              : picks > 0
                ? 'bg-bsb-mid/50 text-white border border-white/10'
                : 'bg-white/5 text-bsb-dim hover:bg-white/10'
        }`}
      >
        {cat.key.replace('Mini ', '').replace('Mega ', '')}
        <span className="ml-1 text-[10px] opacity-60">
          {isComplete ? '✓' : picks > 0 ? `R${round}/${cat.rounds}` : `${cat.rounds}rd`}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-[10px] text-bsb-dim uppercase tracking-wider mb-1">Mini Draft</h4>
        <div className="flex gap-1">{miniCats.map(renderCatButton)}</div>
      </div>
      <div>
        <h4 className="text-[10px] text-bsb-dim uppercase tracking-wider mb-1">Mega Draft</h4>
        <div className="flex flex-wrap gap-1">{megaCats.map(renderCatButton)}</div>
      </div>
    </div>
  )
}
