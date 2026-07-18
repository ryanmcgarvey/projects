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
  // built (hp>0) tanks count, not online ones: a brownout must not vaporize stored surplus
  const tanks = s.modules.filter(m => m.kind === 'tank' && m.hp > 0).length
  const caps = { ...C.BASE_CAP }
  for (const r of Object.keys(caps) as Res[]) caps[r] += tanks * C.TANK_CAP
  caps.burnstock = 1e9 // the move fund is a reserve, not a commodity — never capped away
  return caps
}

export function stockSpace(s: GameState, res: Res): number {
  return Math.max(0, stockCaps(s)[res] - s.stocks[res])
}

/** Deposit up to cap. Returns the amount actually accepted — callers must conserve the rest. */
export function addStock(s: GameState, res: Res, amount: number): number {
  if (amount <= 0) {
    s.stocks[res] = Math.max(0, s.stocks[res] + amount)
    return amount
  }
  const accepted = Math.min(amount, stockSpace(s, res))
  s.stocks[res] += accepted
  return accepted
}

export function sanitizeName(name: string): string {
  return name.replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Keeper'
}

export function ensurePlayer(s: GameState, id: string, name: string) {
  const clean = sanitizeName(name)
  if (s.players[id]) { s.players[id].name = clean; return }
  s.players[id] = {
    id, name: clean,
    x: s.station.x, y: s.station.y + 60,
    hull: 100, hold: {}, downUntil: 0,
    thrusting: false, firing: false, miningBody: -1, lastStateT: 0,
  }
  addLog(s, `${clean} undocked a skiff from the yard.`, 'good')
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
