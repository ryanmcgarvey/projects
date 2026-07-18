import { GameState } from '../types'
import { tickPower, tickCrew } from './station'
import { tickEconomy } from './economy'
import { tickHeat } from './emissions'
import { tickFactions } from './factions'
import { tickCombat } from './combat'
import { tickWeigh } from './weigh'

/**
 * One sim step. Runs ONLY while the world is inhabited (the host's loop calls it),
 * which is the offline contract: absence is never punished.
 * `online` = players currently aboard; encounter intensity scales to it,
 * heat accrual scales to footprint.
 */
export function tick(s: GameState, dt: number, online: number) {
  s.t += dt
  if (s.weigh.phase !== 'transit') s.tLeg += dt
  s.daysFree += dt / 600

  tickPower(s)
  tickEconomy(s, dt)
  tickCrew(s, dt)
  tickHeat(s, dt, online)
  tickFactions(s, dt)
  tickCombat(s, dt)
  tickWeigh(s, online)
}
