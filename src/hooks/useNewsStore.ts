'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Fuse from 'fuse.js'
import { Player } from './useDraftStore'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export type NewsCategory = 'injury' | 'transaction' | 'lineup' | 'spring-training' | 'general'
export type NewsSeverity = 'high' | 'medium' | 'low'

export type NewsItem = {
  id: string
  playerName: string
  playerId: string | null
  headline: string
  description: string
  category: NewsCategory
  source: 'mlb-transactions' | 'rotowire'
  timestamp: number
  severity: NewsSeverity
  url?: string
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const CACHE_KEY = 'bsb-news-cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function hashString(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function categorizeFromText(text: string): { category: NewsCategory; severity: NewsSeverity } {
  const lower = text.toLowerCase()
  if (/injur|il |disabled list|day\-to\-day|out for|surgery|tommy john|strain|sprain|fracture|concussion|hamstring|oblique|shoulder|elbow|knee/.test(lower)) {
    return { category: 'injury', severity: 'high' }
  }
  if (/trade|dfa|designat|waiver|release|sign|free agent|option|recall|outrighted/.test(lower)) {
    return { category: 'transaction', severity: 'medium' }
  }
  if (/lineup|batting order|leadoff|cleanup|bench|start.*lineup|pinch/.test(lower)) {
    return { category: 'lineup', severity: 'medium' }
  }
  if (/spring training|grapefruit|cactus|rotation|starter.*no\.|fifth starter|opening day roster|camp/.test(lower)) {
    return { category: 'spring-training', severity: 'medium' }
  }
  return { category: 'general', severity: 'low' }
}

// ─────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────
function parseMLBTransactions(transactions: any[]): NewsItem[] {
  if (!Array.isArray(transactions)) return []

  return transactions
    .filter((t: any) => t.person?.fullName)
    .slice(0, 200) // limit to most recent 200
    .map((t: any) => {
      const text = t.description || t.note || ''
      const { category, severity } = categorizeFromText(text)
      return {
        id: hashString(`mlb-${t.person?.id}-${t.date}-${t.typeCode}`),
        playerName: t.person?.fullName || '',
        playerId: t.person?.id ? String(t.person.id) : null,
        headline: text.length > 120 ? text.slice(0, 117) + '...' : text,
        description: text,
        category,
        source: 'mlb-transactions' as const,
        timestamp: t.date ? new Date(t.date).getTime() : Date.now(),
        severity,
      }
    })
}

function parseRotoWireRSS(xmlText: string | null): NewsItem[] {
  if (!xmlText) return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const items = doc.querySelectorAll('item')
    const result: NewsItem[] = []

    items.forEach((item) => {
      const title = item.querySelector('title')?.textContent || ''
      const description = item.querySelector('description')?.textContent || ''
      const link = item.querySelector('link')?.textContent || ''
      const pubDate = item.querySelector('pubDate')?.textContent || ''

      // Try to extract player name from title (often formatted as "Player Name - Team: headline")
      const nameMatch = title.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z'-]+)/)
      const playerName = nameMatch ? nameMatch[1] : ''

      const { category, severity } = categorizeFromText(title + ' ' + description)

      result.push({
        id: hashString(`rw-${title}-${pubDate}`),
        playerName,
        playerId: null, // will be matched later
        headline: title,
        description: description.replace(/<[^>]*>/g, '').slice(0, 200),
        category,
        source: 'rotowire',
        timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
        severity,
        url: link || undefined,
      })
    })

    return result
  } catch {
    return []
  }
}

function matchNewsToPlayers(items: NewsItem[], allPlayers: Player[]): NewsItem[] {
  if (allPlayers.length === 0) return items

  const fuse = new Fuse(allPlayers, {
    keys: ['name'],
    threshold: 0.2,
    minMatchCharLength: 3,
  })

  // Build a quick lookup for MLB IDs (which are mlbam_id in our data)
  const byMlbId = new Map<string, Player>()
  allPlayers.forEach(p => {
    if (p.id) byMlbId.set(p.id, p)
  })

  return items.map((item) => {
    // MLB transactions already have person ID — try direct match
    if (item.source === 'mlb-transactions' && item.playerId) {
      // The MLB Stats API person ID may or may not match our internal IDs
      // Try fuzzy name match as fallback
      if (byMlbId.has(item.playerId)) {
        return item
      }
    }

    // Fuzzy match by name
    if (item.playerName && item.playerName.length > 3) {
      const results = fuse.search(item.playerName)
      if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.2) {
        return { ...item, playerId: results[0].item.id }
      }
    }

    return item
  })
}

// ─────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────
function getCachedNews(): { items: NewsItem[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null
    return cached
  } catch {
    return null
  }
}

function setCachedNews(items: NewsItem[], fetchedAt: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, fetchedAt }))
  } catch { /* quota exceeded — ignore */ }
}

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────
export function useNewsStore(allPlayers: Player[]) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchNews = useCallback(async () => {
    // Check cache first
    const cached = getCachedNews()
    if (cached) {
      setItems(cached.items)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()

      const mlbItems = parseMLBTransactions(data.transactions)
      const rssItems = parseRotoWireRSS(data.rss)

      // Combine and sort by timestamp (newest first)
      let combined = [...mlbItems, ...rssItems]
        .sort((a, b) => b.timestamp - a.timestamp)

      // Deduplicate by similar headlines for the same player
      const seen = new Set<string>()
      combined = combined.filter((item) => {
        const key = `${item.playerName.toLowerCase()}-${item.category}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Match to our player data
      combined = matchNewsToPlayers(combined, allPlayers)

      setItems(combined)
      setCachedNews(combined, data.fetchedAt || Date.now())
    } catch (err: any) {
      setError(err.message || 'Failed to load news')
    } finally {
      setIsLoading(false)
    }
  }, [allPlayers])

  // Fetch on mount + auto-refresh
  useEffect(() => {
    fetchNews()
    intervalRef.current = setInterval(fetchNews, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNews])

  // Index by player ID
  const byPlayer = useMemo(() => {
    const map: Record<string, NewsItem[]> = {}
    items.forEach((item) => {
      if (item.playerId) {
        if (!map[item.playerId]) map[item.playerId] = []
        map[item.playerId].push(item)
      }
    })
    return map
  }, [items])

  const newsForPlayer = useCallback(
    (playerId: string): NewsItem[] => byPlayer[playerId] || [],
    [byPlayer]
  )

  const hasNewsForPlayer = useCallback(
    (playerId: string): boolean => !!byPlayer[playerId]?.length,
    [byPlayer]
  )

  const topSeverityForPlayer = useCallback(
    (playerId: string): NewsSeverity | undefined => {
      const playerNews = byPlayer[playerId]
      if (!playerNews?.length) return undefined
      if (playerNews.some(n => n.severity === 'high')) return 'high'
      if (playerNews.some(n => n.severity === 'medium')) return 'medium'
      return 'low'
    },
    [byPlayer]
  )

  return {
    news: items,
    newsByPlayer: byPlayer,
    newsForPlayer,
    hasNewsForPlayer,
    topSeverityForPlayer,
    isLoading,
    error,
    refresh: fetchNews,
  }
}
