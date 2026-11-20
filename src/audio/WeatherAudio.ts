import type { WeatherSnapshot } from '../core/RainCycle.ts';

interface RainLoop {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  intensity: number;
}

export class WeatherAudio {
  private rainBuffer?: AudioBuffer;
  private thunderBuffer?: AudioBuffer;
  private rain?: RainLoop;

  prepare(ctx: AudioContext): void {
    const url = new URL('./assets/rain-loop.mp3', import.meta.url);
    void fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => { this.rainBuffer = buffer; })
      .catch(error => console.warn('Falha ao carregar a gravação de chuva.', error));
  }

  update(ctx: AudioContext, destination: AudioNode, weather: WeatherSnapshot): void {
    const now = ctx.currentTime;
    const intensity = weather.intensity;

    if (intensity > 0.005 && !this.rain && this.rainBuffer) {
      this.rain = this.startRain(ctx, destination, this.rainBuffer);
    }
    if (this.rain) {
      const { gain, source } = this.rain;
      if (intensity <= 0.005) {
        gain.gain.setTargetAtTime(0, now, 0.18);
        source.stop(now + 1);
        this.rain = undefined;
      } else if (Math.abs(intensity - this.rain.intensity) > 0.012) {
        gain.gain.setTargetAtTime(0.35 * Math.pow(intensity, 0.78), now, 0.32);
        this.rain.filter.frequency.setTargetAtTime(4000 + 6500 * intensity, now, 0.5);
        this.rain.intensity = intensity;
      }
    }

    if (weather.thunder > 0) this.playThunder(ctx, destination, weather.thunder);
  }

  private startRain(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer): RainLoop {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4000;
    filter.Q.value = 0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(0, Math.random() * buffer.duration);
    return { source, filter, gain, intensity: 0 };
  }

  private playThunder(ctx: AudioContext, destination: AudioNode, strength: number): void {
    if (!this.thunderBuffer) {
      this.thunderBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const samples = this.thunderBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }

    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(310, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 2.6);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.34 * strength, now + 0.25);
    gain.gain.linearRampToValueAtTime(0.14 * strength, now + 0.8);
    gain.gain.linearRampToValueAtTime(0.22 * strength, now + 1.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.7);
    const source = ctx.createBufferSource();
    source.buffer = this.thunderBuffer;
    source.connect(filter).connect(gain).connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(now);
  }
}
