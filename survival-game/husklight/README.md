# HUSKLIGHT — first playable draft

A co-op survival prototype aboard a derelict generation ship. The reactor is dimming, ten thousand
sleepers draw on its light, and the ship is forgetting how to hold its breath. Keep them alive.

This is draft 1 of the [Husklight setting](../design/settings/01-husklight.md), built to test the core
loop against the [golden rules](../design/golden-rules.md) — not to be pretty or complete.

## Play

- **Board:** pick a steward name and a registry code. The registry code is the world: same code = same
  ship layout (it's the worldgen seed) and same crew room. Share the URL to bring friends aboard.
- **Move** WASD/arrows · **Interact** E · **Emergency O₂** R (burns 1 lithium)
- What exists in draft 1:
  - **The Dimming** — reactor output decays while the ship is inhabited (never while everyone's away).
    Refit rods at the reactor console with salvaged plate to claw watts back.
  - **Power triage** — every room has a breaker and a draw. When demand exceeds output, the grid sheds
    the farthest non-critical decks first. Cryo bays shed last — but an unpowered bay has ~2 minutes of
    thermal grace before sleepers start dying. Deaths are permanent.
  - **Air** — powered rooms regenerate O₂; unpowered rooms slowly bleed it; your suit buffers you and
    refills in good air. Suit failure drops half your carry and recovers you to the cryo bay (tempo tax,
    never progress loss).
  - **Entropy** — micro-breaches open in aging decks, weighted toward your powered footprint: the more
    ship you run, the more the ship needs you. Patch them with sealant.
  - **One automation layer** — find a dormant Custodian drone, reflash it (2 plate + 2 lithium), and
    stock the workshop depot with sealant: it patrols and patches breaches on its own. It also draws
    3W and only works from what you've banked — automation buys attention, not safety.
- **Multiplayer:** first steward in a registry hosts the authoritative sim; others join P2P (WebRTC,
  signaling via public nostr relays). If the host leaves, another peer takes over from the last
  snapshot. The host's browser autosaves the world every 10s, so a registry can be resumed later from
  the same browser.

## Architecture (and why)

```
src/
  worldgen.ts   deterministic ship generation from the registry-code seed
  sim.ts        the ENTIRE game simulation — pure module, no DOM, no net
  net.ts        trystero (WebRTC) transport + host handoff
  render.ts     canvas renderer: tiles, fixtures, darkness/light
  main.ts       orchestration: join flow, host/guest roles, game loop, HUD
  input.ts, prng.ts, types.ts
```

- **Static deploy, no backend.** Vercel can't host long-lived stateful game servers, and for trying many
  prototypes cheaply we don't want one yet. So the authoritative sim runs in the host player's browser
  and guests connect P2P. This also honors golden rule 2 for free: the world literally cannot advance
  while nobody is aboard.
- **`sim.ts` is deliberately self-contained** (state in, state out, no browser APIs except localStorage
  helpers at the bottom). When a prototype graduates, this module moves to a real authoritative server
  (Fly.io or similar) mostly unchanged.
- **Rates, not items** (golden rule 14): rooms are the simulation unit — O₂ levels, watt draws, condition
  scalars. Nothing per-entity ticks except a handful of drones and players.

## Dev

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build to dist/
```

Deploy: static site — build and ship `dist/` anywhere (Vercel project settings: framework Vite,
build `npm run build`, output `dist`).

## Known compromises & next steps

Draft 1 knowingly leaves out, roughly in the order they should arrive:

1. **The Verdance / combat** — no hostile pressure beyond entropy yet, so goal 5 (base ⇄ combat) is
   unrepresented. Next major system.
2. **Richer worldgen** — deck archetypes exist but the skeleton is fixed; needs vacuum-scarred sectors,
   severed trunk topology, and found-machine variety (goal 4 is underweight at one skeleton).
3. **Inspection Protocol** — the beauty-pays-rent mechanic (shipshape spaces get maintained for free by
   the ship) is the setting's crown jewel and is entirely absent from draft 1.
4. **More automation layers** — tube/tram logistics, fabricators, AI shards. Draft 1 has exactly one
   (Custodian patching) to prove the sacrifice loop.
5. **Persistence beyond one browser** — saves live in the host's localStorage. Real persistence (and >8
   player comfort) means moving `sim.ts` to a server; the P2P layer is a prototyping convenience, not
   the destination.
6. **Host-migration hardening** — the takeover protocol is minimal; simultaneous-join races resolve by
   "older world wins" and can momentarily fork.
