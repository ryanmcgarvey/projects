# survival-game (working name)

A browser-based, multiplayer-by-default survival + crafting + automation game. Hard by design: constant
pressure to survive, layers of Factorio-style automation bought through sacrifice, no milestones, and a
map that changes how you play. Persistent small-server worlds (2–20 players, friends-scale), planned to be
hosted on something like Fly.io.

**Status: design exploration.** No code yet. The current work is deciding *what this game is* before
writing a line of it.

## Documents

| Doc | What it is |
|---|---|
| [design/golden-rules.md](design/golden-rules.md) | The constitution: 16 rules distilled from the eight founding goals, with smell tests, the tensions they resolve, and which rules are load-bearing vs. aspirational. Start here. |
| [design/settings/](design/settings/README.md) | Ten candidate settings, each fully developed and adversarially critiqued, with a scoreboard, cross-cutting lessons, a recommendation, and a "steal list" of transplantable mechanics. |

## Where we are

1. ✅ Founding goals articulated (see golden-rules.md preamble)
2. ✅ Golden rules drafted and pressure-tested
3. ✅ Ten settings explored and critiqued — top tier: **Husklight**, **Saltmoon**, **Hallowmoor**
4. ⬜ Pick a setting (or hybrid) and revise its design against the golden rules
5. ⬜ Prototype the core loop (pressure + one automation layer + the offline contract)
6. ⬜ Tech stack decision (authoritative server sim, browser client, Fly.io deployment)
