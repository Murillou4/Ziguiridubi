import { describe, expect, it } from 'vitest';
import { GameClock } from '../../src/core/GameClock.ts';
import { CLEAR_WEATHER, type WeatherSnapshot } from '../../src/core/RainCycle.ts';
import { ISLANDS_DEF } from '../../src/config/world.ts';
import { getIslandFaunaSnapshot, updateIslandFauna } from '../../src/rendering/world-terrain.ts';

describe('Clima do vale', () => {
  it.each([
    [0.1, [0, 1, 0]],
    [0.5, [0, 1, 2, 1, 0]],
    [0.9, [0, 1, 2, 3, 2, 1, 0]]
  ] as const)('atravessa os níveis intermediários com sorteio %s', (roll, expected) => {
    const clock = new GameClock(() => roll);
    const levels = [0];
    let previousIntensity = 0;
    let firstFlashAt = Infinity;
    let thunderCount = 0;
    for (let frame = 0; frame < 3550; frame++) {
      clock.update(0.05);
      const { level, intensity, flash, thunder } = clock.realTime.weather;
      if (levels.at(-1) !== level) levels.push(level);
      expect(Math.abs(intensity - previousIntensity)).toBeLessThan(0.022);
      previousIntensity = intensity;
      if (flash > 0) {
        expect(level).toBe(3);
        firstFlashAt = Math.min(firstFlashAt, clock.worldTime);
      }
      if (thunder > 0) {
        expect(level).toBe(3);
        expect(clock.worldTime - firstFlashAt).toBeGreaterThan(0.8);
        thunderCount++;
      }
      if (level === 0 && levels.length > 1) break;
    }
    expect(levels).toEqual(expected);
    expect(thunderCount > 0).toBe(roll === 0.9);
  });

  it('mantém o episódio de chuva ao ajustar a hora local', () => {
    const clock = new GameClock(() => 0.9);
    clock.update(60);
    const weather = clock.realTime.weather;
    expect(weather.level).toBe(1);
    expect(clock.setSimulatedHour(23).weather).toBe(weather);
    expect(clock.setSimulatedHour(12).weather).toBe(weather);
  });

  it('faz aves e animais terrestres procurarem abrigo e retoma a fauna no horário da ilha', () => {
    const hub = ISLANDS_DEF.find(island => island.id === 'hub')!;
    const hill = ISLANDS_DEF.find(island => island.id === 'east_hill')!;
    const drizzle: WeatherSnapshot = { ...CLEAR_WEATHER, level: 1, intensity: 0.28 };
    const strike: WeatherSnapshot = { ...CLEAR_WEATHER, level: 3, intensity: 1, flash: 1 };
    updateIslandFauna(hub, true, 0, 8, undefined, true);
    updateIslandFauna(hill, true, 0, 8, undefined, true);
    const birds = getIslandFaunaSnapshot(hub);
    const ground = getIslandFaunaSnapshot(hill);

    updateIslandFauna(hub, true, 0.05, 8, undefined, false, drizzle);
    expect(birds.every(agent => agent.rainBehavior === 'outside')).toBe(true);
    for (let frame = 0; frame < 100; frame++) updateIslandFauna(hub, true, 0.05, 8, undefined, false, drizzle);
    expect(birds.some(agent => agent.rainBehavior !== 'outside')).toBe(true);
    expect(birds.some(agent => agent.rainBehavior === 'outside')).toBe(true);
    updateIslandFauna(hub, true, 0.05, 8, undefined, false, strike);
    updateIslandFauna(hill, true, 0.05, 8, undefined, false, strike);
    expect(birds.some(agent => agent.behavior === 'fly' && agent.startledFor > 0)).toBe(true);
    expect(ground.some(agent => agent.behavior === 'walk' && agent.startledFor > 0)).toBe(true);

    for (let frame = 0; frame < 600; frame++) {
      updateIslandFauna(hub, true, 0.05, 8, undefined, false, drizzle);
      updateIslandFauna(hill, true, 0.05, 8, undefined, false, drizzle);
    }
    expect([...birds, ...ground].every(agent => agent.rainBehavior === 'sheltered' && agent.alpha === 0)).toBe(true);

    for (let frame = 0; frame < 56; frame++) {
      updateIslandFauna(hub, true, 0.05, 12);
      updateIslandFauna(hill, true, 0.05, 12);
    }
    expect(birds.some(agent => agent.alpha > 0)).toBe(true);
    expect(birds.some(agent => agent.alpha === 0)).toBe(true);
    expect(ground.every(agent => agent.alpha === 0)).toBe(true);
    for (let frame = 0; frame < 260; frame++) updateIslandFauna(hill, true, 0.05, 17.75);
    expect(ground.every(agent => agent.alpha > 0.9)).toBe(true);
  });
});
