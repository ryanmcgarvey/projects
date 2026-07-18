// Enforces the engine-swap guarantee: src/core must stay pure.
// - no imports from adapters/app/ui or any node_module
// - no browser/engine globals
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../src/core', import.meta.url).pathname
const FORBIDDEN_IMPORTS = [/from\s+['"]\.\.\/(adapters|app|ui)/, /from\s+['"][^.]/]
const FORBIDDEN_GLOBALS = [
  /\bwindow\s*[.[]/, /\bdocument\s*[.[]/, /\bnavigator\s*[.[]/, /\blocalStorage\b/,
  /\brequestAnimationFrame\s*\(/, /\bperformance\s*\./, /\bHTML[A-Za-z]*Element\b/,
  /\bCanvasRenderingContext2D\b/, /\bfetch\s*\(/, /\bWebSocket\b/, /\bMath\.random\b/,
  /\bDate\.now\b/, /\bnew\s+Date\b/,
]

/** Strip comments so prose can't trip the globals scan. */
const stripComments = src =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const failures = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!p.endsWith('.ts') || p.endsWith('.test.ts')) continue
    const src = stripComments(readFileSync(p, 'utf8'))
    for (const re of FORBIDDEN_IMPORTS) {
      if (re.test(src)) failures.push(`${p}: forbidden import (${re})`)
    }
    for (const re of FORBIDDEN_GLOBALS) {
      if (re.test(src)) failures.push(`${p}: forbidden global (${re})`)
    }
  }
}
walk(ROOT)

if (failures.length) {
  console.error('CORE BOUNDARY VIOLATIONS:\n' + failures.join('\n'))
  process.exit(1)
}
console.log('core boundary clean: no engine/DOM/net/nondeterminism leaks in src/core')
