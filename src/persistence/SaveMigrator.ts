import { AudioSettings, GameState, SavePayload } from '../domain/types.ts';
import { createDefaultState } from '../domain/GameState.ts';
import { createDefaultAudioSettings } from '../audio/AudioSettings.ts';
import { TUTORIAL_STEPS } from '../domain/Tutorial.ts';
import { SELLABLE_RESOURCES } from '../config/resources.ts';

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
    const surplusReserves: GameState['surplusReserves'] = {};
    for (const { id } of SELLABLE_RESOURCES) {
      const reserve = stateObj.surplusReserves?.[id];
      if (Number.isSafeInteger(reserve) && reserve >= 0) surplusReserves[id] = reserve;
    }

    const normalizedState: GameState = {
      ...defaultState,
      ...stateObj,
      tutorialStep: TUTORIAL_STEPS.includes(stateObj.tutorialStep) ? stateObj.tutorialStep : 'done',
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
      droneFarmsPaused: stateObj.droneFarmsPaused === true,
      surplusReserves,
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

    for (const id of Object.keys(defaultState.machines)) {
      const machine = normalizedState.machines[id];
      const remaining = machine?.batchRemaining;
      if (remaining !== undefined && (!Number.isSafeInteger(remaining) || remaining <= 0 || machine.paused !== true)) {
        delete machine.batchRemaining;
      }
    }

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
