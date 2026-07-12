export class Input {
  private held = new Set<string>()
  mouseX = 0
  mouseY = 0
  private clicks: { x: number; y: number; right: boolean }[] = []
  private keyHandlers = new Map<string, () => void>()

  constructor(cv: HTMLCanvasElement) {
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const k = e.key.toLowerCase()
      if (!e.repeat) {
        this.held.add(k)
        this.keyHandlers.get(k)?.()
      }
    })
    window.addEventListener('keyup', e => this.held.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => this.held.clear())
    cv.addEventListener('mousemove', e => { this.mouseX = e.clientX; this.mouseY = e.clientY })
    cv.addEventListener('mousedown', e => this.clicks.push({ x: e.clientX, y: e.clientY, right: e.button === 2 }))
    cv.addEventListener('contextmenu', e => e.preventDefault())
  }

  on(key: string, fn: () => void) { this.keyHandlers.set(key, fn) }
  down(key: string): boolean { return this.held.has(key) }

  axis(): { x: number; y: number } {
    let x = 0, y = 0
    if (this.held.has('a') || this.held.has('arrowleft')) x -= 1
    if (this.held.has('d') || this.held.has('arrowright')) x += 1
    if (this.held.has('w') || this.held.has('arrowup')) y -= 1
    if (this.held.has('s') || this.held.has('arrowdown')) y += 1
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2 }
    return { x, y }
  }

  takeClicks(): { x: number; y: number; right: boolean }[] {
    const out = this.clicks
    this.clicks = []
    return out
  }
}
