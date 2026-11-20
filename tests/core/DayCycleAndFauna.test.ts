import { describe, expect, it } from 'vitest';
import { GameClock, classifyDayPeriod } from '../../src/core/GameClock.ts';
import { ISLANDS_DEF } from '../../src/config/world.ts';
import {
  evaluateSpeciesPresence,
  getIslandFaunaSnapshot,
  updateIslandFauna
} from '../../src/rendering/world-terrain.ts';

describe('Ciclo do dia e fauna sincronizados com a hora local', () => {
  it('classifica os quatro períodos do dia e cruza a meia-noite sem descontinuidade', () => {
    expect(classifyDayPeriod(6.0)).toBe('dawn');
    expect(classifyDayPeriod(12.0)).toBe('day');
    expect(classifyDayPeriod(18.0)).toBe('dusk');
    expect(classifyDayPeriod(23.95)).toBe('night');
    expect(classifyDayPeriod(0.05)).toBe('night');

    const clock = new GameClock();
    const beforeMidnight = clock.setSimulatedHour(23.98);
    const afterMidnight = clock.setSimulatedHour(0.02);

    expect(beforeMidnight.period).toBe('night');
    expect(afterMidnight.period).toBe('night');
    expect(Math.abs(beforeMidnight.lighting.tintAlpha - afterMidnight.lighting.tintAlpha)).toBeLessThan(0.01);
  });

  it('mantém o relógio da simulação independente da hora local', () => {
    const clock = new GameClock();
    clock.setSimulatedHour(14.0);
    clock.update(0.05);

    expect(clock.worldTime).toBeCloseTo(0.05);
    clock.setSimulatedHour(2.0);
    expect(clock.worldTime).toBeCloseTo(0.05);
  });

  it('ativa as espécies corretas por ilha e horário previsto', () => {
    const hub = ISLANDS_DEF.find(i => i.id === 'hub')!;
    const dock = ISLANDS_DEF.find(i => i.id === 'north_dock')!;
    const hill = ISLANDS_DEF.find(i => i.id === 'east_hill')!;
    const crystal = ISLANDS_DEF.find(i => i.id === 'west_crystal')!;

    // Dia (12:00): Clareira com borboletas/pássaros, Doca com aves planando, Cristal sem fauna noturna
    updateIslandFauna(hub, true, 0.016, 12.0, undefined, true);
    updateIslandFauna(dock, true, 0.016, 12.0, undefined, true);
    updateIslandFauna(crystal, true, 0.016, 12.0, undefined, true);

    expect(getIslandFaunaSnapshot(hub).length).toBeGreaterThan(0);
    expect(getIslandFaunaSnapshot(hub).every(a => a.alpha > 0.9)).toBe(true);
    expect(getIslandFaunaSnapshot(dock).every(a => a.alpha > 0.9)).toBe(true);
    expect(getIslandFaunaSnapshot(crystal).every(a => a.alpha === 0)).toBe(true);

    // Começo da manhã (06:30) e fim da tarde (17:45) na Colina de Ferro
    updateIslandFauna(hill, true, 0.016, 6.5, undefined, true);
    expect(getIslandFaunaSnapshot(hill).some(a => a.alpha > 0.9)).toBe(true);

    updateIslandFauna(hill, true, 0.016, 13.0, undefined, true);
    expect(getIslandFaunaSnapshot(hill).every(a => a.alpha === 0)).toBe(true);

    // Noite na virada da meia-noite (00:10) na Ilha de Cristal
    updateIslandFauna(crystal, true, 0.016, 0.16, undefined, true);
    expect(getIslandFaunaSnapshot(crystal).every(a => a.alpha > 0.9)).toBe(true);
  });

  it('transiciona presença gradualmente nas bordas de horário', () => {
    const win = [{ startHour: 18.5, endHour: 5.5 }];
    const startEdge = evaluateSpeciesPresence(18.55, win, 0.5, 0);
    const fullNight = evaluateSpeciesPresence(23.99, win, 0.5, 0);
    const afterMidnight = evaluateSpeciesPresence(0.01, win, 0.5, 0);

    expect(startEdge).toBeGreaterThan(0);
    expect(startEdge).toBeLessThan(1);
    expect(fullNight).toBe(1);
    expect(afterMidnight).toBe(1);
  });
});

