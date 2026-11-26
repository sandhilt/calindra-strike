import {
  createPlayerState,
  getMap,
  PLAYER_RADIUS,
  RF_DROP,
  RF_PROTECT,
  stanceFromFlags,
  type CollisionWorld,
  type Cmd,
} from '../../shared/src/index.ts';
import { BotBrain, type BotAgent } from '../../server/src/bot.ts';
import type { NavGrid } from '../../server/src/nav.ts';
import { bombState, bombPlaces, flagStates, carrapetaState, lunchColleagues, type WorldView } from './view.ts';

export type Intent =
  | { kind: 'idle' }
  | { kind: 'moveTo'; x: number; z: number; y?: number }
  | { kind: 'attack'; targetId: number; ended?: boolean }
  | { kind: 'hunt' };

export class Pilot {
  private readonly brain: BotBrain;
  private tick = 0;
  private alive = false;
  private dropping = false;
  private agents = new Map<number, BotAgent>();

  private readonly random: () => number;

  constructor(skill: number, random: () => number) {
    this.brain = new BotBrain(skill);
    this.random = random;
  }

  setIntent(intent: Intent, y: number): void {
    if (intent.kind === 'moveTo') this.brain.setDirective({ kind: 'goto', x: intent.x, z: intent.z, y: intent.y ?? y });
    else if (intent.kind === 'attack') this.brain.setDirective({ kind: 'engage', targetId: intent.targetId });
    else this.brain.setDirective(null);
  }

  get arrived(): boolean {
    return this.brain.arrived;
  }
  get directiveEnded(): boolean {
    return this.brain.directiveEnded;
  }

  noteEnemyHit(distanceUnits: number): void {
    this.brain.noteEnemyHit(distanceUnits);
  }

  nextCmd(view: WorldView, intent: Intent, nav: NavGrid, world: CollisionWorld, seq: number, manualWeaponControl = false): Cmd {
    const state = view.self;
    const alive = state !== null && state.health > 0;
    if ((alive && !this.alive) || (state?.dropping && !this.dropping)) this.brain.reset();
    this.alive = alive;
    this.dropping = state?.dropping ?? false;
    this.tick++;
    const idle = {
      seq,
      buttons: 0,
      yaw: state?.yaw ?? 0,
      pitch: state?.pitch ?? 0,
      weapon: 0,
      interp: view.time,
    };
    if (!state || !alive || intent.kind === 'idle' || (intent.kind === 'attack' && intent.ended)) return idle;
    const self: BotAgent = {
      id: view.id,
      team: view.roster.find((r) => r[0] === view.id)?.[3] ?? -1,
      alive,
      state,
    };
    const players = [self];
    const present = new Set<number>();
    for (const peer of view.peers) {
      present.add(peer.id);
      const previous = this.agents.get(peer.id);
      const remote = previous?.state ?? createPlayerState();
      Object.assign(remote, {
        x: peer.x,
        y: peer.y,
        z: peer.z,
        yaw: peer.yaw,
        pitch: peer.pitch,
        stance: stanceFromFlags(peer.flags),
        lean: peer.lean,
        dropping: !!(peer.flags & RF_DROP),
        protect: peer.flags & RF_PROTECT ? 1 : 0,
        health: 100,
        weapon: peer.weapon,
      });
      const agent = { id: peer.id, team: peer.team, alive: peer.alive, state: remote };
      this.agents.set(peer.id, agent);
      players.push(agent);
    }
    for (const id of this.agents.keys()) if (!present.has(id)) this.agents.delete(id);
    const map = getMap(view.match.map);
    // Only hunt plays the round: the brain holds USE beside a colleague, which would hijack a move_to.
    const colleagues = intent.kind === 'hunt' ? lunchColleagues(view) : undefined;
    const flagBases = map.flagBases.map(b => ({ ...b, y: world.groundBelow(b.x, map.dropHeight, b.z, PLAYER_RADIUS) }));
    const cmd = this.brain.think(self, {
      world,
      nav,
      tick: this.tick,
      manualWeaponControl: manualWeaponControl || intent.kind !== 'hunt',
      now: view.time,
      mode: view.match.mode,
      random: this.random,
      players,
      airdrops: view.airdrops,
      carrapeta: carrapetaState(view),
      flags: flagStates(view),
      bomb: bombState(view),
      bombPlaces: view.bomb.length ? bombPlaces(view, world) : undefined,
      lunchPlaces: colleagues ? { attackers: view.lunch[0], hold: flagBases[1 - view.lunch[0]] } : undefined,
      colleagues,
      restaurants: view.lunch.length >= 3 ? map.restaurants.slice(view.lunch[2], view.lunch[2] + 1) : map.restaurants,
      interiors: map.interiors,
      supplies: map.supplies.map((stand, i) => ({ ...stand, ready: (view.supplies[i] ?? 0) === 0 })),
      flagBases,
    });
    if (this.brain.directiveEnded) return idle;
    return { ...cmd, seq };
  }
}
