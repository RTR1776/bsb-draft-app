// ─────────────────────────────────────────
// Shared constants & utility functions
// ─────────────────────────────────────────

// TEAM NAMES — index = team number (0 = you)
export const TEAM_NAMES: Record<number, string> = {
  0: 'Frequent Fliers',
  1: 'Deuces Wild',
  2: 'El Guapo Gato',
  3: "Fulton's Folly",
  4: 'Hubschs Hackers',
  5: 'Kansas City Monarchs',
  6: 'Kline Drives',
  7: 'No Soup for You',
  8: '14-30-8-24-5-15-13-20',
  9: 'Betty White Sox',
  10: 'Dirty Water All-Stars',
  11: 'Hot Dog Junkies',
  12: 'Mesa Joses',
  13: 'Sedition Brothers',
  14: 'Silly Santos',
  15: 'St. Louis Browns',
  16: 'Unassigned',
}

export function teamAbbrev(num: number): string {
  if (num === 0) return 'FF'
  const abbrevs: Record<number, string> = {
    1: 'DW', 2: 'EGG', 3: 'FF', 4: 'HH', 5: 'KCM', 6: 'KD', 7: 'NSY',
    8: '#s', 9: 'BWS', 10: 'DWA', 11: 'HDJ', 12: 'MJ', 13: 'SBr',
    14: 'SS', 15: 'SLB', 16: 'UN',
  }
  return abbrevs[num] || `T${num}`
}

export function teamColor(num: number): string {
  if (num === 0) return 'text-bsb-gold'
  const colors: Record<number, string> = {
    1: 'text-blue-400', 2: 'text-green-400', 3: 'text-purple-400', 4: 'text-pink-400',
    5: 'text-cyan-400', 6: 'text-orange-400', 7: 'text-lime-400', 8: 'text-rose-400',
    9: 'text-sky-400', 10: 'text-amber-400', 11: 'text-emerald-400', 12: 'text-fuchsia-400',
    13: 'text-teal-400', 14: 'text-indigo-400', 15: 'text-yellow-400', 16: 'text-red-400',
  }
  return colors[num] || 'text-bsb-dim'
}

export function teamBgColor(num: number): string {
  if (num === 0) return 'bg-bsb-gold/10 border-bsb-gold/30'
  const colors: Record<number, string> = {
    1: 'bg-blue-400/10 border-blue-400/30', 2: 'bg-green-400/10 border-green-400/30',
    3: 'bg-purple-400/10 border-purple-400/30', 4: 'bg-pink-400/10 border-pink-400/30',
    5: 'bg-cyan-400/10 border-cyan-400/30', 6: 'bg-orange-400/10 border-orange-400/30',
    7: 'bg-lime-400/10 border-lime-400/30', 8: 'bg-rose-400/10 border-rose-400/30',
    9: 'bg-sky-400/10 border-sky-400/30', 10: 'bg-amber-400/10 border-amber-400/30',
    11: 'bg-emerald-400/10 border-emerald-400/30', 12: 'bg-fuchsia-400/10 border-fuchsia-400/30',
    13: 'bg-teal-400/10 border-teal-400/30', 14: 'bg-indigo-400/10 border-indigo-400/30',
    15: 'bg-yellow-400/10 border-yellow-400/30', 16: 'bg-red-400/10 border-red-400/30',
  }
  return colors[num] || 'bg-white/5 border-white/10'
}

// Tier color utilities
export function tierRowBg(tier?: number): string {
  switch (tier) {
    case 1: return 'bg-yellow-500/[0.07]'
    case 2: return 'bg-blue-400/[0.04]'
    case 3: return ''
    case 4: return 'bg-white/[0.01]'
    default: return ''
  }
}

export function tierBadge(tier?: number): string {
  switch (tier) {
    case 1: return 'text-yellow-400'
    case 2: return 'text-blue-300'
    case 3: return 'text-bsb-dim'
    default: return 'text-white/20'
  }
}

// CSS grid template
// #(28) POS(44) NAME(flex) TM(36) FPTS(52) VORP(48) | S1(42) S2(42) S3(38) S4(42) S5(38) | D1(46) D2(40) D3(42) D4(40) | TAG(40)
export const GRID_COLS = '[rank]28px [pos]44px [name]1fr [team]36px [fpts]52px [vorp]48px [s1]42px [s2]42px [s3]38px [s4]42px [s5]38px [sep]12px [d1]46px [d2]40px [d3]42px [d4]40px [tag]40px'
