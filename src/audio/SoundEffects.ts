export class SoundEffects {
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
    env.gain.setValueAtTime(0.11, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHit(ctx: AudioContext, dest: AudioNode, mat: string = 'wood', isCrit: boolean = false): void {
    const now = ctx.currentTime;
    const pv = 0.93 + Math.random() * 0.14;

    if (mat === 'wood') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 * pv, now);
      osc.frequency.exponentialRampToValueAtTime(65 * pv, now + 0.11);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.28, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(env);
      env.connect(dest);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (mat === 'stone' || mat === 'iron') {
      const base = mat === 'iron' ? 430 : 280;
      const osc = ctx.createOscillator();
      osc.type = mat === 'iron' ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(base * pv, now);
      osc.frequency.exponentialRampToValueAtTime(base * 0.42 * pv, now + 0.11);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.22, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(filter);
      filter.connect(env);
      env.connect(dest);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      // Cristal etéreo: som brilhante ressonante
      [660, 990, 1320].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * pv, now + i * 0.02);
        osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.2);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.12, now + i * 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(env);
        env.connect(dest);
        osc.start(now + i * 0.02);
        osc.stop(now + 0.25);
      });
    }

    if (isCrit) {
      // Som dourado de chime cristalino em acertos perfeitos
      [1046.50, 1318.51, 1567.98].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.18, now + idx * 0.03);
        env.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.18);
        osc.connect(env);
        env.connect(dest);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.2);
      });
    }
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
