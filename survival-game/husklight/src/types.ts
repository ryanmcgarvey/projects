export const TILE = { SPACE: 0, FLOOR: 1, WALL: 2, DOOR: 3 } as const

export type RoomType =
  | 'reactor' | 'cryo' | 'corridor' | 'hydro' | 'storage'
  | 'workshop' | 'quarters' | 'vault' | 'void'

export interface RoomStatic {
  id: number
  name: string
  type: RoomType
  x: number; y: number; w: number; h: number
  draw: number                          // watts while powered
  breaker: { x: number; y: number } | null
  pods: number                          // cryo pod count (0 for non-cryo)
}

export interface World {
  seed: number
  w: number; h: number
  tiles: Uint8Array
  roomOf: Int16Array                    // room id per tile, -1 = none
  rooms: RoomStatic[]
  shedOrder: number[]                   // room ids, first = first to brown out
  spawn: { x: number; y: number }
  console: { x: number; y: number }
  depot: { x: number; y: number }
}

export type ItemKind = 'plate' | 'sealant' | 'lithium'
export interface ItemEnt { id: number; kind: ItemKind; n: number; x: number; y: number }
export interface Breach { id: number; room: number; x: number; y: number }

export interface Drone {
  id: number; x: number; y: number
  state: 'dormant' | 'active'
  path: { x: number; y: number }[]
  target: number                        // breach id, -1 = none/docking
}

export interface Inv { plate: number; sealant: number; lithium: number }

export interface PlayerDyn {
  id: string; name: string
  x: number; y: number
  o2: number; hp: number
  inv: Inv
  downUntil: number                     // sim time; 0 = up
}

export interface RoomDyn {
  on: boolean                           // breaker position
  powered: boolean                      // actually receiving watts this tick
  o2: number                            // 0..1
  cond: number                          // 0..1 condition; low = breach-prone
  grace: number                         // cryo thermal buffer seconds remaining
  sleepers: number                      // cryo only
  deathAcc: number
}

export interface LogEntry { t: number; msg: string; kind: 'info' | 'good' | 'warn' | 'bad' }

export interface GameState {
  t: number                             // occupied sim-seconds (world only advances while inhabited)
  rooms: RoomDyn[]
  items: ItemEnt[]
  breaches: Breach[]
  drones: Drone[]
  players: Record<string, PlayerDyn>
  reactor: { out: number; max: number }
  deaths: number
  depotSealant: number
  nextBreachAt: number
  log: LogEntry[]
  nextId: number
}

export type ActMsg =
  | { k: 'take'; id: number }
  | { k: 'patch'; id: number }
  | { k: 'breaker'; id: number }
  | { k: 'console' }
  | { k: 'drone'; id: number }
  | { k: 'depot' }
  | { k: 'lith' }

export interface HelloMsg { name: string }
export interface WorldMsg { seed: number; state: GameState }
export interface PosMsg { x: number; y: number }

export function totalSleepers(s: GameState): number {
  let n = 0
  for (const r of s.rooms) n += r.sleepers
  return n
}
