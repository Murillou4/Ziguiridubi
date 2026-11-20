import type { SavePayload } from '../domain/types.ts';
import { SaveMigrator } from './SaveMigrator.ts';

export interface CloudRecord {
  payloadJson: string;
  revision: number;
  writeId: string;
  updatedAt: number;
}

export interface CloudGateway {
  read(uid: string): Promise<CloudRecord | null>;
  write(uid: string, revision: number, payloadJson: string, writeId: string):
    Promise<{ saved: CloudRecord } | { conflict: CloudRecord | null }>;
}

export type CloudStatus = 'saved' | 'pending' | 'syncing' | 'offline' | 'conflict' | 'error';

interface Attempt {
  id: string;
  payload: SavePayload;
}

interface Checkpoint {
  revision: number;
  payload: SavePayload;
  attempt?: Attempt;
}

const INTERVAL = 45_000;
const RETRY_INTERVAL = 60_000;
const MAX_PAYLOAD = 128 * 1024;

function progressKey(payload: SavePayload): string {
  const { timestamp: _timestamp, ...progress } = payload;
  return JSON.stringify(progress);
}

class AccountJournal {
  private readonly cache: string;
  private readonly outbox: string;
  readonly key: string;
  private releaseLock?: () => void;
  private readonly lockReady: Promise<void>;
  private closed = false;

  constructor(private storage: Storage, uid: string) {
    this.cache = `oficina_do_vale_account:${uid}`;
    this.outbox = `${this.cache}:pending:`;
    this.key = this.outbox + crypto.randomUUID();
    this.lockReady = typeof navigator !== 'undefined' && navigator.locks ? new Promise(resolve => {
      void navigator.locks.request(this.key, () => {
        resolve();
        if (this.closed) return;
        return new Promise<void>(release => { this.releaseLock = release; });
      }).catch(() => resolve());
    }) : Promise.resolve();
  }

  async load(): Promise<{ checkpoint: Checkpoint; pendingKey?: string } | undefined> {
    await this.lockReady;
    const active = new Set<string>();
    try {
      const locks = typeof navigator !== 'undefined' ? await navigator.locks?.query() : undefined;
      for (const lock of locks?.held ?? []) if (lock.name) active.add(lock.name);
    } catch { /* The outbox still works in browsers without Web Locks. */ }
    const cache = this.read(this.cache);
    const pending: Array<{ checkpoint: Checkpoint; pendingKey: string }> = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(this.outbox) || active.has(key)) continue;
        const checkpoint = this.read(key);
        if (checkpoint) pending.push({ checkpoint, pendingKey: key });
      }
    } catch { /* Some browsers block storage. Cloud saves still work online. */ }
    pending.sort((a, b) => b.checkpoint.payload.timestamp - a.checkpoint.payload.timestamp);
    return pending[0] ?? (cache ? { checkpoint: cache } : undefined);
  }

  savePending(checkpoint: Checkpoint): boolean { return this.put(this.key, checkpoint); }

  saveCache(checkpoint: Checkpoint): void {
    if ((this.read(this.cache)?.revision ?? 0) <= checkpoint.revision) this.put(this.cache, checkpoint);
  }

  remove(key: string, expected?: Checkpoint): void {
    try {
      if (expected && this.storage.getItem(key) !== JSON.stringify(expected)) return;
      this.storage.removeItem(key);
    } catch { /* Storage may be blocked. */ }
  }

  close(): void {
    this.closed = true;
    this.releaseLock?.();
  }

  private put(key: string, checkpoint: Checkpoint): boolean {
    try {
      this.storage.setItem(key, JSON.stringify(checkpoint));
      return true;
    } catch { return false; }
  }

  private read(key: string): Checkpoint | undefined {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return undefined;
      const parsed: Checkpoint = JSON.parse(raw);
      return Number.isSafeInteger(parsed.revision) && parsed.revision >= 0 &&
        typeof parsed.payload?.timestamp === 'number' && parsed.payload.state?.storage ? parsed : undefined;
    } catch { return undefined; }
  }
}

export class CloudSaveSync {
  private readonly journal: AccountJournal;
  private readonly migrator = new SaveMigrator();
  private checkpointData?: Checkpoint;
  private pending = false;
  private storedLocally = true;
  private inherited?: { key: string; checkpoint: Checkpoint };
  private lastAttempt = -Infinity;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private sending = false;
  private connectedOnce = false;
  private signature?: string;
  private acknowledgedSignature?: string;
  conflict?: { remote: CloudRecord | null; local: SavePayload };

  constructor(
    private uid: string,
    private gateway: CloudGateway,
    storage: Storage,
    private onStatus: (status: CloudStatus) => void
  ) {
    this.journal = new AccountJournal(storage, uid);
  }

  async start(): Promise<SavePayload | null> {
    const local = await this.journal.load();
    let remote: CloudRecord | null;
    try {
      remote = await this.readWithDeadline();
    } catch (error) {
      if (!local) throw error;
      this.selectLocal(local);
      this.status('offline');
      if (this.pending) this.schedule(RETRY_INTERVAL);
      return structuredClone(this.checkpointData!.payload);
    }
    if (this.closed) return null;
    // Validate remote data before offering it as a recovery choice.
    const remotePayload = remote ? this.decode(remote) : null;
    this.connectedOnce = true;
    if (local?.pendingKey) {
      this.selectLocal(local);
      if (remote && this.checkpointData?.attempt?.id === remote.writeId) {
        this.acknowledge(remote, this.checkpointData.attempt.payload);
      } else if ((remote?.revision ?? 0) !== this.checkpointData?.revision) {
        this.setConflict(remote);
      } else {
        this.status('pending');
        this.schedule();
      }
      return structuredClone(this.checkpointData!.payload);
    }
    if (remote && remotePayload) this.selectRemote(remote, remotePayload);
    else this.status('pending');
    return remotePayload ? structuredClone(remotePayload) : null;
  }

  checkpoint(payload: SavePayload): boolean {
    if (this.closed) return false;
    const signature = progressKey(payload);
    if (signature === this.signature) return this.storedLocally;
    this.signature = signature;
    const snapshot = structuredClone(payload);
    this.checkpointData = { revision: this.checkpointData?.revision ?? 0, payload: snapshot, attempt: this.checkpointData?.attempt };
    this.pending = Boolean(this.conflict || this.checkpointData.attempt) || signature !== this.acknowledgedSignature;
    if (!this.pending) {
      this.discardPending();
      this.status('saved');
      return true;
    }
    this.persistPending();
    if (this.conflict) {
      this.conflict.local = snapshot;
      return this.storedLocally;
    }
    this.status(!this.storedLocally ? 'error' : navigator.onLine === false ? 'offline' : 'pending');
    this.schedule();
    return this.storedLocally;
  }

  async syncNow(): Promise<void> { await this.flush(true); }

  reconnect(): void {
    if (this.pending) this.schedule();
  }

  resolveConflict(choice: 'local' | 'cloud'): SavePayload | null {
    const conflict = this.conflict;
    if (!conflict) return null;
    this.conflict = undefined;
    if (choice === 'cloud') {
      this.discardPending();
      this.pending = false;
      if (conflict.remote) {
        const payload = this.decode(conflict.remote);
        this.selectRemote(conflict.remote, payload);
        return structuredClone(payload);
      }
      this.checkpointData = undefined;
      this.signature = this.acknowledgedSignature = undefined;
      this.status('pending');
      return null;
    }
    this.checkpointData = { revision: conflict.remote?.revision ?? 0, payload: conflict.local };
    this.pending = true;
    this.persistPending();
    this.status(this.storedLocally ? 'pending' : 'error');
    void this.syncNow();
    return conflict.local;
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.journal.close();
  }

  private selectLocal(local: { checkpoint: Checkpoint; pendingKey?: string }): void {
    const payload = this.migrator.migrateAndNormalize(local.checkpoint.payload);
    this.checkpointData = { ...local.checkpoint, payload };
    this.signature = progressKey(payload);
    this.inherited = local.pendingKey ? { key: local.pendingKey, checkpoint: local.checkpoint } : undefined;
    this.pending = Boolean(local.pendingKey);
    this.acknowledgedSignature = this.pending ? undefined : this.signature;
  }

  private selectRemote(remote: CloudRecord, payload: SavePayload): void {
    this.checkpointData = { revision: remote.revision, payload };
    this.signature = this.acknowledgedSignature = progressKey(payload);
    this.storedLocally = true;
    this.journal.saveCache(this.checkpointData);
    this.status('saved');
  }

  private decode(remote: CloudRecord): SavePayload {
    return this.migrator.migrateAndNormalize(JSON.parse(remote.payloadJson));
  }

  private async readWithDeadline(): Promise<CloudRecord | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([this.gateway.read(this.uid), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo de conexão esgotado.')), 8_000);
      })]);
    } finally {
      clearTimeout(timer);
    }
  }

  private persistPending(): void {
    this.storedLocally = this.journal.savePending(this.checkpointData!);
    if (this.storedLocally && this.inherited) {
      this.journal.remove(this.inherited.key, this.inherited.checkpoint);
      this.inherited = undefined;
    }
  }

  private discardPending(): void {
    this.journal.remove(this.journal.key);
    if (this.inherited) this.journal.remove(this.inherited.key, this.inherited.checkpoint);
    this.inherited = undefined;
  }

  private acknowledge(remote: CloudRecord, payload: SavePayload): void {
    const current = this.checkpointData!;
    this.acknowledgedSignature = progressKey(payload);
    this.journal.saveCache({ revision: remote.revision, payload });
    this.checkpointData = { revision: remote.revision, payload: current.payload };
    this.pending = this.signature !== this.acknowledgedSignature;
    if (this.pending) this.persistPending();
    else {
      this.storedLocally = true;
      this.discardPending();
    }
    this.status(!this.storedLocally ? 'error' : this.pending ? 'pending' : 'saved');
    this.schedule();
  }

  private setConflict(remote: CloudRecord | null): void {
    if (remote) this.decode(remote);
    this.conflict = { remote, local: this.checkpointData!.payload };
    this.status('conflict');
  }

  private schedule(delay = 0): void {
    if (this.closed || this.sending || !this.pending || this.conflict) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(false),
      Math.max(delay, this.lastAttempt + INTERVAL - Date.now(), 0));
  }

  private async flush(manual: boolean): Promise<void> {
    if (this.closed || this.sending || !this.pending || this.conflict || !this.checkpointData) return;
    if (!manual && Date.now() < this.lastAttempt + INTERVAL) { this.schedule(); return; }
    if (navigator.onLine === false) { this.status(this.storedLocally ? 'offline' : 'error'); return; }

    clearTimeout(this.timer);
    this.sending = true;
    this.lastAttempt = Date.now();
    const checkpoint = this.checkpointData;
    let retry = false;
    try {
      if (!this.connectedOnce) {
        const remote = await this.readWithDeadline();
        this.connectedOnce = true;
        if (this.closed) return;
        if (remote && checkpoint.attempt?.id === remote.writeId) {
          this.acknowledge(remote, checkpoint.attempt.payload);
          return;
        }
        if ((remote?.revision ?? 0) !== checkpoint.revision) { this.setConflict(remote); return; }
      }
      const active = this.checkpointData!;
      const attempt = active.attempt ?? { id: crypto.randomUUID(), payload: active.payload };
      const payloadJson = JSON.stringify(attempt.payload);
      if (new TextEncoder().encode(payloadJson).length > MAX_PAYLOAD) { this.status('error'); return; }
      active.attempt = attempt;
      this.persistPending();
      this.status('syncing');
      const result = await this.gateway.write(this.uid, active.revision, payloadJson, attempt.id);
      if ('saved' in result) this.acknowledge(result.saved, attempt.payload);
      else this.setConflict(result.conflict);
    } catch {
      retry = true;
      this.status(this.storedLocally ? 'offline' : 'error');
    } finally {
      this.sending = false;
      if (retry) this.schedule(RETRY_INTERVAL);
      else if (this.pending && !this.conflict && this.checkpointData !== checkpoint) this.schedule();
    }
  }

  private status(status: CloudStatus): void {
    if (!this.closed) this.onStatus(status);
  }
}
