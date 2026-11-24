import * as THREE from 'three';
import { DRUM_CHAMBERS, EJECT_SECONDS, LOAD_TURN_RAD, chambersFilled, drumLayout, droppedShell, ejectedShell, filledChambers, FIRING_ORDER } from './drum-anim.ts';
import type { ReloadPose } from './reload-anim.ts';
import type { ReloadRig } from './weapons3d.ts';

type Drum = NonNullable<ReloadRig['drum']>;

/** Rounds in the drum and what it holds when full. */
export interface DrumRounds {
  mag: number;
  capacity: number;
}

interface Flight {
  t: number;
  fall: boolean;
  start: THREE.Vector3;
}

/** Share of the drum's travel it covers each second when it steps to the next chamber after a shot. */
const STEP_RATE_PER_S = 18;
/** Where in the dump (0..1) the first and the last round start to fall out of the open drum. */
const DUMP_FROM = 0;
const DUMP_SPAN = 0.7;
const FALL_SHARE = 0.3;

const here = new THREE.Vector3();

/**
 * Turns the Azeitadora's drum and moves its rounds: the drum steps one chamber and the fired round is thrown out on every shot, a reload tips the rest out of
 * the open drum and spins it while the fresh rounds go in, and with no rounds left the chambers are empty. Reads the rounds in the magazine, so it never keeps its own count.
 */
export class DrumView {
  private angle = 0;
  private firedShown = 0;
  private pendingEject = false;
  private reloading = false;
  private dumpMask: readonly boolean[] = [];
  private dumped: boolean[] = [];
  private readonly flights: (Flight | null)[] = Array.from({ length: DRUM_CHAMBERS }, () => null);

  /** A new model was built: start from a full drum with nothing in the air. */
  reset(): void {
    this.angle = 0;
    this.firedShown = 0;
    this.pendingEject = false;
    this.reloading = false;
    this.dumpMask = [];
    this.dumped = [];
    this.flights.fill(null);
  }

  /** The gun fired: the round in the top chamber leaves it on the next update. */
  eject(): void {
    this.pendingEject = true;
  }

  update(drum: Drum, pose: ReloadPose, rounds: DrumRounds, dt: number): void {
    const layout = drumLayout(rounds.mag, rounds.capacity);
    const filling = pose.drumFill >= 0;
    const dumping = pose.drumDump >= 0;
    if (!this.reloading && (filling || dumping)) {
      this.dumpMask = [...layout.loaded];
      this.dumped = this.dumpMask.map(() => false);
    }
    this.reloading = filling || dumping;

    if (filling) this.angle = pose.drumTurn * LOAD_TURN_RAD;
    else {
      this.angle %= LOAD_TURN_RAD;
      const toward = this.angle > layout.angle ? layout.angle + LOAD_TURN_RAD : layout.angle;
      this.angle += (toward - this.angle) * Math.min(1, dt * STEP_RATE_PER_S);
    }
    drum.group.rotation.z = -this.angle;
    drum.group.updateWorldMatrix(true, false);

    if (this.pendingEject) {
      this.pendingEject = false;
      this.launch(drum, FIRING_ORDER[this.firedShown % DRUM_CHAMBERS], false);
    }
    if (!filling && !dumping) this.firedShown = Math.max(0, rounds.capacity - rounds.mag);

    const filled = filledChambers(chambersFilled(pose.drumFill, rounds.capacity));
    drum.rounds.forEach((round, k) => {
      if (filling) round.visible = filled.includes(k);
      else if (dumping) round.visible = (this.dumpMask[k] ?? false) && !this.dumped[k];
      else round.visible = layout.loaded[k] && !this.isFlying(k);
    });
    if (dumping) this.dumpRounds(drum, pose.drumDump);
    const lit = drum.rounds.filter((round) => round.visible).length;
    drum.pips.meshes.forEach((pip, i) => {
      pip.visible = i < Math.min(DRUM_CHAMBERS, rounds.capacity);
      pip.material = i < lit ? drum.pips.on : drum.pips.off;
    });

    this.flights.forEach((flight, slot) => {
      const shell = drum.loose[slot];
      if (!flight) {
        shell.visible = false;
        return;
      }
      flight.t += dt / (flight.fall ? EJECT_SECONDS * FALL_SHARE * 3 : EJECT_SECONDS);
      const flightPose = flight.fall ? droppedShell(flight.t) : ejectedShell(flight.t);
      shell.visible = flightPose.visible;
      if (!flightPose.visible) {
        this.flights[slot] = null;
        return;
      }
      shell.position.set(flight.start.x + flightPose.x, flight.start.y + flightPose.y, flight.start.z + flightPose.z);
      shell.rotation.set(0, 0, flightPose.spin);
    });
  }

  private isFlying(chamber: number): boolean {
    return this.flights.some((flight, slot) => flight !== null && slot === chamber && !flight.fall);
  }

  /** The loaded chambers let go one after another while the drum is open. */
  private dumpRounds(drum: Drum, dump: number): void {
    const rank = this.dumpMask.flatMap((loaded, k) => (loaded ? [k] : []));
    rank.forEach((chamber, order) => {
      const startsAt = DUMP_FROM + (DUMP_SPAN * order) / Math.max(1, rank.length);
      if (dump < startsAt || this.dumped[chamber]) return;
      this.dumped[chamber] = true;
      this.launch(drum, chamber, true);
    });
  }

  /** Starts a round flying from `chamber`, at wherever that chamber is now. */
  private launch(drum: Drum, chamber: number, fall: boolean): void {
    const spot = drum.chambers[chamber % DRUM_CHAMBERS];
    const parent = drum.loose[0].parent;
    if (!spot || !parent) return;
    here.copy(spot);
    drum.group.localToWorld(here);
    parent.worldToLocal(here);
    const slot = this.flights.findIndex((flight) => flight === null);
    if (slot < 0) return;
    this.flights[slot] = { t: 0, fall, start: here.clone() };
  }
}
