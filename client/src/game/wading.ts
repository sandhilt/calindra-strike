/** What a player's feet should sound like on this update: a splash, the dry thud of a landing, or nothing new. */
export type WadeSound = 'splash' | 'thud' | null;

/**
 * Remembers whether one player was in water on the last update, so a fall into a pool splashes once: on the
 * way in, not again when the feet reach the floor of the basin, and never with the dry landing on top.
 */
export class Wader {
  private wasWet = false;
  private splashedInFall = false;

  /**
   * `grounded` is whether the feet stand on something now, `landed` whether this update is the touchdown
   * (a jump or a skydive ending).
   */
  update(wet: boolean, grounded: boolean, landed: boolean): WadeSound {
    const entered = wet && !this.wasWet;
    this.wasWet = wet;
    let sound: WadeSound = null;
    if (entered) {
      sound = 'splash';
      this.splashedInFall = !grounded;
    } else if (landed) {
      sound = wet ? (this.splashedInFall ? null : 'splash') : 'thud';
    }
    if (landed) this.splashedInFall = false;
    return sound;
  }

  get wet(): boolean {
    return this.wasWet;
  }

  reset(): void {
    this.wasWet = false;
    this.splashedInFall = false;
  }
}
