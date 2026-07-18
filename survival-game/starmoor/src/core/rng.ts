import { GameState } from './types'

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Pure mulberry32 step: returns [value 0..1, next state]. */
export function next(state: number): [number, number] {
  let a = (state + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a >>> 0]
}

/** Draw from the state's rng stream. All sim randomness flows through here. */
export function rand(s: GameState): number {
  const [v, ns] = next(s.rngState)
  s.rngState = ns
  return v
}

export function randRange(s: GameState, lo: number, hi: number): number {
  return lo + rand(s) * (hi - lo)
}

export function randInt(s: GameState, lo: number, hi: number): number {
  return lo + Math.floor(rand(s) * (hi - lo + 1))
}

export function pick<T>(s: GameState, arr: T[]): T {
  return arr[Math.floor(rand(s) * arr.length)]
}
