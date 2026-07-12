import { C } from './constants'
import { GameState, LogEntry, Res, Stocks } from './types'

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function addLog(s: GameState, msg: string, kind: LogEntry['kind'] = 'info') {
  s.log.push({ t: s.t, msg, kind })
  if (s.log.length > C.LOG_MAX) s.log.splice(0, s.log.length - C.LOG_MAX)
}

export function canAfford(stocks: Stocks, cost: Partial<Record<Res, number>>): boolean {
  return (Object.keys(cost) as Res[]).every(r => stocks[r] >= (cost[r] ?? 0))
}

export function spend(stocks: Stocks, cost: Partial<Record<Res, number>>) {
  for (const r of Object.keys(cost) as Res[]) stocks[r] -= cost[r] ?? 0
}

export function stockCaps(s: GameState): Record<Res, number> {
  const tanks = s.modules.filter(m => m.kind === 'tank' && m.online).length
  const caps = { ...C.BASE_CAP }
  for (const r of Object.keys(caps) as Res[]) caps[r] += tanks * C.TANK_CAP
  return caps
}

export function addStock(s: GameState, res: Res, amount: number) {
  const caps = stockCaps(s)
  s.stocks[res] = clamp(s.stocks[res] + amount, 0, caps[res])
}

export function ensurePlayer(s: GameState, id: string, name: string) {
  if (s.players[id]) { s.players[id].name = name; return }
  s.players[id] = {
    id, name,
    x: s.station.x, y: s.station.y + 60,
    hull: 100, hold: {}, downUntil: 0,
    thrusting: false, firing: false, miningBody: -1,
  }
  addLog(s, `${name} undocked a skiff from the yard.`, 'good')
}

export function removePlayer(s: GameState, id: string) {
  const p = s.players[id]
  if (!p) return
  delete s.players[id]
  addLog(s, `${p.name} berthed and went below.`, 'info')
}

export function wealthOf(s: GameState): number {
  let w = 0
  for (const r of Object.keys(s.stocks) as Res[]) {
    w += s.stocks[r] * (r === 'ice' ? 0.5 : r === 'ferrite' ? 1 : r === 'isotopes' ? 2 : r === 'burnstock' ? 1.5 : 0)
  }
  return w
}
