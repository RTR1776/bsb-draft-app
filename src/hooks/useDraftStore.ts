'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import battersData from '@/data/batters.json'
import pitchersData from '@/data/pitchers.json'
import templatesData from '@/data/templates.json'
import analysisData from '@/data/analysis.json'
import draftCategoriesData from '@/data/draftCategories.json'
import projectionsData from '@/data/projections.json'

export type Player = {
  id: string
  name: string
  team: string
  pos: string
  positions: string[]
  fpts: number
  role?: string
  drafted: boolean
  draftedBy?: number // 0 = you, 1-16 = other teams
  draftCategory?: string
  draftPick?: number
  // enriched analytics
  posRank?: number | null
  vorp?: number
  tier?: number  // 1-5
  // bio fields (from MLB Stats API)
  age?: number
  bats?: string        // 'R', 'L', 'S' (switch)
  throws?: string      // 'R', 'L'
  height?: string      // e.g. "6' 7\""
  weight?: number      // e.g. 282
  mlbDebut?: string    // e.g. "2016-08-13"
  birthCountry?: string
  histFpts?: Record<string, number>  // e.g. { "2022": 450, "2023": 520, "2024": 610 }
  // batter stats
  pa?: number; r?: number; hr?: number; rbi?: number; sb?: number; bb?: number
  avg?: number; tb?: number; obp?: number; slg?: number; ops?: number; war?: number
  // pitcher stats
  ip?: number; w?: number; sv?: number; hld?: number; qs?: number; so?: number
  era?: number; whip?: number; kper9?: number; h?: number; irstr?: number; g?: number; gs?: number
  // BSB custom projection fields
  bsbFpts?: number
  bsbDelta?: number
  projectionYears?: number
  injuryFlag?: string        // 'HEALTHY' | 'MINOR' | 'MODERATE' | 'SEVERE'
  healthPct?: number
  gamesPlayed?: Record<string, number>
  weeklyCV?: number
  weeklyMean?: number
  consistencyGrade?: string  // 'A' through 'F'
  consistencyScore?: number
  ageCurve?: string          // 'Pre-Peak' | 'Peak' | 'Declining' | 'Late Career'
  ageAdj?: number
}

export type DraftCategory = {
  key: string
  rounds: number
  type: 'batter' | 'pitcher' | 'any'
  posFilter: string | null
}

export type DraftLogEntry = {
  player: string
  team: number
  category: string
  round: number
  pick: number
  timestamp: number
}

export type DraftState = {
  phase: 'pre-draft' | 'mini-bat' | 'mini-pitch' | 'mega' | 'complete'
  activeCategory: string | null
  currentRound: number
  currentPick: number
  myTemplate: string | null
  draftLog: DraftLogEntry[]
  categoryPicks: Record<string, number> // track picks per category
}

const STORAGE_KEY = 'bsb-draft-state'

export function useDraftStore() {
  const [batters, setBatters] = useState<Player[]>(() =>
    (battersData as any[]).map(b => {
      const proj = (projectionsData as any).players?.[b.id]
      return { ...b, drafted: false, ...proj }
    })
  )
  const [pitchers, setPitchers] = useState<Player[]>(() =>
    (pitchersData as any[]).map(p => {
      const proj = (projectionsData as any).players?.[p.id]
      return { ...p, drafted: false, ...proj }
    })
  )
  const [draftState, setDraftState] = useState<DraftState>({
    phase: 'pre-draft',
    activeCategory: null,
    currentRound: 1,
    currentPick: 1,
    myTemplate: null,
    draftLog: [],
    categoryPicks: {},
  })

  const templates = templatesData as Record<string, Record<string, number>>
  const analysis = analysisData as any
  const categories = draftCategoriesData as DraftCategory[]

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.draftState) {
          setDraftState(prev => ({
            ...prev,
            ...parsed.draftState,
            categoryPicks: parsed.draftState.categoryPicks || {},
          }))
        }
        if (parsed.draftedIds) {
          const ids = new Set(parsed.draftedIds)
          setBatters(prev => prev.map(b => ({
            ...b,
            drafted: ids.has(b.id),
            draftedBy: parsed.draftedDetails?.[b.id]?.team,
            draftCategory: parsed.draftedDetails?.[b.id]?.category,
          })))
          setPitchers(prev => prev.map(p => ({
            ...p,
            drafted: ids.has(p.id),
            draftedBy: parsed.draftedDetails?.[p.id]?.team,
            draftCategory: parsed.draftedDetails?.[p.id]?.category,
          })))
        }
      }
    } catch (e) {
      console.warn('Failed to load draft state:', e)
    }
  }, [])

  // Save state to localStorage on changes
  useEffect(() => {
    try {
      const all = [...batters, ...pitchers]
      const draftedIds = all.filter(p => p.drafted).map(p => p.id)
      const draftedDetails: Record<string, { team?: number; category?: string }> = {}
      all.filter(p => p.drafted).forEach(p => {
        draftedDetails[p.id] = { team: p.draftedBy, category: p.draftCategory }
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        draftState,
        draftedIds,
        draftedDetails,
      }))
    } catch (e) {
      // localStorage not available
    }
  }, [batters, pitchers, draftState])

  // Draft a player — teamNum: 0 = you, 1-16 = other teams
  const draftPlayer = useCallback((playerId: string, teamNum: number = 0) => {
    const cat = draftState.activeCategory
    const catKey = cat || 'unknown'

    setBatters(prev => prev.map(b =>
      b.id === playerId ? { ...b, drafted: true, draftedBy: teamNum, draftCategory: catKey } : b
    ))
    setPitchers(prev => prev.map(p =>
      p.id === playerId ? { ...p, drafted: true, draftedBy: teamNum, draftCategory: catKey } : p
    ))
    setDraftState(prev => {
      const newCategoryPicks = { ...prev.categoryPicks }
      newCategoryPicks[catKey] = (newCategoryPicks[catKey] || 0) + 1
      return {
        ...prev,
        draftLog: [...prev.draftLog, {
          player: playerId,
          team: teamNum,
          category: catKey,
          round: prev.currentRound,
          pick: prev.currentPick,
          timestamp: Date.now(),
        }],
        currentPick: prev.currentPick + 1,
        categoryPicks: newCategoryPicks,
      }
    })
  }, [draftState.activeCategory])

  const undraftPlayer = useCallback((playerId: string) => {
    // Find the log entry to decrement category pick count
    const logEntry = draftState.draftLog.find(l => l.player === playerId)

    setBatters(prev => prev.map(b =>
      b.id === playerId ? { ...b, drafted: false, draftedBy: undefined, draftCategory: undefined } : b
    ))
    setPitchers(prev => prev.map(p =>
      p.id === playerId ? { ...p, drafted: false, draftedBy: undefined, draftCategory: undefined } : p
    ))
    setDraftState(prev => {
      const newCategoryPicks = { ...prev.categoryPicks }
      if (logEntry) {
        const cat = logEntry.category
        newCategoryPicks[cat] = Math.max((newCategoryPicks[cat] || 1) - 1, 0)
      }
      return {
        ...prev,
        draftLog: prev.draftLog.filter(l => l.player !== playerId),
        categoryPicks: newCategoryPicks,
      }
    })
  }, [draftState.draftLog])

  const setMyTemplate = useCallback((t: string) => {
    setDraftState(prev => ({ ...prev, myTemplate: prev.myTemplate === t ? null : t }))
  }, [])

  const setActiveCategory = useCallback((cat: string | null) => {
    setDraftState(prev => ({ ...prev, activeCategory: cat }))
  }, [])

  const setPhase = useCallback((phase: DraftState['phase']) => {
    setDraftState(prev => ({ ...prev, phase }))
  }, [])

  const resetDraft = useCallback(() => {
    setBatters(prev => prev.map(b => ({ ...b, drafted: false, draftedBy: undefined, draftCategory: undefined })))
    setPitchers(prev => prev.map(p => ({ ...p, drafted: false, draftedBy: undefined, draftCategory: undefined })))
    setDraftState({
      phase: 'pre-draft',
      activeCategory: null,
      currentRound: 1,
      currentPick: 1,
      myTemplate: null,
      draftLog: [],
      categoryPicks: {},
    })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Computed: available players for current category
  const getAvailableForCategory = useCallback((catKey: string) => {
    const cat = categories.find(c => c.key === catKey)
    if (!cat) return []

    if (cat.type === 'pitcher') {
      return pitchers.filter(p => !p.drafted)
    }
    if (cat.type === 'batter') {
      if (cat.posFilter) {
        return batters.filter(b => !b.drafted && b.positions.includes(cat.posFilter!))
      }
      return batters.filter(b => !b.drafted)
    }
    // 'any' - all undrafted
    return [...batters, ...pitchers].filter(p => !p.drafted).sort((a, b) => b.fpts - a.fpts)
  }, [batters, pitchers, categories])

  // Computed: scarcity recalculation based on current draft state
  const getLiveScarcity = useCallback(() => {
    const remaining: Record<string, Player[]> = {}
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'OF']) {
      remaining[pos] = batters
        .filter(b => !b.drafted && b.positions.includes(pos))
        .sort((a, b) => b.fpts - a.fpts)
    }
    remaining['SP'] = pitchers.filter(p => !p.drafted && p.role === 'SP').sort((a, b) => b.fpts - a.fpts)
    remaining['RP'] = pitchers.filter(p => !p.drafted && p.role === 'RP').sort((a, b) => b.fpts - a.fpts)

    const scarcity: Record<string, number> = {}
    for (const [pos, pool] of Object.entries(remaining)) {
      if (pool.length >= 16) {
        scarcity[pos] = Math.round(pool[0].fpts - pool[15].fpts)
      } else if (pool.length >= 2) {
        scarcity[pos] = Math.round(pool[0].fpts - pool[pool.length - 1].fpts)
      }
    }
    return { scarcity, remaining }
  }, [batters, pitchers])

  // Memoize allPlayers to avoid re-sorting every render
  const allPlayers = useMemo(() =>
    [...batters, ...pitchers].sort((a, b) => b.fpts - a.fpts),
    [batters, pitchers]
  )

  const draftedCount = useMemo(() =>
    allPlayers.filter(p => p.drafted).length,
    [allPlayers]
  )

  // Get picks made in a specific category
  const getCategoryPickCount = useCallback((catKey: string) => {
    return draftState.categoryPicks[catKey] || 0
  }, [draftState.categoryPicks])

  // Get current round for a category based on picks made (16 picks per round)
  const getCategoryRound = useCallback((catKey: string) => {
    const picks = draftState.categoryPicks[catKey] || 0
    return Math.floor(picks / 16) + 1
  }, [draftState.categoryPicks])

  // Get which pick within current round (1-16)
  const getCategoryPickInRound = useCallback((catKey: string) => {
    const picks = draftState.categoryPicks[catKey] || 0
    return (picks % 16) + 1
  }, [draftState.categoryPicks])

  // PANA — Points Above Next Available at same position
  const getPANA = useCallback((player: Player): number => {
    if (player.drafted) return 0
    const isPitcher = player.pos === 'P'
    if (isPitcher) {
      const pool = pitchers
        .filter(p => !p.drafted && p.role === player.role && p.id !== player.id)
        .sort((a, b) => b.fpts - a.fpts)
      return pool.length > 0 ? Math.round(player.fpts - pool[0].fpts) : 0
    } else {
      // Use primary position
      const pool = batters
        .filter(b => !b.drafted && b.positions.includes(player.pos) && b.id !== player.id)
        .sort((a, b) => b.fpts - a.fpts)
      return pool.length > 0 ? Math.round(player.fpts - pool[0].fpts) : 0
    }
  }, [batters, pitchers])

  // Pick countdown — how many picks until YOUR pick in active category
  const getPicksUntilMyPick = useCallback((): number | null => {
    if (!draftState.myTemplate || !draftState.activeCategory) return null
    const myPick = templates[draftState.myTemplate]?.[draftState.activeCategory]
    if (!myPick) return null
    const currentPick = getCategoryPickInRound(draftState.activeCategory)
    if (currentPick > myPick) return -1 // already passed
    return myPick - currentPick
  }, [draftState.myTemplate, draftState.activeCategory, templates, getCategoryPickInRound])

  // Recommendation engine — top 3 picks for current category
  const getRecommendations = useCallback((): Player[] => {
    const cat = draftState.activeCategory
    if (!cat) return []
    const available = getAvailableForCategory(cat)
    if (available.length === 0) return []

    // Score each player: weighted combo of VORP + PANA + raw FPTS
    const scored = available.slice(0, 50).map(p => {
      const vorp = p.vorp || 0
      const pana = getPANA(p)
      // Normalize: VORP weight 0.4, PANA weight 0.35, raw FPTS weight 0.25
      const score = (vorp * 0.4) + (pana * 0.35) + (p.fpts * 0.25 / 10)
      return { player: p, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 3).map(s => s.player)
  }, [draftState.activeCategory, getAvailableForCategory, getPANA])

  // My team strength by position
  const getMyTeamStrength = useCallback((): Record<string, { players: Player[]; totalFpts: number; grade: string }> => {
    const myPlayers = allPlayers.filter(p => p.drafted && p.draftedBy === 0)
    const positions: Record<string, Player[]> = {
      C: [], '1B': [], '2B': [], '3B': [], SS: [], OF: [], SP: [], RP: [],
    }
    myPlayers.forEach(p => {
      if (p.pos === 'P') {
        if (p.role === 'SP') positions.SP.push(p)
        else positions.RP.push(p)
      } else {
        if (positions[p.pos]) positions[p.pos].push(p)
      }
    })

    const result: Record<string, { players: Player[]; totalFpts: number; grade: string }> = {}
    for (const [pos, players] of Object.entries(positions)) {
      const total = players.reduce((s, p) => s + p.fpts, 0)
      // Grade based on top player's posRank
      const topRank = players.length > 0 ? Math.min(...players.map(p => p.posRank || 999)) : 999
      let grade = 'F'
      if (topRank <= 2) grade = 'A'
      else if (topRank <= 5) grade = 'B'
      else if (topRank <= 10) grade = 'C'
      else if (topRank <= 16) grade = 'D'
      result[pos] = { players, totalFpts: total, grade }
    }
    return result
  }, [allPlayers])

  return {
    batters,
    pitchers,
    allPlayers,
    draftState,
    templates,
    analysis,
    categories,
    draftedCount,
    draftPlayer,
    undraftPlayer,
    setMyTemplate,
    setActiveCategory,
    setPhase,
    resetDraft,
    getAvailableForCategory,
    getLiveScarcity,
    getCategoryPickCount,
    getCategoryRound,
    getCategoryPickInRound,
    getPANA,
    getPicksUntilMyPick,
    getRecommendations,
    getMyTeamStrength,
  }
}
