import { describe, expect, it } from 'vitest'
import { createGame, serialize, deserialize, applyCommand, tick, weighCost, C } from './index'
import { anchorfeedYield } from './sim/economy'
import { tierOf } from './sim/emissions'
import { computeThrive } from './sim/station'
import { addStock, stockCaps } from './util'
import { GameState, PlayerShip } from './types'

function game(seed = 'test-seed'): GameState {
  const s = createGame(seed)
  addPlayer(s, 'p1')
  return s
}

function addPlayer(s: GameState, id: string) {
  const p: PlayerShip = {
    id, name: id, x: s.station.x, y: s.station.y + 40,
    hull: C.SHIP_HP, hold: {}, downUntil: 0, thrusting: false, firing: false, miningBody: -1,
    lastStateT: 0,
  }
  s.players[id] = p
}

function run(s: GameState, seconds: number, online = 1) {
  const steps = Math.round(seconds / C.TICK)
  for (let i = 0; i < steps; i++) tick(s, C.TICK, online)
}

describe('worldgen', () => {
  it('is deterministic per seed', () => {
    expect(serialize(createGame('alpha'))).toEqual(serialize(createGame('alpha')))
  })
  it('differs across seeds', () => {
    expect(serialize(createGame('alpha'))).not.toEqual(serialize(createGame('beta')))
  })
  it('always deals bodies, shoals and three beacons', () => {
    const s = createGame('gamma')
    expect(s.bodies.length).toBeGreaterThan(5)
    expect(s.shoals.length).toBeGreaterThanOrEqual(1)
    expect(s.beacons.length).toBe(3)
    expect(s.beacons.every(b => !b.revealed)).toBe(true)
  })
})

describe('the taper (steelman #1: a horizon wealth cannot erase)', () => {
  it('anchorfeed yield declines monotonically with occupied time', () => {
    const s = game()
    const y0 = anchorfeedYield(s)
    s.tLeg = 1000
    const y1 = anchorfeedYield(s)
    s.tLeg = 3000
    const y2 = anchorfeedYield(s)
    expect(y1).toBeLessThan(y0)
    expect(y2).toBeLessThan(y1)
  })
  it('no command can raise anchorfeed income — it is moor-bound', () => {
    const s = game()
    s.stocks.ferrite = 9999
    s.stocks.isotopes = 9999
    s.stocks.ice = 9999
    s.tLeg = 20000 // mooring long dead
    const yieldDead = anchorfeedYield(s)
    expect(yieldDead).toBeLessThan(0.02)
    // build everything money can buy; the vein does not care
    applyCommand(s, 'p1', { c: 'build', kind: 'reactor', gx: 5, gy: 4 })
    applyCommand(s, 'p1', { c: 'build', kind: 'tank', gx: 5, gy: 6 })
    expect(anchorfeedYield(s)).toBeLessThanOrEqual(yieldDead)
  })
  it('a starved city sheds crew but never dies (bounded loss)', () => {
    const s = game()
    s.crew.push({ id: 999, name: 'Vess', role: 'idle' })
    s.stocks.anchorfeed = 0
    s.mooringA0 = 0 // vein dead
    run(s, C.STARVE_CREW_LEAVE_SECS + 120)
    expect(s.crew.length).toBe(0)
    expect(s.modules.some(m => m.kind === 'core')).toBe(true) // the city endures
  })
})

describe('emissions and faction heat', () => {
  it('heat accrues from footprint and respects the arrival grace', () => {
    const s = game()
    const h0 = s.factions.breakers.heat
    run(s, 60)
    expect(s.factions.breakers.heat).toBeGreaterThan(h0)
    expect(s.npcs.length).toBe(0) // still inside LEG_GRACE
  })
  it('one encounter per faction at a time, spawned past tier 1', () => {
    const s = game()
    s.tLeg = C.LEG_GRACE + 1
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 7201, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 40 })
    s.factions.breakers.heat = C.HEAT_T2 + 10
    run(s, 2)
    const breakers = s.npcs.filter(n => n.faction === 'breakers')
    expect(breakers.length).toBeGreaterThan(0)
    const count = breakers.length
    run(s, 5)
    // no double-spawn while the first encounter is alive
    expect(s.npcs.filter(n => n.faction === 'breakers').length).toBeLessThanOrEqual(count)
  })
  it('combine posts a toll on the best lane and payToll (at the gate) clears it', () => {
    const s = game()
    s.tLeg = C.LEG_GRACE + 1
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 7001, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 30 })
    s.lanes.push({ id: 7002, claimId: 7001, picket: false, damped: false, tithe: 0 })
    s.factions.combine.heat = C.HEAT_T1 + 20
    run(s, 2)
    const lane = s.lanes[0]
    expect(lane.tithe).toBeGreaterThan(0)
    const gate = s.npcs.find(n => n.kind === 'tollgate')!
    s.stocks.isotopes = 50
    // parley requires flying to the gate
    expect(applyCommand(s, 'p1', { c: 'payToll', npcId: gate.id }).ok).toBe(false)
    s.players['p1'].x = gate.x
    s.players['p1'].y = gate.y
    const res = applyCommand(s, 'p1', { c: 'payToll', npcId: gate.id })
    expect(res.ok).toBe(true)
    expect(lane.tithe).toBe(0)
    expect(s.npcs.some(n => n.kind === 'tollgate')).toBe(false)
  })

  it('automated defenses never burn a toll gate — belligerence is a player choice', () => {
    const s = game()
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 7101, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 10 })
    s.lanes.push({ id: 7102, claimId: 7101, picket: true, damped: false, tithe: C.TOLL_T1 })
    const midX = (body.x + s.station.x) / 2
    const midY = (body.y + s.station.y) / 2
    s.npcs.push({
      id: 7103, kind: 'tollgate', faction: 'combine', x: midX, y: midY,
      hp: 120, maxHp: 120, targetBody: -1, laneId: 7102, stolen: 0, leaving: false,
    })
    run(s, 30)
    const gate = s.npcs.find(n => n.kind === 'tollgate')
    expect(gate).toBeDefined()
    expect(gate!.hp).toBe(120)
    expect(s.factions.combine.belligerence).toBe(0)
  })
  it('tier thresholds are ordered', () => {
    expect(tierOf(C.HEAT_T1 - 1)).toBe(0)
    expect(tierOf(C.HEAT_T1)).toBe(1)
    expect(tierOf(C.HEAT_T2)).toBe(2)
    expect(tierOf(C.HEAT_T3)).toBe(3)
  })
})

describe('the Weigh (steelman #2: paid forward, never sleepable)', () => {
  function readyToWeigh(s: GameState) {
    s.stocks.burnstock = 2000
    const beacon = s.beacons[0]
    beacon.revealed = true
    return beacon
  }

  it('requires a surveyed destination and a funded reserve', () => {
    const s = game()
    expect(applyCommand(s, 'p1', { c: 'weigh', optionId: s.beacons[0].id }).ok).toBe(false)
    s.beacons[0].revealed = true
    s.stocks.burnstock = 0
    expect(applyCommand(s, 'p1', { c: 'weigh', optionId: s.beacons[0].id }).ok).toBe(false)
  })

  it('runs the full cycle: sacrifice, escort, arrival payoff', () => {
    const s = game()
    const beacon = readyToWeigh(s)
    // field infrastructure that will be left behind
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 8001, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 10 })
    s.lanes.push({ id: 8002, claimId: 8001, picket: true, damped: false, tithe: 0 })
    s.factions.hush.heat = 300
    const modulesBefore = s.modules.length
    const oldBodies = serialize(s).length

    expect(applyCommand(s, 'p1', { c: 'weigh', optionId: beacon.id }).ok).toBe(true)
    expect(s.weigh.phase).toBe('countdown')
    run(s, C.WEIGH_COUNTDOWN + 1)
    expect(s.weigh.phase).toBe('transit')
    expect(s.claims.length).toBe(0)           // left behind
    expect(s.lanes.length).toBe(0)
    expect(s.npcs.length).toBeGreaterThan(0)  // the transit escort is real
    run(s, C.WEIGH_TRANSIT + 1)
    expect(s.weigh.phase).toBe('moored')
    expect(s.leg).toBe(2)
    expect(s.modules.length).toBe(modulesBefore)      // the city survives
    expect(s.spikeUntil).toBeGreaterThan(s.t)         // virgin-yield spike
    expect(s.factions.hush.heat).toBeLessThan(300 * C.HEAT_WEIGH_MULT + 1)
    expect(s.mooringA0).toBe(s.beacons.length ? s.mooringA0 : s.mooringA0) // sanity
    expect(serialize(s).length).not.toBe(oldBodies)   // a genuinely new leg
  })

  it('countdown is cancelable (asynchronous consent)', () => {
    const s = game()
    const beacon = readyToWeigh(s)
    applyCommand(s, 'p1', { c: 'weigh', optionId: beacon.id })
    expect(applyCommand(s, 'p1', { c: 'cancelWeigh' }).ok).toBe(true)
    expect(s.weigh.phase).toBe('moored')
  })
})

describe('thrive (beauty pays rent, composable, no template)', () => {
  it('an exposed gallery beats a buried one', () => {
    const s = game()
    s.modules.push({ kind: 'gallery', gx: 5, gy: 3, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    const exposed = computeThrive(s)
    // bury it in tanks
    for (const [gx, gy] of [[4, 3], [6, 3], [5, 2]] as const) {
      s.modules.push({ kind: 'tank', gx, gy, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    }
    expect(computeThrive(s)).toBeLessThan(exposed)
  })
  it('berths like green neighbours and hate noisy ones', () => {
    const s = game()
    s.modules.push({ kind: 'berth', gx: 5, gy: 7, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    const alone = computeThrive(s)
    s.modules.push({ kind: 'hydro', gx: 4, gy: 7, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    const green = computeThrive(s)
    expect(green).toBeGreaterThan(alone)
    s.modules.push({ kind: 'refinery', gx: 6, gy: 7, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    expect(computeThrive(s)).toBeLessThan(green)
  })
})

describe('command validation (price everything)', () => {
  it('rejects unaffordable builds', () => {
    const s = game()
    s.stocks.ferrite = 0
    expect(applyCommand(s, 'p1', { c: 'build', kind: 'gallery', gx: 5, gy: 4 }).ok).toBe(false)
  })
  it('rejects detached placements', () => {
    const s = game()
    s.stocks.ferrite = 999
    expect(applyCommand(s, 'p1', { c: 'build', kind: 'gallery', gx: 0, gy: 0 }).ok).toBe(false)
  })
  it('field infrastructure needs a yard online', () => {
    const s = game()
    s.stocks.ferrite = 999
    const body = s.bodies.find(b => b.richness > 0)!
    const p = s.players['p1']
    p.x = body.x; p.y = body.y
    expect(applyCommand(s, 'p1', { c: 'rig', bodyId: body.id }).ok).toBe(false)
    s.modules.push({ kind: 'yard', gx: 5, gy: 6, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    expect(applyCommand(s, 'p1', { c: 'rig', bodyId: body.id }).ok).toBe(true)
  })
  it('never rigs the mooring body — the city drinks from it', () => {
    const s = game()
    s.stocks.ferrite = 999
    s.modules.push({ kind: 'yard', gx: 5, gy: 6, hp: C.MODULE_HP, online: true, markedUntil: 0 })
    expect(applyCommand(s, 'p1', { c: 'rig', bodyId: s.mooringBodyId }).ok).toBe(false)
  })
})

describe('command hardening (the door validates everything)', () => {
  it('rejects non-finite ship state outright', () => {
    const s = game()
    const before = { x: s.players['p1'].x, y: s.players['p1'].y }
    expect(applyCommand(s, 'p1', { c: 'state', x: NaN, y: NaN, thrusting: false, firing: false, miningBody: -1 }).ok).toBe(false)
    expect(s.players['p1'].x).toBe(before.x)
    expect(s.players['p1'].y).toBe(before.y)
  })
  it('clamps displacement — no client can teleport', () => {
    const s = game()
    const p = s.players['p1']
    const start = { x: p.x, y: p.y }
    applyCommand(s, 'p1', { c: 'state', x: p.x + 2000, y: p.y, thrusting: true, firing: false, miningBody: -1 })
    expect(p.x - start.x).toBeLessThan(100)
  })
  it('hull work requires being at the city', () => {
    const s = game()
    s.stocks.ferrite = 999
    s.players['p1'].x = 10
    s.players['p1'].y = 10
    expect(applyCommand(s, 'p1', { c: 'build', kind: 'gallery', gx: 5, gy: 4 }).ok).toBe(false)
    expect(applyCommand(s, 'p1', { c: 'demolish', gx: 6, gy: 5 }).ok).toBe(false)
  })
})

describe('economy conservation & the move fund', () => {
  it('burnstock is never capped away — the reserve can always cover the Weigh', () => {
    const s = game()
    addStock(s, 'burnstock', 5000)
    expect(s.stocks.burnstock).toBeGreaterThanOrEqual(5000)
    expect(s.stocks.burnstock).toBeGreaterThan(weighCost(s))
  })
  it('full stores back-pressure the lane instead of vaporizing cargo', () => {
    const s = game()
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 9001, bodyId: body.id, hp: C.RIG_HP, online: false, siloRes: body.res, silo: 50 })
    s.lanes.push({ id: 9002, claimId: 9001, picket: false, damped: false, tithe: 0 })
    s.stocks[body.res] = stockCaps(s)[body.res]  // destination full
    const before = s.claims[0].silo
    run(s, 10)
    expect(s.claims[0].silo).toBeCloseTo(before, 1)  // nothing was destroyed in transit
  })
  it('transfer leaves overflow in the hold when stores are full', () => {
    const s = game()
    const p = s.players['p1']
    s.stocks.ferrite = stockCaps(s).ferrite - 5
    p.hold = { ferrite: 20 }
    applyCommand(s, 'p1', { c: 'transfer' })
    expect(s.stocks.ferrite).toBeCloseTo(stockCaps(s).ferrite, 5)
    expect(p.hold.ferrite ?? 0).toBeCloseTo(15, 5)
  })
})

describe('worldgen guarantees', () => {
  it('every resource exists on every leg — denial is scarcity, never a softlock', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const s = createGame(seed)
      for (const res of ['ice', 'ferrite', 'isotopes'] as const) {
        expect(s.bodies.some(b => b.res === res && b.richness > 0)).toBe(true)
      }
    }
  })
})

describe('serialization (host handoff safety)', () => {
  it('round-trips exactly', () => {
    const s = game()
    run(s, 30)
    const raw = serialize(s)
    const back = deserialize(raw)!
    expect(serialize(back)).toEqual(raw)
  })
  it('round-trips a battle-worn state exactly', () => {
    const s = game()
    s.tLeg = C.LEG_GRACE + 1
    const body = s.bodies.find(b => b.richness > 0)!
    s.claims.push({ id: 6001, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 40 })
    s.lanes.push({ id: 6002, claimId: 6001, picket: true, damped: true, tithe: 0.15 })
    s.factions.breakers.heat = C.HEAT_T2 + 5
    s.factions.hush.heat = C.HEAT_T1 + 5
    run(s, 120)
    const raw = serialize(s)
    const back = deserialize(raw)!
    expect(serialize(back)).toEqual(raw)
  })
  it('rejects malformed snapshots instead of bricking the sim', () => {
    expect(deserialize('not json')).toBeNull()
    expect(deserialize('{"v":1,"s":{"t":1}}')).toBeNull()
    expect(deserialize(JSON.stringify({ v: 99, s: {} }))).toBeNull()
    const s = game()
    const evil = JSON.parse(serialize(s))
    evil.s.stocks.ferrite = 'a lot'
    expect(deserialize(JSON.stringify(evil))).toBeNull()
  })
})
