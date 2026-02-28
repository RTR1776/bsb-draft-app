'use client'
import { useState } from 'react'
import { Player } from '@/hooks/useDraftStore'
import { NewsItem, NewsCategory } from '@/hooks/useNewsStore'

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'injury', label: 'Injury' },
  { key: 'transaction', label: 'Trades' },
  { key: 'lineup', label: 'Lineup' },
  { key: 'spring-training', label: 'ST News' },
]

function severityDot(severity: string) {
  if (severity === 'high') return 'bg-red-400'
  if (severity === 'medium') return 'bg-orange-400'
  return 'bg-blue-400'
}

function timeSince(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function NewsFeed({
  news,
  allPlayers,
  isLoading,
  error,
  onRefresh,
  onPlayerClick,
}: {
  news: NewsItem[]
  allPlayers: Player[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onPlayerClick: (player: Player) => void
}) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? news
    : news.filter((n) => n.category === filter)

  // Only show items that matched a player in our pool, plus unmatched injury/transaction items
  const relevant = filtered.filter(
    (n) => n.playerId || n.severity === 'high' || n.category === 'transaction'
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-bsb-dim uppercase tracking-wider">
          News Feed
        </h3>
        <button
          onClick={onRefresh}
          className="text-[10px] text-bsb-dim hover:text-white transition-colors"
        >
          {isLoading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              filter === f.key
                ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30'
                : 'bg-white/5 text-bsb-dim hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-xs text-red-400/80 bg-red-400/10 rounded p-2 mb-2">
          {error}
        </div>
      )}

      {/* News items */}
      <div className="space-y-1.5">
        {relevant.length === 0 && !isLoading && (
          <div className="text-xs text-bsb-dim italic py-4 text-center">
            No news available{filter !== 'all' ? ` for "${filter}"` : ''}
          </div>
        )}
        {isLoading && relevant.length === 0 && (
          <div className="text-xs text-bsb-dim italic py-4 text-center animate-pulse">
            Loading news...
          </div>
        )}
        {relevant.slice(0, 50).map((item) => {
          const player = item.playerId
            ? allPlayers.find((p) => p.id === item.playerId)
            : null

          return (
            <div
              key={item.id}
              className="bg-white/[0.03] rounded-lg p-2.5 hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${severityDot(
                    item.severity
                  )}`}
                />
                <div className="min-w-0 flex-1">
                  {player && (
                    <button
                      className="text-[11px] font-bold text-bsb-gold hover:underline block"
                      onClick={() => onPlayerClick(player)}
                    >
                      {player.name}
                    </button>
                  )}
                  {!player && item.playerName && (
                    <span className="text-[11px] font-bold text-white/60 block">
                      {item.playerName}
                    </span>
                  )}
                  <div className="text-[11px] text-white/80 leading-snug mt-0.5">
                    {item.headline}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-white/25">
                    <span>{timeSince(item.timestamp)}</span>
                    <span className="capitalize px-1 rounded bg-white/5">
                      {item.category.replace('-', ' ')}
                    </span>
                    <span>{item.source === 'mlb-transactions' ? 'MLB' : item.source === 'mlbtraderumors' ? 'MLBTR' : 'News'}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
