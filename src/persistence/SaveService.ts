import { GameState, PlayerState, AudioSettings, SavePayload } from '../domain/types.ts';
import { SaveRepository } from './SaveRepository.ts';
import { SaveMigrator } from './SaveMigrator.ts';
import { EventBus } from '../core/EventBus.ts';
import type { CloudSaveSync } from './CloudSaveSync.ts';

export class SaveService {
  private repository: SaveRepository;
  private migrator: SaveMigrator;
  private cloud: CloudSaveSync | null = null;

  constructor(private eventBus?: EventBus) {
    this.repository = new SaveRepository();
    this.migrator = new SaveMigrator();
  }

  useCloud(session: CloudSaveSync | null): void {
    if (this.cloud !== session) this.cloud?.close();
    this.cloud = session;
  }

  buildSavePayload(
    state: GameState,
    player: PlayerState,
    audioSettings: AudioSettings
  ): SavePayload {
    // Descarrega mochila no armazém virtual do save para não perder nada na transferência
    const mergedStorage = { ...state.storage };
    player.backpack.forEach(res => {
      mergedStorage[res] = (mergedStorage[res] || 0) + 1;
    });

    return {
      version: 1,
      timestamp: Date.now(),
      state: {
        ...state,
        storage: mergedStorage
      },
      playerPos: { x: player.x, y: player.y },
      audio: { ...audioSettings }
    };
  }

  save(
    state: GameState,
    player: PlayerState,
    audioSettings: AudioSettings,
    silent: boolean = false
  ): boolean {
    const payload = this.buildSavePayload(state, player, audioSettings);
    const success = this.cloud ? this.cloud.checkpoint(payload) : this.repository.saveRaw(JSON.stringify(payload));

    if (success && !silent && this.eventBus) {
      this.eventBus.emit('save:indicator');
    }

    return success;
  }

  load(): SavePayload | null {
    const raw = this.repository.loadRaw();
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return this.migrator.migrateAndNormalize(parsed);
    } catch (e) {
      console.warn('Erro ao decodificar save do localStorage:', e);
      return null;
    }
  }

  generateExportCode(
    state: GameState,
    player: PlayerState,
    audioSettings: AudioSettings
  ): string {
    const payload = this.buildSavePayload(state, player, audioSettings);
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
    return 'ODV1_' + b64;
  }

  importFromCode(codeStr: string): SavePayload {
    const trimmed = (codeStr || '').trim();
    if (!trimmed.startsWith('ODV1_')) {
      throw new Error('O código deve começar com ODV1_');
    }
    const b64 = trimmed.slice(5);
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(jsonStr);
    return this.migrator.migrateAndNormalize(parsed);
  }

  importFromJsonString(jsonString: string): SavePayload {
    const parsed = JSON.parse(jsonString);
    return this.migrator.migrateAndNormalize(parsed);
  }

  downloadBackupJson(
    state: GameState,
    player: PlayerState,
    audioSettings: AudioSettings
  ): void {
    this.downloadPayload(this.buildSavePayload(state, player, audioSettings));
  }

  downloadPayload(payload: SavePayload, filename = 'oficina-do-vale-save.json'): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  clear(): boolean {
    return this.cloud ? true : this.repository.clear();
  }
}
