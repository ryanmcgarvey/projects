import { C, MODULES, CREW_NAMES } from '../constants'
import { exposedEdges, neighbors } from '../grid'
import { pick } from '../rng'
import { GameState } from '../types'
import { addLog, clamp } from '../util'

const NOISY = new Set(['refinery', 'yard', 'reactor'])
const LIT = new Set(['gallery', 'hydro'])

/** Power budget: mark modules online, shedding by rank when overdrawn. */
export function tickPower(s: GameState) {
  const transit = s.weigh.phase === 'transit'
  // the taper has teeth: a city with no anchorfeed browns out to life support
  // (starvedSince provides hysteresis — recovery needs a real buffer, not one tick)
  const starving = s.stocks.anchorfeed <= 0 || s.starvedSince > 0
  // life support set: during transit only core+pd; while starving the refinery
  // stays lit too — a dying mooring must never lock the door on funding the Weigh
  const KEEP_TRANSIT = new Set(['core', 'pd', 'reactor'])
  const KEEP_STARVING = new Set(['core', 'pd', 'reactor', 'refinery', 'tank'])
  for (const m of s.modules) {
    m.online = m.hp > 0
    if (m.online && s.dark && LIT.has(m.kind)) m.online = false
    if (m.online && transit && !KEEP_TRANSIT.has(m.kind)) m.online = false
    else if (m.online && starving && !KEEP_STARVING.has(m.kind)) m.online = false
  }
  let supply = 0
  let draw = 0
  for (const m of s.modules) {
    if (!m.online) continue
    const w = MODULES[m.kind].watts
    if (w > 0) supply += w
    else draw -= w
  }
  const shedOrder = s.modules
    .filter(m => m.online && MODULES[m.kind].watts < 0)
    .sort((a, b) => MODULES[b.kind].shedRank - MODULES[a.kind].shedRank)
  for (const m of shedOrder) {
    if (draw <= supply) break
    m.online = false
    draw += MODULES[m.kind].watts
  }
}

/** Beauty pays rent: composable layout properties, no template. */
export function computeThrive(s: GameState): number {
  let t = 0
  for (const m of s.modules) {
    if (!m.online) continue
    if (m.kind === 'gallery') t += C.THRIVE_GALLERY + exposedEdges(s, m) * C.THRIVE_EXPOSED_EDGE
    if (m.kind === 'hydro') t += C.THRIVE_HYDRO
    if (m.kind === 'berth') {
      t += exposedEdges(s, m) * C.THRIVE_EXPOSED_EDGE
      for (const n of neighbors(s, m.gx, m.gy)) {
        if (n.kind === 'hydro' && n.online) t += C.THRIVE_GREEN_ADJ
        if (NOISY.has(n.kind)) t += C.THRIVE_NOISE_ADJ
      }
    }
  }
  if (s.stocks.anchorfeed <= 0) t += C.THRIVE_STARVING
  return clamp(Math.round(t), 0, 100)
}

export function berthCap(s: GameState): number {
  return 1 + 2 * s.modules.filter(m => m.kind === 'berth' && m.online).length
}

export function crewMult(s: GameState, role: 'refinery' | 'yard' | 'guns'): number {
  if (s.stocks.anchorfeed <= 0) return 1 // unfed hands down tools
  const n = s.crew.filter(c => c.role === role).length
  const thriveScale = 1 + s.thrive / 200
  return 1 + n * C.CREW_BOOST * thriveScale
}

export function tickCrew(s: GameState, dt: number) {
  s.thrive = computeThrive(s)

  // starvation: unfed crew stop mattering fast, then leave.
  // Recovery requires a real buffer (hysteresis) so the brownout doesn't flicker.
  if (s.stocks.anchorfeed <= 0) {
    if (s.starvedSince === 0) {
      s.starvedSince = s.t
      addLog(s, 'Anchorfeed dry — the city browns out to life support.', 'bad')
    }
  } else if (s.starvedSince > 0 && s.stocks.anchorfeed > 8) {
    s.starvedSince = 0
    addLog(s, 'The vein flows again. Decks re-lit.', 'good')
  }
  // misery needs a sustained grace window: a 60s defensive dark run (the Hush
  // counterplay) or the deliberate blackout of a Weigh transit never fires crew
  if (s.thrive < C.SIEGE_THRIVE_LEAVE && s.weigh.phase === 'moored') {
    if (s.lowThriveSince === 0) s.lowThriveSince = s.t
  } else {
    s.lowThriveSince = 0
  }
  const starving = s.starvedSince > 0 && s.t - s.starvedSince > C.STARVE_CREW_LEAVE_SECS
  const miserable = s.lowThriveSince > 0 && s.t - s.lowThriveSince > C.THRIVE_LOW_GRACE

  if ((starving || miserable) && s.crew.length > 0 && s.t >= s.leaveAt) {
    const gone = s.crew.shift()!
    s.leaveAt = s.t + 45
    addLog(s, `${gone.name} shipped out with the last caravan. (${starving ? 'unfed' : 'the city feels like a box'})`, 'warn')
  }

  // recruitment: kithships carry gossip — the lit, thriving city gets walk-ons
  if (s.weigh.phase === 'moored' && s.thrive >= C.RECRUIT_MIN_THRIVE && s.crew.length < berthCap(s)) {
    if (s.recruitAt === 0) {
      s.recruitAt = s.t + recruitInterval(s)
    } else if (s.t >= s.recruitAt) {
      const name = pick(s, CREW_NAMES.filter(n => !s.crew.some(c => c.name === n)) as string[]) ?? 'Drift'
      s.crew.push({ id: s.nextId++, name, role: 'idle' })
      s.recruitAt = s.t + recruitInterval(s)
      addLog(s, `${name} walked on at the dock, drawn by the lights. Assign them a post.`, 'good')
    }
  } else if (s.thrive < C.RECRUIT_MIN_THRIVE) {
    s.recruitAt = 0
  }
  void dt
}

function recruitInterval(s: GameState): number {
  const k = clamp((s.thrive - C.RECRUIT_MIN_THRIVE) / (100 - C.RECRUIT_MIN_THRIVE), 0, 1)
  return C.RECRUIT_SLOW - k * (C.RECRUIT_SLOW - C.RECRUIT_FAST)
}
