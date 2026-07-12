import { C } from './constants'
import { hashStr, rand, randInt, randRange, pick } from './rng'
import { Body, BodyKind, GameState, MineRes, MooringOption, Module } from './types'

const DENIALS: MineRes[] = ['ice', 'ferrite', 'isotopes']
const KIND_FOR: Record<MineRes, BodyKind> = { ice: 'comet', ferrite: 'ferrite', isotopes: 'hulk' }

export function createGame(seedStr: string): GameState {
  const seed = hashStr(seedStr)
  const s: GameState = {
    seed,
    rngState: seed ^ 0x9e3779b9,
    leg: 1,
    t: 0,
    tLeg: 0,
    field: { w: C.FIELD_W, h: C.FIELD_H },
    bodies: [], shoals: [], beacons: [],
    mooringBodyId: -1,
    mooringA0: 2.2, mooringTau: 2600,
    station: { x: C.FIELD_W / 2, y: C.FIELD_H / 2 },
    modules: [],
    stocks: { ice: 25, ferrite: 70, isotopes: 12, anchorfeed: 130, burnstock: 0 },
    dark: false,
    crew: [], recruitAt: 0, leaveAt: 0, starvedSince: 0, thrive: 0,
    claims: [], lanes: [], npcs: [], pickups: [],
    players: {},
    factions: {
      combine: { heat: 0, gapUntil: 0, belligerence: 0 },
      breakers: { heat: 0, gapUntil: 0, belligerence: 0 },
      hush: { heat: 0, gapUntil: 0, belligerence: 0 },
    },
    weigh: { phase: 'moored', endsAt: 0, optionId: -1 },
    spikeUntil: 0,
    daysFree: 0,
    log: [],
    fx: [],
    nextId: 1,
  }
  // starter hull: core + refinery + tank, enough to breathe and refine, nothing more
  const starter: [Module['kind'], number, number][] = [
    ['core', C.GRID_CENTER, C.GRID_CENTER],
    ['refinery', C.GRID_CENTER + 1, C.GRID_CENTER],
    ['tank', C.GRID_CENTER - 1, C.GRID_CENTER],
  ]
  for (const [kind, gx, gy] of starter) {
    s.modules.push({ kind, gx, gy, hp: C.MODULE_HP, online: true, markedUntil: 0 })
  }
  generateLeg(s, null)
  s.log.push({ t: 0, msg: 'The freeport drops anchor. The mooring will not last forever.', kind: 'info' })
  return s
}

/**
 * Deal a new leg around the station. Deterministic given rngState.
 * `option` carries the destination's promise (a0/tau/denial); null = first leg.
 */
export function generateLeg(s: GameState, option: MooringOption | null) {
  s.bodies = []
  s.shoals = []
  s.beacons = []
  s.npcs = []
  s.pickups = []
  s.claims = []
  s.lanes = []
  s.tLeg = 0

  const denial: MineRes = option ? (option.denial as MineRes) : pick(s, DENIALS)
  if (option) { s.mooringA0 = option.a0; s.mooringTau = option.tau }

  const cx = s.station.x, cy = s.station.y

  // mooring body: what the city drinks from. Not mineable — it feeds the anchorfeed line only.
  const moor: Body = { id: s.nextId++, kind: 'comet', x: cx, y: cy - 90, r: 34, res: 'ice', richness: 0 }
  s.bodies.push(moor)
  s.mooringBodyId = moor.id

  // resource bodies in loose clusters; the denial resource is scarce and poor
  const clusterCount = randInt(s, 2, 3)
  const clusters: { x: number; y: number }[] = []
  for (let i = 0; i < clusterCount; i++) {
    clusters.push({
      x: randRange(s, 300, s.field.w - 300),
      y: randRange(s, 220, s.field.h - 220),
    })
  }
  const total = randInt(s, 14, 20)
  for (let i = 0; i < total; i++) {
    let res: MineRes = pick(s, ['ice', 'ice', 'ferrite', 'ferrite', 'ferrite', 'isotopes'])
    if (res === denial && rand(s) < 0.7) res = res === 'ferrite' ? 'ice' : 'ferrite'
    const c = pick(s, clusters)
    const x = c.x + randRange(s, -220, 220)
    const y = c.y + randRange(s, -160, 160)
    if (Math.hypot(x - cx, y - cy) < 240) continue
    const richness = (res === denial ? randRange(s, 0.3, 0.6) : randRange(s, 0.8, 1.6))
    s.bodies.push({
      id: s.nextId++, kind: KIND_FOR[res],
      x: Math.max(60, Math.min(s.field.w - 60, x)),
      y: Math.max(60, Math.min(s.field.h - 60, y)),
      r: randRange(s, 14, 30), res, richness,
    })
  }

  // dust shoals: quiet country for lanes
  const shoalN = option ? Math.max(1, Math.min(4, option.shoals)) : randInt(s, 2, 4)
  for (let i = 0; i < shoalN; i++) {
    s.shoals.push({
      x: randRange(s, 300, s.field.w - 300),
      y: randRange(s, 200, s.field.h - 200),
      r: randRange(s, 160, 320),
    })
  }

  // survey beacons: prospecting targets at the edges — each hides a mooring option
  const edges: [number, number][] = [
    [randRange(s, 200, s.field.w - 200), 90],
    [110, randRange(s, 200, s.field.h - 200)],
    [s.field.w - 110, randRange(s, 200, s.field.h - 200)],
  ]
  for (const [bx, by] of edges) {
    const oDenial = pick(s, DENIALS)
    const a0 = randRange(s, 1.6, 2.7)
    const tau = randRange(s, 1700, 3400)
    s.beacons.push({
      id: s.nextId++, x: bx, y: by, revealed: false,
      a0: Math.round(a0 * 100) / 100,
      tau: Math.round(tau),
      shoals: randInt(s, 1, 4),
      mix: `${oDenial}-starved, ${pick(s, DENIALS.filter(d => d !== oDenial))}-rich`,
      denial: oDenial,
    })
  }
}
