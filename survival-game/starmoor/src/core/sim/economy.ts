import { C } from '../constants'
import { GameState } from '../types'
import { addStock, stockSpace } from '../util'
import { crewMult } from './station'

/** Anchorfeed yield from the mooring this instant. Moor-bound; nothing else supplies it. */
export function anchorfeedYield(s: GameState): number {
  if (s.weigh.phase === 'transit') return 0
  const spike = s.t < s.spikeUntil ? C.ARRIVAL_SPIKE_MULT : 1
  return s.mooringA0 * Math.exp(-s.tLeg / s.mooringTau) * spike
}

export function anchorfeedDraw(s: GameState): number {
  const modulesOnline = s.modules.filter(m => m.online).length
  const hydros = s.modules.filter(m => m.kind === 'hydro' && m.online).length
  const crewRelief = Math.max(0.4, 1 - hydros * C.HYDRO_CREW_RELIEF)
  const transitScale = s.weigh.phase === 'transit' ? 0.5 : 1
  return (C.FEED_BASE_DRAW + modulesOnline * C.FEED_MODULE_DRAW +
    s.crew.length * C.FEED_CREW_DRAW * crewRelief) * transitScale
}

export function tickEconomy(s: GameState, dt: number) {
  // the city drinks
  addStock(s, 'anchorfeed', (anchorfeedYield(s) - anchorfeedDraw(s)) * dt)

  // refineries: ice → burnstock (the move fund IS refined survival margin)
  // throttled by output space — never burn ice into a full tank
  const refineries = s.modules.filter(m => m.kind === 'refinery' && m.online).length
  if (refineries > 0 && s.stocks.ice > 0) {
    const rate = refineries * C.REFINE_RATE * crewMult(s, 'refinery')
    const ice = Math.min(s.stocks.ice, rate * dt, stockSpace(s, 'burnstock') / C.REFINE_YIELD)
    if (ice > 0) {
      s.stocks.ice -= ice
      addStock(s, 'burnstock', ice * C.REFINE_YIELD)
    }
  }

  // claim rigs: mine into silos; a full silo HALTS (haul-away demand)
  for (const claim of s.claims) {
    if (!claim.online || claim.hp <= 0) continue
    const body = s.bodies.find(b => b.id === claim.bodyId)
    if (!body) continue
    claim.silo = Math.min(C.SILO_CAP, claim.silo + C.RIG_RATE * body.richness * dt)
  }

  // freight lanes: silo → station, skimmed by any toll gate on the lane.
  // Deliveries pause when the destination store is full — backpressure reaches
  // the silo, the silo halts the rig, and the haul-away demand stays honest.
  for (const lane of s.lanes) {
    const claim = s.claims.find(cl => cl.id === lane.claimId)
    if (!claim || claim.silo <= 0) continue
    const keep = 1 - lane.tithe
    if (keep <= 0) continue
    const spaceLimited = stockSpace(s, claim.siloRes) / keep
    const moved = Math.min(claim.silo, C.LANE_RATE * dt, spaceLimited)
    if (moved <= 0) continue
    claim.silo -= moved
    addStock(s, claim.siloRes, moved * keep)
  }
}
