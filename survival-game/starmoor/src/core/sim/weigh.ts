import { C } from '../constants'
import { generateLeg } from '../worldgen'
import { GameState } from '../types'
import { addLog, addStock } from '../util'
import { randRange } from '../rng'

export function weighCost(s: GameState): number {
  return Math.round(C.WEIGH_BASE_COST + C.WEIGH_PER_MODULE * s.modules.length)
}

export function tickWeigh(s: GameState, online: number) {
  const w = s.weigh
  if (w.phase === 'moored') return

  if (w.phase === 'countdown' && s.t >= w.endsAt) {
    const cost = weighCost(s)
    if (s.stocks.burnstock < cost) {
      w.phase = 'moored'
      addLog(s, 'The burn reserve came up short at the last count. The Weigh is off.', 'warn')
      return
    }
    s.stocks.burnstock -= cost

    // everything rigged in the field is LEFT BEHIND — the sacrifice is real
    const left = s.claims.length + s.lanes.length
    s.claims = []
    s.lanes = []
    if (left > 0) addLog(s, `${left} rigs and lanes left behind in the dark.`, 'warn')

    w.phase = 'transit'
    w.endsAt = s.t + C.WEIGH_TRANSIT
    addLog(s, 'The burn spine is lit. Nothing in the cluster is brighter than a city underway.', 'info')

    // the transit is a presence-scaled set-piece: it cannot be slept through
    const escorts = 2 + Math.min(online, C.PRESENCE_CAP)
    for (let i = 0; i < escorts; i++) {
      s.npcs.push({
        id: s.nextId++, kind: 'skiff', faction: 'breakers',
        x: randRange(s, 0, s.field.w), y: randRange(s, 0, 40),
        hp: C.SKIFF_HP, maxHp: C.SKIFF_HP,
        targetBody: -2, laneId: -1, stolen: 0, leaving: false,
      })
    }
    return
  }

  if (w.phase === 'transit' && s.t >= w.endsAt) {
    const option = s.beacons.find(b => b.id === w.optionId) ?? null
    s.leg += 1
    w.phase = 'moored'
    w.optionId = -1

    generateLeg(s, option)

    // arrival is the payoff, not the penalty box (steelman #2)
    s.spikeUntil = s.t + C.ARRIVAL_SPIKE_SECS
    addStock(s, 'ferrite', C.SALVAGE_FERRITE)
    addStock(s, 'isotopes', C.SALVAGE_ISOTOPES)
    for (const f of Object.values(s.factions)) f.heat *= C.HEAT_WEIGH_MULT
    for (const p of Object.values(s.players)) {
      p.x = s.station.x + randRange(s, -60, 60)
      p.y = s.station.y + C.DOCK_RANGE
    }
    addLog(s, `Leg ${s.leg}: anchor down at a virgin mooring. First-anchor salvage recovered; the vein runs hot.`, 'good')
  }
}
