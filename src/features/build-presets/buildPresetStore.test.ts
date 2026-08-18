import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTargetStats, type BuildPreset } from './types';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

const community: BuildPreset = {
  id: 'community:abigail', heroCode: 'abigail', name: '社区推荐', source: 'community',
  sets: ['speed', 'health'], artifactCode: 'a-daydream-joker', targetStats: { ...emptyTargetStats, spd: 240 },
};

describe('build preset storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('creates, edits and persists manual presets', async () => {
    const store = await import('./buildPresetStore');
    const created = await store.createManualBuildPreset('abigail', community);
    const saved = await store.saveBuildPreset({ ...created, name: '我的高速配置', targetStats: { ...created.targetStats, spd: 255 } });

    expect(store.listBuildPresets('abigail', community)).toContainEqual(saved);
    expect(JSON.parse(localStorage.getItem('epic7.tools.buildPresets.v1') || '{}').manual.abigail[0].targetStats.spd).toBe(255);
  });

  it('resets only the community override and retains manual presets', async () => {
    const store = await import('./buildPresetStore');
    const manual = await store.createManualBuildPreset('abigail', null);
    await store.saveBuildPreset({ ...community, name: '本地改过的推荐' });
    expect(store.listBuildPresets('abigail', community)[0].name).toBe('本地改过的推荐');

    await store.resetCommunityBuildPreset('abigail');
    const rows = store.listBuildPresets('abigail', community);
    expect(rows[0]).toMatchObject(community);
    expect(rows).toContainEqual(manual);
  });

  it('can hide a community preset with the same delete action as manual presets', async () => {
    const store = await import('./buildPresetStore');
    await store.deleteBuildPreset(community);
    expect(store.listBuildPresets('abigail', community)).toEqual([]);
    await store.resetCommunityBuildPreset('abigail');
    expect(store.listBuildPresets('abigail', community)[0]).toMatchObject(community);
  });
});
