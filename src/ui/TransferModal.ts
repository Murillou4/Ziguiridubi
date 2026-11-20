import { AudioSettings, GameState, PlayerState, SavePayload } from '../domain/types.ts';
import { SaveService } from '../persistence/SaveService.ts';
import { EventBus } from '../core/EventBus.ts';

export class TransferModal {
  constructor(
    private saveService: SaveService,
    private eventBus: EventBus
  ) {}

  init(
    getState: () => GameState,
    getPlayer: () => PlayerState,
    getAudio: () => AudioSettings,
    onPayloadLoaded: (payload: SavePayload) => void
  ): void {
    // 1. Salvar Agora
    const btnSaveNow = document.getElementById('btnSaveNowTransfer');
    if (btnSaveNow) {
      btnSaveNow.addEventListener('click', () => {
        this.saveService.save(getState(), getPlayer(), getAudio(), false);
        const box = document.getElementById('exportCodeBox') as HTMLTextAreaElement | null;
        if (box) box.value = this.saveService.generateExportCode(getState(), getPlayer(), getAudio());
        this.eventBus.emit('ui:toast', { message: ' Progresso salvo no navegador!' });
      });
    }

    // 2. Copiar Código
    const btnCopy = document.getElementById('btnCopyExportCode');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const box = document.getElementById('exportCodeBox') as HTMLTextAreaElement | null;
        if (!box) return;
        box.value = this.saveService.generateExportCode(getState(), getPlayer(), getAudio());
        box.select();
        box.setSelectionRange(0, box.value.length);
        try {
          navigator.clipboard.writeText(box.value).catch(() => {
            document.execCommand('copy');
          });
        } catch {
          document.execCommand('copy');
        }

        const msg = document.getElementById('copyConfirmMsg');
        if (msg) {
          msg.classList.remove('hidden');
          setTimeout(() => msg.classList.add('hidden'), 2400);
        }
      });
    }

    // 3. Baixar JSON
    const btnDownload = document.getElementById('btnDownloadJson');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        this.saveService.downloadBackupJson(getState(), getPlayer(), getAudio());
        this.eventBus.emit('ui:toast', { message: ' Backup oficina-do-vale-save.json baixado!' });
      });
    }

    // 4. Carregar Código
    const btnLoad = document.getElementById('btnLoadImportCode');
    if (btnLoad) {
      btnLoad.addEventListener('click', () => {
        const rawBox = document.getElementById('importCodeBox') as HTMLTextAreaElement | null;
        const fb = document.getElementById('importFeedbackMsg');
        if (!rawBox) return;

        try {
          const payload = this.saveService.importFromCode(rawBox.value);
          onPayloadLoaded(payload);
          if (fb) {
            fb.textContent = ' Progresso carregado com sucesso!';
            fb.className = 'text-xs font-semibold ui-ink-moss';
            fb.classList.remove('hidden');
          }
          this.eventBus.emit('sound:upgrade');
          this.eventBus.emit('ui:toast', { message: ' Progresso importado e restaurado!' });
          setTimeout(() => this.eventBus.emit('ui:closeModals'), 900);
        } catch (err: any) {
          if (fb) {
            fb.textContent = ' Código inválido: ' + (err?.message || 'Formato desconhecido');
            fb.className = 'text-xs font-semibold ui-ink-clay';
            fb.classList.remove('hidden');
          }
        }
      });
    }

    // 5. Importar Arquivo JSON
    const fileInput = document.getElementById('importJsonFileInput') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target?.files?.[0];
        if (!file) return;
        const fb = document.getElementById('importFeedbackMsg');
        const reader = new FileReader();

        reader.onload = (ev: ProgressEvent<FileReader>) => {
          try {
            const rawStr = ev.target?.result as string;
            const payload = this.saveService.importFromJsonString(rawStr);
            onPayloadLoaded(payload);
            if (fb) {
              fb.textContent = ' Arquivo JSON importado com sucesso!';
              fb.className = 'text-xs font-semibold ui-ink-moss';
              fb.classList.remove('hidden');
            }
            this.eventBus.emit('sound:upgrade');
            this.eventBus.emit('ui:toast', { message: ' Backup JSON restaurado com sucesso!' });
            setTimeout(() => this.eventBus.emit('ui:closeModals'), 900);
          } catch {
            if (fb) {
              fb.textContent = ' Arquivo JSON inválido.';
              fb.className = 'text-xs font-semibold ui-ink-clay';
              fb.classList.remove('hidden');
            }
          }
        };
        reader.readAsText(file);
      });
    }
  }

  refreshCode(state: GameState, player: PlayerState, audioSettings: AudioSettings): void {
    const box = document.getElementById('exportCodeBox') as HTMLTextAreaElement | null;
    if (box) {
      box.value = this.saveService.generateExportCode(state, player, audioSettings);
    }
    const fb = document.getElementById('importFeedbackMsg');
    if (fb) fb.classList.add('hidden');
  }
}
