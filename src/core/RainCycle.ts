import { clamp, lerp } from './MathUtils.ts';

type RainLevel = 0 | 1 | 2 | 3;

export interface WeatherSnapshot {
  readonly level: RainLevel;
  readonly intensity: number;
  readonly flash: number;
  readonly lightningX: number;
  readonly thunder: number;
}

export const CLEAR_WEATHER: WeatherSnapshot = {
  level: 0, intensity: 0, flash: 0, lightningX: 0, thunder: 0
};

interface RainPhase {
  level: 1 | 2 | 3;
  start: number;
  end: number;
}

interface LightningStrike {
  time: number;
  thunderAt: number;
  strength: number;
  x: number;
}

const INTENSITY = [0, 0.28, 0.60, 1];

function ease(progress: number): number {
  const t = clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Prazos em segundos de simulação, independentes de ajustes na hora local. */
export class RainCycle {
  private time = 0;
  private nextRain = 0;
  private phases: RainPhase[] = [];
  private strikes: LightningStrike[] = [];
  public current = CLEAR_WEATHER;

  constructor(private readonly random: () => number = Math.random) {
    this.reset();
  }

  reset(): void {
    this.time = 0;
    this.nextRain = this.between(22, 58);
    this.phases = [];
    this.strikes = [];
    this.current = CLEAR_WEATHER;
  }

  update(dt: number): void {
    const previousTime = this.time;
    this.time += dt;
    while (this.time >= this.nextRain) this.scheduleRain();

    const index = this.phases.findIndex(phase => this.time < phase.end);
    if (index === -1) {
      this.current = CLEAR_WEATHER;
      return;
    }

    const phase = this.phases[index];
    const target = INTENSITY[phase.level];
    const previous = INTENSITY[this.phases[index - 1]?.level ?? 0];
    let intensity = lerp(previous, target, ease((this.time - phase.start) / 3.5));
    if (index === this.phases.length - 1) {
      intensity *= ease((phase.end - this.time) / 4.5);
    }

    let flash = 0;
    let lightningX = 0;
    let thunder = 0;
    for (const strike of this.strikes) {
      const age = this.time - strike.time;
      if (age >= 0 && age < 0.55) {
        flash = strike.strength * Math.pow(1 - age / 0.55, 2);
        lightningX = strike.x;
      }
      if (previousTime < strike.thunderAt && this.time >= strike.thunderAt) thunder = strike.strength;
    }
    this.current = { level: phase.level, intensity, flash, lightningX, thunder };
  }

  private between(min: number, max: number): number {
    return lerp(min, max, this.random());
  }

  private scheduleRain(): void {
    const roll = this.random();
    const levels: RainPhase['level'][] =
      roll < 0.42 ? [1] : roll < 0.77 ? [1, 2, 1] : [1, 2, 3, 2, 1];
    this.strikes = [];
    let start = this.nextRain;
    this.phases = levels.map((level, index) => {
      const isPeak = index === Math.floor(levels.length / 2);
      const end = start + (isPeak ? this.between(24, 54) : this.between(8, 14));
      const phase = { level, start, end };
      if (level === 3) {
        for (let time = start + this.between(4, 8); time < end - 3; time += this.between(10, 20)) {
          this.strikes.push({
            time,
            thunderAt: time + this.between(0.9, 2.5),
            strength: this.between(0.58, 1),
            x: this.between(0.12, 0.88)
          });
        }
      }
      start = end;
      return phase;
    });
    this.nextRain = start + this.between(85, 230);
  }
}
