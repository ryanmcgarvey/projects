import { chromium } from 'playwright'

const BASE = 'http://localhost:4174'
const SHOT = process.env.SHOT_DIR || '.'
const errors = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1360, height: 820 } })
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => {
  const t = m.text()
  if (m.type() === 'error' && !/WebSocket|net::|tunnel|Failed to load resource/.test(t)) errors.push('console: ' + t)
})

await page.goto(BASE + '/?room=smoketest', { waitUntil: 'networkidle' })
await page.fill('#name', 'Tester')
await page.click('#board')
await page.waitForTimeout(5000) // offline promotion window

const chart = await page.textContent('#chart-main')
console.log('CHART:', chart?.replace(/\s+/g, ' ').slice(0, 220))
if (!chart?.includes('Leg 1')) { errors.push('chart table missing Leg 1') }

// fly around, mine, fire
await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d')
await page.keyboard.down('w'); await page.waitForTimeout(800); await page.keyboard.up('w')
await page.keyboard.down('m'); await page.waitForTimeout(1500); await page.keyboard.up('m')
await page.screenshot({ path: SHOT + '/star-flight.png' })

// build mode
await page.keyboard.press('b')
await page.waitForTimeout(600)
await page.screenshot({ path: SHOT + '/star-build.png' })
const palette = await page.textContent('#palette')
console.log('PALETTE:', palette?.replace(/\s+/g, ' ').slice(0, 160))
await page.keyboard.press('b')

// run dark toggle
await page.keyboard.press('l')
await page.waitForTimeout(400)
const dark = await page.textContent('#dark-btn')
console.log('DARK BTN:', dark)
await page.keyboard.press('l')

// let the sim breathe, watch stocks & log
await page.waitForTimeout(9000)
console.log('STOCKS:', await page.textContent('#stocks'))
console.log('LOG:', (await page.textContent('#log'))?.replace(/\s+/g, ' ').slice(0, 240))
console.log('FACTIONS:', (await page.textContent('#factions'))?.replace(/\s+/g, ' ').slice(0, 160))
await page.screenshot({ path: SHOT + '/star-later.png' })

await browser.close()
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('SMOKE OK')
