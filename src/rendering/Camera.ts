export class Camera {
  public x: number = 0;
  public y: number = 0;
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
      x: this.x + (x - width / 2) / this.zoom,
      y: this.y + (y - height / 2) / this.zoom
    };
  }

  update(targetX: number, targetY: number, dt: number): void {
    if (this.following) {
      this.x += (targetX - this.x) * Math.min(1, 8.5 * dt);
      this.y += (targetY - this.y) * Math.min(1, 8.5 * dt);
    }
  }

  setIdlePan(worldTime: number, width: number, height: number): void {
    this.zoom = Math.max(0.15, Math.min(width / 1040, height / 1110, 1.15));

    // A praça fica entre o título e o botão da jornada.
    this.x = Math.sin(worldTime * 0.25) * 12;
    this.y = height * 0.035 / this.zoom + Math.sin(worldTime * 0.2) * 8;
  }
}
