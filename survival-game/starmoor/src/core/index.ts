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

export function deserialize(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as { v: number; s: GameState }
    if (data.v !== SAVE_VERSION) return null
    return data.s
  } catch {
    return null
  }
}
