/**
 * World units follow the GoldSrc convention (1 unit ~ 1 inch) so movement
 * numbers read like a CS 1.6 server config.
 */
export const PROTOCOL_VERSION = 14;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;
export const SNAPSHOT_EVERY_TICKS = 3; // 20 Hz snapshots
export const CMDS_PER_PACKET_MAX = 12;

// --- movement (sv_* style) ---
export const GRAVITY = 800;
export const MAX_SPEED = 250;
export const ACCELERATE = 5.5;
export const AIR_ACCELERATE = 12;
export const AIR_WISHSPEED_CAP = 30;
export const FRICTION = 4;
export const STOP_SPEED = 100;
export const JUMP_SPEED = 268.3; // sqrt(2 * 800 * 45) -> 45 unit jump
export const BUNNYJUMP_MAX_FACTOR = 1.2;
export const STEP_SIZE = 18;
export const MAX_VELOCITY = 2000;

export const DUCK_SPEED_MULT = 0.34;
export const WALK_SPEED_MULT = 0.52;

// --- player hull ---
export const PLAYER_RADIUS = 16;
export const STAND_HEIGHT = 72;
export const DUCK_HEIGHT = 36;
export const STAND_EYE = 64;
export const DUCK_EYE = 30;

// --- skydive spawn ---
export const DROP_FALL_SPEED = 560;
export const DROP_DIVE_SPEED = 980;
export const DROP_AIR_SPEED = 520;
export const DROP_ACCEL = 4;
export const SPAWN_PROTECT_TICKS = 90; // 1.5s after landing

// --- match ---
export const MAX_HEALTH = 100;
export const MAX_ARMOR = 100;
export const RESPAWN_TICKS = 3 * TICK_RATE;
export const LAGCOMP_MAX_MS = 250;
export const INTERP_DELAY_MS = 100;

export const AIRDROP_FALL_SPEED = 140;
export const AIRDROP_PICKUP_RADIUS = 44;
export const AIRDROP_HALF = 22;

export const NAME_MAX_LEN = 16;

/** Team Deathmatch sides. Lime vs blue stays distinguishable for red-green colour blindness. */
export const TEAMS = [
  { name: 'Bulldogs', color: '#9de82b' },
  { name: 'Martelos', color: '#4a9dff' },
] as const;

export const ZOOM_SENSITIVITY_RATIO = 1.2; // CS 1.6 default
export const CHAT_MAX_LEN = 100;

/** Player colours: vivid, readable against the arena palette. Lime is reserved for UI. */
export const PLAYER_COLORS = [
  '#ff5a4e',
  '#ff9f1c',
  '#ffd23f',
  '#3ec1ff',
  '#4f6bff',
  '#a46bff',
  '#ff5fc4',
  '#2ee6c5',
  '#f0f0f0',
  '#ff7a59',
  '#7ce0ff',
  '#c8ff8a',
] as const;

export const BTN = {
  FWD: 1,
  BACK: 2,
  LEFT: 4,
  RIGHT: 8,
  JUMP: 16,
  DUCK: 32,
  WALK: 64,
  ATTACK: 128,
  ATTACK2: 256,
  RELOAD: 512,
  USE: 1024,
} as const;
export const BTN_MASK = 2047;

export const SPECTATOR_PICK_MS = 15_000;
export const MAX_SPECTATORS = 16;

export const SPRAYS_PER_SPAWN = 10;
export const SPRAY_COOLDOWN_TICKS = 2 * TICK_RATE; // 2 s
export const SPRAY_EMPTY_BURSTS = [
  { delaySeconds: 0.95, frequencyHz: 4800, durationSeconds: 0.06, gain: 0.1 },
  { delaySeconds: 1.03, frequencyHz: 3900, durationSeconds: 0.045, gain: 0.07 },
  { delaySeconds: 1.17, frequencyHz: 3400, durationSeconds: 0.03, gain: 0.03 },
] as const;
export const SPRAY_RANGE = 128; // world units
export const SPRAY_SIZE = 32; // world units, decal square side
export const CTF_PICKUP_RADIUS_UNITS = 48;
export const CTF_CAPTURE_RADIUS_UNITS = 64;
export const CTF_RETURN_TICKS = 30 * TICK_RATE;

export const CTF_ENGAGE_DISTANCE_UNITS = 600;

// --- debug defusion ---
export const PLANT_TICKS = 3 * TICK_RATE;
export const FUSE_TICKS = 30 * TICK_RATE;
export const DEFUSE_TICKS = 7 * TICK_RATE;
/** A dropped bug left on the floor this long hands the round to the other team, like a closed plant window. */
export const BOMB_DROPPED_TICKS = 20 * TICK_RATE;
export const BOMB_DROPPED_MS = (BOMB_DROPPED_TICKS * 1000) / TICK_RATE;
export const PLANT_MS = PLANT_TICKS * TICK_MS;
export const DEFUSE_MS = DEFUSE_TICKS * TICK_MS;
export const FUSE_MS = (FUSE_TICKS * 1000) / TICK_RATE;
export const BOMB_SITE_RADIUS_UNITS = 160;
export const DEFUSE_RADIUS_UNITS = 64;
export const DEBUG_SCENARIO_COUNT = 6;
/** Share of rounds that turn Black Friday: it switches on at a random moment, and the planted bug burns a shorter fuse. */
export const BLACK_FRIDAY_CHANCE = 0.2;
/** A match without Black Friday gets one at the latest on this round, so every complete match sees it at least once. */
export const BLACK_FRIDAY_GUARANTEE_ROUND = 3;
/** A Black Friday round switches on within this long after the round starts, or at the plant if that comes first. */
export const BLACK_FRIDAY_WINDOW_TICKS = 30 * TICK_RATE;
/** Black Friday is "50% OFF" the fuse: half the normal one. */
export const BLACK_FRIDAY_DISCOUNT_PERCENT = 50;
export const BLACK_FRIDAY_FUSE_TICKS = (FUSE_TICKS * (100 - BLACK_FRIDAY_DISCOUNT_PERCENT)) / 100;
export const BLACK_FRIDAY_FUSE_MS = (BLACK_FRIDAY_FUSE_TICKS * 1000) / TICK_RATE;
/** Default time the attackers get to plant before the laptop goes to the other team (server setting, 0 = no limit). */
export const BOMB_PLANT_TIMEOUT_SECONDS = 60;
// The bug rests on square, solid stands, so any quarter turn of the model keeps the same collision box.
// Sized so a player pressed against any corner still reaches it: desk corner within DEFUSE_RADIUS_UNITS,
// crate corner within CTF_PICKUP_RADIUS_UNITS (half size plus PLAYER_RADIUS, along both axes).
export const BOMB_DESK_SIZE_UNITS = 50;
export const BOMB_DESK_HEIGHT_UNITS = 30;
export const BOMB_CRATE_SIZE_UNITS = 32;
export const BOMB_CRATE_HEIGHT_UNITS = 24;
