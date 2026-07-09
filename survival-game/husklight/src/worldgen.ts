import { TILE, World, RoomStatic, RoomType, GameState, ItemEnt, Drone, RoomDyn } from './types'
import { mulberry32 } from './prng'

const W = 84
const H = 52
const SLEEPERS_PER_POD = 25

interface Slot { x: number; y: number; w: number; h: number; door: { x: number; y: number } }

// Room slots hang off the main concourse (rows 25-26). Doors sit in the 1-tile
// wall gap between slot and concourse. Vertical service corridors at x 20/41/62.
const NORTH: Slot[] = [
  { x: 7,  y: 13, w: 11, h: 11, door: { x: 12, y: 24 } },
  { x: 23, y: 13, w: 9,  h: 11, door: { x: 27, y: 24 } },
  { x: 33, y: 13, w: 7,  h: 11, door: { x: 36, y: 24 } },
  { x: 44, y: 13, w: 9,  h: 11, door: { x: 48, y: 24 } },
  { x: 54, y: 13, w: 7,  h: 11, door: { x: 57, y: 24 } },
  { x: 65, y: 13, w: 13, h: 11, door: { x: 70, y: 24 } },
]
const SOUTH: Slot[] = [
  { x: 7,  y: 28, w: 11, h: 11, door: { x: 12, y: 27 } },
  { x: 23, y: 28, w: 9,  h: 13, door: { x: 27, y: 27 } },
  { x: 33, y: 28, w: 7,  h: 11, door: { x: 36, y: 27 } },
  { x: 44, y: 28, w: 9,  h: 13, door: { x: 48, y: 27 } },
  { x: 54, y: 28, w: 7,  h: 11, door: { x: 57, y: 27 } },
  { x: 65, y: 28, w: 13, h: 13, door: { x: 70, y: 27 } },
]

const DRAWS: Record<RoomType, number> = {
  reactor: 0, cryo: 12, corridor: 2, hydro: 6, storage: 3,
  workshop: 5, quarters: 4, vault: 5, void: 0,
}

const NAMES: Record<RoomType, string[]> = {
  reactor: ['Reactor Spine'],
  cryo: ['Cryo Vault AFT', 'Cryo Vault DORSAL', 'Cryo Vault KEEL'],
  corridor: ['Main Concourse', 'Transverse Alpha', 'Transverse Beta', 'Transverse Gamma'],
  hydro: ['Hydroponic Ring'],
  storage: ['Storage Bay 3', 'Storage Bay 7'],
  workshop: ['Fitter’s Workshop'],
  quarters: ['Crew Quarters B', 'Crew Quarters D'],
  vault: ['Signal Vault'],
  void: ['Jettison Scar'],
}

export function generateWorld(seed: number): World {
  const rnd = mulberry32(seed)
  const tiles = new Uint8Array(W * H) // SPACE
  const roomOf = new Int16Array(W * H).fill(-1)
  const rooms: RoomStatic[] = []
  const nameCount: Partial<Record<RoomType, number>> = {}

  const idx = (x: number, y: number) => y * W + x

  const carveRect = (x: number, y: number, w: number, h: number, id: number) => {
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) {
        tiles[idx(tx, ty)] = TILE.FLOOR
        roomOf[idx(tx, ty)] = id
      }
  }

  const addRoom = (type: RoomType, x: number, y: number, w: number, h: number): RoomStatic => {
    const i = (nameCount[type] = (nameCount[type] ?? 0))
    nameCount[type]!++
    const names = NAMES[type]
    const r: RoomStatic = {
      id: rooms.length, type, x, y, w, h,
      name: names[Math.min(i, names.length - 1)],
      draw: DRAWS[type], breaker: null, pods: 0,
    }
    rooms.push(r)
    carveRect(x, y, w, h, r.id)
    return r
  }

  // --- corridors (they are rooms too: they draw watts, hold air) ---
  const main = addRoom('corridor', 6, 25, 72, 2)
  addRoom('corridor', 20, 9, 2, 34)
  addRoom('corridor', 41, 9, 2, 34)
  addRoom('corridor', 62, 9, 2, 34)
  // main concourse claims the crossing tiles
  for (let tx = 6; tx < 78; tx++) for (let ty = 25; ty < 27; ty++) roomOf[idx(tx, ty)] = main.id

  // --- assign types to slots (seeded) ---
  // reactor: fixed NW anchor. one cryo far east (N or S), one cryo mid, workshop,
  // hydro, vault, storage x2, quarters with the rest; one non-essential slot voided.
  const slots: (Slot & { side: 'n' | 's'; i: number })[] = []
  NORTH.forEach((s, i) => slots.push({ ...s, side: 'n', i }))
  SOUTH.forEach((s, i) => slots.push({ ...s, side: 's', i }))

  const take = (pred: (s: typeof slots[number]) => boolean): typeof slots[number] => {
    const cands = slots.filter(pred)
    const pick = cands[Math.floor(rnd() * cands.length)]
    slots.splice(slots.indexOf(pick), 1)
    return pick
  }

  const placed: { slot: Slot; type: RoomType }[] = []
  placed.push({ slot: take(s => s.i === 0 && s.side === 'n'), type: 'reactor' })
  placed.push({ slot: take(s => s.i === 5), type: 'cryo' })                 // far east bay
  placed.push({ slot: take(s => s.i >= 3 && s.i <= 4), type: 'cryo' })      // mid-east bay
  placed.push({ slot: take(s => s.i >= 1 && s.i <= 3), type: 'workshop' })
  placed.push({ slot: take(s => s.i >= 1 && s.i <= 4), type: 'hydro' })
  placed.push({ slot: take(() => true), type: 'vault' })
  placed.push({ slot: take(() => true), type: 'storage' })
  placed.push({ slot: take(() => true), type: 'storage' })
  placed.push({ slot: take(() => true), type: 'quarters' })
  placed.push({ slot: take(() => true), type: 'quarters' })
  // remaining 2 slots: one void scar (stays vacuum), one skipped entirely
  if (slots.length) {
    const scar = slots[Math.floor(rnd() * slots.length)]
    placed.push({ slot: scar, type: 'void' })
  }

  let spawn = { x: 40, y: 26 }
  let consoleTile = { x: 10, y: 18 }
  let depot = { x: 30, y: 18 }
  const droneSpots: { x: number; y: number }[] = []
  const items: ItemEnt[] = []
  let nextEnt = 1

  const dropItem = (kind: ItemEnt['kind'], n: number, x: number, y: number) =>
    items.push({ id: nextEnt++, kind, n, x: x + 0.5, y: y + 0.5 })

  const randTileIn = (r: RoomStatic) => ({
    x: r.x + 1 + Math.floor(rnd() * (r.w - 2)),
    y: r.y + 1 + Math.floor(rnd() * (r.h - 2)),
  })

  for (const { slot, type } of placed) {
    // jitter size a touch (keep door aligned)
    let { x, y, w, h } = slot
    if (type !== 'void' && rnd() < 0.5 && h > 8) { if (slot.door.y < y) h -= 1; else { y += 1; h -= 1 } }

    const r = addRoom(type, x, y, w, h)
    if (type === 'void') {
      // a room that was jettisoned: floor exists but exposed to vacuum, no door
      continue
    }
    // door + breaker just inside the door
    tiles[idx(slot.door.x, slot.door.y)] = TILE.DOOR
    roomOf[idx(slot.door.x, slot.door.y)] = r.id
    const inside = slot.door.y === y - 1 ? { x: slot.door.x, y } : { x: slot.door.x, y: y + h - 1 }
    r.breaker = { x: inside.x + 1 <= x + w - 1 ? inside.x + 1 : inside.x - 1, y: inside.y }

    switch (type) {
      case 'reactor':
        consoleTile = { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) }
        dropItem('plate', 3, x + 1, y + 1)
        break
      case 'cryo': {
        for (let py = y + 1; py < y + h - 1; py++)
          for (let px = x + 1; px < x + w - 1; px++)
            if ((px - x) % 2 === 1 && (py - y) % 2 === 1) r.pods++
        if (spawn.x === 40 && spawn.y === 26)
          spawn = { x: x + Math.floor(w / 2), y: slot.door.y === y - 1 ? y + 1 : y + h - 2 }
        break
      }
      case 'workshop': {
        depot = { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) }
        droneSpots.push(randTileIn(r))
        dropItem('plate', 2 + Math.floor(rnd() * 3), ...xy(randTileIn(r)))
        dropItem('sealant', 2, ...xy(randTileIn(r)))
        break
      }
      case 'storage': {
        dropItem('plate', 2 + Math.floor(rnd() * 4), ...xy(randTileIn(r)))
        dropItem('plate', 2 + Math.floor(rnd() * 3), ...xy(randTileIn(r)))
        dropItem('sealant', 2 + Math.floor(rnd() * 2), ...xy(randTileIn(r)))
        if (rnd() < 0.6) dropItem('sealant', 2, ...xy(randTileIn(r)))
        if (rnd() < 0.5) dropItem('lithium', 1, ...xy(randTileIn(r)))
        break
      }
      case 'quarters': {
        dropItem('lithium', 1 + Math.floor(rnd() * 2), ...xy(randTileIn(r)))
        dropItem('sealant', 1, ...xy(randTileIn(r)))
        if (rnd() < 0.5) droneSpots.push(randTileIn(r))
        break
      }
      case 'hydro': {
        dropItem('sealant', 2, ...xy(randTileIn(r)))
        dropItem('lithium', 1, ...xy(randTileIn(r)))
        break
      }
      case 'vault': {
        dropItem('plate', 5 + Math.floor(rnd() * 4), ...xy(randTileIn(r)))
        dropItem('lithium', 2, ...xy(randTileIn(r)))
        break
      }
    }
  }
  if (droneSpots.length < 2) droneSpots.push({ x: 41, y: 20 })

  // --- hull: wrap every floor/door in wall where it meets space ---
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (tiles[idx(x, y)] !== TILE.SPACE) continue
      let touch = false
      for (let dy = -1; dy <= 1 && !touch; dy++)
        for (let dx = -1; dx <= 1 && !touch; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const t = tiles[idx(nx, ny)]
          if (t === TILE.FLOOR || t === TILE.DOOR) touch = true
        }
      if (touch) tiles[idx(x, y)] = TILE.WALL
    }

  // --- shed order: on brownout, farthest non-critical rooms drop first ---
  const dist = bfsDist(tiles, W, H, consoleTile)
  const roomDist = rooms.map(r => {
    let d = Infinity
    for (let ty = r.y; ty < r.y + r.h; ty++)
      for (let tx = r.x; tx < r.x + r.w; tx++)
        d = Math.min(d, dist[ty * W + tx] ?? Infinity)
    return isFinite(d) ? d : 999
  })
  const shedOrder = rooms
    .filter(r => r.type !== 'reactor' && r.type !== 'void')
    .sort((a, b) => {
      const cls = (r: RoomStatic) => (r.type === 'cryo' ? 2 : r.type === 'corridor' ? 1 : 0)
      return cls(a) - cls(b) || roomDist[b.id] - roomDist[a.id]
    })
    .map(r => r.id)

  const world: World = {
    seed, w: W, h: H, tiles, roomOf, rooms, shedOrder,
    spawn: { x: spawn.x + 0.5, y: spawn.y + 0.5 },
    console: consoleTile, depot,
  }
  ;(world as unknown as { _initItems: ItemEnt[] })._initItems = items
  ;(world as unknown as { _droneSpots: { x: number; y: number }[] })._droneSpots = droneSpots
  ;(world as unknown as { _nextEnt: number })._nextEnt = nextEnt
  return world
}

function xy(p: { x: number; y: number }): [number, number] { return [p.x, p.y] }

function bfsDist(tiles: Uint8Array, w: number, h: number, from: { x: number; y: number }): Float64Array {
  const dist = new Float64Array(w * h).fill(Infinity)
  const q: number[] = []
  const start = from.y * w + from.x
  dist[start] = 0
  q.push(start)
  while (q.length) {
    const cur = q.shift()!
    const cx = cur % w, cy = Math.floor(cur / w)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const ni = ny * w + nx
      const t = tiles[ni]
      if (t !== TILE.FLOOR && t !== TILE.DOOR) continue
      if (dist[ni] > dist[cur] + 1) { dist[ni] = dist[cur] + 1; q.push(ni) }
    }
  }
  return dist
}

/** Fresh dynamic state for a just-generated world. Deterministic given the seed. */
export function initialState(world: World): GameState {
  const rnd = mulberry32(world.seed ^ 0x9e3779b9)
  const items = (world as unknown as { _initItems: ItemEnt[] })._initItems
  const droneSpots = (world as unknown as { _droneSpots: { x: number; y: number }[] })._droneSpots
  const nextEnt = (world as unknown as { _nextEnt: number })._nextEnt

  const rooms: RoomDyn[] = world.rooms.map(r => {
    const cond = r.type === 'corridor' ? 0.85 : 0.55 + rnd() * 0.4
    const on = r.type === 'void' ? false : cond > 0.62 || r.type === 'cryo' || r.type === 'reactor'
    return {
      on, powered: false,
      o2: r.type === 'void' ? 0 : on ? 0.85 + rnd() * 0.1 : 0.3 + rnd() * 0.15,
      cond, grace: 120,
      sleepers: r.pods * SLEEPERS_PER_POD,
      deathAcc: 0,
    }
  })

  const drones: Drone[] = droneSpots.slice(0, 2).map((p, i) => ({
    id: nextEnt + i, x: p.x + 0.5, y: p.y + 0.5, state: 'dormant', path: [], target: -1,
  }))

  return {
    t: 0, rooms, items: items.slice(), breaches: [], drones,
    players: {}, reactor: { out: 100, max: 100 },
    deaths: 0, depotSealant: 0, nextBreachAt: 45 + rnd() * 30,
    log: [{ t: 0, msg: 'Steward aboard. The Husk stirs.', kind: 'info' }],
    nextId: nextEnt + 8,
  }
}
