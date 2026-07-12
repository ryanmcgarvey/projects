// Canvas2D renderer. Consumes RenderModel (plain data from core selectors) and a
// camera — it knows nothing about game rules. Swapping engines = rewriting this file.
import type { RenderModel } from '../../core'

export interface Camera { x: number; y: number; zoom: number }

const MODULE_COLOR: Record<string, string> = {
  core: '#d8b23a', reactor: '#c96a3d', refinery: '#8a742f', tank: '#5b6673',
  berth: '#7d6a9e', gallery: '#e0c568', hydro: '#5fae6e', pd: '#b5464a', yard: '#4a90a4',
}
const RES_COLOR: Record<string, string> = { ice: '#7fd4e8', ferrite: '#c9a58a', isotopes: '#c47fe8' }
const FACTION_COLOR: Record<string, string> = { combine: '#d8b23a', breakers: '#c94a3d', hush: '#8fa8c9' }

export class Renderer {
  cv: HTMLCanvasElement
  ctx: CanvasRenderingContext2D

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv
    this.ctx = cv.getContext('2d')!
    const fit = () => { cv.width = window.innerWidth; cv.height = window.innerHeight }
    fit()
    window.addEventListener('resize', fit)
  }

  sx(cam: Camera, x: number) { return (x - cam.x) * cam.zoom + this.cv.width / 2 }
  sy(cam: Camera, y: number) { return (y - cam.y) * cam.zoom + this.cv.height / 2 }

  draw(m: RenderModel, cam: Camera, selfId: string, now: number, buildMode: boolean, hoverCell: { gx: number; gy: number } | null) {
    const { ctx, cv } = this
    const z = cam.zoom
    ctx.fillStyle = '#05070d'
    ctx.fillRect(0, 0, cv.width, cv.height)

    // starfield
    ctx.fillStyle = 'rgba(200,210,235,0.5)'
    for (let i = 0; i < 140; i++) {
      const px = ((i * 1973 + 313) % 1900) / 1900 * cv.width
      const py = ((i * 3121 + 517) % 1300) / 1300 * cv.height
      const tw = (i % 5 === 0) ? 0.4 + 0.4 * Math.sin(now / 900 + i) : 0.7
      ctx.globalAlpha = tw
      ctx.fillRect(px, py, 1.2, 1.2)
    }
    ctx.globalAlpha = 1

    // field bounds
    ctx.strokeStyle = 'rgba(90,110,150,0.25)'
    ctx.setLineDash([6, 8])
    ctx.strokeRect(this.sx(cam, 0), this.sy(cam, 0), m.field.w * z, m.field.h * z)
    ctx.setLineDash([])

    // dust shoals: quiet country
    for (const sh of m.shoals) {
      const g = ctx.createRadialGradient(this.sx(cam, sh.x), this.sy(cam, sh.y), 4, this.sx(cam, sh.x), this.sy(cam, sh.y), sh.r * z)
      g.addColorStop(0, 'rgba(110,125,160,0.16)')
      g.addColorStop(1, 'rgba(110,125,160,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(this.sx(cam, sh.x), this.sy(cam, sh.y), sh.r * z, 0, Math.PI * 2)
      ctx.fill()
    }

    // lanes
    for (const lane of m.lanes) {
      ctx.strokeStyle = lane.tithe > 0 ? 'rgba(216,178,58,0.7)' : lane.damped ? 'rgba(110,140,170,0.45)' : 'rgba(120,200,220,0.5)'
      ctx.lineWidth = 1.2
      ctx.setLineDash(lane.damped ? [3, 5] : [])
      ctx.beginPath()
      ctx.moveTo(this.sx(cam, lane.x1), this.sy(cam, lane.y1))
      ctx.lineTo(this.sx(cam, lane.x2), this.sy(cam, lane.y2))
      ctx.stroke()
      ctx.setLineDash([])
      // drone dot running the lane
      const t = (now / 2400 + lane.id * 0.37) % 1
      const dx = lane.x2 + (lane.x1 - lane.x2) * t
      const dy = lane.y2 + (lane.y1 - lane.y2) * t
      ctx.fillStyle = '#9fd8e8'
      ctx.fillRect(this.sx(cam, dx) - 1.5, this.sy(cam, dy) - 1.5, 3, 3)
      if (lane.picket) {
        ctx.strokeStyle = 'rgba(140,220,160,0.5)'
        ctx.beginPath()
        ctx.arc(this.sx(cam, lane.midX), this.sy(cam, lane.midY), 8, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // bodies
    for (const b of m.bodies) {
      const x = this.sx(cam, b.x), y = this.sy(cam, b.y), r = b.r * z
      const isMoor = b.id === m.mooringBodyId
      ctx.fillStyle = isMoor ? '#3d4d5c' : '#2a3240'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = isMoor ? '#7fd4e8' : (RES_COLOR[b.res] ?? '#666')
      ctx.globalAlpha = isMoor ? 0.9 : 0.4 + Math.min(0.6, b.richness * 0.3)
      ctx.stroke()
      ctx.globalAlpha = 1
      if (isMoor) {
        // the umbilical: the city drinks
        ctx.strokeStyle = `rgba(127,212,232,${0.35 + 0.2 * Math.sin(now / 300)})`
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(this.sx(cam, m.station.x), this.sy(cam, m.station.y))
        ctx.stroke()
      }
      if (b.claimed) {
        ctx.strokeStyle = '#d8b23a'
        ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // claims (rig + silo bar)
    for (const cl of m.claims) {
      const x = this.sx(cam, cl.x), y = this.sy(cam, cl.y)
      ctx.fillStyle = cl.online ? '#d8b23a' : '#5c4436'
      ctx.fillRect(x - 3, y - 14 * z - 3, 6, 6)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(x - 11, y - 14 * z + 5, 22, 3)
      ctx.fillStyle = RES_COLOR[cl.siloRes] ?? '#fff'
      ctx.fillRect(x - 11, y - 14 * z + 5, 22 * Math.min(1, cl.silo / 60), 3)
    }

    // beacons
    for (const b of m.beacons) {
      const x = this.sx(cam, b.x), y = this.sy(cam, b.y)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.PI / 4)
      const pulse = b.revealed ? 0.8 : 0.5 + 0.4 * Math.sin(now / 350)
      ctx.strokeStyle = b.revealed ? 'rgba(140,220,160,0.9)' : `rgba(216,178,58,${pulse})`
      ctx.strokeRect(-5, -5, 10, 10)
      ctx.restore()
    }

    // station modules
    const cs = m.cell * z
    for (const mod of m.modules) {
      const x = this.sx(cam, mod.x), y = this.sy(cam, mod.y)
      ctx.fillStyle = mod.online ? (MODULE_COLOR[mod.kind] ?? '#888') : '#2c323c'
      ctx.fillRect(x - cs / 2 + 1, y - cs / 2 + 1, cs - 2, cs - 2)
      if (!mod.online) {
        ctx.strokeStyle = MODULE_COLOR[mod.kind] ?? '#888'
        ctx.globalAlpha = 0.5
        ctx.strokeRect(x - cs / 2 + 1, y - cs / 2 + 1, cs - 2, cs - 2)
        ctx.globalAlpha = 1
      }
      if (mod.hp < 1) {
        ctx.fillStyle = '#c94a3d'
        ctx.fillRect(x - cs / 2 + 1, y + cs / 2 - 3, (cs - 2) * mod.hp, 2)
      }
      if (mod.marked) {
        ctx.strokeStyle = `rgba(201,74,61,${0.5 + 0.5 * Math.sin(now / 120)})`
        ctx.lineWidth = 2
        ctx.strokeRect(x - cs / 2 - 2, y - cs / 2 - 2, cs + 4, cs + 4)
        ctx.lineWidth = 1
      }
    }

    // build grid overlay
    if (buildMode) {
      ctx.strokeStyle = 'rgba(120,150,200,0.25)'
      for (let gx = 0; gx < m.gridN; gx++) {
        for (let gy = 0; gy < m.gridN; gy++) {
          const wx = m.station.x + (gx - m.gridCenter) * m.cell
          const wy = m.station.y + (gy - m.gridCenter) * m.cell
          ctx.strokeRect(this.sx(cam, wx) - cs / 2, this.sy(cam, wy) - cs / 2, cs, cs)
        }
      }
      if (hoverCell) {
        const wx = m.station.x + (hoverCell.gx - m.gridCenter) * m.cell
        const wy = m.station.y + (hoverCell.gy - m.gridCenter) * m.cell
        ctx.strokeStyle = 'rgba(216,178,58,0.9)'
        ctx.lineWidth = 2
        ctx.strokeRect(this.sx(cam, wx) - cs / 2, this.sy(cam, wy) - cs / 2, cs, cs)
        ctx.lineWidth = 1
      }
    }

    // pickups
    for (const pk of m.pickups) {
      ctx.strokeStyle = '#d8e0a0'
      ctx.strokeRect(this.sx(cam, pk.x) - 3, this.sy(cam, pk.y) - 3, 6, 6)
    }

    // npcs
    for (const n of m.npcs) {
      const x = this.sx(cam, n.x), y = this.sy(cam, n.y)
      ctx.fillStyle = FACTION_COLOR[n.faction] ?? '#f00'
      if (n.kind === 'tollgate') {
        ctx.strokeStyle = FACTION_COLOR[n.faction]
        ctx.lineWidth = 2
        ctx.strokeRect(x - 8, y - 8, 16, 16)
        ctx.lineWidth = 1
        ctx.fillRect(x - 2, y - 2, 4, 4)
      } else if (n.kind === 'hushwing') {
        ctx.beginPath()
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 9, y + 5); ctx.lineTo(x - 9, y + 5); ctx.closePath()
        ctx.fill()
      } else {
        const r = n.kind === 'gunship' ? 7 : 4.5
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
      if (n.hpPct < 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 8, y - 13, 16, 2)
        ctx.fillStyle = '#c94a3d'; ctx.fillRect(x - 8, y - 13, 16 * n.hpPct, 2)
      }
    }

    // players
    for (const p of m.players) {
      if (p.down) continue
      const x = this.sx(cam, p.x), y = this.sy(cam, p.y)
      const self = p.id === selfId
      // beams first (approximate: renderer draws toward nearest visual target)
      if (p.mining) {
        ctx.strokeStyle = 'rgba(127,212,232,0.6)'
        const tgt = nearest(m.bodies, p.x, p.y)
        if (tgt) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.sx(cam, tgt.x), this.sy(cam, tgt.y)); ctx.stroke() }
      }
      if (p.firing) {
        const tgt = nearest(m.npcs, p.x, p.y)
        if (tgt) {
          ctx.strokeStyle = `rgba(224,120,90,${0.5 + 0.4 * Math.sin(now / 60)})`
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.sx(cam, tgt.x), this.sy(cam, tgt.y)); ctx.stroke()
          ctx.lineWidth = 1
        }
      }
      ctx.fillStyle = self ? '#e8d27a' : '#c9b06a'
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a2028'
      ctx.beginPath(); ctx.arc(x, y - 1.5, 2.5, 0, Math.PI * 2); ctx.fill()
      if (p.thrusting) {
        ctx.fillStyle = `rgba(224,150,80,${0.5 + 0.4 * Math.sin(now / 50)})`
        ctx.beginPath(); ctx.arc(x, y + 8, 2.5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = 'rgba(230,235,245,0.85)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(p.name, x, y - 13)
    }

    // fx
    for (const f of m.fx) {
      const x = this.sx(cam, f.x), y = this.sy(cam, f.y)
      const k = 1 - Math.max(0, Math.min(1, f.ttl / 1.2))
      ctx.strokeStyle = `rgba(230,160,90,${1 - k})`
      ctx.beginPath(); ctx.arc(x, y, 4 + k * 26, 0, Math.PI * 2); ctx.stroke()
    }

    // dark-running vignette
    if (m.dark) {
      const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height / 3, cv.width / 2, cv.height / 2, cv.height)
      g.addColorStop(0, 'rgba(4,6,12,0)')
      g.addColorStop(1, 'rgba(2,3,8,0.7)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cv.width, cv.height)
    }
  }
}

function nearest<T extends { x: number; y: number }>(arr: T[], x: number, y: number): T | null {
  let best: T | null = null
  let bd = Infinity
  for (const e of arr) {
    const d = Math.hypot(e.x - x, e.y - y)
    if (d < bd) { bd = d; best = e }
  }
  return best
}
