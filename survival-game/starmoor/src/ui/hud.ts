// DOM HUD. Reads selector outputs only — zero game logic lives here.
import type { ChartTable, Command, Crew, Emissions, FactionView, LogEntry } from '../core'

const $ = (id: string) => document.getElementById(id) as HTMLElement

export class Hud {
  private dispatch: (cmd: Command) => void
  private lastLogLen = -1

  constructor(dispatch: (cmd: Command) => void) {
    this.dispatch = dispatch
    $('chart-options').addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('button')
      if (!btn) return
      if (btn.dataset.weigh) this.dispatch({ c: 'weigh', optionId: Number(btn.dataset.weigh) })
      if (btn.dataset.cancel) this.dispatch({ c: 'cancelWeigh' })
    })
    $('crew-list').addEventListener('click', e => {
      const row = (e.target as HTMLElement).closest('[data-crew]') as HTMLElement | null
      if (!row) return
      const roles = ['idle', 'refinery', 'yard', 'guns'] as const
      const cur = roles.indexOf(row.dataset.role as typeof roles[number])
      this.dispatch({ c: 'assign', crewId: Number(row.dataset.crew), role: roles[(cur + 1) % roles.length] })
    })
    $('dark-btn').addEventListener('click', () => this.dispatch({ c: 'dark' }))
  }

  update(
    ct: ChartTable,
    factions: FactionView[],
    emis: Emissions,
    self: { hull: number; hold: Partial<Record<string, number>>; holdTotal: number } | null,
    crew: Crew[],
    stocks: Record<string, number>,
    log: LogEntry[],
  ) {
    // ship
    if (self) {
      ($('hullfill')).style.width = `${self.hull}%`
      $('hold').textContent = `hold ${self.holdTotal.toFixed(0)}/30 · ` +
        (['ice', 'ferrite', 'isotopes'] as const)
          .map(r => `${r.slice(0, 2)} ${(self.hold[r] ?? 0).toFixed(0)}`).join(' · ')
    }

    // stocks
    $('stocks').innerHTML =
      `<b>${stocks.ferrite.toFixed(0)}</b> fe · <b>${stocks.ice.toFixed(0)}</b> ice · ` +
      `<b>${stocks.isotopes.toFixed(0)}</b> iso · <b class="brass">${stocks.burnstock.toFixed(0)}</b> burn`

    // chart table
    const feedNet = ct.yieldNow - ct.drawNow
    $('chart-main').innerHTML = `
      <div class="row"><span class="lbl">Leg ${ct.leg} · mooring</span><b class="${ct.yieldPct < 30 ? 'bad' : ''}">${ct.yieldPct}%</b></div>
      <div class="row"><span class="lbl">anchorfeed</span><span class="num ${feedNet < 0 ? 'warn' : 'good'}">${ct.feed.toFixed(0)}/${ct.feedCap} (${feedNet >= 0 ? '+' : ''}${feedNet.toFixed(2)}/s)</span></div>
      <div class="row"><span class="lbl">burn reserve</span><span class="num ${ct.burnstock >= ct.weighCost ? 'good' : ''}">${ct.burnstock.toFixed(0)} / ${ct.weighCost}</span></div>
      <div class="row"><span class="lbl">crew</span><span class="num">${ct.crew}/${ct.berths} · thrive ${ct.thrive}</span></div>
      <div class="row"><span class="lbl">days free</span><span class="num">${ct.daysFree.toFixed(1)}</span></div>
      ${ct.spikeRemaining > 0 ? `<div class="row good">virgin vein — ${Math.ceil(ct.spikeRemaining)}s of rich feed</div>` : ''}
      ${ct.phase !== 'moored' ? `<div class="row warn">${ct.phase === 'countdown' ? `WEIGH in ${Math.ceil(ct.phaseEndsIn)}s` : `UNDER BURN — ${Math.ceil(ct.phaseEndsIn)}s`}</div>` : ''}`

    $('chart-options').innerHTML = ct.options.map(o =>
      `<div class="opt">${o.revealed
        ? `<span>${o.label}</span>${ct.phase === 'moored' ? `<button data-weigh="${o.id}">weigh</button>` : ''}`
        : `<span class="dim">${o.label} — fly out and survey it</span>`}
      </div>`).join('') +
      (ct.phase === 'countdown' ? `<div class="opt"><button data-cancel="1">object — hold the city</button></div>` : '')

    // factions
    $('factions').innerHTML = factions.map(f => {
      const pct = Math.min(100, (f.heat / 360) * 100)
      return `<div class="fac">
        <span class="lbl">${f.id}${f.belligerence > 0 ? ` <span class="bad">†${f.belligerence}</span>` : ''}${f.active ? ' <span class="warn">— inbound</span>' : ''}</span>
        <div class="bar"><div style="width:${pct}%; background:${f.id === 'combine' ? '#d8b23a' : f.id === 'breakers' ? '#c94a3d' : '#8fa8c9'}"></div>
        <i style="left:27.7%"></i><i style="left:61.1%"></i></div>
      </div>`
    }).join('')

    $('emissions').innerHTML =
      `<span class="lbl">emitting</span> glare ${emis.glare.toFixed(2)} · wake ${emis.wake.toFixed(2)} · chatter ${emis.chatter.toFixed(2)}`
    $('dark-btn').textContent = ct.dark ? 'lights up [L]' : 'run dark [L]'
    ;($('dark-btn')).classList.toggle('on', ct.dark)

    // crew
    $('crew-list').innerHTML = crew.length
      ? crew.map(c => `<div class="crewrow" data-crew="${c.id}" data-role="${c.role}" title="click to reassign">${c.name} — <b>${c.role}</b></div>`).join('')
      : '<div class="dim">no hands aboard — thrive draws them in</div>'

    // log
    if (log.length !== this.lastLogLen) {
      this.lastLogLen = log.length
      $('log').innerHTML = log.slice(-6).map(l => `<div class="${l.kind}">${l.msg}</div>`).join('')
    }
  }

  prompt(text: string | null) {
    const el = $('prompt')
    if (!text) { el.style.display = 'none'; return }
    el.style.display = 'block'
    el.innerHTML = text
  }

  palette(visible: boolean, html: string) {
    const el = $('palette')
    el.style.display = visible ? 'block' : 'none'
    if (visible) el.innerHTML = html
  }
}
