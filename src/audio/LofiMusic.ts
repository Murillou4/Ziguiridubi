import { AudioSettings } from '../domain/types.ts';

export class LofiMusic {
  private timer: number | null = null;
  private chordIndex: number = 0;
  private stepIndex: number = 0;

  // Acordes Lo-Fi suaves (Fmaj9 -> Em7 -> Dm9 -> Cmaj9)
  public readonly chords = [
    [174.61, 220.00, 261.63, 329.63, 392.00],
    [164.81, 196.00, 246.94, 293.66, 392.00],
    [146.83, 174.61, 220.00, 261.63, 329.63],
    [130.81, 196.00, 246.94, 293.66, 329.63]
  ];

  startVinylTexture(ctx: AudioContext, destination: AudioNode): void {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const crackle = Math.random() > 0.9978 ? Math.random() * 0.3 - 0.15 : 0;
      data[i] = white * 0.007 + crackle * 0.16;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1050;
    filter.Q.value = 0.8;

    noise.connect(filter);
    filter.connect(destination);
    noise.start();
  }

  startLoop(ctx: AudioContext, musicGain: GainNode, settings: AudioSettings): void {
    if (this.timer) clearInterval(this.timer);
    const stepMs = 415;

    const tick = () => {
      if (!ctx || ctx.state !== 'running' || settings.musicMuted) return;
      const stepInBar = this.stepIndex % 8;

      if (stepInBar === 0) {
        const chord = this.chords[this.chordIndex % this.chords.length];
        this.playChord(ctx, musicGain, chord, 3.2);
        this.chordIndex++;
      }
      if (stepInBar === 3 || (stepInBar === 6 && Math.random() > 0.35)) {
        const chord = this.chords[(this.chordIndex - 1 + this.chords.length) % this.chords.length];
        const note = chord[Math.floor(Math.random() * chord.length)] * 2;
        this.playPluck(ctx, musicGain, note, 0.65);
      }
      if (stepInBar === 0 || stepInBar === 5) this.playKick(ctx, musicGain);
      else if (stepInBar === 2 || stepInBar === 6) this.playRim(ctx, musicGain);

      this.stepIndex++;
    };

    tick();
    this.timer = window.setInterval(tick, stepMs);
  }

  stopLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private playChord(ctx: AudioContext, dest: AudioNode, freqs: number[], duration: number): void {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(740, now);
    filter.frequency.exponentialRampToValueAtTime(460, now + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.11, now + 0.16);
    env.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    filter.connect(env);
    env.connect(dest);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 1.3, now);
      osc.connect(filter);
      osc.start(now + idx * 0.025);
      osc.stop(now + duration + 0.05);
    });
  }

  private playPluck(ctx: AudioContext, dest: AudioNode, freq: number, duration: number): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.05, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private playKick(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playRim(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.05);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.04, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(env);
    env.connect(dest);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}
