import { useMemo } from 'react'
import { Player } from '@/hooks/useDraftStore'
import { TEAM_NAMES, teamColor, teamBgColor } from './constants'

const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'OF', 'U', 'DH', 'SP', 'RP']
const SLOTS: Record<string, number> = {
    C: 2, '1B': 2, '2B': 2, '3B': 2, SS: 2, OF: 4, U: 1, DH: 1, SP: 6, RP: 4
}

export function AllTeamsRoster({ allPlayers }: { allPlayers: Player[] }) {
    const teamRosters = useMemo(() => {
        const rosters: Record<number, Record<string, Player[]>> = {}
        for (let i = 1; i <= 16; i++) {
            rosters[i] = { C: [], '1B': [], '2B': [], '3B': [], SS: [], OF: [], U: [], DH: [], SP: [], RP: [] }
        }

        // Distribute players
        for (let i = 1; i <= 16; i++) {
            const myPlayers = allPlayers.filter(p => p.drafted && p.draftedBy === i)
            const positions = rosters[i]

            myPlayers.forEach(p => {
                if (p.pos === 'P') {
                    const role = p.role === 'SP' ? 'SP' : 'RP'
                    positions[role].push(p)
                } else {
                    let placed = false
                    if (positions[p.pos] && positions[p.pos].length < SLOTS[p.pos]) {
                        positions[p.pos].push(p)
                        placed = true
                    }
                    if (!placed) {
                        for (const altPos of p.positions) {
                            if (altPos !== p.pos && positions[altPos] && positions[altPos].length < SLOTS[altPos]) {
                                positions[altPos].push(p)
                                placed = true
                                break
                            }
                        }
                    }
                    if (!placed && positions['U'].length < SLOTS['U']) {
                        positions['U'].push(p)
                        placed = true
                    }
                    if (!placed && positions['DH'].length < SLOTS['DH']) {
                        positions['DH'].push(p)
                        placed = true
                    }
                    if (!placed && positions[p.pos]) {
                        positions[p.pos].push(p) // overflow
                    }
                }
            })
        }
        return rosters
    }, [allPlayers])

    return (
        <div className="space-y-4 px-2 pb-4">
            {Array.from({ length: 16 }, (_, i) => i + 1).map(num => {
                const positions = teamRosters[num]
                const count = Object.values(positions).reduce((acc, arr) => acc + arr.length, 0)
                if (count === 0) return null

                return (
                    <div key={num} className={`rounded-xl border ${teamBgColor(num)} overflow-hidden`}>
                        <div className={`px-3 py-1.5 border-b border-white/10 ${teamBgColor(num).split(' ')[0]} flex justify-between items-center`}>
                            <span className={`text-xs font-bold uppercase tracking-wider ${teamColor(num)}`}>
                                {TEAM_NAMES[num]}
                            </span>
                            <span className="text-[10px] text-white/50">{count} drafted</span>
                        </div>
                        <div className="p-2 space-y-1 bg-black/20">
                            {POS_ORDER.map(pos => {
                                const arr = positions[pos]
                                if (arr.length === 0) return null
                                return (
                                    <div key={pos} className="flex flex-wrap gap-1 text-[10px] items-center">
                                        <span className={`w-5 font-bold pos-text-${pos} opacity-80 shrink-0 text-right`}>{pos}</span>
                                        <div className="flex flex-wrap gap-1 flex-1">
                                            {arr.map((p, i) => (
                                                <span key={p.id} className="bg-white/5 px-1.5 py-0.5 rounded text-white/80 border border-white/5 whitespace-nowrap">
                                                    {p.name.split(' ')[0][0] + '.'} {p.name.split(' ').slice(1).join(' ')}
                                                    {i >= SLOTS[pos] && <span className="text-red-400 ml-1">!</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
