# The Golden Rules

This is the constitution for the game. Every feature, every system, every tuning pass gets tested
against these rules. They exist so we can say **no** quickly and for reasons we've already agreed on.

They were distilled from the eight founding goals (below) by working them through three lenses —
player psychology, systems/economy design, and multiplayer/persistence/scope — and then pressure-testing
them against ten candidate settings with adversarial critiques. The recurring ways those settings
*failed* are baked back into these rules.

## The founding goals

The original brief, kept verbatim in spirit:

1. **Constant pressure to survive.** The game is hard. Something is always pushing against you, keeping you moving and making decisions.
2. **Layers of automation unlocked through sacrifice** — redirecting resources from survival, or manual work — whose investment pays off by alleviating that work. Constantly deciding what to sacrifice or invest in because there's too much to do at once.
3. **Many ways to solve problems.** No one obvious way to build a base or order your progression. Intricate enough to reward experimentation and strategy.
4. **The random map changes your approach.** Strategy partly emerges from reacting to the environment.
5. **Base building and combat feed each other.** Base investment unlocks better combat; exploration and victories unlock new things to build at home.
6. **No clear lines.** No pre-defined milestones to cross — those make playthroughs linear and repetitive.
7. **Aesthetics are mechanical.** Building beautifully should be functional, rewarded by an in-game mechanic, and fun — not a cosmetics tab.
8. **Everything driven by in-game goals.** Never a moment of "why am I doing this?" One outer narrative goal, and a few legible mechanisms cascading from it down to what you're doing right now.

**Platform:** browser-based, multiplayer by default (persistent small-server worlds, 2–20 players, friends-scale, not an MMO), real-time, hosted on something like Fly.io, built by a very small team.

---

## I. The pressure contract (goal 1)

### Rule 1 — Pressure taxes tempo, never progress

**Every threat must cost players time, resources, position, or opportunity — never erase hours of built
progress — and a defeated player must have a recovery path measured in minutes.**

The emotion goal 1 protects is *tension* — leaning-forward alertness — not dread. Dread is what you feel
when logging in might reveal your base in ashes; on a persistent server that feeling becomes churn.
And unbounded loss kills goal 3 too: players only try weird builds when the worst case is bounded.
The moment total loss is possible, everyone copies the one proven-safe wiki layout and the meta calcifies.
Loss must read as "we fell behind," never "our labor was deleted."

*Broken when:* a siege event can level a week of building overnight; playtesters google "best base layout"
in week one; a returning player's first emotion on login is dread instead of curiosity.

### Rule 2 — Pressure follows presence and footprint

**Scale every threat to the players currently online and to what they have built and disturbed — territory
claimed, emissions, noise, hoarded wealth — never to wall-clock time, calendar days, or server age. While no
defender is online: automation keeps producing (fast-forwarded as rates), threats may tax the base — decay,
spoilage, rising siege meters — but must never destroy it.**

This is the persistence contract, and it is the single most common way our ten candidate settings died in
adversarial review. Clock-driven pressure on a persistent server punishes being asleep instead of playing
badly, and several otherwise-great designs collapsed into "logging off is the mathematically optimal
strategy" — a retention death sentence. Footprint-scaling makes pressure self-balancing (staying small buys
quiet; every automation layer raises the stakes it must defend) and makes absence survivable while
negligence is not. Production-continues-but-destruction-waits makes automation the game's only
offline-progression mechanic — the literal payoff of goal 2.

*Broken when:* the 4-player Tuesday crew faces the same raid wave as the 16-player weekend crowd; a fixed
wave schedule hits a shack and a megafactory identically; players return from three days offline to
unavoidable rubble; the world is demonstrably safer when nobody plays it.

### Rule 3 — The loop must breathe

**Design every session as alternating crisis and calm: guarantee a protected lull for planning, building,
and admiring, and never let two crisis systems peak simultaneously by default.**

Pressure only registers against a baseline of calm; unbroken alarm becomes noise, then exhaustion, then
churn. The lull is also where goals 2 and 7 actually live — deliberate investment decisions and pride in a
beautiful base both require a moment to stand still. This is the difference between a hard game and a
miserable one.

*Broken when:* playtesters say they "never got to look at the base," or spend twenty minutes defending
without once opening the build menu.

---

## II. The sacrifice engine (goal 2)

### Rule 4 — One economy, real sacrifice

**Every automation investment is paid from the same resource and time pools that survival consumes — never
from a dedicated tech currency — and priced so the shortfall is felt for at least one full threat cycle.**

"Meaningful choice about what to sacrifice" only exists when investment and survival compete for the same
scarce inputs. A research currency with no alternative use makes the decision fake, because nothing was
given up. You should eat worse, defend thinner, or work harder while the machine pays itself off. This
shared-pool scarcity is the engine that generates "too much to do at once."

*Broken when:* someone proposes passive "science points" spendable only on tech; an upgrade pays for itself
before the next threat arrives (a cost you never feel is not a cost); a currency buys only one category, so
choices stop competing.

### Rule 5 — Automation buys attention, not safety

**Every automation layer must eliminate a specific manual chore that players have personally performed long
enough to resent — and must introduce a new, smaller demand of a different kind: power draw, defense
surface, upkeep, or aggro. No built system may ever reach fire-and-forget. No manual phase may stretch past
resentment into misery.**

This is the only stable resolution of goal 2 against goal 1. If automation simply deletes work, pressure
decays into an idle game; if pressure scales up to cancel automation, investing feels pointless. Instead,
automation converts toil into stakes — you stop hand-feeding furnaces and start defending the fuel line. Net
attention cost falls (the payoff is real) while the consequence of neglect rises (pressure never lapses).
Both halves have failure modes our candidate settings hit: several "living factory" designs made every
machine a mouth, so investment compounded *upkeep* instead of leverage and the factory became a pet that
punishes ownership. The counterweight rule: the ledger must always net positive on attention. Automation
frees hands; it never merely relabels the chore.

*Broken when:* a self-powered module feeds the whole team forever with zero inputs or threat exposure; a
player can log off for a week and return to a strictly better position; a machine automates something no
player ever did manually; session time is dominated by feeding the things you built to escape feeding
things; playtesters describe the pre-automation phase as "the part you get through."

### Rule 6 — Never enough hands

**At every moment the world must offer more worthwhile things to do than the players present can do, at any
headcount — and no single task may be gated on party size, assigned roles, or simultaneous button-pressing.**

The core feeling of goal 2 is the ache of meaningful triage: agency comes from forgoing good options.
Overload is also the entire multiplayer design: dividing an impossible workload is the co-op loop, and it
produces voluntary specialization without building an expensive class system. Independent parallel tasks
make drop-in/drop-out safe. If automation ever clears the whole task list, the frontier must expand —
new layer, new territory, new threat — rather than let hands go idle.

*Broken when:* a player clears their mental to-do list in one session; someone asks "what do you need me to
do?" and the honest answer is "nothing"; you ship a door that needs two players standing on pressure plates.

---

## III. The freedom architecture (goals 3, 4, 6)

### Rule 7 — Price everything, lock nothing

**Never gate a capability behind a binary milestone, prerequisite checklist, or named tier. Gate it with
continuous cost, risk, and distance — plus knowledge found in the world — so any acquisition order is legal
and order itself is a strategy.**

This is what goal 6 means concretely: progression as a capability curve you can climb from any direction,
not a tech tree with eras everyone traverses in sequence. Rushing something powerful early should be
possible, painful, and occasionally brilliant. "I can't have that yet because it's expensive and dangerous"
reads as world logic; "quest flag not set" reads as designer fiat. Knowledge-as-loot (schematics, dissected
monster parts) ties acquisition order to what your particular map offers. Beware milestone smuggling: our
candidate settings kept sneaking tiers back in as "numbered automation layers," singular endgame devices,
and discrete switch-flip gates. Named tiers in a design doc are milestones wearing a trench coat.

*Broken when:* a design doc says "unlocks at" or "after defeating the Warden, players unlock steel"; the UI
shows a tree of greyed-out nodes every server fills in the same order; two playthroughs' first ten
acquisitions match; a speedrunner couldn't touch late-game tech in hour one by taking insane risks.

### Rule 8 — Ship problems, not puzzles

**Every challenge must be beatable by at least three genuinely different strategies discovered by
playtesters, not scripted by designers (two is acceptable at launch), and the random map must change which
strategy is best.**

Goals 3 and 4 protect curiosity and the pride of authorship — "my clever answer," never "the answer." A
single-key lock ("you need the acid gun to get past the roots") is a puzzle, not a problem. Once a wiki
build order exists, replay dies and goal 6 is moot.

*Broken when:* two playtest servers independently converge on near-identical layouts and build orders; a
design doc names the one intended solution.

### Rule 9 — New tools are sideways; depth from collisions

**Every new buildable must solve an existing problem a different way — different inputs, geometry, terrain
needs, tradeoffs — never the same way but strictly better. A new mechanic ships only if it meaningfully
interacts with at least two existing systems; reject any feature that is a parallel track with its own
resource, own UI, and own loop.**

Build diversity comes from orthogonality, not tiers: "Mk2" items kill old options and re-linearize
progression through the back door. Five orthogonal systems that all touch each other yield more strategies
than fifty parallel ones — and that combinatorial depth is the only way a small team affords goal 3. Every
collision is free strategy; every catalog entry is paid content. This is also how goal 5 actually happens:
base and combat feed each other only if their systems share real inputs and outputs.

*Broken when:* the content plan contains "Stone Wall → Iron Wall" with identical function and scaled stats;
veterans call early buildables "trash you skip past"; someone pitches a fishing minigame with its own
currency that nothing else consumes; the roadmap says "add 30 tower types" instead of "make weather affect
turrets."

### Rule 10 — The map is the tech tree

**Every major system — power, food, defense, logistics, aesthetics — must take at least one binding input
from local map generation, such that the strong build on one seed is a weak build on another. The generator
must deny each server at least one comfortable resource or strategy.**

Goal 4 requires terrain to be a resource and a constraint, not scenery. This multiplies goal 3 for free
(N approaches × M map conditions), structurally prevents blueprint monoculture, and — combined with
knowledge-as-loot — lets the map set your progression order: you pursue what your seed makes cheap. On a
persistent server the map is the server's identity for weeks; it is the single highest-leverage
replayability item we own, and crude scarcity weighting is a week of work.

*Broken when:* a community blueprint works on every seed; every seed has all resources within a five-minute
walk of spawn; the seed doesn't change your opening moves; a proposed convenience feature (cheap teleporters)
quietly erases distance as a strategic fact. The positive test: veterans should be able to guess each
other's map seed from a base screenshot alone.

---

## IV. One life, not two games (goal 5)

### Rule 11 — The sword feeds the hearth

**Every combat or exploration reward must change what players can build at home, and every major base
capability must change how players fight or explore. Every combat capability traces its cost back to base
production; every base upgrade path requires at least one input obtainable only by venturing out. No
self-sufficient turtles, no baseless nomads.**

Goal 5 is a circulation requirement on the economy: home and frontier must be each other's suppliers, or one
becomes optional flavor. Venturing out should make you homesick with plans; building should make you itch to
go test what you built. Expeditions return raw components and schematics only the base can process — the
trip home is where combat converts into base power. Cross-feeding is also what makes co-op roles genuinely
need each other.

*Broken when:* a weapon tier's only purpose is killing monsters that drop the next weapon tier; a player
maxes their base without leaving render distance; monsters drop finished weapons instead of parts; a pure
fighter and a pure builder on the same server never have a reason to talk.

---

## V. Beauty and purpose (goals 7, 8)

### Rule 12 — Beauty pays rent

**The simulation must read emergent local properties of the working base — light, flow, symmetry, variety,
sightlines, adjacency — and pay mechanical yield for them. Never score a checklist of decoration items or a
fixed template. Never ship a purely cosmetic buildable. The mechanically optimal base must trend beautiful,
never ugly.**

Goal 7 protects pride — the base as the thing players screenshot — but insists it be earned inside the
system. The trap is Factorio's: when optimal is ugly spaghetti, pressure makes everyone build ugly, and
pride dies. The other trap is the answer key: scoring beauty against a template produces one optimal pretty
base and violates goal 3 — so score composable local properties that admit unlimited high-scoring layouts.
Paying the yield in real economic terms makes beautification a genuine line item in the sacrifice economy.
Scope bonus: computed-from-layout beauty needs no parallel decoration art track, and beautiful bases are a
browser game's entire marketing budget.

*Broken when:* optimal-play screenshots are joyless resource grids; an art pass adds forty stat-less
furniture items; every base grows an identical shrine corner of copy-pasted flowerpots; a buildable's
tooltip contains no numbers.

### Rule 13 — The world asks, not the UI

**Every objective presented to players must originate from inspectable simulated state — an approaching
storm front, a decaying signal, a hungry mouth — never from an authored quest log, numbered tier, or
milestone popup. Every "why?" link between an action and the outer narrative goal must be legible inside
the game world, and no link may exist for depth's sake. The goal surface is server-shared, never
per-player.**

This is the one mechanism that satisfies goal 8 without violating goal 6: when the simulation generates the
goals, direction is constant but its sequence is never pre-defined, and every server's story differs. The
why-chain test: walk the chain — "Why smelt iron?" → "to armor the caravan" → "so it survives the crossing"
→ the north star. The chain may be as long as the design needs; depth is not the enemy. What's forbidden is
an *unclear* link (the player can't see, in the world, why this step serves the next) or a *filler* link
(a step whose only justification is adding progression). If removing a link doesn't break the chain, remove
the link — not the depth. A shared forecast ("storm in two days, food at 40%") makes a group self-organize
for free; per-player quest logs fragment co-op. And the simulation writes infinite quests a small team never
has to author.

*Broken when:* a popup reads "Craft 10 planks (0/10) — Reward: 50 XP"; an "Era II Unlocked!" banner ships; a
playtester asks "what should I be doing?"; the honest answer to "why am I doing this?" is "to clear the
quest log"; a crafting chain contains an intermediate product that exists only to make the chain longer.

---

## VI. The engineering constitution (platform)

These are architecture rules. They're here because they cannot be retrofitted.

### Rule 14 — Rates, not items

**Every automation mechanic must be reducible to throughput arithmetic — rates, buffers, capacities — when
unobserved. Never ship a machine whose correctness depends on per-entity simulation.**

Factorio-depth automation on a browser server hosting 20 players is only affordable if ten thousand machines
tick as math, not objects. It is also what makes the offline fast-forward of Rule 2 a cheap integral instead
of an expensive replay. Our feasibility reviews flagged the same thing on nearly every candidate setting:
the designs that promise continuous physics (thermal diffusion, fluid dynamics, deformable terrain) are the
ones that don't ship. Commit to legible, coarse, tile-or-graph simulation as the *design language* from day
one — sell it proudly as a rule system players can read and master, not as a cheap imitation of physics.

*Broken when:* a splitter puzzle only works because of physical item spacing; a defense requires tracking
each projectile server-side; a machine's pitch can't be restated as "X per second through Y capacity."

### Rule 15 — Bounded blast radius

**Never ship a mechanic that lets one player destroy more of the shared base in a minute than a session can
rebuild, and make every placement, edit, and removal attributable to its author.**

The base is the server's crown jewels, built from hours of collective sacrifice. On persistent co-op servers
the number-one killer is not monsters — it's a griefer, or a well-meaning friend, deleting the power grid.
A change log plus bounded destruction is cheap; a full permission system is not. Buy legibility and
rebuildability before locks. The game may hurt you; friends shouldn't be able to erase you.

*Broken when:* friendly splash damage can chain-detonate a boiler row; craftable TNT ships before the "who
placed/removed this" inspector does.

### Rule 16 — The day-30 join test

**Every feature must pass this test: a brand-new player joining a 30-day-old server can contribute visibly
to the group within their first hour, with no personal catch-up track.**

Persistent friend-servers live or die on whether the friend who joins late has fun on night one. Non-linear
progression, read through a multiplayer lens, means there is no single ladder to be "behind" on — frontier
work (scouting, holding a wall, hauling) must stay valuable at every base tier. Per-player tech gates and
tutorial chains quietly reintroduce the milestone lines Rule 7 bans.

*Broken when:* the only useful thing a newcomer can do is hand-mine copper the base automated two weeks ago;
communal buildings are locked behind individual research progress.

---

## The tensions these rules resolve

The founding goals genuinely conflict in six places. The rules above are the resolutions — when a design
argument circles one of these, this table is the tiebreaker.

| Tension | Resolution |
|---|---|
| Constant pressure (G1) vs. persistent servers where everyone sleeps | Split the clock: pressure scales to presence and footprint; offline time produces but never destroys. (Rules 2, 14) |
| No milestones (G6) vs. always knowing why (G8) | Source objectives from live world state on continuous price curves — the sim supplies direction, the player supplies order. (Rules 7, 13) |
| Automation alleviates work (G2) vs. pressure never lapses (G1) | Conversion, not removal: every layer trades a chore for a smaller demand of a new kind — players climb abstraction layers rather than exiting the loop. (Rule 5) |
| Hard game with real stakes (G1) vs. freedom to experiment (G3) | Bound the downside: threats tax resources, territory, tempo — never hours of built progress. Failure is tuition, not a wipe. (Rule 1) |
| Mechanical beauty (G7) vs. many valid builds (G3) | Score emergent local properties, never templates or item checklists, so unlimited layouts can be both beautiful and profitable. (Rule 12) |
| Factorio-depth automation (G2) vs. browser compute + tiny team | Simulate flows as arithmetic; buy strategic variety through system collisions rather than content volume. (Rules 9, 14) |

## Load-bearing vs. aspirational

A constitution a small team can't enforce is decoration. Priority order, merged from all three lenses:

**Non-negotiable (the loop itself):** Rules 1, 2, 4, 5, 6, 13 — bounded loss, the presence/offline contract,
one economy, attention-conversion, overload, sim-driven direction. If any one fails the game becomes,
respectively: miserable, dead-on-retention, fake, an idle game, a checklist, or pointless.

**Architectural (cannot be retrofitted, decide day one):** Rules 7, 14, 15 — milestone-free progression is
an architecture, not a tuning pass; rates-not-items caps how many automation layers can ever exist; blast
radius matters the day you have two players and one explosive.

**Load-bearing in principle, cheap-first in execution:** Rules 10, 11 — one binding terrain input per major
system and one field-only input per base-upgrade path is enough for v1; crude scarcity weighting ships in
week one.

**Aspirational (enforce in review, build later):** Rules 3, 8, 9, 12, 16 — accept two strategies per
challenge at launch; ship one thin beauty hook (a morale radius that likes light and open space) rather than
an aesthetics engine; start enforcing the join test when servers are actually aging. Rule 9's collision test
costs nothing and starts day one as a review-room question: *which shared pool does this feature drain, and
which new demand does it create? If it has answers to neither, it isn't in this game.*
