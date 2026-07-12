import { C } from '../constants'
import { moduleAt, moduleWorld, outermostModule } from '../grid'
import { FactionId, GameState, MineRes, Npc, PlayerShip } from '../types'
import { addLog, dist } from '../util'
import { encounterResolved, laneMidpoint } from './factions'
import { crewMult } from './station'

const NPC_SPEED: Record<string, number> = {
  skiff: C.SKIFF_SPEED, gunship: C.GUNSHIP_SPEED, hushwing: C.HUSHWING_SPEED, tollgate: 0,
}

export function tickCombat(s: GameState, dt: number) {
  const before: Record<FactionId, number> = { combine: 0, breakers: 0, hush: 0 }
  for (const n of s.npcs) before[n.faction]++

  for (const npc of s.npcs) stepNpc(s, npc, dt)

  // defenses: point-defense ring + lane pickets
  const gunsBoost = crewMult(s, 'guns')
  for (const m of s.modules) {
    if (m.kind !== 'pd' || !m.online) continue
    const at = moduleWorld(s, m)
    const target = nearestNpc(s, at.x, at.y, C.PD_RANGE)
    if (target) target.hp -= C.PD_DPS * gunsBoost * dt
  }
  for (const lane of s.lanes) {
    if (!lane.picket) continue
    const mid = laneMidpoint(s, lane)
    if (!mid) continue
    const target = nearestNpc(s, mid.x, mid.y, C.PICKET_RANGE)
    if (target) target.hp -= C.PICKET_DPS * dt
  }

  // player lasers
  for (const p of Object.values(s.players)) {
    if (p.downUntil > s.t || !p.firing) continue
    const target = nearestNpc(s, p.x, p.y, C.LASER_RANGE)
    if (target) target.hp -= C.LASER_DPS * dt
  }

  // deaths & departures
  const dead = s.npcs.filter(n => n.hp <= 0)
  const left = s.npcs.filter(n => n.leaving && atEdge(s, n))
  for (const n of dead) {
    s.fx.push({ kind: 'boom', x: n.x, y: n.y, until: s.t + 1.2 })
    if (n.kind === 'tollgate') {
      const lane = s.lanes.find(l => l.id === n.laneId)
      if (lane) lane.tithe = 0
      s.factions.combine.belligerence += 1
      s.factions.combine.heat += 40
      addLog(s, 'Toll gate destroyed. The Combine will remember the smoke.', 'warn')
    }
    if (n.stolen > 0) dropStolen(s, n)
  }
  if (dead.length || left.length) {
    s.npcs = s.npcs.filter(n => n.hp > 0 && !(n.leaving && atEdge(s, n)))
  }

  for (const fid of ['combine', 'breakers', 'hush'] as FactionId[]) {
    const now = s.npcs.filter(n => n.faction === fid).length
    if (before[fid] > 0 && now === 0) encounterResolved(s, fid)
  }

  tickPlayers(s, dt)
  s.fx = s.fx.filter(f => f.until > s.t)
}

function stepNpc(s: GameState, npc: Npc, dt: number) {
  const speed = NPC_SPEED[npc.kind]
  let goal: { x: number; y: number } | null = null

  if (npc.leaving) {
    goal = nearestEdge(s, npc)
  } else if (npc.kind === 'tollgate') {
    goal = null
  } else if (npc.kind === 'hushwing') {
    const m = moduleAt(s, Math.floor(npc.targetBody / 100), npc.targetBody % 100)
    if (!m || m.hp <= 0) { npc.leaving = true; return }
    const at = moduleWorld(s, m)
    goal = at
    if (dist(npc.x, npc.y, at.x, at.y) < 14) {
      m.hp = 0
      m.online = false
      s.fx.push({ kind: 'boom', x: at.x, y: at.y, until: s.t + 1.5 })
      addLog(s, `The Hush silenced your ${m.kind}.`, 'bad')
      s.factions.hush.heat *= 0.5
      npc.hp = -1 // consumed by the strike
      return
    }
  } else if (npc.targetBody === -2) {
    // station attack: chew the outermost module
    const m = outermostModule(s)
    const at = m ? moduleWorld(s, m) : s.station
    goal = at
    if (dist(npc.x, npc.y, at.x, at.y) < (npc.kind === 'gunship' ? C.GUNSHIP_RANGE : C.SKIFF_RANGE)) {
      goal = null
      if (m) {
        m.hp -= C.NPC_MODULE_DPS * dt
        if (m.hp <= 0) {
          m.online = false
          addLog(s, `${m.kind} torn offline by the Breakers.`, 'bad')
          s.fx.push({ kind: 'boom', x: at.x, y: at.y, until: s.t + 1.2 })
        }
      }
    }
  } else if (npc.kind === 'skiff') {
    const claim = s.claims.find(cl => cl.id === npc.targetBody)
    const body = claim && s.bodies.find(b => b.id === claim.bodyId)
    if (!claim || !body) { npc.targetBody = -2; return }
    goal = body
    if (dist(npc.x, npc.y, body.x, body.y) < C.SKIFF_RANGE) {
      goal = null
      if (claim.silo > 0 && npc.stolen < C.SKIFF_BAG) {
        const take = Math.min(claim.silo, C.SKIFF_STEAL * dt)
        claim.silo -= take
        npc.stolen += take
      } else if (npc.stolen >= C.SKIFF_BAG) {
        npc.leaving = true
      } else if (claim.hp > 0) {
        claim.hp -= C.NPC_MODULE_DPS * dt
        if (claim.hp <= 0) {
          claim.online = false
          addLog(s, 'A claim rig went dark under Breaker cutters.', 'bad')
          npc.leaving = true
        }
      }
    }
  } else if (npc.kind === 'gunship') {
    const gate = s.npcs.find(n => n.id === npc.targetBody)
    goal = gate ? { x: gate.x + 30, y: gate.y } : { x: s.station.x, y: s.station.y }
    if (goal && dist(npc.x, npc.y, goal.x, goal.y) < 40) goal = null
  }

  if (goal && speed > 0) {
    const d = dist(npc.x, npc.y, goal.x, goal.y)
    if (d > 1) {
      npc.x += ((goal.x - npc.x) / d) * speed * dt
      npc.y += ((goal.y - npc.y) / d) * speed * dt
    }
  }

  // shoot the nearest player in range
  if (npc.kind === 'skiff' || npc.kind === 'gunship') {
    const range = npc.kind === 'skiff' ? C.SKIFF_RANGE : C.GUNSHIP_RANGE
    const dps = npc.kind === 'skiff' ? C.SKIFF_DPS : C.GUNSHIP_DPS
    const p = nearestPlayer(s, npc.x, npc.y, range)
    if (p) p.hull -= dps * dt
  }
}

function tickPlayers(s: GameState, dt: number) {
  for (const p of Object.values(s.players)) {
    if (p.downUntil > s.t) continue

    // mining beam
    if (p.miningBody >= 0) {
      const body = s.bodies.find(b => b.id === p.miningBody)
      const total = holdTotal(p)
      if (body && body.richness > 0 && total < C.HOLD_CAP &&
          dist(p.x, p.y, body.x, body.y) < C.MINE_RANGE + body.r) {
        const take = Math.min(C.HOLD_CAP - total, C.MINE_RATE * body.richness * dt)
        p.hold[body.res] = (p.hold[body.res] ?? 0) + take
      }
    }

    // docked: hull regen
    if (dist(p.x, p.y, s.station.x, s.station.y) < C.DOCK_RANGE) {
      p.hull = Math.min(C.SHIP_HP, p.hull + C.HULL_REGEN_DOCKED * dt)
    }

    // float pickups
    for (const pk of s.pickups) {
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        for (const r of Object.keys(pk.hold) as MineRes[]) {
          const space = C.HOLD_CAP - holdTotal(p)
          const take = Math.min(space, pk.hold[r] ?? 0)
          p.hold[r] = (p.hold[r] ?? 0) + take
          pk.hold[r] = (pk.hold[r] ?? 0) - take
        }
      }
    }

    // down: tempo tax, never progress — drop the hold, wake at the dock
    if (p.hull <= 0) {
      if (holdTotal(p) > 0) {
        s.pickups.push({ id: s.nextId++, x: p.x, y: p.y, hold: { ...p.hold } })
      }
      p.hold = {}
      p.downUntil = s.t + C.RESPAWN_SECS
      p.x = s.station.x
      p.y = s.station.y + C.DOCK_RANGE * 0.5
      p.hull = 60
      addLog(s, `${p.name} ejected — pod recovered at the dock. The cargo is still out there.`, 'bad')
    }
  }
  s.pickups = s.pickups.filter(pk =>
    (Object.values(pk.hold) as number[]).some(v => v > 0.01))
}

export function holdTotal(p: PlayerShip): number {
  return (Object.values(p.hold) as number[]).reduce((a, b) => a + b, 0)
}

function nearestNpc(s: GameState, x: number, y: number, range: number): Npc | null {
  let best: Npc | null = null
  let bd = range
  for (const n of s.npcs) {
    const d = dist(x, y, n.x, n.y)
    if (d < bd) { bd = d; best = n }
  }
  return best
}

function nearestPlayer(s: GameState, x: number, y: number, range: number): PlayerShip | null {
  let best: PlayerShip | null = null
  let bd = range
  for (const p of Object.values(s.players)) {
    if (p.downUntil > s.t) continue
    const d = dist(x, y, p.x, p.y)
    if (d < bd) { bd = d; best = p }
  }
  return best
}

function dropStolen(s: GameState, npc: Npc) {
  const claim = s.claims.find(cl => cl.id === npc.targetBody)
  const res: MineRes = claim ? claim.siloRes : 'ferrite'
  s.pickups.push({ id: s.nextId++, x: npc.x, y: npc.y, hold: { [res]: npc.stolen } })
}

function atEdge(s: GameState, npc: Npc): boolean {
  return npc.x < 30 || npc.y < 30 || npc.x > s.field.w - 30 || npc.y > s.field.h - 30
}

function nearestEdge(s: GameState, npc: Npc): { x: number; y: number } {
  const candidates = [
    { x: 0, y: npc.y }, { x: s.field.w, y: npc.y },
    { x: npc.x, y: 0 }, { x: npc.x, y: s.field.h },
  ]
  return candidates.sort((a, b) => dist(npc.x, npc.y, a.x, a.y) - dist(npc.x, npc.y, b.x, b.y))[0]
}
