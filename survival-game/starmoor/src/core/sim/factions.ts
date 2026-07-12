import { C } from '../constants'
import { GameState, FactionId, Lane, Npc, NpcKind } from '../types'
import { addLog } from '../util'
import { emissionRates, tierOf } from './emissions'
import { randRange } from '../rng'

// Encounters are bounded: one active per faction, minimum gaps, arrival grace.
// The loop must breathe — pressure is a tide chart, not a fire alarm.

function activeFor(s: GameState, f: FactionId): boolean {
  return s.npcs.some(n => n.faction === f)
}

function edgeSpawn(s: GameState): { x: number; y: number } {
  const side = randRange(s, 0, 4) | 0
  const w = s.field.w, h = s.field.h
  if (side === 0) return { x: randRange(s, 0, w), y: 20 }
  if (side === 1) return { x: randRange(s, 0, w), y: h - 20 }
  if (side === 2) return { x: 20, y: randRange(s, 0, h) }
  return { x: w - 20, y: randRange(s, 0, h) }
}

function spawnNpc(s: GameState, kind: NpcKind, faction: FactionId, x: number, y: number, hp: number): Npc {
  const npc: Npc = {
    id: s.nextId++, kind, faction, x, y, hp, maxHp: hp,
    targetBody: -1, laneId: -1, stolen: 0, leaving: false,
  }
  s.npcs.push(npc)
  return npc
}

export function tickFactions(s: GameState, dt: number) {
  void dt
  if (s.weigh.phase === 'transit') return
  if (s.tLeg < C.LEG_GRACE) return

  for (const fid of ['combine', 'breakers', 'hush'] as FactionId[]) {
    const f = s.factions[fid]
    if (s.t < f.gapUntil || activeFor(s, fid)) continue
    const tier = tierOf(f.heat)
    if (tier === 0) continue

    if (fid === 'combine') spawnCombine(s, tier)
    else if (fid === 'breakers') spawnBreakers(s, tier)
    else spawnHush(s, tier)

    f.gapUntil = s.t + C.ENCOUNTER_GAP
  }

  tickHushMarks(s)
}

// --- Combine: wants you paying ---

function spawnCombine(s: GameState, tier: number) {
  if (s.lanes.length === 0) { s.factions.combine.heat = Math.min(s.factions.combine.heat, C.HEAT_T1); return }
  const lane = bestLane(s)
  if (!lane) return
  const mid = laneMidpoint(s, lane)
  if (!mid) return
  const gate = spawnNpc(s, 'tollgate', 'combine', mid.x, mid.y, 120)
  gate.laneId = lane.id
  lane.tithe = tier >= 2 ? C.TOLL_T2 : C.TOLL_T1
  const guards = Math.min(3, tier - 1 + s.factions.combine.belligerence)
  for (let i = 0; i < guards; i++) {
    const g = spawnNpc(s, 'gunship', 'combine', mid.x + randRange(s, -40, 40), mid.y + randRange(s, -40, 40), C.GUNSHIP_HP)
    g.targetBody = gate.id
  }
  addLog(s, `The Combine posted a toll gate on your ore lane — ${Math.round(lane.tithe * 100)}% skim. Pay it off, eat it, or burn it.`, 'warn')
}

function bestLane(s: GameState): Lane | undefined {
  const untolled = s.lanes.filter(l => l.tithe === 0)
  const pool = untolled.length ? untolled : s.lanes
  return pool.sort((a, b) => {
    const ca = s.claims.find(c => c.id === a.claimId)?.silo ?? 0
    const cb = s.claims.find(c => c.id === b.claimId)?.silo ?? 0
    return cb - ca
  })[0]
}

export function laneMidpoint(s: GameState, lane: Lane): { x: number; y: number } | null {
  const claim = s.claims.find(c => c.id === lane.claimId)
  const body = claim && s.bodies.find(b => b.id === claim.bodyId)
  if (!body) return null
  return { x: (body.x + s.station.x) / 2, y: (body.y + s.station.y) / 2 }
}

// --- Breakers: want you as salvage ---

function spawnBreakers(s: GameState, tier: number) {
  const at = edgeSpawn(s)
  if (tier >= 3) {
    // siege: the station itself
    for (let i = 0; i < 4; i++) {
      const n = spawnNpc(s, 'skiff', 'breakers', at.x + randRange(s, -50, 50), at.y + randRange(s, -50, 50), C.SKIFF_HP)
      n.targetBody = -2 // station
    }
    const g = spawnNpc(s, 'gunship', 'breakers', at.x, at.y, C.GUNSHIP_HP)
    g.targetBody = -2
    addLog(s, 'Breaker tender inbound — they mean to strip the city itself. Man the guns.', 'bad')
    return
  }
  const target = s.claims.sort((a, b) => b.silo - a.silo)[0]
  const n = 1 + tier
  for (let i = 0; i < n; i++) {
    const sk = spawnNpc(s, 'skiff', 'breakers', at.x + randRange(s, -50, 50), at.y + randRange(s, -50, 50), C.SKIFF_HP)
    sk.targetBody = target ? target.id : -2
  }
  addLog(s, target ? 'Breaker skiffs sighted, running for your silos.' : 'Breaker skiffs prowling the approaches.', 'warn')
}

// --- Hush: wants you quiet ---

function spawnHush(s: GameState, tier: number) {
  void tier
  const lit = s.modules
    .filter(m => m.online && (m.kind === 'gallery' || m.kind === 'hydro'))
    .concat(s.modules.filter(m => m.online && m.kind !== 'core'))
  const target = lit[0]
  if (!target) { s.factions.hush.heat *= 0.8; return }
  target.markedUntil = s.t + C.HUSH_MARK_SECS
  addLog(s, `The Hush have marked your ${target.kind}. Go dark before the count ends, or lose it.`, 'bad')
}

function tickHushMarks(s: GameState) {
  for (const m of s.modules) {
    if (m.markedUntil === 0 || s.t < m.markedUntil) continue
    m.markedUntil = 0
    const rates = emissionRates(s)
    if (rates.glare < C.HUSH_AVERT_GLARE) {
      addLog(s, 'The city ran dark. The Hush passed over.', 'good')
      s.factions.hush.heat *= 0.6
    } else {
      const at = edgeSpawn(s)
      const wing = spawnNpc(s, 'hushwing', 'hush', at.x, at.y, C.HUSHWING_HP)
      wing.targetBody = m.gx * 100 + m.gy // grid-encoded module address (stable across splices)
      addLog(s, 'The Hush answer light with silence. Strike wing inbound.', 'bad')
    }
  }
}

/** Called by combat when a faction's last npc dies or leaves. */
export function encounterResolved(s: GameState, fid: FactionId) {
  s.factions[fid].heat *= C.HEAT_ENCOUNTER_RELIEF
  s.factions[fid].gapUntil = s.t + C.ENCOUNTER_GAP
}
