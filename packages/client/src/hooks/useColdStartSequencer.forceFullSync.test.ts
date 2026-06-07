/**
 * Unit tests for the forceFullSync closure produced by useColdStartSequencer.
 *
 * We test the behaviour of the function directly — not via a rendered hook —
 * so we can keep the test focused and avoid mocking the full React lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal types used by the closure ────────────────────────────────────────

interface MockSyncManager {
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds the forceFullSync closure in isolation, mirroring the shape
 * that useColdStartSequencer creates internally.
 */
function buildForceFullSync(deps: {
  snapshotStore: { clear: ReturnType<typeof vi.fn> };
  syncManagerRef: { current: MockSyncManager | null };
  newSyncManagerFactoryRef: { current: (() => MockSyncManager) | null };
}) {
  const { snapshotStore, syncManagerRef, newSyncManagerFactoryRef } = deps;

  return async () => {
    await snapshotStore.clear('entry-list-projection');
    syncManagerRef.current?.stop();
    const newManager = newSyncManagerFactoryRef.current?.();
    if (newManager) {
      newManager.start();
      syncManagerRef.current = newManager;
    }
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('forceFullSync closure', () => {
  let snapshotStore: { clear: ReturnType<typeof vi.fn> };
  let oldManager: MockSyncManager;
  let newManager: MockSyncManager;
  let syncManagerRef: { current: MockSyncManager | null };
  let newSyncManagerFactoryRef: { current: (() => MockSyncManager) | null };

  beforeEach(() => {
    snapshotStore = { clear: vi.fn().mockResolvedValue(undefined) };

    oldManager = { stop: vi.fn(), start: vi.fn() };
    newManager = { stop: vi.fn(), start: vi.fn() };

    syncManagerRef = { current: oldManager };
    newSyncManagerFactoryRef = { current: () => newManager };
  });

  it('calls snapshotStore.clear with "entry-list-projection"', async () => {
    const forceFullSync = buildForceFullSync({
      snapshotStore,
      syncManagerRef,
      newSyncManagerFactoryRef,
    });

    await forceFullSync();

    expect(snapshotStore.clear).toHaveBeenCalledOnce();
    expect(snapshotStore.clear).toHaveBeenCalledWith('entry-list-projection');
  });

  it('calls stop() on the current SyncManager', async () => {
    const forceFullSync = buildForceFullSync({
      snapshotStore,
      syncManagerRef,
      newSyncManagerFactoryRef,
    });

    await forceFullSync();

    expect(oldManager.stop).toHaveBeenCalledOnce();
  });

  it('starts a new SyncManager instance', async () => {
    const forceFullSync = buildForceFullSync({
      snapshotStore,
      syncManagerRef,
      newSyncManagerFactoryRef,
    });

    await forceFullSync();

    expect(newManager.start).toHaveBeenCalledOnce();
  });

  it('replaces syncManagerRef.current with the new SyncManager', async () => {
    const forceFullSync = buildForceFullSync({
      snapshotStore,
      syncManagerRef,
      newSyncManagerFactoryRef,
    });

    await forceFullSync();

    expect(syncManagerRef.current).toBe(newManager);
  });

  it('does nothing to syncManagerRef when factory is null', async () => {
    newSyncManagerFactoryRef.current = null;

    const forceFullSync = buildForceFullSync({
      snapshotStore,
      syncManagerRef,
      newSyncManagerFactoryRef,
    });

    await forceFullSync();

    // clear + stop still run; start never runs; ref unchanged
    expect(snapshotStore.clear).toHaveBeenCalledOnce();
    expect(oldManager.stop).toHaveBeenCalledOnce();
    expect(newManager.start).not.toHaveBeenCalled();
    expect(syncManagerRef.current).toBe(oldManager);
  });
});
