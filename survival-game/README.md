# survival-game (working name)

A browser-based, multiplayer-by-default survival + crafting + automation game. Hard by design: constant
pressure to survive, layers of Factorio-style automation bought through sacrifice, no milestones, and a
map that changes how you play. Persistent small-server worlds (2–20 players, friends-scale), planned to be
hosted on something like Fly.io.

**Status: first prototype.** The plan is to draft several of the explored settings as thin playable
prototypes and let playtesting decide — Husklight is draft 1.

## Contents

| Path | What it is |
|---|---|
| [design/golden-rules.md](design/golden-rules.md) | The constitution: 16 rules distilled from the eight founding goals, with smell tests, the tensions they resolve, and which rules are load-bearing vs. aspirational. Start here. |
| [design/settings/](design/settings/README.md) | Ten candidate settings, each fully developed and adversarially critiqued, with a scoreboard, cross-cutting lessons, a recommendation, and a "steal list" of transplantable mechanics. |
| [husklight/](husklight/) | **Playable draft 1** of the Husklight setting: browser co-op prototype — power triage, air, entropy breaches, cryo stewardship, and the first automation layer. Static Vite app, P2P multiplayer, no backend. |
| [starmoor/](starmoor/) | **Playable MVP** of the Starmoor concept (steelmanned): taper + Fix + three predator factions, rigs/lanes/pickets/crew automation, thrive, and the full Weigh cycle. Pure dependency-free sim core behind enforced boundaries — renderer/net/persistence are swappable adapters. |

## Where we are

1. ✅ Founding goals articulated (see golden-rules.md preamble)
2. ✅ Golden rules drafted and pressure-tested
3. ✅ Ten settings explored and critiqued — top tier: **Husklight**, **Saltmoon**, **Hallowmoor**
4. ✅ First playable draft: Husklight (core loop: pressure + sacrifice + one automation layer + the offline contract)
5. ⬜ Deploy + playtest with 2-4 people; tune the pressure curve
6. ⬜ Draft 2 of Husklight (Verdance/combat, Inspection Protocol) — or a rival setting prototype to compare
