/** Remembers whether one player was in water on the last update, so only the step from dry to wet splashes. */
export class Wader {
  private wasWet = false;

  /** True once, on the update where the feet go from dry to wet. */
  update(wet: boolean): boolean {
    const entered = wet && !this.wasWet;
    this.wasWet = wet;
    return entered;
  }

  get wet(): boolean {
    return this.wasWet;
  }

  reset(): void {
    this.wasWet = false;
  }
}
