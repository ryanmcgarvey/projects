import { GameState, TILE, World } from './types'
import { hash2 } from './prng'

export const TS = 26 // px per tile

const ROOM_TINT: Record<string, string> = {
  reactor: '#2b2317', cryo: '#16242e', corridor: '#1c1f26', hydro: '#1a2619',
  storage: '#211f1a', workshop: '#241e16', quarters: '#1f1a20', vault: '#181d2a',
  void: '#0a0c12',
}

export class Renderer {
  cv: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  dark: HTMLCanvasElement
  dctx: CanvasRenderingContext2D

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv
    this.ctx = cv.getContext('2d')!
    this.dark = document.createElement('canvas')
    this.dctx = this.dark.getContext('2d')!
    const fit = () => {
      this.cv.width = window.innerWidth
      this.cv.height = window.innerHeight
      this.dark.width = window.innerWidth
      this.dark.height = window.innerHeight
    }
    fit()
    window.addEventListener('resize', fit)
  }

  draw(world: World, s: GameState, selfId: string, camX: number, camY: number, now: number) {
    const { ctx, cv } = this
    const px = (wx: number) => Math.round(wx * TS - camX)
    const py = (wy: number) => Math.round(wy * TS - camY)

    ctx.fillStyle = '#04060b'
    ctx.fillRect(0, 0, cv.width, cv.height)

    const x0 = Math.max(0, Math.floor(camX / TS) - 1)
    const y0 = Math.max(0, Math.floor(camY / TS) - 1)
    const x1 = Math.min(world.w - 1, Math.ceil((camX + cv.width) / TS) + 1)
    const y1 = Math.min(world.h - 1, Math.ceil((camY + cv.height) / TS) + 1)

    // --- tiles ---
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = world.tiles[ty * world.w + tx]
        const X = px(tx), Y = py(ty)
        if (t === TILE.SPACE) {
          if (hash2(tx, ty) % 97 < 3) {
            ctx.fillStyle = 'rgba(190,200,230,0.5)'
            ctx.fillRect(X + (hash2(tx, ty) % TS), Y + (hash2(ty, tx) % TS), 1, 1)
          }
          continue
        }
        if (t === TILE.WALL) {
          ctx.fillStyle = '#39424f'
          ctx.fillRect(X, Y, TS, TS)
          ctx.fillStyle = '#2c343f'
          ctx.fillRect(X + 2, Y + 2, TS - 4, TS - 4)
          continue
        }
        const rid = world.roomOf[ty * world.w + tx]
        const type = rid >= 0 ? world.rooms[rid].type : 'corridor'
        ctx.fillStyle = ROOM_TINT[type] ?? '#1c1f26'
        ctx.fillRect(X, Y, TS, TS)
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'
        ctx.strokeRect(X + 0.5, Y + 0.5, TS - 1, TS - 1)
        if (t === TILE.DOOR) {
          ctx.fillStyle = '#5c4d22'
          ctx.fillRect(X + 2, Y + 2, TS - 4, TS - 4)
          ctx.fillStyle = '#8a742f'
          ctx.fillRect(X + 4, Y + TS / 2 - 1, TS - 8, 2)
        }
      }
    }

    // --- fixtures ---
    for (const r of world.rooms) {
      const dyn = s.rooms[r.id]
      // cryo pods
      if (r.type === 'cryo') {
        for (let ty2 = r.y + 1; ty2 < r.y + r.h - 1; ty2++)
          for (let tx2 = r.x + 1; tx2 < r.x + r.w - 1; tx2++) {
            if ((tx2 - r.x) % 2 !== 1 || (ty2 - r.y) % 2 !== 1) continue
            if (tx2 < x0 || tx2 > x1 || ty2 < y0 || ty2 > y1) continue
            const X = px(tx2), Y = py(ty2)
            ctx.fillStyle = dyn.powered ? '#0e3d46' : '#26292e'
            ctx.fillRect(X + 4, Y + 2, TS - 8, TS - 4)
            ctx.fillStyle = dyn.powered ? `rgba(90,220,235,${0.5 + 0.2 * Math.sin(now / 700 + tx2)})` : '#3a3f45'
            ctx.fillRect(X + 7, Y + 5, TS - 14, TS - 12)
          }
      }
      // breaker panel
      if (r.breaker) {
        const X = px(r.breaker.x), Y = py(r.breaker.y)
        ctx.fillStyle = '#23282f'
        ctx.fillRect(X + 6, Y + 6, TS - 12, TS - 12)
        ctx.fillStyle = dyn.on ? '#46b558' : '#b5464a'
        ctx.fillRect(X + TS / 2 - 2, Y + TS / 2 - 2, 4, 4)
      }
    }
    // reactor console
    {
      const X = px(world.console.x), Y = py(world.console.y)
      ctx.fillStyle = '#123a38'
      ctx.fillRect(X + 3, Y + 3, TS - 6, TS - 6)
      ctx.fillStyle = `rgba(80,220,200,${0.5 + 0.3 * Math.sin(now / 400)})`
      ctx.fillRect(X + 7, Y + 7, TS - 14, TS - 14)
    }
    // depot
    {
      const X = px(world.depot.x), Y = py(world.depot.y)
      ctx.fillStyle = '#4a3d1c'
      ctx.fillRect(X + 3, Y + 5, TS - 6, TS - 10)
      ctx.fillStyle = '#c9a227'
      ctx.strokeStyle = '#c9a227'
      ctx.strokeRect(X + 3.5, Y + 5.5, TS - 7, TS - 11)
      ctx.fillRect(X + TS / 2 - 5, Y + TS / 2 - 1, 10, 2)
    }

    // --- items ---
    const ITEM_STYLE: Record<string, [string, string]> = {
      plate: ['#9aa7b8', 'P'], sealant: ['#46b5a5', 'S'], lithium: ['#d0d668', 'L'],
    }
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const it of s.items) {
      const X = px(it.x), Y = py(it.y)
      const [col, ch] = ITEM_STYLE[it.kind]
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(X - 7, Y - 7, 14, 14)
      ctx.strokeStyle = col
      ctx.strokeRect(X - 7.5, Y - 7.5, 15, 15)
      ctx.fillStyle = col
      ctx.fillText(it.n > 1 ? `${ch}${it.n}` : ch, X, Y + 0.5)
    }

    // --- breaches ---
    for (const b of s.breaches) {
      const X = px(b.x), Y = py(b.y)
      const pulse = 5 + 3 * Math.sin(now / 180 + b.id)
      ctx.strokeStyle = 'rgba(220,90,70,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(X, Y, pulse + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.fillStyle = '#180a08'
      ctx.beginPath()
      ctx.arc(X, Y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // --- drones ---
    for (const d of s.drones) {
      const X = px(d.x), Y = py(d.y)
      ctx.save()
      ctx.translate(X, Y)
      ctx.fillStyle = d.state === 'dormant' ? '#4a5058' : '#d8b23a'
      ctx.beginPath()
      ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath()
      ctx.fill()
      if (d.state === 'active') {
        ctx.fillStyle = `rgba(255,240,180,${0.4 + 0.3 * Math.sin(now / 220)})`
        ctx.fillRect(-1.5, -2, 3, 3)
      }
      ctx.restore()
    }

    // --- players ---
    ctx.font = '11px sans-serif'
    for (const p of Object.values(s.players)) {
      if (p.downUntil > s.t) continue
      const X = px(p.x), Y = py(p.y)
      ctx.fillStyle = p.id === selfId ? '#e4c95b' : '#b8955a'
      ctx.beginPath()
      ctx.arc(X, Y, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#20242c'
      ctx.beginPath()
      ctx.arc(X, Y - 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(230,235,245,0.85)'
      ctx.fillText(p.name, X, Y - 15)
    }

    // --- darkness ---
    const d = this.dctx
    d.globalCompositeOperation = 'source-over'
    d.clearRect(0, 0, this.dark.width, this.dark.height)
    d.fillStyle = 'rgba(3,6,14,0.90)'
    d.fillRect(0, 0, this.dark.width, this.dark.height)
    d.globalCompositeOperation = 'destination-out'
    for (const r of world.rooms) {
      if (!s.rooms[r.id].powered) continue
      const flicker = s.breaches.some(b => b.room === r.id)
        ? 0.55 + 0.2 * Math.sin(now / 60 + r.id * 7)
        : 0.82
      d.fillStyle = `rgba(0,0,0,${flicker})`
      d.fillRect(px(r.x) - 4, py(r.y) - 4, r.w * TS + 8, r.h * TS + 8)
    }
    for (const p of Object.values(s.players)) {
      if (p.downUntil > s.t) continue
      const X = px(p.x), Y = py(p.y)
      const g = d.createRadialGradient(X, Y, 10, X, Y, 130)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      d.fillStyle = g
      d.beginPath()
      d.arc(X, Y, 130, 0, Math.PI * 2)
      d.fill()
    }
    ctx.drawImage(this.dark, 0, 0)
  }
}
