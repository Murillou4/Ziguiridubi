export type UpdateFn = (dt: number) => void;
export type RenderFn = () => void;

export class GameLoop {
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;
  private animFrameId: number | null = null;
  private onUpdate: UpdateFn;
  private onRender: RenderFn;

  constructor(onUpdate: UpdateFn, onRender: RenderFn) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = 0;
    this.animFrameId = requestAnimationFrame(this.step);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private step = (timestamp: number): void => {
    if (!this.isRunning) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    // Limita o dt a no máximo 0.05s (evita saltos quânticos se a aba perder foco)
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    this.onUpdate(dt);
    this.onRender();

    this.animFrameId = requestAnimationFrame(this.step);
  };
}
