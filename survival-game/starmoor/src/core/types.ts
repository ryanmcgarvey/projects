// All game state. Plain JSON-serializable data — no classes, no typed arrays,
// no references to anything outside core. Serialization safety is by construction.

export type Res = 'ice' | 'ferrite' | 'isotopes' | 'anchorfeed' | 'burnstock'
export type MineRes = 'ice' | 'ferrite' | 'isotopes'
export type Stocks = Record<Res, number>

export type ModuleKind =
  | 'core' | 'reactor' | 'refinery' | 'tank' | 'berth'
  | 'gallery' | 'hydro' | 'pd' | 'yard'

export interface Module {
  kind: ModuleKind
  gx: number; gy: number
  hp: number
  online: boolean            // recomputed each tick by the power budget
  markedUntil: number        // hush strike countdown (sim time); 0 = unmarked
}

export type BodyKind = 'comet' | 'ferrite' | 'hulk'
export interface Body {
  id: number
  kind: BodyKind
  x: number; y: number; r: number
  res: MineRes               // dominant mineable resource
  richness: number           // mining rate multiplier
}

export interface Shoal { x: number; y: number; r: number }

export interface Claim {
  id: number
  bodyId: number
  hp: number
  online: boolean
  siloRes: MineRes
  silo: number               // halts at CAP (haul-away demand)
}

export interface Lane {
  id: number
  claimId: number
  picket: boolean
  damped: boolean            // path crosses a dust shoal → wake damped
  tithe: number              // 0..1 skim currently imposed by a toll gate
}

export type FactionId = 'combine' | 'breakers' | 'hush'
export interface FactionState {
  heat: number
  gapUntil: number           // no new encounter before this sim time
  belligerence: number       // combine only: permanent, raised by destroying gates
}

export type NpcKind = 'skiff' | 'gunship' | 'hushwing' | 'tollgate'
export interface Npc {
  id: number
  kind: NpcKind
  faction: FactionId
  x: number; y: number
  hp: number
  maxHp: number
  targetBody: number         // claim/lane/module target context (id, meaning per kind)
  laneId: number             // tollgate: which lane it taxes; -1 otherwise
  stolen: number             // skiffs: silo goods carried
  leaving: boolean
}

export interface Crew {
  id: number
  name: string
  role: 'idle' | 'refinery' | 'yard' | 'guns'
}

export interface PlayerShip {
  id: string
  name: string
  x: number; y: number
  hull: number
  hold: Partial<Record<MineRes, number>>
  downUntil: number
  thrusting: boolean
  firing: boolean
  miningBody: number         // body id or -1
}

export interface MooringOption {
  id: number
  x: number; y: number       // beacon position in the current leg
  revealed: boolean
  a0: number                 // anchorfeed yield at arrival
  tau: number                // decay constant (occupied seconds)
  shoals: number             // dust-shoal density at the destination
  mix: string                // human-readable body mix
  denial: string             // what this mooring is starved of
}

export interface WeighState {
  phase: 'moored' | 'countdown' | 'transit'
  endsAt: number             // sim time the current phase resolves
  optionId: number           // chosen destination while countdown/transit
}

export interface LogEntry { t: number; msg: string; kind: 'info' | 'good' | 'warn' | 'bad' }

export interface Fx { kind: 'boom' | 'spark'; x: number; y: number; until: number }

export interface Pickup { id: number; x: number; y: number; hold: Partial<Record<MineRes, number>> }

export interface GameState {
  seed: number
  rngState: number           // ALL sim randomness flows through this (replayable)
  leg: number
  t: number                  // total occupied sim seconds
  tLeg: number               // occupied seconds this leg (drives the taper)
  field: { w: number; h: number }

  bodies: Body[]
  shoals: Shoal[]
  beacons: MooringOption[]
  mooringBodyId: number
  mooringA0: number          // this leg's anchorfeed curve
  mooringTau: number

  station: { x: number; y: number }
  modules: Module[]
  stocks: Stocks
  dark: boolean              // running dark: galleries/hydro unlit (glare counterplay)
  crew: Crew[]
  recruitAt: number          // sim time next recruit may arrive
  leaveAt: number            // sim time next disgruntled-crew departure may happen
  starvedSince: number       // sim time anchorfeed ran dry; 0 = fed
  thrive: number

  claims: Claim[]
  lanes: Lane[]
  npcs: Npc[]
  pickups: Pickup[]
  players: Record<string, PlayerShip>

  factions: Record<FactionId, FactionState>
  weigh: WeighState
  spikeUntil: number         // arrival virgin-yield bonus window
  daysFree: number           // census/score surface: legs survived scaled by time

  log: LogEntry[]
  fx: Fx[]
  nextId: number
}

// ---- player intents: the ONLY way input mutates the sim ----

export type Command =
  | { c: 'state'; x: number; y: number; thrusting: boolean; firing: boolean; miningBody: number }
  | { c: 'transfer' }                                  // hold → station stocks (near station)
  | { c: 'build'; kind: ModuleKind; gx: number; gy: number }
  | { c: 'demolish'; gx: number; gy: number }
  | { c: 'repair'; gx: number; gy: number }
  | { c: 'rig'; bodyId: number }
  | { c: 'lane'; claimId: number }
  | { c: 'picket'; laneId: number }
  | { c: 'repairRig'; claimId: number }
  | { c: 'assign'; crewId: number; role: Crew['role'] }
  | { c: 'payToll'; npcId: number }
  | { c: 'prospect'; beaconId: number }
  | { c: 'weigh'; optionId: number }
  | { c: 'cancelWeigh' }
  | { c: 'dark' }                                      // toggle running dark

export interface CmdResult { ok: boolean; err?: string }
