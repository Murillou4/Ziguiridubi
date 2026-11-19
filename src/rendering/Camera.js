export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
  }

  addShake(amt) {
    this.shakeMag = Math.min(14, this.shakeMag + amt);
  }

  update(targetX, targetY, dt) {
    this.x += (targetX - this.x) * Math.min(1, 8.5 * dt);
    this.y += (targetY - this.y) * Math.min(1, 8.5 * dt);

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

  setIdlePan(worldTime) {
    this.x = Math.cos(worldTime * 0.25) * 70;
    this.y = Math.sin(worldTime * 0.2) * 45;
  }
}
