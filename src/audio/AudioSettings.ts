import { AudioSettings } from '../domain/types.ts';

export function createDefaultAudioSettings(): AudioSettings {
  return {
    master: 0.80,
    music: 0.55,
    sfx: 0.85,
    musicMuted: false,
    sfxMuted: false
  };
}
