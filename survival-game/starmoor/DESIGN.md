# Starmoor MVP — mechanics spec & architecture

Draft 1 of [the Starmoor concept](../design/settings/12-starmoor.md), **steelmanned** per its critique.
This file is the contract: the sim implements exactly this, the tests assert it, reviewers hold the code
to it. Tuning constants live in `src/core/constants.ts` — one file, so balance iteration never means
hunting through logic.

## The core loop (all present in MVP)

**You** fly a nimble, cheap ship. **Everyone** shares one freeport station, moored to a body it drinks
from. Mine, build claims and lanes, fight off three predators, grow the city — then move the whole thing
before the mooring dies and the predators' fix hardens.

### 1. Mooring & taper (the horizon wealth cannot erase)

- The station moors to one body per leg. That body yields **anchorfeed** — the city's life support —
  on a continuously declining curve: `yield(t) = A0 · exp(−t_leg / tau)`.
- **Anchorfeed is moor-bound and un-importable** (the steelman): no other source exists, no body can be
  mined for it, nothing converts to it. Station + crew drink it constantly. When stocks run dry:
  non-critical modules brown out, crew stop working and eventually leave, thrive collapses. The station
  never dies (bounded loss) — it declines, and only a Weigh resets the curve.

### 2. The Fix (emissions → predators)

Three emission channels, continuously accrued into three faction heats (footprint-driven, never wall-clock):

| Channel | Sources | Damped by |
|---|---|---|
| **glare** | galleries/hydro lit, modules online | running dark (galleries offline) |
| **wake** | lane traffic, ship thrust | routing lanes through dust shoals |
| **chatter** | lane count, picket broadcasts | fewer lanes/pickets |

| Faction | Reads hardest | Wants | Encounter |
|---|---|---|---|
| **Combine** (tariff cartel) | wake + wealth | you paying | toll gate on your richest lane: pay lump, eat the skim, or destroy it (permanent belligerence — future gates arrive armed) |
| **Breakers** (shipbreakers) | scrap value of footprint | you as salvage | skiff raids on silos and rigs; tier 3 = station siege vs point-defense |
| **Hush** (dark-sky zealots) | glare + chatter | you quiet | marks your brightest module with a countdown; go dark before impact or lose it |

Encounters are bounded (max one active per faction, minimum gaps, grace period after arrival) — the loop
must breathe. Heats partially pay down when an encounter resolves; a Weigh slashes all of them.

### 3. Automation layers (each kills a chore, each adds a smaller demand)

| Layer | Kills | Adds |
|---|---|---|
| **Claim rig** on a body | holding the mining beam yourself | a silo that fills and *halts when full* — a haul-away demand + raid target |
| **Freight lane** rig → station | flying cargo in your own hold | wake + a tithe surface for the Combine, raid surface for Breakers |
| **Picket** on a lane | flying escort duty yourself | chatter + isotope cost; arms your profile |
| **Crew** (recruits) | station micromanagement (refinery/yard/guns rate boosts) | anchorfeed draw + berth demand; they *leave* if unfed or post-siege thrive is low |

Everything is throughput arithmetic (rates, buffers, caps) — Rule 14 — which is what makes host handoff
and offline fast-forward cheap.

### 4. One economy, real sacrifice

Five resources: **ice** (→ burnstock at the refinery), **ferrite** (modules, rigs, hulls), **isotopes**
(reactor, pickets, tolls), **anchorfeed** (life support, moor-only), **burnstock** (the move fund AND
refined fuel). Reactor watts are a second shared budget: over-draw sheds modules in a fixed priority.
Every build competes with the Weigh reserve. No research currency exists.

### 5. The Weigh (paid forward, per the steelman)

- **Prospect**: three survey beacons per leg at the map edges; fly to one to reveal a mooring option
  (A0, tau, body mix, shoal density — procedurally dealt, always denying something).
- **Call**: costs burnstock scaled to station size; 45 s cancelable countdown (asynchronous consent).
- **Transit**: modules offline except core + PD; an escort encounter scaled to players present — the
  brightest, most dangerous act in the game, and it cannot be slept through.
- **Arrive**: new leg generated; claims, lanes, pickets are *left behind* (the sacrifice); fix heats
  slashed; **virgin-yield spike** (×1.5 anchorfeed for the first stretch) plus **first-anchor salvage**
  (ferrite + isotopes) — moving is the payoff, not the penalty box.

### 6. Beauty pays rent (thrive)

Station modules sit on a grid you compose. **Thrive** is computed from emergent layout properties —
exterior light exposure of berths/galleries, green adjacency (hydro), noise distance from
refinery/yard — never from a decoration checklist. Thrive pays through systems that already exist:
crew work speed and recruit arrival. The dark box stays viable (low glare, no Hush) but forfeits crew
and growth. Known tension from the critique — windows are glare and the Hush hunts glare — is kept
deliberately mild in tuning and is a named playtest question.

### 7. Multiplayer & the offline contract

Host-authoritative P2P (same proven pattern as Husklight): first player in a registry hosts the sim,
guests send commands, host handoff on disconnect. The world only advances while someone is aboard —
Rule 2's offline contract for free. Encounter intensity scales to players online; heat accrual scales
to footprint.

### Deliberately cut from MVP (roadmap, not scope creep)

Kithships/compacts and all trading · boarding and recruitment-via-combat · hulk-towing · multiple
stations · faction diplomacy beyond heat/grievance · station interior walk-around · deep moorings.

## Architecture — the engine-swap guarantee

```
src/
  core/        THE GAME. Pure TS, zero dependencies, no DOM/engine/net imports.
    types.ts        all state shapes; state is plain JSON (serializable by construction)
    constants.ts    every tuning number in one file
    rng.ts          seeded PRNG; sim randomness flows through state.rngState (replayable)
    worldgen.ts     leg generation (bodies, shoals, beacons, mooring)
    sim/            tick(state, dt): economy, emissions, factions, combat, station, weigh
    commands.ts     the ONLY mutation entry point for player intent (validated)
    selectors.ts    derived read-models for HUD/renderer (RenderModel, ChartTable, Ledger)
    index.ts        public API: createGame / tick / applyCommand / serialize / deserialize
  adapters/    swappable I/O. Each implements a small port interface.
    render2d/       Canvas2D renderer consuming RenderModel (swap target: Pixi, WebGL, anything)
    input/          keyboard+mouse → Command objects
    net/            trystero WebRTC transport (swap target: real server — core doesn't know)
    persist/        localStorage saves (swap target: server DB)
  app/         composition root: join flow, host/guest roles, fixed-tick loop, wiring
  ui/          DOM HUD (panels read selectors; no game logic)
```

Rules of the boundary (enforced by `npm run check`, which greps `src/core` for violations and fails the
build): core imports nothing from outside core; core never references `window`, `document`,
`performance`, `requestAnimationFrame`, `localStorage`, or any DOM type. Time comes in as `dt`
arguments; randomness comes from `state.rngState`; rendering is someone else's problem.

**Library choices and why:** core has zero dependencies (that IS the engine-swap guarantee);
Canvas2D for the MVP renderer (fastest correct thing; the port makes it disposable); trystero for P2P
signaling (proven in Husklight, zero backend, and the transport is an adapter so a Fly.io
authoritative server later replaces one file); Vite + vitest (the test suite runs the pure sim headless
— mechanics iteration without opening a browser).

## What the tests assert (`src/core/*.test.ts`)

- Worldgen is deterministic per seed; every leg denies something.
- The taper horizon exists and is unavoidable: no command sequence raises anchorfeed income.
- Fix heats accrue from footprint, encounters respect caps/gaps, Weigh slashes heats.
- The full Weigh cycle: modules survive, claims/lanes die, arrival bonuses apply, new leg differs.
- Thrive rewards exterior light + green adjacency, punishes noise adjacency; composable (no template).
- Command validation: no free builds, no Weigh without reserve, no rig without yard.
- Serialize → deserialize → identical state (host handoff safety).
