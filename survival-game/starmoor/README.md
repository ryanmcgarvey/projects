# STARMOOR — MVP

The last free city in a burned-out cluster. Every player flies a cheap, nimble skiff; everyone shares
one slow, precious freeport that drinks from whatever it's moored to — and gets easier to find every
day it stays. Draft 1 of [the Starmoor concept](../design/settings/12-starmoor.md), built steelmanned
per its critique. The mechanics contract is [DESIGN.md](DESIGN.md); the architecture is the point.

## Play

**WASD** fly · **SPACE** fire · **M** mine (near a body) · **E** context action · **B** build mode
(1–8 select, click place, right-click demolish) · **L** run dark. Same registry code = same city,
same crew — share the URL.

The loop: hand-mine → plant claim rigs (needs a yard) → rig freight lanes → post pickets → refine ice
into burnstock → survey the beacons at the map edges → and when the mooring thins and the faction bars
climb, **call the Weigh** from the chart table and move the whole city. Rigs and lanes are left behind;
the new mooring arrives with a virgin-yield spike and first-anchor salvage. Watch the three predators:
the **Combine** tolls your lanes, the **Breakers** raid your silos, the **Hush** mark your brightest
module — go dark before the count ends or lose it.

## Architecture (the engine-swap guarantee)

```
src/core       the ENTIRE game: rules, economy, factions, worldgen, commands, selectors.
               Pure TypeScript, zero dependencies, no DOM/engine/net/nondeterminism —
               enforced by scripts/check-boundaries.mjs, which fails the build on violation.
src/adapters   swappable I/O: render2d (Canvas2D), input, net (trystero P2P), persist (localStorage)
src/app        composition root: join flow, host/guest roles, the fixed-tick loop
src/ui         DOM HUD; reads core selectors only
```

- Swap the engine → rewrite `adapters/render2d` against `RenderModel`. Nothing else changes.
- Move to an authoritative server → replace `adapters/net` + run `core` on the server. The sim is
  already a pure `tick(state, dt, online)` over JSON-serializable state with seeded RNG.
- Iterate on balance → every tuning number lives in `src/core/constants.ts`; the vitest suite
  (`npm test`) asserts the mechanical invariants headlessly (taper horizon, weigh cycle, thrive
  composability, encounter bounds, serialization round-trip).

## Dev

```bash
npm install
npm run dev      # local dev server
npm test         # headless mechanics suite (pure core)
npm run build    # boundary check + typecheck + tests + bundle
```

## MVP cuts (roadmap)

Kithship trading/compacts · boarding & combat recruitment · hulk towing · deep moorings · richer
faction AI (currently reputational meters spawning encounters) · station interior walkaround ·
server-authoritative deployment (the sim module is ready for it).
