export class Input {
  private held = new Set<string>()
  onInteract: () => void = () => {}
  onLithium: () => void = () => {}

  constructor() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      this.held.add(k)
      if (k === 'e') this.onInteract()
      if (k === 'r') this.onLithium()
    })
    window.addEventListener('keyup', e => this.held.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => this.held.clear())
  }

  axis(): { x: number; y: number } {
    let x = 0, y = 0
    if (this.held.has('a') || this.held.has('arrowleft')) x -= 1
    if (this.held.has('d') || this.held.has('arrowright')) x += 1
    if (this.held.has('w') || this.held.has('arrowup')) y -= 1
    if (this.held.has('s') || this.held.has('arrowdown')) y += 1
    if (x !== 0 && y !== 0) { const s = Math.SQRT1_2; x *= s; y *= s }
    return { x, y }
  }
}
