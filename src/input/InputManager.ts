import { VirtualJoystick } from './VirtualJoystick.ts';
import { PlayerInput } from '../gameplay/PlayerSystem.ts';
import { EventBus } from '../core/EventBus.ts';
import type { Camera } from '../rendering/Camera.ts';

export class InputManager {
  public keys: Record<string, boolean> = {};
  public mouse = {
    screenX: 0,
    screenY: 0,
    worldX: 0,
    worldY: 0
  };

  public virtualJoystick = new VirtualJoystick();

  constructor(private eventBus: EventBus) {}

  resetInputs(): void {
    this.keys = {};
    this.virtualJoystick.reset();
  }

  init(canvas: HTMLCanvasElement, isPlaying: () => boolean, isModalOpen: () => boolean): void {
    // 1. Teclado
    window.addEventListener('keydown', (e) => {
      if (!isPlaying()) return;

      const code = e.code;
      this.keys[code] = true;

      // Não intercepta teclas se o usuário estiver digitando em campo de texto
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')
      ) {
        if (code === 'Escape') {
          this.eventBus.emit('ui:closeModals');
        }
        return;
      }

      if (code === 'Escape') {
        this.eventBus.emit('input:escape');
        return;
      }

      if (code === 'Home') {
        e.preventDefault();
        this.eventBus.emit('input:cameraRecenter');
        return;
      }

      if (code === 'Tab') {
        if (isModalOpen()) return;
        e.preventDefault();
        this.eventBus.emit('input:openWorkshop');
        return;
      }

      if (code === 'KeyM') {
        this.eventBus.emit('input:openProjects');
        return;
      }

      if (code === 'Digit1') {
        this.eventBus.emit('input:openMerchant');
        return;
      }

      if (code === 'Digit2') {
        this.eventBus.emit('input:openWorkshop');
        return;
      }

      if (code === 'Digit3') {
        this.eventBus.emit('input:openProjects');
        return;
      }

      if (code === 'Digit4') {
        this.eventBus.emit('input:openAirship');
        return;
      }

      if (code === 'KeyP') {
        this.eventBus.emit('input:openSettings');
        return;
      }

      if (code === 'Space') {
        if (isModalOpen() && e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        this.eventBus.emit('input:swing');
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        this.eventBus.emit('input:dash');
      } else if (code === 'KeyE') {
        e.preventDefault();
        if (!e.repeat) this.eventBus.emit('input:interact');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => {
        this.resetInputs();
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.resetInputs();
        }
      });
    }

    // 2. Mouse no Canvas
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.screenX = e.clientX - rect.left;
      this.mouse.screenY = e.clientY - rect.top;
      this.eventBus.emit('input:mouseMove', {
        screenX: this.mouse.screenX,
        screenY: this.mouse.screenY
      });
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.screenX = e.clientX - rect.left;
      this.mouse.screenY = e.clientY - rect.top;

      if (e.button === 2) {
        this.eventBus.emit('input:dash');
        return;
      }

      if (e.button === 0) {
        this.eventBus.emit('input:canvasClick', {
          button: 0,
          screenX: this.mouse.screenX,
          screenY: this.mouse.screenY
        });
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let panPointer: number | null = null;
    let panX = 0;
    let panY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      panPointer = e.pointerId;
      panX = e.clientX;
      panY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== panPointer) return;
      this.eventBus.emit('input:cameraPan', { dx: e.clientX - panX, dy: e.clientY - panY });
      panX = e.clientX;
      panY = e.clientY;
    });
    canvas.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId === panPointer) panPointer = null;
    });
    canvas.addEventListener('wheel', (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.eventBus.emit('input:cameraZoom', {
        factor: e.deltaY < 0 ? 1.12 : 1 / 1.12,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }, { passive: false });

    // 3. Controles Touch Mobile
    this.virtualJoystick.init('touchJoystickZone', 'touchJoystickKnob');

    const btnHit = document.getElementById('touchBtnHit');
    if (btnHit) {
      btnHit.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.eventBus.emit('input:swing');
      }, { passive: false });
    }

    const btnDash = document.getElementById('touchBtnDash');
    if (btnDash) {
      btnDash.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.eventBus.emit('input:dash');
      }, { passive: false });
    }

    const btnInteract = document.getElementById('touchBtnInteract');
    if (btnInteract) {
      btnInteract.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.eventBus.emit('input:interact');
      }, { passive: false });
    }
  }

  updateWorldMouse(camera: Camera, screenW: number, screenH: number): void {
    const point = camera.screenToWorld(this.mouse.screenX, this.mouse.screenY, screenW, screenH);
    this.mouse.worldX = point.x;
    this.mouse.worldY = point.y;
  }

  getPlayerInput(): PlayerInput {
    let ix = 0;
    let iy = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) iy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) iy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) ix -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) ix += 1;

    if (this.virtualJoystick.state.active) {
      ix += this.virtualJoystick.state.dx;
      iy += this.virtualJoystick.state.dy;
    }

    const hasInput = Math.hypot(ix, iy) > 0.05;

    return {
      ix,
      iy,
      hasInput,
      dashPressed: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
      swingPressed: Boolean(this.keys['Space'])
    };
  }
}
