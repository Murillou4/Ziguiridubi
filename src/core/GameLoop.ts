export type UpdateFn = (dt: number, isCatchingUp?: boolean) => void;
export type RenderFn = () => void;

export interface GameLoopOptions {
  /** Intervalo em milissegundos para o batimento cardíaco em segundo plano (padrão: 30ms ~33Hz). */
  backgroundTickIntervalMs?: number;
  /** Limite máximo de dt por subpasso de simulação (padrão: 0.05s). */
  maxSubStepSec?: number;
  /** Limite máximo de catch-up acumulado (padrão: 1800s = 30 minutos). */
  maxCatchupSec?: number;
}

export class GameLoop {
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;
  private animFrameId: number | null = null;
  private worker: Worker | null = null;
  private workerBlobUrl: string | null = null;
  private fallbackTimerId: number | null = null;
  private onUpdate: UpdateFn;
  private onRender: RenderFn;
  private readonly backgroundTickIntervalMs: number;
  private readonly maxSubStepSec: number;
  private readonly maxCatchupSec: number;
  private boundVisibilityChange: (() => void) | null = null;

  constructor(
    onUpdate: UpdateFn,
    onRender: RenderFn,
    options: GameLoopOptions = {}
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.backgroundTickIntervalMs = options.backgroundTickIntervalMs ?? 30;
    this.maxSubStepSec = options.maxSubStepSec ?? 0.05;
    this.maxCatchupSec = options.maxCatchupSec ?? 1800;
  }

  get running(): boolean {
    return this.isRunning;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. Inicia o ticker de segundo plano (Web Worker ou fallback timer)
    this.startBackgroundTicker();

    // 2. Registra listener de visibilidade de página
    if (typeof document !== 'undefined') {
      this.boundVisibilityChange = () => this.handleVisibilityChange();
      document.addEventListener('visibilitychange', this.boundVisibilityChange);
    }

    // 3. Inicia o loop de animação ativo (requestAnimationFrame) se suportado
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(this.step);
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.stopBackgroundTicker();

    if (this.boundVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
      this.boundVisibilityChange = null;
    }
  }

  /**
   * Executa a simulação em subpassos calibrados (<= maxSubStepSec).
   * Se o tempo acumulado for muito grande (ex.: despertar de hibernação),
   * executa em modo catch-up para evitar travamentos e artefatos de áudio.
   */
  public stepSimulation(elapsedSec: number): void {
    if (elapsedSec <= 0.0001) return;

    const clampedElapsed = Math.min(this.maxCatchupSec, elapsedSec);
    const stepsCount = Math.ceil(clampedElapsed / this.maxSubStepSec);
    const isCatchingUp = stepsCount > 4;

    let remaining = clampedElapsed;
    while (remaining > 0.0001) {
      const dt = Math.min(this.maxSubStepSec, remaining);
      remaining -= dt;
      const isFinalStep = remaining <= 0.0001;
      this.onUpdate(dt, isCatchingUp && !isFinalStep);
    }
  }

  /** Loop do requestAnimationFrame (ativo quando a aba está em primeiro plano e visível). */
  private step = (timestamp: number): void => {
    if (!this.isRunning) return;

    const now = typeof performance !== 'undefined' ? performance.now() : timestamp;
    if (!this.lastTimestamp) {
      this.lastTimestamp = now;
    }

    const elapsedSec = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    this.stepSimulation(elapsedSec);
    this.onRender();

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(this.step);
    }
  };

  /**
   * Ticker em segundo plano acionado pelo Web Worker (imune a throttling de timers em abas inativas)
   * ou pelo fallback de setInterval.
   */
  public onBackgroundTick = (): void => {
    if (!this.isRunning) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.lastTimestamp) {
      this.lastTimestamp = now;
      return;
    }

    const elapsedMs = now - this.lastTimestamp;
    const isHidden = typeof document !== 'undefined' && document.hidden;

    // Se a aba estiver visível e o requestAnimationFrame estiver ativo e rodando (intervalo recente < 45ms),
    // o rAF assume o update + render perfeitamente sincronizado com o monitor.
    if (!isHidden && elapsedMs < 45) {
      return;
    }

    // A aba está em segundo plano (document.hidden) OU o rAF parou de disparar.
    // O ticker assume o avanço da simulação em tempo real.
    this.lastTimestamp = now;
    this.stepSimulation(elapsedMs / 1000);

    // Se a aba não estiver oculta (ex.: rAF apenas perdeu um frame), mantém o canvas desenhado.
    // Quando document.hidden for true, pulamos o onRender() para economizar bateria e GPU.
    if (!isHidden) {
      this.onRender();
    }
  };

  private handleVisibilityChange(): void {
    if (!this.isRunning || typeof document === 'undefined') return;

    if (!document.hidden) {
      // Ao voltar para a aba ativa:
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.lastTimestamp) {
        const elapsedSec = (now - this.lastTimestamp) / 1000;
        this.lastTimestamp = now;
        this.stepSimulation(elapsedSec);
      } else {
        this.lastTimestamp = now;
      }

      // Renderiza imediatamente para que o usuário veja a tela atualizada sem atraso
      this.onRender();

      // Garante que o loop de requestAnimationFrame está rodando
      if (this.animFrameId === null && typeof requestAnimationFrame !== 'undefined') {
        this.animFrameId = requestAnimationFrame(this.step);
      }
    }
  }

  private startBackgroundTicker(): void {
    if (
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL?.createObjectURL === 'function'
    ) {
      try {
        const workerCode = `
          let timer = null;
          self.onmessage = function(e) {
            var cmd = (e.data && e.data.data) || e.data;
            if (cmd === 'start') {
              var interval = (e.data && e.data.interval) || 30;
              if (timer !== null) clearInterval(timer);
              timer = setInterval(function() {
                self.postMessage('tick');
              }, interval);
            } else if (cmd === 'stop') {
              if (timer !== null) {
                clearInterval(timer);
                timer = null;
              }
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.workerBlobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this.workerBlobUrl);
        this.worker.onmessage = () => {
          this.onBackgroundTick();
        };
        this.worker.postMessage({ data: 'start', interval: this.backgroundTickIntervalMs });
        return;
      } catch (e) {
        console.warn('GameLoop: Worker inline indisponível, usando fallback de timer.', e);
      }
    }

    if (typeof window !== 'undefined') {
      this.fallbackTimerId = window.setInterval(() => {
        this.onBackgroundTick();
      }, this.backgroundTickIntervalMs);
    }
  }

  private stopBackgroundTicker(): void {
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.terminate();
      } catch {
        // Ignora erros ao terminar o worker
      }
      this.worker = null;
    }

    if (this.workerBlobUrl && typeof URL?.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.workerBlobUrl);
      this.workerBlobUrl = null;
    }

    if (this.fallbackTimerId !== null && typeof clearInterval !== 'undefined') {
      clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }
  }
}
