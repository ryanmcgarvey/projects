// Composition root: wires the pure core to the adapters and runs the loop.
// This file may read GameState (it owns the instance); rendering goes through
// selectors, mutation goes through applyCommand — nothing else touches the sim.
import {
  createGame, tick, applyCommand, serialize, deserialize,
  chartTable, factionsView, emissionsView, renderModel,
  ensurePlayer, removePlayer, holdTotal,
  C, MODULES,
} from '../core'
import type { Command, GameState, ModuleKind } from '../core'
import { Renderer, Camera } from '../adapters/render2d/renderer'
import { Input } from '../adapters/input/keyboard'
import { Net } from '../adapters/net/trystero'
import * as persist from '../adapters/persist/local'
import { Hud } from '../ui/hud'

const $ = (id: string) => document.getElementById(id) as HTMLElement

// ---------------------------------------------------------------- join flow

const nameInput = $('name') as HTMLInputElement
const roomInput = $('room') as HTMLInputElement
nameInput.value = localStorage.getItem('starmoor-name') ?? ''
roomInput.value = new URLSearchParams(location.search).get('room') ?? randomCode()

function randomCode(): string {
  const alpha = 'abcdefghjkmnpqrstvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(5))).map(b => alpha[b % alpha.length]).join('')
}

$('board').addEventListener('click', () => {
  const name = (nameInput.value.trim() || 'Keeper').slice(0, 16)
  const room = (roomInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || randomCode()).slice(0, 12)
  localStorage.setItem('starmoor-name', name)
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
const BUILD_KEYS: ModuleKind[] = ['reactor', 'refinery', 'tank', 'berth', 'gallery', 'hydro', 'pd', 'yard']

async function start(name: string, room: string) {
  const cv = document.getElementById('cv') as HTMLCanvasElement
  const renderer = new Renderer(cv)
  const input = new Input(cv)
  const net = new Net()
  const dispatch = (cmd: Command) => {
    if (role === 'host' && state) applyCommand(state, net.selfId, cmd)
    else if (role === 'guest') net.cmd(cmd)
  }
  const hud = new Hud(dispatch)

  let role: Role = 'pending'
  let state: GameState | null = null       // host: authoritative; guest: last snapshot
  let hostId: string | null = null
  let lastStateAt = performance.now()
  let lastHelloAt = 0

  // local ship (client-authoritative movement)
  let selfX = 0, selfY = 0, velX = 0, velY = 0
  let buildMode = false
  let buildSel: ModuleKind = 'gallery'

  const becomeHost = (from?: GameState | null) => {
    const saved = from ?? (persist.load(room) ? deserialize(persist.load(room)!) : null)
    state = saved ?? createGame(room)
    role = 'host'
    hostId = null
    for (const pid of Object.keys(state.players))
      if (pid !== net.selfId && !net.peers.has(pid)) removePlayer(state, pid)
    ensurePlayer(state, net.selfId, name)
    const me = state.players[net.selfId]
    selfX = me.x; selfY = me.y
  }

  const adoptState = (st: GameState, from: string) => {
    role = 'guest'
    hostId = from
    state = st
    lastStateAt = performance.now()
    const me = st.players[net.selfId]
    if (!me) {
      if (performance.now() - lastHelloAt > 3000) { lastHelloAt = performance.now(); net.hello(name) }
      return
    }
    if (me.downUntil > st.t || Math.hypot(me.x - selfX, me.y - selfY) > 150) {
      selfX = me.x; selfY = me.y; velX = 0; velY = 0
    }
  }

  await net.join(room, {
    onHello: (peer, peerName) => {
      if (role === 'host' && state) {
        ensurePlayer(state, peer, peerName)
        net.world(serialize(state), peer)
      }
    },
    onWorld: (raw, from) => {
      if (role === 'host') return
      const st = deserialize(raw)
      if (st) adoptState(st, from)
    },
    onState: (snap, from) => {
      const st = snap as GameState
      if (role === 'host' && state) {
        if (st.t > state.t) adoptState(st, from)   // duel: the older world wins
      } else {
        adoptState(st, from)
      }
    },
    onCmd: (peer, cmd) => { if (role === 'host' && state) applyCommand(state, peer, cmd) },
    onPeerLeave: peer => {
      if (role === 'host' && state) removePlayer(state, peer)
      else if (peer === hostId) tryElection()
    },
  })

  if (!net.ok) $('offline-badge').style.display = 'block'
  net.hello(name)
  setTimeout(() => { if (role === 'pending') becomeHost() }, net.ok ? 3000 : 0)

  const tryElection = () => {
    if (role === 'host' || !state) return
    const rivals = [...net.peers].filter(p => p !== hostId)
    if (rivals.every(p => p > net.selfId)) becomeHost(state)
    else hostId = null
  }

  // ------------------------------------------------------------ key bindings

  input.on('b', () => { buildMode = !buildMode })
  input.on('escape', () => { buildMode = false })
  input.on('l', () => dispatch({ c: 'dark' }))
  input.on('e', () => { if (currentAction) dispatch(currentAction) })
  for (let i = 0; i < BUILD_KEYS.length; i++) {
    input.on(String(i + 1), () => { if (buildMode) buildSel = BUILD_KEYS[i] })
  }

  $('hud-left').hidden = false
  $('hud-right').hidden = false
  $('controls-hint').hidden = false
  $('roomcode').textContent = room
  $('roomcode').addEventListener('click', () => {
    void navigator.clipboard?.writeText(location.href)
    $('roomcode').textContent = 'copied!'
    setTimeout(() => { $('roomcode').textContent = room }, 1200)
  })

  // ------------------------------------------------------------ loop

  let last = performance.now()
  let simAcc = 0, castAcc = 0, cmdAcc = 0, saveAcc = 0, hudAcc = 0
  let currentAction: Command | null = null
  let currentPrompt: string | null = null

  const frame = (now: number) => {
    requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!state) { drawWaiting(renderer, now); return }
    const s = state
    const me = s.players[net.selfId]
    const alive = !!me && me.downUntil <= s.t

    // ship physics (client-authoritative)
    if (alive && !buildMode) {
      const ax = input.axis()
      velX += ax.x * 260 * dt
      velY += ax.y * 260 * dt
    }
    const drag = Math.exp(-1.6 * dt)
    velX *= drag; velY *= drag
    const sp = Math.hypot(velX, velY)
    if (sp > C.SHIP_SPEED) { velX *= C.SHIP_SPEED / sp; velY *= C.SHIP_SPEED / sp }
    selfX = Math.max(0, Math.min(s.field.w, selfX + velX * dt))
    selfY = Math.max(0, Math.min(s.field.h, selfY + velY * dt))

    // continuous intent
    const thrusting = input.axis().x !== 0 || input.axis().y !== 0
    const firing = input.down(' ')
    const miningBody = input.down('m') && alive ? nearestMineable(s, selfX, selfY) : -1
    const stateCmd: Command = { c: 'state', x: selfX, y: selfY, thrusting, firing, miningBody }
    if (role === 'host') {
      applyCommand(s, net.selfId, stateCmd)
      simAcc += dt
      while (simAcc >= C.TICK) {
        tick(s, C.TICK, Object.keys(s.players).length)
        simAcc -= C.TICK
      }
      castAcc += dt
      if (castAcc >= 0.25) { castAcc = 0; net.state(s) }
      saveAcc += dt
      if (saveAcc >= 10) { saveAcc = 0; persist.save(room, serialize(s)) }
    } else {
      cmdAcc += dt
      if (cmdAcc >= 0.1) { cmdAcc = 0; net.cmd(stateCmd) }
      if (performance.now() - lastStateAt > 6000) tryElection()
      if (me) { me.x = selfX; me.y = selfY } // local echo for render
    }

    // camera
    const cam: Camera = buildMode
      ? { x: s.station.x, y: s.station.y, zoom: 3.2 }
      : { x: selfX, y: selfY, zoom: 1 }

    // build mode clicks
    const model = renderModel(s)
    let hoverCell: { gx: number; gy: number } | null = null
    if (buildMode) {
      const wx = (input.mouseX - cv.width / 2) / cam.zoom + cam.x
      const wy = (input.mouseY - cv.height / 2) / cam.zoom + cam.y
      const gx = Math.round((wx - s.station.x) / C.CELL + C.GRID_CENTER)
      const gy = Math.round((wy - s.station.y) / C.CELL + C.GRID_CENTER)
      if (gx >= 0 && gy >= 0 && gx < C.GRID && gy < C.GRID) hoverCell = { gx, gy }
      for (const click of input.takeClicks()) {
        const hc = hoverCell
        if (!hc) continue
        const existing = s.modules.find(mm => mm.gx === hc.gx && mm.gy === hc.gy)
        if (click.right && existing) dispatch({ c: 'demolish', gx: hc.gx, gy: hc.gy })
        else if (existing && existing.hp < C.MODULE_HP) dispatch({ c: 'repair', gx: hc.gx, gy: hc.gy })
        else if (!existing) dispatch({ c: 'build', kind: buildSel, gx: hc.gx, gy: hc.gy })
      }
      hud.palette(true, BUILD_KEYS.map((k, i) => {
        const cost = Object.entries(MODULES[k].cost).map(([r, n]) => `${n}${r.slice(0, 2)}`).join(' ')
        return `<span class="${k === buildSel ? 'sel' : ''}">[${i + 1}] ${k} <i>${cost || 'free'}</i></span>`
      }).join(' ') + ' · click place · right-click demolish · [B] done')
    } else {
      input.takeClicks()
      hud.palette(false, '')
    }

    // context action
    ;[currentAction, currentPrompt] = alive ? scanAction(s, net.selfId, selfX, selfY) : [null, null]
    hud.prompt(buildMode ? null : currentPrompt)

    // render + HUD
    renderer.draw(model, cam, net.selfId, now, buildMode, hoverCell)
    hudAcc += dt
    if (hudAcc >= 0.2) {
      hudAcc = 0
      hud.update(
        chartTable(s), factionsView(s), emissionsView(s),
        me ? { hull: Math.max(0, me.hull), hold: me.hold, holdTotal: holdTotal(me) } : null,
        s.crew, s.stocks, s.log,
      )
      $('down-overlay').style.display = me && me.downUntil > s.t ? 'flex' : 'none'
    }
  }
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- helpers

function nearestMineable(s: GameState, x: number, y: number): number {
  let best = -1, bd = Infinity
  for (const b of s.bodies) {
    if (b.richness <= 0) continue
    const d = Math.hypot(b.x - x, b.y - y) - b.r
    if (d < C.MINE_RANGE && d < bd) { bd = d; best = b.id }
  }
  return best
}

/** Context-sensitive E action. Pure read over state; emits a Command. */
function scanAction(s: GameState, pid: string, x: number, y: number): [Command | null, string | null] {
  const near = (bx: number, by: number, r: number) => Math.hypot(bx - x, by - y) < r
  const me = s.players[pid]
  const yard = s.modules.some(m => m.kind === 'yard' && m.online)

  // toll gate: pay the lump
  for (const n of s.npcs) {
    if (n.kind === 'tollgate' && near(n.x, n.y, 160)) {
      return [{ c: 'payToll', npcId: n.id }, `<b>[E]</b> Pay the Combine's lump (${C.TOLL_PAYOFF_ISOTOPES} isotopes) — or burn the gate`]
    }
  }
  // beacons
  for (const b of s.beacons) {
    if (!b.revealed && near(b.x, b.y, 150)) {
      return [{ c: 'prospect', beaconId: b.id }, '<b>[E]</b> Survey the mooring beacon']
    }
  }
  // claims: repair / lane / picket
  for (const cl of s.claims) {
    const body = s.bodies.find(b => b.id === cl.bodyId)
    if (!body || !near(body.x, body.y, 140)) continue
    if (cl.hp < C.RIG_HP) return [{ c: 'repairRig', claimId: cl.id }, '<b>[E]</b> Repair the claim rig (5 fe)']
    const lane = s.lanes.find(l => l.claimId === cl.id)
    if (!lane) return [yard ? { c: 'lane', claimId: cl.id } : null,
      yard ? '<b>[E]</b> Rig a freight lane to the city (12 fe, 4 iso)' : 'A lane needs a yard online']
    if (!lane.picket) return [yard ? { c: 'picket', laneId: lane.id } : null,
      yard ? '<b>[E]</b> Post a picket on this lane (8 fe, 6 iso)' : 'A picket needs a yard online']
    return [null, `Silo ${cl.silo.toFixed(0)}/60 — the lane is running`]
  }
  // unclaimed bodies
  for (const b of s.bodies) {
    if (b.richness <= 0 || b.id === s.mooringBodyId) continue
    if (s.claims.some(cl => cl.bodyId === b.id)) continue
    if (near(b.x, b.y, b.r + 90)) {
      return [yard ? { c: 'rig', bodyId: b.id } : null,
        yard ? `<b>[E]</b> Plant a claim rig — ${b.res} (20 fe) · hold <b>M</b> to mine by hand`
             : `Hold <b>M</b> to mine ${b.res} by hand · rigs need a yard online`]
    }
  }
  // station: transfer
  if (near(s.station.x, s.station.y, C.DOCK_RANGE) && me && holdTotal(me) > 0.5) {
    return [{ c: 'transfer' }, '<b>[E]</b> Transfer hold to city stores']
  }
  return [null, null]
}

function drawWaiting(renderer: Renderer, now: number) {
  const { ctx, cv } = renderer
  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = `rgba(216,178,58,${0.4 + 0.25 * Math.sin(now / 400)})`
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('raising the harbor registry…', cv.width / 2, cv.height / 2)
}
