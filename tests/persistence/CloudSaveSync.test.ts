import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSaveSync, type CloudGateway, type CloudRecord, type CloudStatus } from '../../src/persistence/CloudSaveSync.ts';
import { createDefaultState } from '../../src/domain/GameState.ts';
import { createDefaultAudioSettings } from '../../src/audio/AudioSettings.ts';
import type { SavePayload } from '../../src/domain/types.ts';

function payload(wood: number): SavePayload {
  const state = createDefaultState();
  state.storage.wood = wood;
  return { version: 1, timestamp: Date.now(), state, playerPos: { x: 0, y: 55 }, audio: createDefaultAudioSettings() };
}

function localStorageFixture(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }
  };
}

function cloudFixture() {
  const records = new Map<string, CloudRecord>();
  const cloud: CloudGateway = {
    async read(uid) { return records.get(uid) ?? null; },
    async write(uid, revision, payloadJson, writeId) {
      const current = records.get(uid) ?? null;
      if (current?.writeId === writeId) return { saved: current };
      if ((current?.revision ?? 0) !== revision) return { conflict: current };
      const saved = { revision: revision + 1, payloadJson, writeId, updatedAt: Date.now() };
      records.set(uid, saved);
      return { saved };
    }
  };
  return cloud;
}

describe('CloudSaveSync', () => {
  const sessions: CloudSaveSync[] = [];
  const network = { onLine: true };

  beforeEach(() => {
    network.onLine = true;
    vi.stubGlobal('navigator', network);
    vi.useFakeTimers();
  });

  afterEach(() => {
    sessions.splice(0).forEach(session => session.close());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function open(cloud: CloudGateway, storage = localStorageFixture(), uid = 'player', status = (_value: CloudStatus) => {}) {
    const session = new CloudSaveSync(uid, cloud, storage, status);
    sessions.push(session);
    return session;
  }

  it('coalesces changes, snapshots data and skips saves that only change the timestamp', async () => {
    const cloud = cloudFixture();
    const write = vi.spyOn(cloud, 'write');
    const session = open(cloud);
    await session.start();
    const first = payload(2);
    session.checkpoint(first);
    first.state.storage.wood = 50;
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse((await cloud.read('player'))!.payloadJson).state.storage.wood).toBe(2);
    session.checkpoint(payload(3));
    session.checkpoint(payload(4));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse((await cloud.read('player'))!.payloadJson).state.storage.wood).toBe(4);
    session.checkpoint(payload(4));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('recovers an offline checkpoint after reopening and keeps other accounts isolated', async () => {
    const cloud = cloudFixture();
    const storage = localStorageFixture();
    const original = open(cloud, storage);
    await original.start();
    original.checkpoint(payload(2));
    await original.syncNow();
    network.onLine = false;
    original.checkpoint(payload(8));
    original.close();

    const onlineRead = cloud.read;
    vi.spyOn(cloud, 'read').mockRejectedValueOnce(new Error('offline'));
    const resumed = open(cloud, storage);
    expect((await resumed.start())?.state.storage.wood).toBe(8);
    expect(await open(cloud, storage, 'other').start()).toBeNull();
    network.onLine = true;
    resumed.reconnect();
    await resumed.syncNow();
    expect(JSON.parse((await onlineRead('player'))!.payloadJson).state.storage.wood).toBe(8);
  });

  it('requires a choice after another session advances the same revision', async () => {
    const cloud = cloudFixture();
    const first = open(cloud);
    const second = open(cloud);
    await first.start();
    await second.start();
    first.checkpoint(payload(3));
    await first.syncNow();
    second.checkpoint(payload(9));
    await second.syncNow();
    expect(second.conflict?.local.state.storage.wood).toBe(9);
    expect(second.conflict?.remote?.revision).toBe(1);
    expect(second.resolveConflict('cloud')?.state.storage.wood).toBe(3);
    expect((await cloud.read('player'))?.revision).toBe(1);
  });

  it('reuses a write id after losing the response to a successful commit', async () => {
    const cloud = cloudFixture();
    const originalWrite = cloud.write;
    const write = vi.spyOn(cloud, 'write').mockImplementationOnce(async (...args) => {
      await originalWrite(...args);
      throw new Error('lost acknowledgment');
    });
    const session = open(cloud);
    await session.start();
    session.checkpoint(payload(8));
    await session.syncNow();
    await session.syncNow();
    expect(write.mock.calls[0][3]).toBe(write.mock.calls[1][3]);
    expect((await cloud.read('player'))?.revision).toBe(1);
    expect(session.conflict).toBeUndefined();
  });
});
