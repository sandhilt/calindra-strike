import {
  BTN,
  CollisionWorld,
  type MapDef,
  MapBuilder,
  WEAPON,
  type WeaponId,
  applyCmd,
  computeSpread,
  createPlayerState,
  getMaps,
  giveWeapon,
  spawnState,
  weaponDef,
} from '../src/index.ts';

/** One pass over the inputs a player can give a gun with no sights: the trace must not move when aim down sights ships. */
const PLAN: ReadonlyArray<readonly [buttons: number, ticks: number]> = [
  [0, 20],
  [BTN.FWD, 40],
  [BTN.ATTACK2, 3],
  [BTN.FWD, 30],
  [BTN.ATTACK2, 2],
  [BTN.ATTACK2 | BTN.FWD, 25],
  [0, 5],
  [BTN.ATTACK, 2],
  [BTN.FWD | BTN.SPRINT, 40],
  [BTN.FWD | BTN.SPRINT | BTN.ATTACK2, 20],
  [BTN.FWD | BTN.SPRINT, 15],
  [BTN.ATTACK2, 2],
  [BTN.ATTACK2 | BTN.ATTACK, 2],
  [0, 70],
  [BTN.ATTACK2 | BTN.FWD | BTN.DUCK, 30],
  [BTN.ATTACK2, 2],
  [BTN.RELOAD, 3],
  [BTN.ATTACK2 | BTN.FWD, 30],
  [0, 4],
  [BTN.ATTACK2 | BTN.JUMP | BTN.FWD, 40],
  [BTN.ATTACK, 3],
  [0, 90],
  [BTN.ATTACK2 | BTN.ATTACK | BTN.FWD, 40],
];

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  return new CollisionWorld(map);
}

export function traceNoSightsWeapon(weapon: WeaponId): string {
  const w = flatWorld();
  const s = createPlayerState();
  spawnState(s, 0, 0.1, 0, 0, WEAPON.RIFLE);
  s.dropping = false;
  giveWeapon(s, weapon);
  let seq = 0;
  const rows: unknown[] = [];
  const step = (buttons: number): void => {
    const shot = applyCmd(w, s, { seq: seq++, buttons, yaw: 0.3, pitch: 0, weapon: 0, interp: 0 }, 9);
    rows.push([
      s.x, s.z, s.vx, s.vz, s.sprinting, s.zoom, s.resumeZoom, s.stance, s.reload, s.deploy, s.nextFire, s.stamina,
      computeSpread(s), weaponDef(s.weapon).speed, shot ? shot.dirs : null,
    ]);
  };
  for (let i = 0; i < weaponDef(weapon).deployTicks + 2; i++) step(0);
  for (const [buttons, ticks] of PLAN) for (let i = 0; i < ticks; i++) step(buttons);
  return JSON.stringify(rows);
}
