import { C } from '../constants'
import { GameState } from '../types'
import { wealthOf } from '../util'

export interface EmissionRates { glare: number; wake: number; chatter: number }

/** What the city is shouting into the dark, right now. */
export function emissionRates(s: GameState): EmissionRates {
  const galleries = s.modules.filter(m => m.kind === 'gallery' && m.online).length
  const hydros = s.modules.filter(m => m.kind === 'hydro' && m.online).length
  const modulesOnline = s.modules.filter(m => m.online).length

  let laneWake = 0
  for (const lane of s.lanes) laneWake += lane.damped ? C.WAKE_LANE * C.WAKE_LANE_DAMPED : C.WAKE_LANE
  const thrusting = Object.values(s.players).filter(p => p.thrusting && p.downUntil <= s.t).length
  const pickets = s.lanes.filter(l => l.picket).length

  return {
    glare: galleries * C.GLARE_GALLERY + hydros * C.GLARE_HYDRO + modulesOnline * C.GLARE_MODULE,
    wake: laneWake + thrusting * C.WAKE_SHIP,
    chatter: s.lanes.length * C.CHATTER_LANE + pickets * C.CHATTER_PICKET,
  }
}

export function presenceScale(s: GameState, online: number): number {
  void s
  return C.PRESENCE_BASE + C.PRESENCE_PER_PLAYER * Math.min(online, C.PRESENCE_CAP)
}

/** Footprint-driven, never wall-clock: heat accrues from what you built and shouted. */
export function tickHeat(s: GameState, dt: number, online: number) {
  if (s.weigh.phase === 'transit') return
  const rates = emissionRates(s)
  const p = presenceScale(s, online)
  const wealth = wealthOf(s)
  const scrap = s.modules.length + 1.5 * s.claims.length + s.lanes.length

  s.factions.combine.heat += dt * p * (C.HEAT_COMBINE_WAKE * rates.wake + C.HEAT_COMBINE_WEALTH * wealth * 0.1)
  s.factions.breakers.heat += dt * p * C.HEAT_BREAKERS_SCRAP * scrap * 0.1
  s.factions.hush.heat += dt * p * (C.HEAT_HUSH_GLARE * rates.glare + C.HEAT_HUSH_CHATTER * rates.chatter)
}

export function tierOf(heat: number): 0 | 1 | 2 | 3 {
  if (heat >= C.HEAT_T3) return 3
  if (heat >= C.HEAT_T2) return 2
  if (heat >= C.HEAT_T1) return 1
  return 0
}
