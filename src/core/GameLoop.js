export class GameLoop {
  constructor(onUpdate, onRender) {
    this.isRunning = false;
    this.lastTimestamp = 0;
    this.animFrameId = null;
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = 0;
    this.animFrameId = requestAnimationFrame(this.step);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  step = (timestamp) => {
    if (!this.isRunning) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    this.onUpdate(dt);
    this.onRender();

    this.animFrameId = requestAnimationFrame(this.step);
  };
}
