export class Camera {
  public x: number = 0;
  public y: number = 0;
  public shakeX: number = 0;
  public shakeY: number = 0;
  public shakeMag: number = 0;
  public zoom = 1;
  private following = true;

  pan(dx: number, dy: number): void {
    this.following = false;
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  changeZoom(factor: number, offsetX: number, offsetY: number): void {
    const previous = this.zoom;
    this.zoom = Math.max(0.25, Math.min(3, previous * factor));
    if (!this.following) {
      this.x += offsetX * (1 / previous - 1 / this.zoom);
      this.y += offsetY * (1 / previous - 1 / this.zoom);
    }
  }

  recenter(x: number, y: number): void {
    this.following = true;
    this.x = x;
    this.y = y;
  }

  screenToWorld(x: number, y: number, width: number, height: number): { x: number; y: number } {
    return {
      x: this.x + (x - width / 2 - this.shakeX) / this.zoom,
      y: this.y + (y - height / 2 - this.shakeY) / this.zoom
    };
  }

  addShake(amt: number): void {
    this.shakeMag = Math.min(14, this.shakeMag + amt);
  }

  update(targetX: number, targetY: number, dt: number): void {
    if (this.following) {
      this.x += (targetX - this.x) * Math.min(1, 8.5 * dt);
      this.y += (targetY - this.y) * Math.min(1, 8.5 * dt);
    }

    if (this.shakeMag > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeMag * 2;
      this.shakeMag *= Math.pow(0.04, dt);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeMag = 0;
    }
  }

  setIdlePan(worldTime: number): void {
    this.x = Math.cos(worldTime * 0.25) * 70;
    this.y = Math.sin(worldTime * 0.2) * 45;
  }
}
