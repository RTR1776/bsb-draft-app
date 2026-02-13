'use client'

export function TemplatePanel({
  templates, analysis, selected, onSelect
}: {
  templates: Record<string, Record<string, number>>
  analysis: any; selected: string | null
  onSelect: (t: string) => void
}) {
  const order = analysis.templateOrder || Object.keys(templates)
  const scores = analysis.templateScores || {}
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider mb-2">Template Priority</h3>
      {order.map((t: string, i: number) => (
        <div
          key={t}
          onClick={() => onSelect(t)}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm transition-all ${
            selected === t
              ? 'bg-bsb-accent/20 border border-bsb-accent text-white'
              : 'hover:bg-white/5 border border-transparent'
          }`}
        >
          <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
            i < 4 ? 'bg-bsb-gold text-bsb-navy' : 'bg-white/10 text-bsb-dim'
          }`}>{i + 1}</span>
          <span className="font-bold w-6">{t}</span>
          <span className={`text-xs font-mono ${scores[t] > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {scores[t] > 0 ? '+' : ''}{Math.round(scores[t])}
          </span>
          {selected === t && (
            <span className="ml-auto text-[10px] text-bsb-accent">★ MINE</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function TemplateDetail({
  template, picks, activeCategory
}: {
  template: string; picks: Record<string, number>
  activeCategory: string | null
}) {
  const cats = [
    'Mini Bat', 'Mini Pitch', 'Mega Pitch', 'Mega OF',
    'Mega 1B', 'Mega 2B', 'Mega 3B', 'Mega SS', 'Mega C', 'Mega Any'
  ]
  return (
    <div className="mt-3 p-2 bg-white/5 rounded">
      <h4 className="text-xs font-bold text-bsb-gold mb-1">Template {template} — Your Picks</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {cats.map(cat => {
          const pick = picks[cat]
          const isActive = activeCategory === cat
          const color = pick <= 3 ? 'text-green-400' : pick >= 14 ? 'text-red-400' : 'text-bsb-dim'
          return (
            <div key={cat} className={`flex justify-between text-xs rounded px-0.5 ${
              isActive ? 'bg-bsb-accent/20 ring-1 ring-bsb-accent/50' : ''
            }`}>
              <span className={isActive ? 'text-white font-bold' : 'text-bsb-dim'}>
                {cat.replace('Mega ', 'M-').replace('Mini ', 'm-')}
              </span>
              <span className={`font-mono font-bold ${color}`}>#{pick}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
