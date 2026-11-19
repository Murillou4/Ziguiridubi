export class GameClock {
  public worldTime: number = 0;
  public hitStopTimer: number = 0;
  public uiTickTimer: number = 0;
  public saveTickTimer: number = 0;

  update(dt: number): { isHitStopped: boolean; shouldTickUI: boolean; shouldAutoSave: boolean } {
    this.worldTime += dt;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return { isHitStopped: true, shouldTickUI: false, shouldAutoSave: false };
    }

    this.uiTickTimer += dt;
    let shouldTickUI = false;
    if (this.uiTickTimer >= 0.25) {
      this.uiTickTimer = 0;
      shouldTickUI = true;
    }

    this.saveTickTimer += dt;
    let shouldAutoSave = false;
    if (this.saveTickTimer >= 15.0) {
      this.saveTickTimer = 0;
      shouldAutoSave = true;
    }

    return { isHitStopped: false, shouldTickUI, shouldAutoSave };
  }

  addHitStop(duration: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  reset(): void {
    this.worldTime = 0;
    this.hitStopTimer = 0;
    this.uiTickTimer = 0;
    this.saveTickTimer = 0;
  }
}
