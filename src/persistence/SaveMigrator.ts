import { AudioSettings, GameState, SavePayload } from '../domain/types.ts';
import { createDefaultState } from '../domain/GameState.ts';
import { createDefaultAudioSettings } from '../audio/AudioSettings.ts';

export class SaveMigrator {
  /**
   * Valida e migra qualquer save antigo ou incompleto para o formato canônico atual.
   */
  migrateAndNormalize(rawParsed: any): SavePayload {
    if (!rawParsed || typeof rawParsed !== 'object') {
      throw new Error('Save inválido: carga não é um objeto.');
    }

    // Se o save for da versão anterior ou formato direto de estado
    const stateObj = rawParsed.state || rawParsed;
    if (!stateObj.storage || typeof stateObj.storage !== 'object') {
      throw new Error('Save inválido: estado de armazenamento ausente.');
    }

    const defaultState = createDefaultState();
    const defaultAudio = createDefaultAudioSettings();

    const normalizedState: GameState = {
      ...defaultState,
      ...stateObj,
      storage: {
        ...defaultState.storage,
        ...(stateObj.storage || {})
      },
      upgrades: {
        ...defaultState.upgrades,
        ...(stateObj.upgrades || {})
      },
      builds: {
        ...defaultState.builds,
        ...(stateObj.builds || {})
      },
      machines: {
        ...defaultState.machines,
        ...(stateObj.machines || {})
      },
      airship: {
        ...defaultState.airship,
        ...(stateObj.airship || {})
      },
      stats: {
        ...defaultState.stats,
        ...(stateObj.stats || {})
      },
      contracts: Array.isArray(stateObj.contracts) ? stateObj.contracts : defaultState.contracts,
      specialization: stateObj.specialization || null,
      trackedBuildId: stateObj.trackedBuildId ?? defaultState.trackedBuildId
    };

    const playerPos = {
      x: typeof rawParsed.playerPos?.x === 'number' ? rawParsed.playerPos.x : 0,
      y: typeof rawParsed.playerPos?.y === 'number' ? rawParsed.playerPos.y : 55
    };

    const audio: AudioSettings = {
      ...defaultAudio,
      ...(rawParsed.audio || {})
    };

    return {
      version: 1,
      timestamp: rawParsed.timestamp || Date.now(),
      state: normalizedState,
      playerPos,
      audio
    };
  }
}
