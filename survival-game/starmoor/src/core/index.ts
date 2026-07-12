// Public API of the game core. Everything outside src/core talks to the game
// exclusively through these exports — that boundary is the engine-swap guarantee.
export { createGame } from './worldgen'
export { tick } from './sim/index'
export { applyCommand } from './commands'
export { chartTable, factionsView, emissionsView, renderModel } from './selectors'
export type { ChartTable, FactionView, RenderModel, Emissions } from './selectors'
export { weighCost } from './sim/weigh'
export { holdTotal } from './sim/combat'
export { C, MODULES } from './constants'
export { hashStr } from './rng'
export { ensurePlayer, removePlayer } from './util'
export * from './types'

import { GameState } from './types'

const SAVE_VERSION = 1

export function serialize(s: GameState): string {
  return JSON.stringify({ v: SAVE_VERSION, s })
}

/**
 * Parse + structurally validate + migrate. Both saves AND network snapshots come
 * through here — a malformed or hostile payload returns null instead of bricking
 * the sim. New optional fields get defaults so old payloads stay loadable.
 */
export function deserialize(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as { v: number; s: GameState }
    if (data.v !== SAVE_VERSION) return null
    const s = data.s
    if (!validShape(s)) return null
    // migrations / defaults for fields added after first release
    s.lowThriveSince ??= 0
    for (const p of Object.values(s.players)) p.lastStateT ??= 0
    return s
  } catch {
    return null
  }
}

function validShape(s: GameState): boolean {
  if (typeof s !== 'object' || s === null) return false
  if (!Number.isFinite(s.t) || !Number.isFinite(s.tLeg) || !Number.isFinite(s.leg)) return false
  if (!Number.isFinite(s.rngState) || !Number.isFinite(s.nextId)) return false
  for (const key of ['bodies', 'shoals', 'beacons', 'modules', 'claims', 'lanes', 'npcs', 'pickups', 'crew', 'log', 'fx'] as const) {
    if (!Array.isArray(s[key])) return false
  }
  if (typeof s.players !== 'object' || s.players === null || Array.isArray(s.players)) return false
  if (typeof s.stocks !== 'object' || s.stocks === null) return false
  for (const r of ['ice', 'ferrite', 'isotopes', 'anchorfeed', 'burnstock'] as const) {
    if (!Number.isFinite(s.stocks[r])) return false
  }
  if (typeof s.factions !== 'object' || s.factions === null) return false
  for (const f of ['combine', 'breakers', 'hush'] as const) {
    if (!s.factions[f] || !Number.isFinite(s.factions[f].heat)) return false
  }
  if (!s.weigh || !['moored', 'countdown', 'transit'].includes(s.weigh.phase)) return false
  if (!s.field || !Number.isFinite(s.field.w) || !Number.isFinite(s.field.h)) return false
  for (const p of Object.values(s.players)) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hull)) return false
  }
  return true
}
