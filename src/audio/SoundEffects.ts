import type { ResourceNode } from '../domain/types.ts';

type ImpactTone = [frequency: number, duration: number, volume: number, delay?: number];

interface ImpactSound {
  noiseFrequency: number;
  noiseDuration: number;
  noiseVolume: number;
  noiseQ: number;
  tones: readonly ImpactTone[];
}

const IMPACT_SOUNDS: Record<ResourceNode['mat'], ImpactSound> = {
  wood: {
    noiseFrequency: 710, noiseDuration: .044, noiseVolume: .28, noiseQ: .78,
    tones: [[138, .083, .21], [303, .042, .079], [521, .03, .038, .015]]
  },
  stone: {
    noiseFrequency: 1640, noiseDuration: .085, noiseVolume: .30, noiseQ: .56,
    tones: [[201, .073, .14], [481, .053, .07], [706, .038, .04, .022]]
  },
  iron: {
    noiseFrequency: 2310, noiseDuration: .048, noiseVolume: .20, noiseQ: .88,
    tones: [[292, .074, .12], [671, .16, .115], [1048, .134, .062], [1540, .082, .021]]
  },
  ether: {
    noiseFrequency: 2750, noiseDuration: .054, noiseVolume: .11, noiseQ: .82,
    tones: [[392, .15, .074], [784, .24, .10], [1175, .29, .059, .019], [1568, .23, .025, .046]]
  }
};

export class SoundEffects {
  private impactNoise?: AudioBuffer;
  private pickupCombo: number = 0;
  private lastPickupTime: number = 0;
  private readonly pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];

  playSwing(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175 + Math.random() * 35, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.09);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.052, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHit(ctx: AudioContext, dest: AudioNode, mat: ResourceNode['mat'], isCrit: boolean, blocked: boolean): void {
    const sound = IMPACT_SOUNDS[mat];
    const now = ctx.currentTime;
    const pitch = .96 + Math.random() * .08;
    const strength = blocked ? .48 : .92 + Math.random() * .16;
    const length = blocked ? .45 : 1;

    if (!this.impactNoise) {
      this.impactNoise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .18), ctx.sampleRate);
      const samples = this.impactNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = this.impactNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sound.noiseFrequency * pitch;
    filter.Q.value = sound.noiseQ;
    const env = ctx.createGain();
    const decay = sound.noiseDuration * length;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(sound.noiseVolume * strength, now + .002);
    env.gain.exponentialRampToValueAtTime(.001, now + decay);
    noise.connect(filter).connect(env).connect(dest);
    noise.start(now, Math.random() * .06, decay + .01);

    for (const [frequency, duration, volume, delay = 0] of sound.tones) {
      this.playImpactTone(ctx, dest, frequency * pitch, now + delay * length, duration * length, volume * strength);
    }

    if (isCrit) {
      this.playImpactTone(ctx, dest, 987.77, now + .037, .16, .07);
      this.playImpactTone(ctx, dest, 1318.51, now + .068, .21, .056);
    }
  }

  private playImpactTone(
    ctx: AudioContext, dest: AudioNode, frequency: number, start: number, duration: number, volume: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * .96, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(volume, start + .003);
    env.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(env).connect(dest);
    osc.start(start);
    osc.stop(start + duration + .008);
  }

  playPickup(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    if (now - this.lastPickupTime > 0.8) this.pickupCombo = 0;
    this.lastPickupTime = now;

    const noteIdx = this.pickupCombo % this.pentatonic.length;
    this.pickupCombo++;
    const freq = this.pentatonic[noteIdx];

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.14, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCoins(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    [1320, 1760, 2093].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.14, now + idx * 0.04);
      env.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);
      osc.connect(env);
      env.connect(dest);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.16);
    });
  }

  playHammerBuild(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.24, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playAirshipHorn(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    [146.83, 220.00, 293.66].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.16, now + 0.18);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(filter);
      filter.connect(env);
      env.connect(dest);
      osc.start(now);
      osc.stop(now + 1.0);
    });
  }

  playDash(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.15, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playUpgrade(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    [392.00, 493.88, 587.33, 783.99].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.055);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.18, now + idx * 0.055);
      env.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.35);
      osc.connect(env);
      env.connect(dest);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.38);
    });
  }
}
