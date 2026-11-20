import type { SavePayload } from '../domain/types.ts';
import { CloudSaveSync, type CloudStatus } from '../persistence/CloudSaveSync.ts';
import { cloudConfigured, connectAccountGateway, type AccountGateway, type AccountIdentity } from '../persistence/FirebaseAccount.ts';
import { SaveService } from '../persistence/SaveService.ts';

interface AccountActions {
  leaveGame(): void;
  load(payload: SavePayload | null): void;
  checkpoint(): void;
}

const STATUS_TEXT: Record<CloudStatus, string> = {
  saved: 'Salvo na nuvem',
  pending: 'Sincronização pendente',
  syncing: 'Sincronizando…',
  offline: 'Sem conexão com a nuvem · salvo neste dispositivo',
  conflict: 'Duas versões da partida',
  error: 'Falha no salvamento. Baixe uma cópia em Salvar.'
};

type Stage = 'loading' | 'ready' | 'import' | 'failed';

export class AccountFlow {
  private gateway?: AccountGateway;
  private session?: CloudSaveSync;
  private identity: AccountIdentity | null = null;
  private stage: Stage = 'ready';
  private status?: CloudStatus;
  private message = '';
  private busy = false;
  private generation = 0;
  private panels: HTMLElement[] = [];
  private connected = false;
  private stagedSession?: CloudSaveSync;

  constructor(private saves: SaveService, private actions: AccountActions) {}

  init(): void {
    if (!cloudConfigured) return;
    this.panels = [...document.querySelectorAll<HTMLElement>('[data-account-panel]')];
    for (const panel of this.panels) {
      panel.hidden = false;
      panel.innerHTML = `
        <strong data-account-name></strong>
        <p class="account-status" data-account-status role="status"></p>
        <div class="account-actions">
          <button type="button" data-account-action="login">Entrar com Google</button>
          <button type="button" data-account-action="sync">Sincronizar agora</button>
          <button type="button" data-account-action="logout">Sair da conta</button>
          <button type="button" data-account-action="retry">Tentar de novo</button>
          <button type="button" data-account-action="import">Levar minha partida local</button>
          <button type="button" data-account-action="fresh">Começar do zero</button>
          <button type="button" data-account-action="local">Manter esta partida</button>
          <button type="button" data-account-action="cloud">Usar a partida da nuvem</button>
          <button type="button" data-account-action="backup">Baixar cópia local</button>
        </div>`;
      panel.addEventListener('click', event => {
        if (!(event.target instanceof HTMLButtonElement)) return;
        const action = event.target.dataset.accountAction;
        if (action) void this.act(action);
      });
    }
    window.addEventListener('online', () => {
      if (this.stage === 'failed' && this.identity) void this.openAccount(this.identity);
      else this.session?.reconnect();
    });
    void this.connect();
  }

  private async connect(): Promise<void> {
    this.stage = 'loading';
    this.message = 'Conectando à conta…';
    this.paint();
    try {
      this.gateway = await connectAccountGateway();
      this.gateway.observe(identity => {
        if (this.connected && identity?.uid === this.identity?.uid) return;
        const first = !this.connected;
        this.connected = true;
        if (identity) {
          if (!first) this.actions.leaveGame();
          void this.openAccount(identity);
        } else {
          this.generation++;
          if (!first) this.actions.leaveGame();
          this.closeSession();
          this.identity = null;
          this.stage = 'ready';
          this.status = undefined;
          this.message = first && this.gateway?.redirectError
            ? 'O login foi interrompido. Você pode tentar de novo.' : '';
          if (!first) this.actions.load(this.saves.load());
          this.paint();
        }
      });
    } catch {
      this.stage = 'ready';
      this.message = 'Conta indisponível. Você pode jogar neste dispositivo.';
      this.paint();
    }
  }

  private async openAccount(identity: AccountIdentity): Promise<void> {
    const generation = ++this.generation;
    this.closeSession();
    this.identity = identity;
    this.stage = 'loading';
    this.status = undefined;
    this.message = 'Buscando sua partida…';
    this.paint();
    try {
      const session = new CloudSaveSync(identity.uid, this.gateway!, window.localStorage, status => {
        if (generation !== this.generation) return;
        this.status = status;
        this.paint();
      });
      this.stagedSession = session;
      const payload = await session.start();
      if (generation !== this.generation) { session.close(); return; }
      this.stagedSession = undefined;
      this.session = session;
      if (!payload && this.saves.load()) {
        this.stage = 'import';
        this.message = 'Quer usar a partida deste navegador na sua conta?';
        this.paint();
        return;
      }
      this.begin(payload);
    } catch {
      if (generation !== this.generation) return;
      this.stagedSession?.close();
      this.stagedSession = undefined;
      this.stage = 'failed';
      this.message = 'Não foi possível abrir sua partida online. Tente novamente ou saia para jogar como visitante.';
      this.paint();
    }
  }

  private closeSession(): void {
    this.stagedSession?.close();
    this.stagedSession = undefined;
    this.session?.close();
    this.saves.useCloud(null);
    this.session = undefined;
  }

  private begin(payload: SavePayload | null): void {
    this.saves.useCloud(this.session ?? null);
    this.stage = 'ready';
    this.message = '';
    this.actions.load(payload);
    this.paint();
  }

  private async act(action: string): Promise<void> {
    if (this.busy) return;
    switch (action) {
      case 'login':
      case 'logout':
        if (!this.gateway) { void this.connect(); return; }
        this.actions.checkpoint();
        this.message = '';
        this.busy = true;
        this.paint();
        try {
          if (action === 'login') await this.gateway.signIn();
          else await this.gateway.signOut();
        } catch {
          this.message = action === 'login' ? 'O login não foi concluído. Tente entrar novamente.'
            : 'Não foi possível sair da conta. Tente novamente.';
        } finally {
          this.busy = false;
          this.paint();
        }
        break;
      case 'sync':
        this.actions.checkpoint();
        await this.session?.syncNow();
        break;
      case 'retry':
        if (this.identity) await this.openAccount(this.identity);
        break;
      case 'import':
      case 'fresh':
        if (this.stage !== 'import') return;
        const payload = action === 'import' ? this.saves.load() : null;
        if (payload) this.session?.checkpoint(payload);
        this.begin(payload);
        break;
      case 'backup':
        if (this.session?.conflict) this.saves.downloadPayload(this.session.conflict.local, 'ziguiridubi-copia-local.json');
        break;
      case 'local':
      case 'cloud':
        if (!this.session?.conflict) return;
        this.actions.checkpoint();
        const selected = this.session.resolveConflict(action);
        if (action === 'cloud') this.actions.load(selected);
        break;
    }
  }

  private paint(): void {
    const start = document.getElementById('btnStartGame') as HTMLButtonElement | null;
    if (start) start.disabled = this.stage !== 'ready' || this.busy || Boolean(this.session?.conflict);
    const loggedIn = this.identity !== null;
    const startLabel = document.getElementById('btnStartLabel');
    if (!loggedIn && startLabel) {
      if (startLabel.textContent === 'Iniciar jornada') startLabel.textContent = 'Jogar como visitante';
      if (startLabel.textContent === 'Continuar jornada') startLabel.textContent = 'Continuar como visitante';
    }
    const ready = this.stage === 'ready';
    const conflict = this.session?.conflict;
    const cloudText = conflict
      ? `Neste dispositivo: ${this.formatDate(conflict.local.timestamp)} · Na nuvem: ${this.formatDate(conflict.remote?.updatedAt)}`
      : this.status ? STATUS_TEXT[this.status] : 'Salvamento neste navegador';
    const text = this.message || cloudText;
    for (const panel of this.panels) {
      panel.querySelector('[data-account-name]')!.textContent = this.identity?.name ?? 'Visitante';
      const element = panel.querySelector('[data-account-status]')!;
      if (element.textContent !== text) element.textContent = text;
      const visible = {
        login: !loggedIn && ready,
        logout: loggedIn && this.stage !== 'loading',
        sync: loggedIn && ready && !conflict,
        retry: this.stage === 'failed',
        import: this.stage === 'import', fresh: this.stage === 'import',
        local: Boolean(conflict), cloud: Boolean(conflict), backup: Boolean(conflict)
      };
      panel.querySelectorAll<HTMLButtonElement>('[data-account-action]').forEach(button => {
        button.hidden = !visible[button.dataset.accountAction as keyof typeof visible];
        button.disabled = this.busy || (button.dataset.accountAction === 'sync' && this.status === 'syncing');
      });
    }
    const badge = document.getElementById('cloudSaveStatus');
    if (badge) {
      badge.hidden = !loggedIn || !this.status;
      badge.textContent = conflict ? 'Conflito no save · abra Salvar' : cloudText;
    }
  }

  private formatDate(time?: number): string {
    return time ? new Date(time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem partida';
  }
}
