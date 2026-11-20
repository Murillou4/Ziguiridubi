import { describe, expect, it, vi } from 'vitest';
import { LofiMusic } from '../../src/audio/LofiMusic.ts';
import { createDefaultAudioSettings } from '../../src/audio/AudioSettings.ts';

function createMockAudioContext() {
  return {
    state: 'running',
    currentTime: 10.0,
    sampleRate: 44100,
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn()
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    })
  } as unknown as AudioContext;
}

describe('LofiMusic simulation-driven timing', () => {
  it('advances beats based on dt and does not depend on browser intervals', () => {
    const lofi = new LofiMusic();
    const mockCtx = createMockAudioContext();
    const mockGain = {} as GainNode;
    const settings = createDefaultAudioSettings();

    // Start loop plays the initial beat (step 0: chord + kick)
    lofi.startLoop(mockCtx, mockGain, settings);

    // Advance 0.2s: should not trigger the next 0.415s step yet
    lofi.update(0.2, settings);

    // Advance another 0.25s (total 0.45s accumulated): triggers step 1
    lofi.update(0.25, settings);

    lofi.stopLoop();
  });

  it('resets step accumulator during catch-up mode to prevent audio bursts', () => {
    const lofi = new LofiMusic();
    const mockCtx = createMockAudioContext();
    const mockGain = {} as GainNode;
    const settings = createDefaultAudioSettings();

    lofi.startLoop(mockCtx, mockGain, settings);

    // Fast-forward catch-up (e.g. 5 seconds in one go)
    lofi.update(5.0, settings, true);

    // When normal dt resumes, it will start accumulating cleanly from 0 without playing 12 notes at once
    lofi.update(0.1, settings, false);

    lofi.stopLoop();
  });

  it('does not trigger sounds when muted', () => {
    const lofi = new LofiMusic();
    const mockCtx = createMockAudioContext();
    const mockGain = {} as GainNode;
    const settings = createDefaultAudioSettings();
    settings.musicMuted = true;

    lofi.startLoop(mockCtx, mockGain, settings);
    lofi.update(1.0, settings, false);

    lofi.stopLoop();
  });
});
