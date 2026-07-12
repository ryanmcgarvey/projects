// Read-models for renderer and HUD. Plain data out — adapters never touch GameState internals
// for anything but these, which is what keeps the renderer swappable.
import { C, MODULES } from './constants'
import { moduleWorld } from './grid'
import { anchorfeedDraw, anchorfeedYield } from './sim/economy'
import { emissionRates, tierOf } from './sim/emissions'
import { laneMidpoint } from './sim/factions'
import { weighCost } from './sim/weigh'
import { GameState, FactionId } from './types'

export interface ChartTable {
  leg: number
  phase: string
  phaseEndsIn: number
  yieldNow: number
  yieldPct: number         // vs arrival strength — the mooring's remaining life, legible
  drawNow: number
  feed: number
  feedCap: number
  burnstock: number
  weighCost: number
  spikeRemaining: number
  daysFree: number
  options: { id: number; revealed: boolean; label: string }[]
  crew: number
  berths: number
  thrive: number
  dark: boolean
}

export function chartTable(s: GameState): ChartTable {
  const berths = 1 + 2 * s.modules.filter(m => m.kind === 'berth' && m.online).length
  return {
    leg: s.leg,
    phase: s.weigh.phase,
    phaseEndsIn: s.weigh.phase === 'moored' ? 0 : Math.max(0, s.weigh.endsAt - s.t),
    yieldNow: anchorfeedYield(s),
    yieldPct: Math.round(100 * Math.exp(-s.tLeg / s.mooringTau)),
    drawNow: anchorfeedDraw(s),
    feed: s.stocks.anchorfeed,
    feedCap: C.BASE_CAP.anchorfeed + C.TANK_CAP * s.modules.filter(m => m.kind === 'tank' && m.online).length,
    burnstock: s.stocks.burnstock,
    weighCost: weighCost(s),
    spikeRemaining: Math.max(0, s.spikeUntil - s.t),
    daysFree: s.daysFree,
    options: s.beacons.map(b => ({
      id: b.id,
      revealed: b.revealed,
      label: b.revealed
        ? `${b.mix} · vein ${b.a0.toFixed(1)}/s · ~${Math.round(b.tau / 60)}min · ${b.shoals} shoals`
        : 'unsurveyed bearing',
    })),
    crew: s.crew.length,
    berths,
    thrive: s.thrive,
    dark: s.dark,
  }
}

export interface FactionView {
  id: FactionId
  heat: number
  tier: number
  nextAt: number
  active: boolean
  belligerence: number
}

export function factionsView(s: GameState): FactionView[] {
  return (['combine', 'breakers', 'hush'] as FactionId[]).map(id => {
    const f = s.factions[id]
    const tier = tierOf(f.heat)
    const nextAt = tier === 0 ? C.HEAT_T1 : tier === 1 ? C.HEAT_T2 : C.HEAT_T3
    return {
      id, heat: Math.round(f.heat), tier, nextAt,
      active: s.npcs.some(n => n.faction === id),
      belligerence: f.belligerence,
    }
  })
}

export interface Emissions { glare: number; wake: number; chatter: number }
export function emissionsView(s: GameState): Emissions {
  return emissionRates(s)
}

export interface RenderModel {
  field: { w: number; h: number }
  station: { x: number; y: number }
  mooringBodyId: number
  dark: boolean
  bodies: { id: number; kind: string; x: number; y: number; r: number; res: string; richness: number; claimed: boolean }[]
  shoals: { x: number; y: number; r: number }[]
  beacons: { id: number; x: number; y: number; revealed: boolean }[]
  modules: { kind: string; gx: number; gy: number; x: number; y: number; online: boolean; hp: number; marked: boolean; watts: number }[]
  claims: { id: number; x: number; y: number; silo: number; siloRes: string; online: boolean; hp: number }[]
  lanes: { id: number; x1: number; y1: number; x2: number; y2: number; damped: boolean; tithe: number; picket: boolean; midX: number; midY: number }[]
  npcs: { id: number; kind: string; faction: string; x: number; y: number; hpPct: number }[]
  players: { id: string; name: string; x: number; y: number; hull: number; down: boolean; thrusting: boolean; firing: boolean; mining: boolean }[]
  pickups: { id: number; x: number; y: number }[]
  fx: { kind: string; x: number; y: number; ttl: number }[]
  cell: number
  gridN: number
  gridCenter: number
}

export function renderModel(s: GameState): RenderModel {
  return {
    field: s.field,
    station: s.station,
    mooringBodyId: s.mooringBodyId,
    dark: s.dark,
    bodies: s.bodies.map(b => ({
      id: b.id, kind: b.kind, x: b.x, y: b.y, r: b.r, res: b.res, richness: b.richness,
      claimed: s.claims.some(cl => cl.bodyId === b.id),
    })),
    shoals: s.shoals,
    beacons: s.beacons.map(b => ({ id: b.id, x: b.x, y: b.y, revealed: b.revealed })),
    modules: s.modules.map(m => {
      const at = moduleWorld(s, m)
      return {
        kind: m.kind, gx: m.gx, gy: m.gy, x: at.x, y: at.y,
        online: m.online, hp: m.hp / C.MODULE_HP,
        marked: m.markedUntil > 0 && s.t < m.markedUntil,
        watts: MODULES[m.kind].watts,
      }
    }),
    claims: s.claims.map(cl => {
      const b = s.bodies.find(x => x.id === cl.bodyId)
      return {
        id: cl.id, x: b?.x ?? 0, y: b?.y ?? 0,
        silo: cl.silo, siloRes: cl.siloRes, online: cl.online, hp: cl.hp / C.RIG_HP,
      }
    }),
    lanes: s.lanes.map(l => {
      const cl = s.claims.find(x => x.id === l.claimId)
      const b = cl && s.bodies.find(x => x.id === cl.bodyId)
      const mid = laneMidpoint(s, l)
      return {
        id: l.id, x1: s.station.x, y1: s.station.y, x2: b?.x ?? 0, y2: b?.y ?? 0,
        damped: l.damped, tithe: l.tithe, picket: l.picket,
        midX: mid?.x ?? 0, midY: mid?.y ?? 0,
      }
    }),
    npcs: s.npcs.map(n => ({
      id: n.id, kind: n.kind, faction: n.faction, x: n.x, y: n.y, hpPct: n.hp / n.maxHp,
    })),
    players: Object.values(s.players).map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, hull: p.hull,
      down: p.downUntil > s.t, thrusting: p.thrusting, firing: p.firing, mining: p.miningBody >= 0,
    })),
    pickups: s.pickups.map(pk => ({ id: pk.id, x: pk.x, y: pk.y })),
    fx: s.fx.map(f => ({ kind: f.kind, x: f.x, y: f.y, ttl: f.until - s.t })),
    cell: C.CELL,
    gridN: C.GRID,
    gridCenter: C.GRID_CENTER,
  }
}
