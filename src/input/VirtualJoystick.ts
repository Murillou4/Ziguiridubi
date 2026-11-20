export interface JoystickState {
  active: boolean;
  id: number | null;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

export class VirtualJoystick {
  public state: JoystickState = {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0
  };

  private zoneEl: HTMLElement | null = null;
  private knobEl: HTMLElement | null = null;

  init(zoneId: string, knobId: string): void {
    this.zoneEl = document.getElementById(zoneId);
    this.knobEl = document.getElementById(knobId);
    if (!this.zoneEl || !this.knobEl) return;

    this.zoneEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = this.zoneEl!.getBoundingClientRect();
      this.state.active = true;
      this.state.id = t.identifier;
      this.state.startX = rect.left + rect.width / 2;
      this.state.startY = rect.top + rect.height / 2;
    }, { passive: false });

    this.zoneEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.state.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.state.id) {
          const maxR = 38;
          let dx = t.clientX - this.state.startX;
          let dy = t.clientY - this.state.startY;
          const dist = Math.hypot(dx, dy);
          if (dist > maxR) {
            dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR;
          }
          this.state.dx = dx / maxR;
          this.state.dy = dy / maxR;
          if (this.knobEl) {
            this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
          }
        }
      }
    }, { passive: false });

    const endJoy = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.state.id) {
          this.state.active = false;
          this.state.dx = 0;
          this.state.dy = 0;
          if (this.knobEl) {
            this.knobEl.style.transform = 'translate(0px, 0px)';
          }
        }
      }
    };

    this.zoneEl.addEventListener('touchend', endJoy);
    this.zoneEl.addEventListener('touchcancel', endJoy);
  }

  reset(): void {
    this.state.active = false;
    this.state.id = null;
    this.state.dx = 0;
    this.state.dy = 0;
    if (this.knobEl) {
      this.knobEl.style.transform = 'translate(0px, 0px)';
    }
  }
}
