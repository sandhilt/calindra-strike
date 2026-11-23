/**
 * World units follow the GoldSrc convention (1 unit ~ 1 inch) so movement
 * numbers read like a CS 1.6 server config.
 */
export const PROTOCOL_VERSION = 22;

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
export const PRONE_SPEED_MULT = 0.15;

// --- sprint, stamina, slide, lean and prone (experimental tuning values) ---
/** Sprint runs at this multiple of the weapon's own speed. */
export const SPRINT_SPEED_MULT = 1.35;
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN_PER_TICK = STAMINA_MAX / (5 * TICK_RATE); // 5 s of sprint from full
export const STAMINA_REGEN_PER_TICK = STAMINA_MAX / (6 * TICK_RATE); // 6 s to refill from empty
/** After the meter empties the player is winded and cannot sprint until it refills to this much. */
export const STAMINA_RESUME = 25;
/** The gun is out of use this long after a sprint ends, like the weapon coming up in a war game. */
export const SPRINT_OUT_TICKS = 9;
export const SLIDE_TICKS = 42; // longest slide, 0.7 s
export const SLIDE_MIN_SPEED = 240; // units/s needed on the ground to start a slide
export const SLIDE_BOOST_SPEED = 330; // units/s cap of the push a slide starts with
export const SLIDE_FRICTION = 1.2; // ground friction while sliding (FRICTION is 4)
export const SLIDE_END_SPEED = 120; // a slide that slows below this units/s ends
export const SLIDE_STAMINA_COST = 20;
/** Sideways reach of the eye at full lean, before a wall shortens it. */
export const LEAN_OFFSET_UNITS = 18;
/** The leaning eye stops this short of a wall, so the view never pokes into it. */
export const LEAN_WALL_MARGIN_UNITS = 6;
export const LEAN_RATE_PER_TICK = 0.14; // lean (-1..1) moves this much per tick toward its target
export const LEAN_HEAD_SHIFT_UNITS = 9; // the head hitbox follows the lean this far: less than the eye and the gun (LEAN_OFFSET_UNITS), so a peek shows the weapon before the body
export const LEAN_BODY_SHIFT_UNITS = 3;
/** Going into or out of prone locks the stance this long, so nobody can stutter between prone and standing. */
export const PRONE_SWITCH_TICKS = 18;
export const PRONE_SPREAD_MULT = 0.8; // on top of the weapon's crouch multiplier

// --- player hull ---
export const PLAYER_RADIUS = 16;
export const STAND_HEIGHT = 72;
export const DUCK_HEIGHT = 36;
export const STAND_EYE = 64;
export const DUCK_EYE = 30;
export const PRONE_HEIGHT = 20;
export const PRONE_EYE = 14;

// --- skydive spawn ---
export const DROP_FALL_SPEED = 560;
export const DROP_DIVE_SPEED = 980;
export const DROP_AIR_SPEED = 520;
export const DROP_ACCEL = 4;
export const SPAWN_PROTECT_TICKS = 90; // 1.5s after landing
/** Default time without input before an idle player goes back to the lobby (server setting). */
export const IDLE_KICK_SECONDS = 60;
/** Same, during the warmup: players wait there for the match to fill up, so they may stay idle longer. */
export const IDLE_KICK_WARMUP_SECONDS = 300;
/** Default time a player has to confirm "pronto" before going back to the lobby (server setting). */
export const READY_KICK_SECONDS = 180;
export const IDLE_WARNING_LEAD_MS = 10_000; // how long before the idle kick the client warns the player

// --- match ---
export const MAX_HEALTH = 100;
export const MAX_ARMOR = 100;
export const RESPAWN_TICKS = 5 * TICK_RATE;
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
/** Minimum gap between two radio lines from one player (CS 1.6 mp_radio_timeout), so the menu cannot be spammed. */
export const RADIO_COOLDOWN_MS = 1500;
export const RADIO_COOLDOWN_TICKS = Math.ceil(RADIO_COOLDOWN_MS / TICK_MS);
/** At most this many radio lines per player in any RADIO_WINDOW_MS (0 = no cap). Lines over it are dropped silently. */
export const RADIO_MAX_PER_WINDOW = 3;
export const RADIO_WINDOW_MS = 10_000;

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
  SPRINT: 2048,
  LEAN_LEFT: 4096,
  LEAN_RIGHT: 8192,
  PRONE: 16384, // wants to lie down; the client latches it as a toggle
} as const;
export const BTN_MASK = 32767;

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
/** In debug defusion nobody respawns closer than this to the site, so a revived defender cannot kill the planter on the spot. */
export const BOMB_SPAWN_KEEPOUT_UNITS = 800;
export const DEFUSE_RADIUS_UNITS = 64;
export const DEBUG_SCENARIO_COUNT = 8;
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
export const BOMB_PLANT_TIMEOUT_SECONDS = 30;
// The bug rests on square, solid stands, so any quarter turn of the model keeps the same collision box.
// Sized so a player pressed against any corner still reaches it: desk corner within DEFUSE_RADIUS_UNITS,
// crate corner within CTF_PICKUP_RADIUS_UNITS (half size plus PLAYER_RADIUS, along both axes).
export const BOMB_DESK_SIZE_UNITS = 50;
export const BOMB_DESK_HEIGHT_UNITS = 30;
export const BOMB_CRATE_SIZE_UNITS = 32;
export const BOMB_CRATE_HEIGHT_UNITS = 24;

// Hora de almoçar (tuning values)
export const LUNCH_ROUND_TICKS = 90 * TICK_RATE; // a round lasts 90 s, then the food court is full
/** Share of rounds that are a rush hour: the food court fills up this many times faster, so the round is that much shorter (tuning values). */
export const LUNCH_RUSH_CHANCE = 0.25;
export const LUNCH_RUSH_SPEED = 2;
export const LUNCH_RUSH_ROUND_TICKS = LUNCH_ROUND_TICKS / LUNCH_RUSH_SPEED;
export const LUNCH_WIN_ROUNDS = 4; // rounds to win the match early
export const LUNCH_USE_RADIUS_UNITS = 80; // how close a rescuer stands to call a colleague with USE
export const LUNCH_WALK_UNITS_PER_TICK = MAX_SPEED / TICK_RATE; // colleagues keep up with a running player
export const LUNCH_FOLLOW_GAP_UNITS = 64; // the first follower stops this far behind its leader
export const LUNCH_FOLLOW_SPACING_UNITS = 44; // each further follower trails this much more
export const LUNCH_TRAIL_STEP_UNITS = 24; // leader positions are kept every this many units walked
export const LUNCH_TRAIL_MAX_POINTS = 240;
export const LUNCH_SEAT_RADIUS_UNITS = 180; // a colleague this close to a restaurant counter sits down
export const LUNCH_SEAT_HEIGHT_UNITS = 48; // ...and on the same floor

// Day cycle (tuning values): the phases follow each other in this order and then start over.
export const DAY_PHASES = ['day', 'afternoon', 'night'] as const;
export type DayPhase = (typeof DAY_PHASES)[number];
/** Length of each phase's slot, its closing transition included: 15 min for the whole cycle. */
export const DAY_SLOT_MS: Readonly<Record<DayPhase, number>> = { day: 7 * 60_000, afternoon: 4 * 60_000, night: 4 * 60_000 };
/** The last stretch of a slot is spent blending into the next phase. */
export const DAY_TRANSITION_MS = 30_000;
