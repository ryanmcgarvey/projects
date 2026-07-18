import { C } from './constants'
import { GameState, Module } from './types'

export function inGrid(gx: number, gy: number): boolean {
  return gx >= 0 && gy >= 0 && gx < C.GRID && gy < C.GRID
}

export function moduleAt(s: GameState, gx: number, gy: number): Module | undefined {
  return s.modules.find(m => m.gx === gx && m.gy === gy)
}

export function moduleWorld(s: GameState, m: Module): { x: number; y: number } {
  return {
    x: s.station.x + (m.gx - C.GRID_CENTER) * C.CELL,
    y: s.station.y + (m.gy - C.GRID_CENTER) * C.CELL,
  }
}

export function neighbors(s: GameState, gx: number, gy: number): Module[] {
  const out: Module[] = []
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const m = moduleAt(s, gx + dx, gy + dy)
    if (m) out.push(m)
  }
  return out
}

export function exposedEdges(s: GameState, m: Module): number {
  let n = 0
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (!moduleAt(s, m.gx + dx, m.gy + dy)) n++
  }
  return n
}

/** Outermost online module — what sieges chew on first. */
export function outermostModule(s: GameState): Module | undefined {
  const online = s.modules.filter(m => m.hp > 0 && m.kind !== 'core')
  online.sort((a, b) =>
    (Math.abs(b.gx - C.GRID_CENTER) + Math.abs(b.gy - C.GRID_CENTER)) -
    (Math.abs(a.gx - C.GRID_CENTER) + Math.abs(a.gy - C.GRID_CENTER)))
  return online[0]
}
