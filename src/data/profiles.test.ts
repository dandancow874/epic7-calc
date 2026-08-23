import { beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, String(value)),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  };
}

describe('calculator profile persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('keeps manually edited panel values when the build preset is disabled', async () => {
    const profiles = await import('./profiles');
    await profiles.saveProfile('attacker', 'abigail', {
      useBuildPreset: false,
      attack: 4321,
      critDamage: 321,
      artifactId: 'noProc',
    });
    expect(profiles.loadProfile('attacker', 'abigail')).toMatchObject({
      useBuildPreset: false,
      attack: 4321,
      critDamage: 321,
    });
  });

  it('preserves the last manual panel while a build preset is enabled', async () => {
    const profiles = await import('./profiles');
    await profiles.saveProfile('attacker', 'abigail', {
      useBuildPreset: false,
      attack: 4321,
      critDamage: 321,
      artifactId: 'manual_artifact',
    });
    await profiles.saveProfile('attacker', 'abigail', {
      useBuildPreset: true,
      attack: 9999,
      critDamage: 350,
      artifactId: 'preset_artifact',
    });
    expect(profiles.loadProfile('attacker', 'abigail')).toMatchObject({
      useBuildPreset: true,
      attack: 4321,
      critDamage: 321,
      artifactId: 'manual_artifact',
    });
  });

  it('migrates the legacy attack imprint field without applying it as a general attack increase', async () => {
    const profiles = await import('./profiles');
    const migrated = profiles.migrateLegacyProfile({
      __profileName: '默认',
      attackIncreasePercent: 10,
    });
    expect(migrated).toMatchObject({
      attackImprint: 10,
    });
    expect(migrated.attackIncreasePercent).toBeUndefined();
  });
});
