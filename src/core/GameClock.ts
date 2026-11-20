import { CLEAR_WEATHER, RainCycle, type WeatherSnapshot } from './RainCycle.ts';

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyPalette {
  top: string;
  mid: string;
  horizon: string;
  horizonGlow: string;
  horizonGlowAlpha: number;
  starAlpha: number;
}

export interface IslandLighting {
  /** Cor de tonalização atmosférica sobre o terreno da ilha. */
  tintColor: string;
  /** Opacidade calibrada (<= 0.34) para manter trilhas e recursos legíveis. */
  tintAlpha: number;
  /** Fator de luz solar [0..1] (1 = meio-dia, 0 = noite). */
  daylight: number;
  /** Intensidade de luzes quentes/cristais no período noturno e crepuscular [0..1]. */
  lanternGlow: number;
  /** Fator de presença de vaga-lumes [0..1]. */
  fireflyFactor: number;
  /** Fator de presença de pétalas ao vento [0..1]. */
  petalFactor: number;
}

export interface RealTimeSnapshot {
  hours: number;
  minutes: number;
  seconds: number;
  /** Hora decimal contínua no intervalo [0, 24). */
  hourDecimal: number;
  period: DayPeriod;
  periodLabel: string;
  sky: SkyPalette;
  lighting: IslandLighting;
  weather: WeatherSnapshot;
  /** True quando houve salto brusco (ex.: abertura do jogo, troca de aba ou virada manual). */
  jumped: boolean;
}

interface TimeKeyframe {
  hour: number;
  period: DayPeriod;
  top: [number, number, number];
  mid: [number, number, number];
  horizon: [number, number, number];
  glow: [number, number, number];
  glowAlpha: number;
  starAlpha: number;
  tint: [number, number, number];
  tintAlpha: number;
  daylight: number;
  lanternGlow: number;
  firefly: number;
  petal: number;
}

const KEYFRAMES: readonly TimeKeyframe[] = [
  // 00:00 — Meia-noite
  {
    hour: 0.0,
    period: 'night',
    top: [11, 21, 38],
    mid: [17, 33, 56],
    horizon: [24, 46, 74],
    glow: [68, 112, 168],
    glowAlpha: 0.14,
    starAlpha: 0.85,
    tint: [14, 26, 56],
    tintAlpha: 0.32,
    daylight: 0.08,
    lanternGlow: 1.0,
    firefly: 0.9,
    petal: 0.05
  },
  // 04:45 — Fim da madrugada (antes do amanhecer)
  {
    hour: 4.75,
    period: 'night',
    top: [14, 25, 46],
    mid: [22, 39, 68],
    horizon: [36, 56, 88],
    glow: [96, 122, 168],
    glowAlpha: 0.18,
    starAlpha: 0.65,
    tint: [18, 30, 62],
    tintAlpha: 0.28,
    daylight: 0.14,
    lanternGlow: 0.9,
    firefly: 0.55,
    petal: 0.15
  },
  // 06:00 — Pico do amanhecer (dourado e rosado suave)
  {
    hour: 6.0,
    period: 'dawn',
    top: [44, 68, 106],
    mid: [122, 118, 142],
    horizon: [236, 166, 118],
    glow: [255, 206, 138],
    glowAlpha: 0.42,
    starAlpha: 0.1,
    tint: [255, 184, 116],
    tintAlpha: 0.14,
    daylight: 0.62,
    lanternGlow: 0.35,
    firefly: 0.1,
    petal: 0.75
  },
  // 07:30 — Manhã clara (transição completa para o dia)
  {
    hour: 7.5,
    period: 'day',
    top: [26, 74, 102],
    mid: [42, 102, 132],
    horizon: [74, 144, 170],
    glow: [190, 232, 240],
    glowAlpha: 0.18,
    starAlpha: 0.0,
    tint: [255, 248, 224],
    tintAlpha: 0.03,
    daylight: 0.95,
    lanternGlow: 0.0,
    firefly: 0.0,
    petal: 1.0
  },
  // 12:30 — Meio-dia (identidade artesanal clássica)
  {
    hour: 12.5,
    period: 'day',
    top: [22, 66, 92],
    mid: [36, 94, 124],
    horizon: [66, 134, 160],
    glow: [180, 226, 236],
    glowAlpha: 0.14,
    starAlpha: 0.0,
    tint: [255, 255, 255],
    tintAlpha: 0.0,
    daylight: 1.0,
    lanternGlow: 0.0,
    firefly: 0.0,
    petal: 1.0
  },
  // 16:45 — Fim de tarde (aquecendo)
  {
    hour: 16.75,
    period: 'day',
    top: [32, 74, 106],
    mid: [64, 106, 134],
    horizon: [138, 156, 162],
    glow: [248, 198, 132],
    glowAlpha: 0.24,
    starAlpha: 0.0,
    tint: [255, 196, 120],
    tintAlpha: 0.08,
    daylight: 0.85,
    lanternGlow: 0.1,
    firefly: 0.0,
    petal: 0.9
  },
  // 18:15 — Pico do entardecer (âmbar e violeta)
  {
    hour: 18.25,
    period: 'dusk',
    top: [46, 52, 92],
    mid: [132, 86, 114],
    horizon: [232, 134, 88],
    glow: [255, 174, 96],
    glowAlpha: 0.45,
    starAlpha: 0.15,
    tint: [242, 138, 72],
    tintAlpha: 0.17,
    daylight: 0.48,
    lanternGlow: 0.65,
    firefly: 0.45,
    petal: 0.55
  },
  // 20:15 — Anoitecer (mergulho suave na noite)
  {
    hour: 20.25,
    period: 'night',
    top: [14, 24, 44],
    mid: [20, 38, 64],
    horizon: [30, 52, 82],
    glow: [82, 118, 168],
    glowAlpha: 0.16,
    starAlpha: 0.78,
    tint: [16, 28, 58],
    tintAlpha: 0.30,
    daylight: 0.10,
    lanternGlow: 0.95,
    firefly: 0.95,
    petal: 0.1
  },
  // 24:00 — Fechamento circular idêntico a 00:00 (virada da meia-noite contínua)
  {
    hour: 24.0,
    period: 'night',
    top: [11, 21, 38],
    mid: [17, 33, 56],
    horizon: [24, 46, 74],
    glow: [68, 112, 168],
    glowAlpha: 0.14,
    starAlpha: 0.85,
    tint: [14, 26, 56],
    tintAlpha: 0.32,
    daylight: 0.08,
    lanternGlow: 1.0,
    firefly: 0.9,
    petal: 0.05
  }
];

const PERIOD_LABELS: Record<DayPeriod, string> = {
  dawn: 'Amanhecer',
  day: 'Dia',
  dusk: 'Entardecer',
  night: 'Noite'
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}

export function classifyDayPeriod(hourDecimal: number): DayPeriod {
  const h = ((hourDecimal % 24) + 24) % 24;
  if (h >= 5.0 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 17.25) return 'day';
  if (h >= 17.25 && h < 19.75) return 'dusk';
  return 'night';
}

export function evaluateRealTimeAtmosphere(
  hourDecimal: number,
  jumped = false,
  weather: WeatherSnapshot = CLEAR_WEATHER
): RealTimeSnapshot {
  const h = ((hourDecimal % 24) + 24) % 24;
  const hours = Math.floor(h);
  const remMinutes = (h - hours) * 60;
  const minutes = Math.floor(remMinutes);
  const seconds = Math.floor((remMinutes - minutes) * 60);

  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, k1.hour - k0.hour);
  const t = smoothstep(Math.max(0, Math.min(1, (h - k0.hour) / span)));
  const period = classifyDayPeriod(h);
  const rain = weather.intensity;

  return {
    hours,
    minutes,
    seconds,
    hourDecimal: h,
    period,
    periodLabel: PERIOD_LABELS[period],
    sky: {
      top: mixRgb(k0.top, k1.top, t),
      mid: mixRgb(k0.mid, k1.mid, t),
      horizon: mixRgb(k0.horizon, k1.horizon, t),
      horizonGlow: mixRgb(k0.glow, k1.glow, t),
      horizonGlowAlpha: lerp(k0.glowAlpha, k1.glowAlpha, t) * (1 - 0.68 * rain),
      starAlpha: lerp(k0.starAlpha, k1.starAlpha, t) * (1 - rain)
    },
    lighting: {
      tintColor: mixRgb(k0.tint, k1.tint, t),
      tintAlpha: lerp(k0.tintAlpha, k1.tintAlpha, t),
      daylight: lerp(k0.daylight, k1.daylight, t) * (1 - 0.42 * rain),
      lanternGlow: lerp(k0.lanternGlow, k1.lanternGlow, t),
      fireflyFactor: lerp(k0.firefly, k1.firefly, t) * (1 - rain),
      petalFactor: lerp(k0.petal, k1.petal, t) * (1 - rain)
    },
    weather,
    jumped
  };
}

export class GameClock {
  /** Relógio da simulação: anima personagens, fauna, produção de máquinas e respawn. */
  public worldTime: number = 0;
  public hitStopTimer: number = 0;
  public uiTickTimer: number = 0;
  public saveTickTimer: number = 0;

  /** Relógio ambiental baseado na hora local do jogador (ou hora simulada para validação). */
  public realTime: RealTimeSnapshot = evaluateRealTimeAtmosphere(this.readLocalHourDecimal(new Date()), true);

  private simulatedHourOverride: number | null = null;
  private simulatedRateHoursPerSec: number = 0;
  private lastKnownHourDecimal: number = this.realTime.hourDecimal;
  private readonly rain: RainCycle;

  constructor(weatherRandom: () => number = Math.random) {
    this.rain = new RainCycle(weatherRandom);
  }

  private readLocalHourDecimal(date: Date): number {
    return (
      date.getHours() +
      date.getMinutes() / 60 +
      date.getSeconds() / 3600 +
      date.getMilliseconds() / 3_600_000
    );
  }

  /**
   * Sincroniza o período ambiental com a hora local atual (ou hora simulada).
   * Deve ser chamado ao abrir o jogo, ao voltar para a aba (`visibilitychange`) e na virada da meia-noite.
   */
  syncRealTime(now: Date = new Date(), forceJump: boolean = false): RealTimeSnapshot {
    const rawHour =
      this.simulatedHourOverride !== null
        ? this.simulatedHourOverride
        : this.readLocalHourDecimal(now);

    const normalized = ((rawHour % 24) + 24) % 24;
    // Detecta salto de relógio (ex.: aba ficou inativa por vários minutos) sem confundir com virada 23:59 -> 00:00
    const rawDelta = Math.abs(normalized - this.lastKnownHourDecimal);
    const circularDelta = Math.min(rawDelta, 24 - rawDelta);
    const jumped = forceJump || circularDelta > 0.05; // > 3 minutos reais de salto

    this.lastKnownHourDecimal = normalized;
    this.realTime = evaluateRealTimeAtmosphere(normalized, jumped, this.rain.current);
    return this.realTime;
  }

  /** Define uma hora fixa [0, 24) ou velocidade de passagem para testes dos 4 períodos e meia-noite. */
  setSimulatedHour(hour: number | null, hoursPerSecond: number = 0): RealTimeSnapshot {
    this.simulatedHourOverride = hour === null ? null : ((hour % 24) + 24) % 24;
    this.simulatedRateHoursPerSec = hour === null ? 0 : hoursPerSecond;
    return this.syncRealTime(new Date(), true);
  }

  update(dt: number): { isHitStopped: boolean; shouldTickUI: boolean; shouldAutoSave: boolean } {
    this.worldTime += dt;
    this.rain.update(dt);

    if (this.simulatedHourOverride !== null && this.simulatedRateHoursPerSec !== 0) {
      this.simulatedHourOverride =
        (((this.simulatedHourOverride + dt * this.simulatedRateHoursPerSec) % 24) + 24) % 24;
    }
    this.syncRealTime();

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

  addHitStop(duration: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  reset(): void {
    this.worldTime = 0;
    this.hitStopTimer = 0;
    this.uiTickTimer = 0;
    this.saveTickTimer = 0;
    this.rain.reset();
    this.syncRealTime(new Date(), true);
  }
}

