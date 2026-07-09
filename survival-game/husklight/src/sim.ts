import {
  ActMsg, Breach, GameState, Inv, PlayerDyn, RoomStatic, TILE, World,
} from './types'

// All rates are per sim-second. The sim only ticks while someone is aboard —
// absence is never punished (golden rule 2).
const CFG = {
  TICK: 0.2,
  REACTOR_DECAY: 0.02,          // W lost per occupied second (The Dimming)
  REACTOR_FLOOR: 12,
  REFIT_PLATE: 8,
  REFIT_WATTS: 9,
  O2_REGEN: 0.035,              // powered room
  O2_DECAY: 0.004,              // unpowered room
  O2_BREACH: 0.05,              // per breach in room
  SUIT_DRAIN_VAC: 2.0,          // suit O2/s in hard vacuum
  SUIT_REFILL: 7,
  SUIT_THRESH: 0.35,            // room o2 below this starts draining suit
  HP_DRAIN: 6,
  HP_REGEN: 1.5,
  COND_DECAY: 0.00035,          // powered rooms age (footprint pressure)
  BREACH_MIN_GAP: 16,
  BREACH_MAX_ACTIVE: 3,         // the loop must breathe
  CRYO_GRACE: 120,
  CRYO_DEATH_RATE: 0.3,         // sleepers/s once grace exhausted
  DRONE_SPEED: 3.2,
  DRONE_DRAW: 3,
  DRONE_COST: { plate: 2, lithium: 2 },
  PLAYER_REACH: 1.8,
  RESPAWN_SECS: 6,
  LITH_O2: 40,
}

export class Sim {
  world: World
  s: GameState

  constructor(world: World, state: GameState) {
    this.world = world
    this.s = state
  }

  log(msg: string, kind: 'info' | 'good' | 'warn' | 'bad' = 'info') {
    this.s.log.push({ t: this.s.t, msg, kind })
    if (this.s.log.length > 40) this.s.log.splice(0, this.s.log.length - 40)
  }

  roomAt(x: number, y: number): number {
    const tx = Math.floor(x), ty = Math.floor(y)
    if (tx < 0 || ty < 0 || tx >= this.world.w || ty >= this.world.h) return -1
    return this.world.roomOf[ty * this.world.w + tx]
  }

  walkable(x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y)
    if (tx < 0 || ty < 0 || tx >= this.world.w || ty >= this.world.h) return false
    const t = this.world.tiles[ty * this.world.w + tx]
    return t === TILE.FLOOR || t === TILE.DOOR
  }

  addPlayer(id: string, name: string) {
    if (this.s.players[id]) { this.s.players[id].name = name; return }
    this.s.players[id] = {
      id, name, x: this.world.spawn.x, y: this.world.spawn.y,
      o2: 100, hp: 100, inv: { plate: 2, sealant: 2, lithium: 1 }, downUntil: 0,
    }
    this.log(`${name} came out of the cold.`, 'good')
  }

  removePlayer(id: string) {
    const p = this.s.players[id]
    if (!p) return
    delete this.s.players[id]
    this.log(`${p.name} returned to cryo.`, 'info')
  }

  setPos(id: string, x: number, y: number) {
    const p = this.s.players[id]
    if (!p || p.downUntil > this.s.t) return
    if (this.walkable(x, y)) { p.x = x; p.y = y }
  }

  // ---------------------------------------------------------------- tick

  tick(dt: number) {
    const s = this.s
    s.t += dt
    this.tickPower()
    this.tickAir(dt)
    this.tickBreaches(dt)
    this.tickCryo(dt)
    this.tickPlayers(dt)
    this.tickDrones(dt)
    s.reactor.out = Math.max(CFG.REACTOR_FLOOR, s.reactor.out - CFG.REACTOR_DECAY * dt)
  }

  demand(): number {
    let d = 0
    for (let i = 0; i < this.world.rooms.length; i++)
      if (this.s.rooms[i].on) d += this.world.rooms[i].draw
    for (const dr of this.s.drones) if (dr.state === 'active') d += CFG.DRONE_DRAW
    return d
  }

  private tickPower() {
    const s = this.s
    let demand = this.demand()
    const wasPowered = s.rooms.map(r => r.powered)
    for (let i = 0; i < s.rooms.length; i++) s.rooms[i].powered = s.rooms[i].on
    // brown out farthest non-critical rooms until demand fits
    for (const id of this.world.shedOrder) {
      if (demand <= s.reactor.out) break
      if (!s.rooms[id].on || !s.rooms[id].powered) continue
      s.rooms[id].powered = false
      demand -= this.world.rooms[id].draw
    }
    for (let i = 0; i < s.rooms.length; i++) {
      if (wasPowered[i] && !s.rooms[i].powered && s.rooms[i].on)
        this.log(`Brownout — ${this.world.rooms[i].name} lost power.`, 'warn')
      if (!wasPowered[i] && s.rooms[i].powered && s.t > 1 && this.world.rooms[i].type === 'cryo')
        this.log(`${this.world.rooms[i].name} pods re-chilled.`, 'good')
    }
  }

  private tickAir(dt: number) {
    const s = this.s
    const breachCount = new Map<number, number>()
    for (const b of s.breaches) breachCount.set(b.room, (breachCount.get(b.room) ?? 0) + 1)
    for (let i = 0; i < s.rooms.length; i++) {
      const r = s.rooms[i]
      const st = this.world.rooms[i]
      if (st.type === 'void') { r.o2 = 0; continue }
      const leaks = breachCount.get(i) ?? 0
      if (leaks > 0) r.o2 -= CFG.O2_BREACH * leaks * dt
      else if (r.powered) r.o2 += CFG.O2_REGEN * dt
      else r.o2 -= CFG.O2_DECAY * dt
      r.o2 = Math.max(0, Math.min(1, r.o2))
      if (r.powered) r.cond = Math.max(0.22, r.cond - CFG.COND_DECAY * dt)
    }
  }

  private tickBreaches(dt: number) {
    const s = this.s
    void dt
    if (s.t < s.nextBreachAt || s.breaches.length >= CFG.BREACH_MAX_ACTIVE) return
    // footprint-weighted: aging powered rooms invite entropy
    const cands: { id: number; w: number }[] = []
    for (let i = 0; i < s.rooms.length; i++) {
      const st = this.world.rooms[i]
      if (st.type === 'reactor' || st.type === 'void') continue
      const r = s.rooms[i]
      const w = r.powered ? Math.max(0.05, 1.15 - r.cond) : 0.12 * (1 - r.cond)
      cands.push({ id: i, w })
    }
    const total = cands.reduce((a, c) => a + c.w, 0)
    let roll = Math.random() * total
    let pick = cands[0]
    for (const c of cands) { roll -= c.w; if (roll <= 0) { pick = c; break } }
    const st = this.world.rooms[pick.id]
    const bx = st.x + 1 + Math.floor(Math.random() * Math.max(1, st.w - 2))
    const by = st.y + 1 + Math.floor(Math.random() * Math.max(1, st.h - 2))
    s.breaches.push({ id: s.nextId++, room: pick.id, x: bx + 0.5, y: by + 0.5 })
    this.log(`Micro-breach in ${st.name}!`, 'bad')
    s.nextBreachAt = s.t + CFG.BREACH_MIN_GAP + Math.random() * 34
  }

  private tickCryo(dt: number) {
    const s = this.s
    for (let i = 0; i < s.rooms.length; i++) {
      const st = this.world.rooms[i]
      if (st.type !== 'cryo' || s.rooms[i].sleepers <= 0) continue
      const r = s.rooms[i]
      if (r.powered) {
        if (r.grace < CFG.CRYO_GRACE) r.grace = Math.min(CFG.CRYO_GRACE, r.grace + dt * 2)
        continue
      }
      r.grace -= dt
      if (r.grace > 0) continue
      r.deathAcc += CFG.CRYO_DEATH_RATE * dt
      const deaths = Math.floor(r.deathAcc)
      if (deaths > 0) {
        r.deathAcc -= deaths
        r.sleepers = Math.max(0, r.sleepers - deaths)
        s.deaths += deaths
        if (Math.floor(s.t) % 10 < dt * 2)
          this.log(`Sleepers are dying in ${st.name}.`, 'bad')
      }
    }
  }

  private tickPlayers(dt: number) {
    const s = this.s
    for (const p of Object.values(s.players)) {
      if (p.downUntil > s.t) continue
      const room = this.roomAt(p.x, p.y)
      const roomO2 = room >= 0 ? s.rooms[room].o2 : 0
      if (roomO2 > 0.5) {
        p.o2 = Math.min(100, p.o2 + CFG.SUIT_REFILL * dt)
      } else if (roomO2 < CFG.SUIT_THRESH) {
        const severity = (CFG.SUIT_THRESH - roomO2) / CFG.SUIT_THRESH
        p.o2 = Math.max(0, p.o2 - CFG.SUIT_DRAIN_VAC * severity * dt)
      }
      if (p.o2 <= 0) p.hp -= CFG.HP_DRAIN * dt
      else if (roomO2 > 0.5) p.hp = Math.min(100, p.hp + CFG.HP_REGEN * dt)
      if (p.hp <= 0) this.downPlayer(p)
    }
  }

  private downPlayer(p: PlayerDyn) {
    // taxes tempo, never progress: you drop half your carry, wake at cryo
    const drop: Inv = {
      plate: Math.floor(p.inv.plate / 2),
      sealant: Math.floor(p.inv.sealant / 2),
      lithium: Math.floor(p.inv.lithium / 2),
    }
    for (const k of ['plate', 'sealant', 'lithium'] as const) {
      if (drop[k] > 0) {
        this.s.items.push({ id: this.s.nextId++, kind: k, n: drop[k], x: p.x, y: p.y })
        p.inv[k] -= drop[k]
      }
    }
    p.downUntil = this.s.t + CFG.RESPAWN_SECS
    p.x = this.world.spawn.x
    p.y = this.world.spawn.y
    p.o2 = 100
    p.hp = 60
    this.log(`${p.name}'s suit failed — recovered to cryo bay.`, 'bad')
  }

  private tickDrones(dt: number) {
    const s = this.s
    for (const d of s.drones) {
      if (d.state !== 'active') continue
      // choose work: nearest breach if the depot can pay for the patch
      if (d.target === -1 && s.depotSealant > 0 && s.breaches.length > 0) {
        let best: Breach | null = null
        let bestD = Infinity
        for (const b of s.breaches) {
          const dist = Math.hypot(b.x - d.x, b.y - d.y)
          if (dist < bestD) { bestD = dist; best = b }
        }
        if (best) {
          const path = this.findPath(d.x, d.y, best.x, best.y)
          if (path) { d.target = best.id; d.path = path }
        }
      }
      if (d.target !== -1) {
        const b = s.breaches.find(x => x.id === d.target)
        if (!b || s.depotSealant <= 0) { d.target = -1; d.path = []; continue }
        this.stepAlong(d, dt)
        if (Math.hypot(b.x - d.x, b.y - d.y) < 0.7) {
          s.breaches = s.breaches.filter(x => x.id !== b.id)
          s.depotSealant -= 1
          s.rooms[b.room].cond = Math.min(1, s.rooms[b.room].cond + 0.02)
          this.log(`Custodian sealed the breach in ${this.world.rooms[b.room].name}.`, 'good')
          d.target = -1
          d.path = []
        }
      } else if (d.path.length === 0) {
        // dock at the depot when idle
        const dd = Math.hypot(this.world.depot.x + 0.5 - d.x, this.world.depot.y + 0.5 - d.y)
        if (dd > 1.2) {
          const path = this.findPath(d.x, d.y, this.world.depot.x + 0.5, this.world.depot.y + 0.5)
          if (path) d.path = path
        }
      } else {
        this.stepAlong(d, dt)
      }
    }
  }

  private stepAlong(d: { x: number; y: number; path: { x: number; y: number }[] }, dt: number) {
    let budget = CFG.DRONE_SPEED * dt
    while (budget > 0 && d.path.length > 0) {
      const n = d.path[0]
      const dist = Math.hypot(n.x - d.x, n.y - d.y)
      if (dist <= budget) { d.x = n.x; d.y = n.y; d.path.shift(); budget -= dist }
      else {
        d.x += ((n.x - d.x) / dist) * budget
        d.y += ((n.y - d.y) / dist) * budget
        budget = 0
      }
    }
  }

  findPath(fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] | null {
    const { w, h } = this.world
    const from = Math.floor(fy) * w + Math.floor(fx)
    const to = Math.floor(ty) * w + Math.floor(tx)
    if (from === to) return []
    const prev = new Int32Array(w * h).fill(-1)
    prev[from] = from
    const q = [from]
    let found = false
    while (q.length && !found) {
      const cur = q.shift()!
      const cx = cur % w, cy = Math.floor(cur / w)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (prev[ni] !== -1) continue
        const t = this.world.tiles[ni]
        if (t !== TILE.FLOOR && t !== TILE.DOOR) continue
        prev[ni] = cur
        if (ni === to) { found = true; break }
        q.push(ni)
      }
    }
    if (!found) return null
    const path: { x: number; y: number }[] = []
    let cur = to
    while (cur !== from) {
      path.push({ x: (cur % w) + 0.5, y: Math.floor(cur / w) + 0.5 })
      cur = prev[cur]
    }
    path.reverse()
    return path
  }

  // ---------------------------------------------------------------- actions

  /** Apply a player action. Returns false if invalid (silently — prototype). */
  apply(pid: string, act: ActMsg): boolean {
    const p = this.s.players[pid]
    if (!p || p.downUntil > this.s.t) return false
    const near = (x: number, y: number) => Math.hypot(x - p.x, y - p.y) <= CFG.PLAYER_REACH

    switch (act.k) {
      case 'take': {
        const it = this.s.items.find(i => i.id === act.id)
        if (!it || !near(it.x, it.y)) return false
        p.inv[it.kind] += it.n
        this.s.items = this.s.items.filter(i => i.id !== it.id)
        return true
      }
      case 'patch': {
        const b = this.s.breaches.find(x => x.id === act.id)
        if (!b || !near(b.x, b.y) || p.inv.sealant < 1) return false
        p.inv.sealant -= 1
        this.s.breaches = this.s.breaches.filter(x => x.id !== b.id)
        this.s.rooms[b.room].cond = Math.min(1, this.s.rooms[b.room].cond + 0.03)
        this.log(`${p.name} sealed the breach in ${this.world.rooms[b.room].name}.`, 'good')
        return true
      }
      case 'breaker': {
        const st: RoomStatic | undefined = this.world.rooms[act.id]
        if (!st?.breaker || !near(st.breaker.x + 0.5, st.breaker.y + 0.5)) return false
        const r = this.s.rooms[act.id]
        r.on = !r.on
        this.log(`${p.name} ${r.on ? 'energized' : 'cut power to'} ${st.name}.`, r.on ? 'good' : 'warn')
        return true
      }
      case 'console': {
        if (!near(this.world.console.x + 0.5, this.world.console.y + 0.5)) return false
        if (p.inv.plate < CFG.REFIT_PLATE) return false
        p.inv.plate -= CFG.REFIT_PLATE
        this.s.reactor.out = Math.min(this.s.reactor.max, this.s.reactor.out + CFG.REFIT_WATTS)
        this.log(`${p.name} refit a reactor rod. +${CFG.REFIT_WATTS}W.`, 'good')
        return true
      }
      case 'drone': {
        const d = this.s.drones.find(x => x.id === act.id)
        if (!d || d.state !== 'dormant' || !near(d.x, d.y)) return false
        if (p.inv.plate < CFG.DRONE_COST.plate || p.inv.lithium < CFG.DRONE_COST.lithium) return false
        p.inv.plate -= CFG.DRONE_COST.plate
        p.inv.lithium -= CFG.DRONE_COST.lithium
        d.state = 'active'
        this.log(`${p.name} reflashed a Custodian. It answers to the depot now.`, 'good')
        return true
      }
      case 'depot': {
        if (!near(this.world.depot.x + 0.5, this.world.depot.y + 0.5)) return false
        if (p.inv.sealant <= 0) return false
        this.s.depotSealant += p.inv.sealant
        this.log(`${p.name} stocked ${p.inv.sealant} sealant in the depot.`, 'info')
        p.inv.sealant = 0
        return true
      }
      case 'lith': {
        if (p.inv.lithium < 1 || p.o2 > 70) return false
        p.inv.lithium -= 1
        p.o2 = Math.min(100, p.o2 + CFG.LITH_O2)
        this.log(`${p.name} cracked a lithium candle.`, 'info')
        return true
      }
    }
  }
}

export { CFG }

export function saveKey(roomCode: string): string {
  return `husklight-save-${roomCode}`
}

export function saveState(roomCode: string, seed: number, s: GameState) {
  try {
    localStorage.setItem(saveKey(roomCode), JSON.stringify({ seed, s }))
  } catch { /* storage full or blocked — losing the autosave is acceptable */ }
}

export function loadState(roomCode: string, seed: number): GameState | null {
  try {
    const raw = localStorage.getItem(saveKey(roomCode))
    if (!raw) return null
    const data = JSON.parse(raw) as { seed: number; s: GameState }
    if (data.seed !== seed) return null
    data.s.players = {}
    return data.s
  } catch { return null }
}
