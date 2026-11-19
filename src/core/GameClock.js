export class GameClock {
  constructor() {
    this.worldTime = 0;
    this.hitStopTimer = 0;
    this.uiTickTimer = 0;
    this.saveTickTimer = 0;
  }

  update(dt) {
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

  addHitStop(duration) {
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  reset() {
    this.worldTime = 0;
    this.hitStopTimer = 0;
    this.uiTickTimer = 0;
    this.saveTickTimer = 0;
  }
}
