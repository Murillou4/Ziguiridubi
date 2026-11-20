import { AudioSettings } from '../domain/types.ts';
import { createDefaultAudioSettings } from './AudioSettings.ts';
import { LofiMusic } from './LofiMusic.ts';
import { SoundEffects } from './SoundEffects.ts';
import { EventBus } from '../core/EventBus.ts';
import type { WeatherSnapshot } from '../core/RainCycle.ts';
import { WeatherAudio } from './WeatherAudio.ts';

export class AudioManager {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public musicGain: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  public isInitialized: boolean = false;

  public settings: AudioSettings = createDefaultAudioSettings();
  public lofiMusic = new LofiMusic();
  public sfx = new SoundEffects();
  private readonly weatherAudio = new WeatherAudio();

  constructor(private eventBus: EventBus) {
    this.bindEvents();
  }

  private bindEvents(): void {
    this.eventBus.on('sound:hit', (data: { mat?: string; isCrit?: boolean }) => {
      this.playHit(data?.mat || 'wood', data?.isCrit || false);
    });

    this.eventBus.on('sound:swing', () => this.playSwing());
    this.eventBus.on('sound:pickup', () => this.playPickup());
    this.eventBus.on('sound:coins', () => this.playCoins());
    this.eventBus.on('sound:hammer', () => this.playHammerBuild());
    this.eventBus.on('sound:horn', () => this.playAirshipHorn());
    this.eventBus.on('sound:dash', () => this.playDash());
    this.eventBus.on('sound:upgrade', () => this.playUpgrade());
  }

  init(): void {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.applyVolumes();
    this.isInitialized = true;

    this.weatherAudio.prepare(this.ctx);
    this.lofiMusic.startVinylTexture(this.ctx, this.musicGain);
    this.lofiMusic.startLoop(this.ctx, this.musicGain, this.settings);
  }

  applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.master, now, 0.04);
    this.musicGain.gain.setTargetAtTime(
      this.settings.musicMuted ? 0 : this.settings.music * 0.40,
      now,
      0.05
    );
    this.sfxGain.gain.setTargetAtTime(
      this.settings.sfxMuted ? 0 : this.settings.sfx * 0.55,
      now,
      0.03
    );
  }

  update(dt: number, weather: WeatherSnapshot, isCatchingUp: boolean = false): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.sfxGain) {
      this.weatherAudio.update(this.ctx, this.sfxGain, weather);
    }
    if (this.musicGain) {
      this.lofiMusic.update(dt, this.settings, isCatchingUp);
    }
  }

  updateWeather(weather: WeatherSnapshot): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    this.weatherAudio.update(this.ctx, this.sfxGain, weather);
  }

  resumeIfNeeded(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  playSwing(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playSwing(this.ctx, this.sfxGain);
  }

  playHit(mat: string = 'wood', isCrit: boolean = false): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playHit(this.ctx, this.sfxGain, mat, isCrit);
  }

  playPickup(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playPickup(this.ctx, this.sfxGain);
  }

  playCoins(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playCoins(this.ctx, this.sfxGain);
  }

  playHammerBuild(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playHammerBuild(this.ctx, this.sfxGain);
  }

  playAirshipHorn(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playAirshipHorn(this.ctx, this.sfxGain);
  }

  playDash(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playDash(this.ctx, this.sfxGain);
  }

  playUpgrade(): void {
    if (!this.ctx || !this.sfxGain) return;
    this.sfx.playUpgrade(this.ctx, this.sfxGain);
  }
}
