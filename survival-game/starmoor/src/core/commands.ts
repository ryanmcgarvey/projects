import { C, MODULES } from './constants'
import { inGrid, moduleAt, neighbors } from './grid'
import { Command, CmdResult, GameState } from './types'
import { addLog, addStock, canAfford, clamp, dist, spend } from './util'
import { weighCost } from './sim/weigh'
import { MineRes } from './types'

/** The only door into the sim for player intent. Validates everything. */
export function applyCommand(s: GameState, pid: string, cmd: Command): CmdResult {
  const p = s.players[pid]
  if (!p) return { ok: false, err: 'no ship' }
  if (p.downUntil > s.t && cmd.c !== 'state') return { ok: false, err: 'pod in transit' }

  switch (cmd.c) {
    case 'state': {
      // the command layer trusts nothing: non-finite input is rejected outright,
      // and displacement is clamped so no client can teleport regardless of shell
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y) ||
          typeof cmd.miningBody !== 'number' || !Number.isFinite(cmd.miningBody)) {
        return { ok: false, err: 'malformed state' }
      }
      const nx = clamp(cmd.x, 0, s.field.w)
      const ny = clamp(cmd.y, 0, s.field.h)
      const dtSim = Math.max(0, s.t - p.lastStateT)
      const allow = C.SHIP_SPEED * 1.5 * dtSim + 6 // slack covers low-fps frames between sim ticks
      const d = dist(nx, ny, p.x, p.y)
      if (d > allow && d > 0) {
        p.x += ((nx - p.x) / d) * allow
        p.y += ((ny - p.y) / d) * allow
      } else {
        p.x = nx
        p.y = ny
      }
      p.lastStateT = s.t
      p.thrusting = !!cmd.thrusting
      p.firing = !!cmd.firing
      p.miningBody = Math.floor(cmd.miningBody)
      return { ok: true }
    }

    case 'transfer': {
      if (!(dist(p.x, p.y, s.station.x, s.station.y) <= C.DOCK_RANGE)) return { ok: false, err: 'not docked' }
      for (const r of Object.keys(p.hold) as MineRes[]) {
        const accepted = addStock(s, r, p.hold[r] ?? 0)
        const left = (p.hold[r] ?? 0) - accepted
        if (left > 0.001) p.hold[r] = left   // stores full: overflow stays in the hold
        else delete p.hold[r]
      }
      return { ok: true }
    }

    case 'build': {
      const def = MODULES[cmd.kind]
      if (!def?.buildable) return { ok: false, err: 'not buildable' }
      if (!atStation(s, p.x, p.y)) return { ok: false, err: 'fly to the city to work the hull' }
      if (!inGrid(cmd.gx, cmd.gy)) return { ok: false, err: 'outside hull grid' }
      if (moduleAt(s, cmd.gx, cmd.gy)) return { ok: false, err: 'cell occupied' }
      if (neighbors(s, cmd.gx, cmd.gy).length === 0) return { ok: false, err: 'must attach to the station' }
      if (!canAfford(s.stocks, def.cost)) return { ok: false, err: 'cannot afford' }
      spend(s.stocks, def.cost)
      s.modules.push({ kind: cmd.kind, gx: cmd.gx, gy: cmd.gy, hp: C.MODULE_HP, online: false, markedUntil: 0 })
      addLog(s, `${p.name} raised a ${cmd.kind}.`, 'info')
      return { ok: true }
    }

    case 'demolish': {
      if (!atStation(s, p.x, p.y)) return { ok: false, err: 'fly to the city to work the hull' }
      const m = moduleAt(s, cmd.gx, cmd.gy)
      if (!m) return { ok: false, err: 'nothing there' }
      if (m.kind === 'core') return { ok: false, err: 'the core is the city' }
      s.modules = s.modules.filter(x => x !== m)
      addLog(s, `${p.name} broke down the ${m.kind} for the lanes it stood on.`, 'warn')
      return { ok: true }
    }

    case 'repair': {
      if (!atStation(s, p.x, p.y)) return { ok: false, err: 'fly to the city to work the hull' }
      const m = moduleAt(s, cmd.gx, cmd.gy)
      if (!m || m.hp >= C.MODULE_HP) return { ok: false, err: 'nothing to repair' }
      if (!canAfford(s.stocks, C.COST_REPAIR_MODULE)) return { ok: false, err: 'cannot afford' }
      spend(s.stocks, C.COST_REPAIR_MODULE)
      m.hp = C.MODULE_HP
      addLog(s, `${m.kind} patched and humming again.`, 'good')
      return { ok: true }
    }

    case 'rig': {
      if (!yardOnline(s)) return { ok: false, err: 'needs a yard online' }
      const body = s.bodies.find(b => b.id === cmd.bodyId)
      if (!body || body.richness <= 0) return { ok: false, err: 'nothing to mine there' }
      if (body.id === s.mooringBodyId) return { ok: false, err: 'the city drinks from this one' }
      if (s.claims.some(cl => cl.bodyId === body.id)) return { ok: false, err: 'already claimed' }
      if (!(dist(p.x, p.y, body.x, body.y) <= C.INTERACT_RANGE_RIG)) return { ok: false, err: 'fly closer to plant a rig' }
      if (!canAfford(s.stocks, C.COST_RIG)) return { ok: false, err: 'cannot afford' }
      spend(s.stocks, C.COST_RIG)
      s.claims.push({ id: s.nextId++, bodyId: body.id, hp: C.RIG_HP, online: true, siloRes: body.res, silo: 0 })
      addLog(s, `${p.name} clamped a claim rig to the ${body.res} ${body.kind}. The silo will halt when full.`, 'good')
      return { ok: true }
    }

    case 'lane': {
      if (!yardOnline(s)) return { ok: false, err: 'needs a yard online' }
      const claim = s.claims.find(cl => cl.id === cmd.claimId)
      if (!claim) return { ok: false, err: 'no such claim' }
      if (s.lanes.some(l => l.claimId === claim.id)) return { ok: false, err: 'lane exists' }
      if (!canAfford(s.stocks, C.COST_LANE)) return { ok: false, err: 'cannot afford' }
      const body = s.bodies.find(b => b.id === claim.bodyId)
      if (!body) return { ok: false, err: 'claim lost its body' }
      spend(s.stocks, C.COST_LANE)
      const damped = s.shoals.some(sh =>
        segCircle(s.station.x, s.station.y, body.x, body.y, sh.x, sh.y, sh.r))
      s.lanes.push({ id: s.nextId++, claimId: claim.id, picket: false, damped, tithe: 0 })
      addLog(s, `Freight lane rigged${damped ? ' — routed through the shoal, wake damped' : ' — it will shine in every predator’s chart'}.`, damped ? 'good' : 'info')
      return { ok: true }
    }

    case 'picket': {
      const lane = s.lanes.find(l => l.id === cmd.laneId)
      if (!lane || lane.picket) return { ok: false, err: 'no lane / already armed' }
      if (!yardOnline(s)) return { ok: false, err: 'needs a yard online' }
      if (!canAfford(s.stocks, C.COST_PICKET)) return { ok: false, err: 'cannot afford' }
      spend(s.stocks, C.COST_PICKET)
      lane.picket = true
      addLog(s, 'Picket drone on station along the lane. Its broadcast carries.', 'info')
      return { ok: true }
    }

    case 'repairRig': {
      const claim = s.claims.find(cl => cl.id === cmd.claimId)
      const body = claim && s.bodies.find(b => b.id === claim.bodyId)
      if (!claim || !body || claim.hp >= C.RIG_HP) return { ok: false, err: 'nothing to repair' }
      if (!(dist(p.x, p.y, body.x, body.y) <= C.INTERACT_RANGE_RIG)) return { ok: false, err: 'fly closer' }
      if (!canAfford(s.stocks, C.COST_REPAIR_RIG)) return { ok: false, err: 'cannot afford' }
      spend(s.stocks, C.COST_REPAIR_RIG)
      claim.hp = C.RIG_HP
      claim.online = true
      addLog(s, 'Claim rig cut back in.', 'good')
      return { ok: true }
    }

    case 'assign': {
      const crew = s.crew.find(c => c.id === cmd.crewId)
      if (!crew) return { ok: false, err: 'no such hand' }
      crew.role = cmd.role
      return { ok: true }
    }

    case 'payToll': {
      const gate = s.npcs.find(n => n.id === cmd.npcId && n.kind === 'tollgate')
      if (!gate) return { ok: false, err: 'no gate' }
      if (!(dist(p.x, p.y, gate.x, gate.y) <= C.INTERACT_RANGE_GATE)) return { ok: false, err: 'fly to the gate to parley' }
      if (s.stocks.isotopes < C.TOLL_PAYOFF_ISOTOPES) return { ok: false, err: 'cannot afford the lump' }
      s.stocks.isotopes -= C.TOLL_PAYOFF_ISOTOPES
      const lane = s.lanes.find(l => l.id === gate.laneId)
      if (lane) lane.tithe = 0
      // the gate is struck immediately; escorts fly home
      s.npcs = s.npcs.filter(n => n.kind !== 'tollgate' || n.faction !== 'combine')
      for (const n of s.npcs) if (n.faction === 'combine') n.leaving = true
      s.factions.combine.heat *= 0.5
      s.factions.combine.gapUntil = s.t + C.ENCOUNTER_GAP
      addLog(s, 'The Combine took the lump and struck the gate. Peace, priced.', 'good')
      return { ok: true }
    }

    case 'prospect': {
      const beacon = s.beacons.find(b => b.id === cmd.beaconId)
      if (!beacon || beacon.revealed) return { ok: false, err: 'nothing to survey' }
      if (!(dist(p.x, p.y, beacon.x, beacon.y) <= C.INTERACT_RANGE_BEACON)) return { ok: false, err: 'fly closer' }
      beacon.revealed = true
      addLog(s, `Survey: a mooring bearing ${beacon.mix}. Feed vein ${beacon.a0.toFixed(1)}/s, thinning over ~${Math.round(beacon.tau / 60)} occupied minutes.`, 'good')
      return { ok: true }
    }

    case 'weigh': {
      if (s.weigh.phase !== 'moored') return { ok: false, err: 'already underway' }
      const option = s.beacons.find(b => b.id === cmd.optionId)
      if (!option?.revealed) return { ok: false, err: 'unprospected mooring' }
      const cost = weighCost(s)
      if (s.stocks.burnstock < cost) return { ok: false, err: `burn reserve short: ${Math.floor(s.stocks.burnstock)}/${cost}` }
      s.weigh.phase = 'countdown'
      s.weigh.endsAt = s.t + C.WEIGH_COUNTDOWN
      s.weigh.optionId = option.id
      addLog(s, `${p.name} proposed the Weigh — ${Math.round(C.WEIGH_COUNTDOWN)}s to object. Destination: ${option.mix}.`, 'warn')
      return { ok: true }
    }

    case 'cancelWeigh': {
      if (s.weigh.phase !== 'countdown') return { ok: false, err: 'no countdown' }
      if (!atStation(s, p.x, p.y)) return { ok: false, err: 'objections are lodged at the chart table — dock first' }
      s.weigh.phase = 'moored'
      s.weigh.optionId = -1
      addLog(s, `${p.name} objected. The city stays.`, 'info')
      return { ok: true }
    }

    case 'dark': {
      s.dark = !s.dark
      addLog(s, s.dark ? 'Running dark. The promenade goes cold.' : 'Lights up. Let them see the city.', 'info')
      return { ok: true }
    }
  }
}

function yardOnline(s: GameState): boolean {
  return s.modules.some(m => m.kind === 'yard' && m.online)
}

function atStation(s: GameState, x: number, y: number): boolean {
  return dist(x, y, s.station.x, s.station.y) <= C.STATION_WORK_RANGE
}

/** Does segment AB pass within r of point C? */
function segCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return dist(ax, ay, cx, cy) < r
  let t = ((cx - ax) * abx + (cy - ay) * aby) / len2
  t = clamp(t, 0, 1)
  return dist(ax + abx * t, ay + aby * t, cx, cy) < r
}
