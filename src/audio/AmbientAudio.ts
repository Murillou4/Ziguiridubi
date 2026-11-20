import type { RealTimeSnapshot } from '../core/GameClock.ts';

interface AmbientTrack {
  url: URL;
  gain?: GainNode;
  level: number;
}

export class AmbientAudio {
  private readonly day: AmbientTrack = { url: new URL('./assets/vale-dia.mp3', import.meta.url), level: 0 };
  private readonly night: AmbientTrack = { url: new URL('./assets/vale-noite.mp3', import.meta.url), level: 0 };

  start(ctx: AudioContext, destination: AudioNode): void {
    for (const track of [this.day, this.night]) {
      void fetch(track.url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then(data => ctx.decodeAudioData(data))
        .then(buffer => {
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 0;
          source.connect(gain).connect(destination);
          track.gain = gain;
          source.start(0, Math.random() * buffer.duration);
        })
        .catch(error => console.warn('Falha ao carregar a gravação de ambiente.', error));
    }
  }

  update(ctx: AudioContext, environment: RealTimeSnapshot): void {
    const daylight = environment.lighting.daylight;
    const openAir = 1 - environment.weather.intensity * .78;
    this.setLevel(this.day, .30 * daylight * openAir, ctx.currentTime);
    this.setLevel(this.night, .24 * (1 - daylight) * openAir, ctx.currentTime);
  }

  private setLevel(track: AmbientTrack, level: number, now: number): void {
    if (!track.gain || Math.abs(level - track.level) < .003) return;
    track.gain.gain.setTargetAtTime(level, now, 1.1);
    track.level = level;
  }
}
