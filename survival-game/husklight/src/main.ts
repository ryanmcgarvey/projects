import { generateWorld, initialState } from './worldgen'
import { Sim, CFG, saveState, loadState } from './sim'
import { Net } from './net'
import { Input } from './input'
import { Renderer, TS } from './render'
import { ActMsg, GameState, TILE, World, totalSleepers } from './types'
import { hashStr } from './prng'

const $ = (id: string) => document.getElementById(id) as HTMLElement

// ---------------------------------------------------------------- join UI

const nameInput = $('name') as HTMLInputElement
const roomInput = $('room') as HTMLInputElement
nameInput.value = localStorage.getItem('husk-name') ?? ''
roomInput.value = new URLSearchParams(location.search).get('room') ?? randomCode()

function randomCode(): string {
  const alpha = 'abcdefghjkmnpqrstvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  return Array.from(bytes).map(b => alpha[b % alpha.length]).join('')
}

$('board').addEventListener('click', () => {
  const name = (nameInput.value.trim() || 'Steward').slice(0, 16)
  const room = (roomInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || randomCode()).slice(0, 12)
  localStorage.setItem('husk-name', name)
  const url = new URL(location.href)
  url.searchParams.set('room', room)
  history.replaceState(null, '', url)
  $('join').style.display = 'none'
  void start(name, room)
})
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') roomInput.focus() })
roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') ($('board') as HTMLButtonElement).click() })

// ---------------------------------------------------------------- game

type Role = 'pending' | 'host' | 'guest'

interface Interact { prompt: string; act: ActMsg | null }

async function start(name: string, room: string) {
  const seed = hashStr(room)
  const world = generateWorld(seed)
  const renderer = new Renderer(document.getElementById('cv') as HTMLCanvasElement)
  const input = new Input()
  const net = new Net()

  let role: Role = 'pending'
  let sim: Sim | null = null
  let lastState: GameState | null = null
  let hostId: string | null = null
  let lastStateAt = performance.now()
  let lastHelloAt = 0

  let selfX = world.spawn.x
  let selfY = world.spawn.y
  const disp = new Map<string, { x: number; y: number }>()

  const becomeHost = (from?: GameState | null) => {
    const resumed = from ?? loadState(room, seed)
    const st = resumed ?? initialState(world)
    sim = new Sim(world, st)
    role = 'host'
    hostId = null
    for (const pid of Object.keys(sim.s.players))
      if (pid !== net.selfId && !net.peers.has(pid)) sim.removePlayer(pid)
    sim.addPlayer(net.selfId, name)
    const me = sim.s.players[net.selfId]
    selfX = me.x; selfY = me.y
    if (from) sim.log('Stewardship transferred.', 'info')
    else if (resumed) sim.log('The Husk remembers you. Shift resumed.', 'info')
    lastState = sim.s
  }

  const adoptState = (st: GameState, from: string) => {
    role = 'guest'
    sim = null
    hostId = from
    lastState = st
    lastStateAt = performance.now()
    const me = st.players[net.selfId]
    if (!me) {
      const now = performance.now()
      if (now - lastHelloAt > 3000) { lastHelloAt = now; net.hello({ name }) }
      return
    }
    // own position is locally authoritative unless the host moved us (respawn)
    if (me.downUntil > st.t || Math.hypot(me.x - selfX, me.y - selfY) > 4) {
      selfX = me.x; selfY = me.y
    }
  }

  await net.join(room, {
    onHello: (peer, msg) => {
      if (role === 'host' && sim) {
        sim.addPlayer(peer, msg.name)
        net.world({ seed, state: sim.s }, peer)
      }
    },
    onWorld: (msg, from) => {
      if (role !== 'host') adoptState(msg.state, from)
    },
    onState: (st, from) => {
      if (role === 'host' && sim) {
        // two hosts (both promoted during discovery): the older world wins
        if (st.t > sim.s.t) adoptState(st, from)
      } else {
        adoptState(st, from)
      }
    },
    onPos: (peer, msg) => { if (role === 'host' && sim) sim.setPos(peer, msg.x, msg.y) },
    onAct: (peer, msg) => { if (role === 'host' && sim) sim.apply(peer, msg) },
    onPeerLeave: peer => {
      if (role === 'host' && sim) sim.removePlayer(peer)
      else if (peer === hostId) tryElection()
    },
  })

  if (!net.ok) $('offline-badge').style.display = 'block'
  net.hello({ name })
  setTimeout(() => { if (role === 'pending') becomeHost() }, net.ok ? 3000 : 0)

  const tryElection = () => {
    if (role === 'host' || !lastState) return
    const rivals = [...net.peers].filter(p => p !== hostId)
    if (rivals.every(p => p > net.selfId)) becomeHost(lastState)
    else hostId = null // someone else will take it; we keep listening
  }

  // ------------------------------------------------------------- actions

  let current: Interact | null = null
  const doAct = (act: ActMsg) => {
    if (role === 'host' && sim) sim.apply(net.selfId, act)
    else if (role === 'guest') net.act(act)
  }
  input.onInteract = () => { if (current?.act) doAct(current.act) }
  input.onLithium = () => doAct({ k: 'lith' })

  $('roomcode').textContent = room
  $('roomcode').addEventListener('click', () => {
    void navigator.clipboard?.writeText(location.href)
    $('roomcode').textContent = 'copied!'
    setTimeout(() => { $('roomcode').textContent = room }, 1200)
  })

  $('hud-tl').hidden = false
  $('hud-tr').hidden = false
  $('controls-hint').hidden = false

  // ------------------------------------------------------------- loop

  let last = performance.now()
  let simAcc = 0
  let castAcc = 0
  let posAcc = 0
  let saveAcc = 0
  let lastRoom = -2
  let roomFadeTimer = 0

  const frame = (now: number) => {
    requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    const st = role === 'host' && sim ? sim.s : lastState
    if (!st) { drawWaiting(renderer, now); return }
    const me = st.players[net.selfId]

    // self movement
    if (me && me.downUntil <= st.t) {
      const ax = input.axis()
      if (ax.x !== 0 || ax.y !== 0) {
        const nx = selfX + ax.x * 4.4 * dt
        const ny = selfY + ax.y * 4.4 * dt
        if (canStand(world, nx, selfY)) selfX = nx
        if (canStand(world, selfX, ny)) selfY = ny
      }
    }

    if (role === 'host' && sim) {
      sim.setPos(net.selfId, selfX, selfY)
      simAcc += dt
      while (simAcc >= CFG.TICK) { sim.tick(CFG.TICK); simAcc -= CFG.TICK }
      castAcc += dt
      if (castAcc >= 0.25) { castAcc = 0; net.state(sim.s) }
      saveAcc += dt
      if (saveAcc >= 10) { saveAcc = 0; saveState(room, seed, sim.s) }
    } else if (role === 'guest') {
      posAcc += dt
      if (posAcc >= 0.1) { posAcc = 0; net.pos({ x: selfX, y: selfY }) }
      if (performance.now() - lastStateAt > 6000) tryElection()
    }

    // display smoothing for other players; self is exact
    for (const p of Object.values(st.players)) {
      if (p.id === net.selfId) { p.x = selfX; p.y = selfY; continue }
      const d = disp.get(p.id) ?? { x: p.x, y: p.y }
      const k = 1 - Math.exp(-10 * dt)
      d.x += (p.x - d.x) * k
      d.y += (p.y - d.y) * k
      disp.set(p.id, d)
      p.x = d.x; p.y = d.y
    }

    current = me ? scanInteract(world, st, net.selfId, selfX, selfY) : null
    updatePrompt(current)
    updateHud(world, st, net, role)
    updateLog(st)

    const downNow = !!me && me.downUntil > st.t
    $('down-overlay').style.display = downNow ? 'flex' : 'none'

    // room label
    const rid = roomIdAt(world, selfX, selfY)
    if (rid !== lastRoom) {
      lastRoom = rid
      const label = rid >= 0 ? world.rooms[rid].name : 'Hull Vacuum'
      const el = $('room-label')
      el.textContent = label
      el.style.opacity = '1'
      clearTimeout(roomFadeTimer)
      roomFadeTimer = window.setTimeout(() => { el.style.opacity = '0' }, 1800)
    }

    const cv = renderer.cv
    const camX = selfX * TS - cv.width / 2
    const camY = selfY * TS - cv.height / 2
    renderer.draw(world, st, net.selfId, camX, camY, now)
  }
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- helpers

function roomIdAt(world: World, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y)
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return -1
  return world.roomOf[ty * world.w + tx]
}

function tileAt(world: World, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y)
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return TILE.SPACE
  return world.tiles[ty * world.w + tx]
}

function canStand(world: World, x: number, y: number): boolean {
  const R = 0.3
  for (const [dx, dy] of [[-R, -R], [R, -R], [-R, R], [R, R]] as const) {
    const t = tileAt(world, x + dx, y + dy)
    if (t !== TILE.FLOOR && t !== TILE.DOOR) return false
  }
  return true
}

function scanInteract(world: World, st: GameState, selfId: string, x: number, y: number): Interact | null {
  const inv = st.players[selfId]?.inv
  const reach = CFG.PLAYER_REACH
  let best: { d: number; it: Interact } | null = null
  const offer = (d: number, it: Interact) => {
    if (d <= reach && (!best || d < best.d)) best = { d, it }
  }

  for (const it of st.items) {
    offer(Math.hypot(it.x - x, it.y - y), {
      prompt: `<b>[E]</b> Take ${it.n > 1 ? it.n + ' ' : ''}${it.kind}`,
      act: { k: 'take', id: it.id },
    })
  }
  for (const b of st.breaches) {
    const ok = (inv?.sealant ?? 0) >= 1
    offer(Math.hypot(b.x - x, b.y - y), {
      prompt: ok ? '<b>[E]</b> Patch breach (1 sealant)' : 'Hull breach — need sealant',
      act: ok ? { k: 'patch', id: b.id } : null,
    })
  }
  for (const d of st.drones) {
    if (d.state !== 'dormant') continue
    const ok = (inv?.plate ?? 0) >= 2 && (inv?.lithium ?? 0) >= 2
    offer(Math.hypot(d.x - x, d.y - y), {
      prompt: ok
        ? '<b>[E]</b> Reflash Custodian (2 plate, 2 lithium)'
        : 'Dormant Custodian — needs 2 plate, 2 lithium',
      act: ok ? { k: 'drone', id: d.id } : null,
    })
  }
  for (const r of world.rooms) {
    if (!r.breaker) continue
    const bd = Math.hypot(r.breaker.x + 0.5 - x, r.breaker.y + 0.5 - y)
    const on = st.rooms[r.id].on
    offer(bd, {
      prompt: `<b>[E]</b> Breaker — ${r.name}: ${on ? 'CUT power' : `energize (${r.draw}W)`}`,
      act: { k: 'breaker', id: r.id },
    })
  }
  {
    const cd = Math.hypot(world.console.x + 0.5 - x, world.console.y + 0.5 - y)
    const ok = (inv?.plate ?? 0) >= CFG.REFIT_PLATE
    offer(cd, {
      prompt: ok
        ? `<b>[E]</b> Refit reactor rod (${CFG.REFIT_PLATE} plate → +${CFG.REFIT_WATTS}W)`
        : `Reactor console — rod refit needs ${CFG.REFIT_PLATE} plate`,
      act: ok ? { k: 'console' } : null,
    })
  }
  {
    const dd = Math.hypot(world.depot.x + 0.5 - x, world.depot.y + 0.5 - y)
    const n = inv?.sealant ?? 0
    offer(dd, {
      prompt: n > 0
        ? `<b>[E]</b> Stock depot with ${n} sealant (Custodians draw from it)`
        : `Depot holds ${st.depotSealant} sealant — Custodians patch from here`,
      act: n > 0 ? { k: 'depot' } : null,
    })
  }
  return best ? (best as { d: number; it: Interact }).it : null
}

function updatePrompt(cur: Interact | null) {
  const el = $('prompt')
  if (!cur) { el.style.display = 'none'; return }
  el.style.display = 'block'
  el.innerHTML = cur.prompt
}

function demandOf(world: World, st: GameState): number {
  let d = 0
  for (let i = 0; i < world.rooms.length; i++) if (st.rooms[i].on) d += world.rooms[i].draw
  for (const dr of st.drones) if (dr.state === 'active') d += 3
  return d
}

function updateHud(world: World, st: GameState, net: Net, role: Role) {
  const me = st.players[net.selfId]
  if (me) {
    ($('o2fill')).style.width = `${me.o2}%`
    ;($('hpfill')).style.width = `${me.hp}%`
    $('inv').textContent = `Plate ${me.inv.plate} · Sealant ${me.inv.sealant} · Lithium ${me.inv.lithium}`
  }
  const demand = demandOf(world, st)
  $('reactline').textContent = `${st.reactor.out.toFixed(0)}W`
  const dl = $('drawline')
  dl.textContent = `draw ${demand}W ${demand > st.reactor.out ? '— OVERDRAWN, shedding decks' : ''}`
  dl.classList.toggle('over', demand > st.reactor.out)
  const alive = totalSleepers(st)
  $('sleepline').textContent = `${alive.toLocaleString()} sleepers${st.deaths > 0 ? ` · ${st.deaths} lost` : ''}`
  const day = Math.floor(st.t / 600) + 1
  const mm = Math.floor((st.t % 600) / 60)
  const ss = Math.floor(st.t % 60)
  $('dayline').textContent = `shift ${day} · ${mm}:${String(ss).padStart(2, '0')} · ${role}`
  const n = Object.keys(st.players).length
  $('crewline').textContent = `${n} steward${n === 1 ? '' : 's'} aboard`
}

let lastLogLen = -1
function updateLog(st: GameState) {
  if (st.log.length === lastLogLen) return
  lastLogLen = st.log.length
  const el = $('log')
  el.innerHTML = ''
  for (const entry of st.log.slice(-6)) {
    const div = document.createElement('div')
    div.className = entry.kind
    div.textContent = entry.msg
    el.appendChild(div)
  }
}

function drawWaiting(renderer: Renderer, now: number) {
  const { ctx, cv } = renderer
  ctx.fillStyle = '#04060b'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = `rgba(201,162,39,${0.4 + 0.25 * Math.sin(now / 400)})`
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('reaching the hull registry…', cv.width / 2, cv.height / 2)
}
