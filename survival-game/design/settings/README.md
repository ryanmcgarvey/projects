# Setting Explorations

Ten candidate settings for the game, each developed deeply by an independent designer pass and then torn
apart by an independent adversarial critic who scored it against the eight founding goals (see
[../golden-rules.md](../golden-rules.md)), plus distinctiveness and small-team browser feasibility.

Each dossier contains the full concept — pressure, automation layers, sacrifice economy, map reactivity,
combat/base loop, non-linearity, aesthetics mechanic, narrative frame, multiplayer model — followed by the
unedited critique: per-goal scores, the biggest weakness, a concrete story of how a real server dies, and
the single "steelman" fix that would most improve the design.

**Read the critiques as seriously as the pitches.** The steelmanned version of each setting is the real
candidate, not the raw pitch.

## Scoreboard

Sorted by goal-fit score. Note the compression: everything landed 31–36/40 with identical
distinctiveness (4/5) and feasibility (2/5) marks, so the ranking is a weak signal — the *content* of each
critique is the strong signal.

| # | Setting | Seed | Goal fit | Dist. | Feas. | Closest game | One-line hook |
|---|---|---|---|---|---|---|---|
| 1 | [Husklight](01-husklight.md) | `ship` | 36/40 | 4/5 | 2/5 | Barotrauma | Your factory is a dying megastructure that argues back — you automate by reawakening ancient systems with their own agendas, and the power bill is measured in sleeping human lives. |
| 2 | [The Buried Choir](02-the-buried-choir.md) | `godsand` | 35/40 | 4/5 | 2/5 | Factorio | Every machine is a resurrected fragment of a dead god that drinks from the same waterskin you do — and your power grid is a song that sounds exactly as good as it's built, on a map the wind keeps burying and exhuming. |
| 3 | [Hallowmoor](03-hallowmoor.md) | `blight` | 34/40 | 4/5 | 2/5 | The Riftbreaker | The dead are simultaneously your ore, your engines, your conveyor belts, and your enemy — and the blight studies how you use them and evolves to take them back. |
| 4 | [Emberline](04-emberline.md) | `frost` | 33/40 | 4/5 | 2/5 | Oxygen Not Included | Your conveyor belts are rivers of hot water the enemy can freeze, and the progress bar is the literal line of ice your machines have pushed back from your door. |
| 5 | [Understory](05-understory.md) | `mycel` | 33/40 | 4/5 | 2/5 | Atrio: The Dark Wild | The factory is a living garden a sentient forest is forever reclaiming — and the most beautiful garden is also the most productive and best-defended one, because the forest keeps what it loves. |
| 6 | [Saltmoon](06-saltmoon.md) | `tide` | 33/40 | 4/5 | 2/5 | Timberborn | The conveyor belt is the tide itself: the whole map floods and drains on a real-time clock every player shares, and everything you build has to work twice — drowned and drained. |
| 7 | [Switchgrass](07-switchgrass.md) | `overgrowth` | 33/40 | 4/5 | 2/5 | Factorio | You don't build the factory — you resuscitate a drowned civilization's grid wire by wire, while the wilderness eats what you restore and the grid's own immune system hunts you for daring to turn it on. |
| 8 | [Emberdeep](08-emberdeep.md) | `abyss` | 32/40 | 4/5 | 2/5 | Oxygen Not Included | Every watt you burn is visible, audible bait; your power plants are dying geology you decide how fast to bleed; your most beautiful garden is your best defense. |
| 9 | [Galeheart](09-galeheart.md) | `sky` | 32/40 | 4/5 | 2/5 | Raft | Every machine you bolt down weighs your flying island toward the drowning sea — until your automation matures enough that you sail your entire base across the storm-shuffled map. |
| 10 | [Hollow Saint](10-hollow-saint.md) | `titan` | 31/40 | 4/5 | 2/5 | Factorio | Your entire factory is a living organism you grow inside a dying god, and building beautifully is literally how you hide from its immune system. |

## Round 2 — player-seeded concepts (2026-07-09)

Two concepts seeded directly by the designer's briefs, developed and critiqued AFTER the golden rules
and the round-1 lessons existed — so both were written to dodge the known failure modes, and both
critiques test whether those dodges are mechanically real or just incantations. Scores are not directly
comparable to round 1: these critics were explicitly primed with the failure catalog and graded harder.

| # | Concept | Seed | Goal fit | Dist. | Feas. | Closest game | One-line hook |
|---|---|---|---|---|---|---|---|
| 11 | [Longfire](11-longfire.md) | early human colony | 28/40 | 4/5 | 2/5 | RimWorld | The tech tree is the population — every technology lives in a mortal head until you build the culture that can outlive one. |
| 12 | [Starmoor](12-starmoor.md) | ship + mobile station | 29/40 | 4/5 | 3/5 | Starsector | A base-building game where the base must periodically flee its own success: your logistics empire has a lifespan by design, and the loudest thing you'll ever do is move home. |

What round 2 added to the lesson list:

6. **Presence-scaled world time is social poison.** Keying the world clock to player hours (Longfire's
   Wheel) makes one heavy-playing friend age everyone's civilization — the group ends up rationing a
   friend's permission to play. Key world time to colony/base *throughput*, never to login hours.
7. **Bounded loss + tradeable inputs = pressure becomes rent.** If nothing can kill the base (Rule 1)
   AND every input can be imported (compacts/trade), a rich enough base converts every threat into a
   line-item fee and stops moving/deciding. At least one survival-critical input must be local-only, so
   wealth can defer the reckoning but never delete it.
8. **Check the beauty mechanic against the pressure mechanic.** Starmoor's windows are glare and a
   predator faction hunts glare — the pressure system teaches the dark box, recreating Factorio's ugly
   optimum with an enforcer. Beauty's costs must not be denominated in the exact currency the main
   threat punishes.

## What the critiques taught us (cross-cutting lessons)

Five failure modes recurred across nearly all ten settings, independent of theme. These are now baked into
the golden rules — treat them as the known ways this game dies:

1. **"Logging off is optimal."** Any pressure keyed to wall-clock time, or that scales with online
   headcount, eventually makes absence the best strategy on a persistent server. Killed or wounded
   Husklight, Emberline, Hallowmoor, Switchgrass, and Galeheart in review. → Golden Rule 2.
2. **The upkeep treadmill.** Settings where every machine is "alive" (a mouth to feed) invert the genre's
   payoff: investment compounds maintenance instead of leverage, and the factory becomes a pet that
   punishes ownership. Killed or wounded Understory, Hollow Saint, Galeheart, Emberdeep. → Golden Rule 5.
3. **The simulation-fidelity bet.** Every pitch that needs continuous physics (thermal diffusion, fluid
   dynamics, deformable sand, wind fields, perfusion networks) got feasibility-flagged: that fidelity can't
   run server-side for 20 browser clients. The steelman is always the same — commit to a proudly *legible,
   coarse, tile-or-graph* rule language players can read and master. → Golden Rule 14.
4. **Single-currency convergence.** One master resource (heat, water, ichor) plus a solvable geometry pulls
   every server toward the same meta base. Multiple orthogonal channels with distinct counterplay resist
   this. → Golden Rules 4, 8, 9.
5. **Milestone smuggling.** Even settings designed for continuous progression snuck tiers back in —
   "numbered automation layers L1–L6," singular endgame devices, discrete switch-flip gates. Naming tiers
   in a design doc is how linearity gets back in. → Golden Rule 7.

Also worth noting: **every single setting scored 4–5 on map-reactivity and sacrifice-automation.** Those two
goals are robustly achievable almost anywhere; the goals that discriminate between settings are pressure
sustainability (G1 on a persistent server), non-linearity (G6), and mechanical aesthetics (G7).

## Recommendation

Top tier, in order — in each case the *steelmanned* version:

1. **Husklight** — the strongest overall fit. A found megastructure inverts Factorio's blank canvas (the
   map IS the tech tree, literally), automation-as-reawakening gives machines character for free, and
   "every watt is a sleeping colonist" is the cleanest goal-8 answer of the ten: nobody ever asks why
   they're smelting. Its fatal flaw (a wall-clock doom curve that punishes presence) is cleanly fixable per
   the steelman: advance The Dimming on simulation-attention, not real time; scale event budget to restored
   territory, never headcount. Deck-based procgen is also the most tractable generation problem of the ten.
2. **Saltmoon** — the most *multiplayer-native* pressure of the ten: the whole server shares one tide
   clock, so crisis/calm alternation (Golden Rule 3) is baked into the planet, and drop-in players are
   always synchronized with the world's rhythm rather than a personal timer. It's also the cheapest honest
   simulation *if* we commit to the steelman up front: proudly discrete tile-hydraulics as a visible rule
   language (Timberborn, not fluid illusion), with tide windows that precess so no timezone owns the good
   tides. Needs real design work on its weakest axis: depth-gated progression is a single monotone axis
   (G6 scored 3/5).
3. **Hallowmoor** — the best unified economy (the dead are ore, engine, labor, AND enemy — everything
   collides with everything, which is Golden Rule 9 for free) and the strongest base⇄combat circulation.
   Two real concerns: it's the closest to a shipped game (The Riftbreaker), and it's honestly two hard
   sims welded together (factory + adaptive tide), the biggest engineering bite of the top three.

**The steal list** — ideas from non-winning settings worth transplanting into whichever setting wins:

- **Understory's steelman:** beauty-completion as *permanence* — satisfying an explicit aesthetic/ecological
  threshold in a district permanently retires its upkeep. This is the single best fusion of goals 1+2+7
  found in the whole exploration: the beauty puzzle IS the thing that buys back attention.
- **Hollow Saint's steelman:** the same idea from the other side — long-maintained beautiful builds get
  "accepted as self-tissue" and stop costing. Earned permanence as the reward for building well.
- **The Buried Choir's consonance grid:** the base's power network as a literal song whose harmony depends
  on layout — the most original aesthetics-pays-rent mechanic of the ten (WebAudio makes it cheap), even if
  the sand-simulation host setting is too expensive.
- **Emberdeep's three-channel attention system:** light/sound/heat as separate emission channels with
  distinct counterplay — a multi-axis alternative to single-currency aggro that resists meta convergence.
- **Emberdeep's steelman:** senescence without erasure — when a resource node dies, infrastructure stays
  valuable and gets re-fed from new nodes, so the world pushes expansion without deleting work.

## Provenance

Generated 2026-07-09 by a fan-out design exploration: 10 independent designer agents (one per setting seed),
each output reviewed blind by an independent critic agent scoring against the founding goals; in parallel,
3 agents drafted golden-rule sets through different lenses (player psychology, systems/economy,
multiplayer/persistence/scope), which were merged by hand into [../golden-rules.md](../golden-rules.md).
The dossier text is the agents' output, lightly formatted; the scoreboard, lessons, and recommendation are
the synthesis.
