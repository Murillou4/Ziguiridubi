import { describe, expect, it } from 'vitest';
import { SaveMigrator } from '../../src/persistence/SaveMigrator.ts';

describe('SaveMigrator', () => {
  it('normaliza um save existente e preserva os dados conhecidos', () => {
    const migrator = new SaveMigrator();
    const payload = migrator.migrateAndNormalize({
      version: 1,
      timestamp: 123,
      state: {
        storage: { wood: 12 },
        upgrades: { toolPower: 2 }
      },
      playerPos: { x: 18, y: 27 },
      audio: { music: 0.35 }
    });

    expect(payload.version).toBe(1);
    expect(payload.timestamp).toBe(123);
    expect(payload.state.storage.wood).toBe(12);
    expect(payload.state.storage.coins).toBe(15);
    expect(payload.state.upgrades.toolPower).toBe(2);
    expect(payload.playerPos).toEqual({ x: 18, y: 27 });
    expect(payload.audio.music).toBe(0.35);
  });

  it('aceita o formato antigo com o estado na raiz', () => {
    const migrator = new SaveMigrator();
    const payload = migrator.migrateAndNormalize({
      storage: { stone: 9 }
    });

    expect(payload.state.storage.stone).toBe(9);
    expect(payload.playerPos).toEqual({ x: 0, y: 55 });
  });

  it('rejeita saves sem armazenamento', () => {
    const migrator = new SaveMigrator();

    expect(() => migrator.migrateAndNormalize({ state: {} })).toThrow(
      'Save inválido: estado de armazenamento ausente.'
    );
  });
});
