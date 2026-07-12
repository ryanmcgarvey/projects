// Every tuning number in the game. Balance iteration happens here, not in logic.
import { ModuleKind, Res } from './types'

export const C = {
  TICK: 0.25,                      // sim step seconds

  FIELD_W: 3200, FIELD_H: 2000,
  GRID: 11, GRID_CENTER: 5, CELL: 16,   // station module grid (world units per cell)

  // ship
  SHIP_SPEED: 150,                 // hard cap; displacement per command is clamped to this
  SHIP_ACCEL: 260, SHIP_DRAG: 1.6, // flight feel (integrated in the shell, enforced in core)
  SHIP_HP: 100,
  HOLD_CAP: 30,
  LASER_DPS: 14, LASER_RANGE: 110,
  MINE_RATE: 1.4, MINE_RANGE: 80,
  DOCK_RANGE: 110,
  STATION_WORK_RANGE: 220,         // build/demolish/repair require being at the city
  INTERACT_RANGE_RIG: 140,
  INTERACT_RANGE_BEACON: 150,
  INTERACT_RANGE_GATE: 200,
  RESPAWN_SECS: 5,
  HULL_REGEN_DOCKED: 4,

  // anchorfeed: the moor-bound, un-importable life support (steelman #1)
  FEED_BASE_DRAW: 0.35,
  FEED_MODULE_DRAW: 0.05,
  FEED_CREW_DRAW: 0.12,
  HYDRO_CREW_RELIEF: 0.25,         // each lit hydro trims total crew draw, floor 40%
  STARVE_CREW_LEAVE_SECS: 90,

  // refinery
  REFINE_RATE: 0.6,                // ice/s consumed
  REFINE_YIELD: 0.8,               // burnstock per ice

  // claims & lanes
  RIG_RATE: 0.9, SILO_CAP: 60,
  LANE_RATE: 1.2,
  RIG_HP: 60,

  // base stock caps (+TANK_CAP per tank online)
  BASE_CAP: { ice: 120, ferrite: 140, isotopes: 80, anchorfeed: 160, burnstock: 500 } as Record<Res, number>,
  TANK_CAP: 60,

  // emissions → faction heat
  GLARE_GALLERY: 0.16, GLARE_HYDRO: 0.06, GLARE_MODULE: 0.015,
  WAKE_LANE: 0.07, WAKE_LANE_DAMPED: 0.35, WAKE_SHIP: 0.012,
  CHATTER_LANE: 0.05, CHATTER_PICKET: 0.06,
  HEAT_COMBINE_WAKE: 0.9, HEAT_COMBINE_WEALTH: 0.010,
  HEAT_BREAKERS_SCRAP: 0.16,
  HEAT_HUSH_GLARE: 1.1, HEAT_HUSH_CHATTER: 0.5,
  HEAT_T1: 100, HEAT_T2: 220, HEAT_T3: 360,
  HEAT_MAX: 440,                   // heat is a bounded meter, not an unbounded debt
  HEAT_ENCOUNTER_RELIEF: 0.55,     // multiplier applied when an encounter resolves
  ENCOUNTER_GAP: 120,              // min seconds between encounters per faction
  LEG_GRACE: 180,                  // no encounters right after arrival (the loop breathes)
  PRESENCE_BASE: 0.6, PRESENCE_PER_PLAYER: 0.1, PRESENCE_CAP: 4,

  // combat
  SKIFF_HP: 40, SKIFF_DPS: 6, SKIFF_SPEED: 55, SKIFF_RANGE: 80, SKIFF_STEAL: 0.9, SKIFF_BAG: 18,
  GUNSHIP_HP: 100, GUNSHIP_DPS: 11, GUNSHIP_SPEED: 40, GUNSHIP_RANGE: 120,
  HUSHWING_HP: 70, HUSHWING_SPEED: 90,
  PD_DPS: 10, PD_RANGE: 170,
  PICKET_DPS: 5, PICKET_RANGE: 140,
  MODULE_HP: 80,
  NPC_MODULE_DPS: 8,
  TOLL_T1: 0.15, TOLL_T2: 0.25,
  TOLL_PAYOFF_ISOTOPES: 15,
  HUSH_MARK_SECS: 60,
  HUSH_AVERT_GLARE: 0.25,          // glare rate below this at expiry → strike averted

  // thrive (beauty pays rent — composable properties, no template)
  THRIVE_GALLERY: 4, THRIVE_EXPOSED_EDGE: 1, THRIVE_GREEN_ADJ: 2, THRIVE_NOISE_ADJ: -2,
  THRIVE_HYDRO: 3, THRIVE_STARVING: -12,
  RECRUIT_MIN_THRIVE: 25,
  RECRUIT_FAST: 90, RECRUIT_SLOW: 260,   // arrival interval at thrive 100 / at min
  CREW_BOOST: 0.5,                 // assigned crew rate bonus (thrive-scaled)
  SIEGE_THRIVE_LEAVE: 15,
  THRIVE_LOW_GRACE: 100,           // sustained misery before anyone leaves — a 60s defensive
                                   // dark run must never cost crew (Hush counterplay stays viable)

  // the Weigh (steelman #2: paid forward, presence-scaled set-piece)
  WEIGH_BASE_COST: 500, WEIGH_PER_MODULE: 15,
  WEIGH_COUNTDOWN: 45, WEIGH_TRANSIT: 75,
  ARRIVAL_SPIKE_MULT: 1.5, ARRIVAL_SPIKE_SECS: 300,
  SALVAGE_FERRITE: 30, SALVAGE_ISOTOPES: 12,
  HEAT_WEIGH_MULT: 0.15,

  // costs
  COST_RIG: { ferrite: 20 } as Partial<Record<Res, number>>,
  COST_LANE: { ferrite: 12, isotopes: 4 } as Partial<Record<Res, number>>,
  COST_PICKET: { ferrite: 8, isotopes: 6 } as Partial<Record<Res, number>>,
  COST_REPAIR_MODULE: { ferrite: 6 } as Partial<Record<Res, number>>,
  COST_REPAIR_RIG: { ferrite: 5 } as Partial<Record<Res, number>>,

  LOG_MAX: 40,
}

export interface ModuleDef {
  cost: Partial<Record<Res, number>>
  watts: number                    // negative = draws, positive = supplies
  shedRank: number                 // higher = browns out first when overdrawn
  buildable: boolean
}

export const MODULES: Record<ModuleKind, ModuleDef> = {
  core:     { cost: {},                          watts: +20, shedRank: -1, buildable: false },
  reactor:  { cost: { ferrite: 25, isotopes: 10 }, watts: +16, shedRank: -1, buildable: true },
  gallery:  { cost: { ferrite: 15 },             watts: -2,  shedRank: 9, buildable: true },
  hydro:    { cost: { ferrite: 12, ice: 10 },    watts: -3,  shedRank: 8, buildable: true },
  yard:     { cost: { ferrite: 25 },             watts: -6,  shedRank: 7, buildable: true },
  refinery: { cost: { ferrite: 20 },             watts: -8,  shedRank: 6, buildable: true },
  berth:    { cost: { ferrite: 12 },             watts: -1,  shedRank: 5, buildable: true },
  tank:     { cost: { ferrite: 10 },             watts: -1,  shedRank: 4, buildable: true },
  pd:       { cost: { ferrite: 18, isotopes: 8 }, watts: -5, shedRank: 3, buildable: true },
}

export const WEALTH_WEIGHT: Record<Res, number> = {
  ice: 0.5, ferrite: 1, isotopes: 2, anchorfeed: 0, burnstock: 1.5,
}

export const CREW_NAMES = [
  'Vess', 'Okoro', 'Brann', 'Sable', 'Ihra', 'Tam', 'Juno', 'Kest',
  'Marlow', 'Ode', 'Pell', 'Rook', 'Sena', 'Ugo', 'Wren', 'Yara',
]
