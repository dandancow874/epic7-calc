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

  it('restores Boss HP and the Joker profile after a cold module reload', async () => {
    const profiles = await import('./profiles');
    await profiles.saveProfile('defender', 'abigail', {
      useBuildPreset: false,
      targetMaxHP: 233578,
      targetCurrentHP: 233578,
      targetDefense: 1950,
    });
    await profiles.saveProfile('attacker', 'alexa', {
      useBuildPreset: false,
      attack: 3000,
      artifactId: 'daydream_joker',
      artifactLevel: 30,
    });
    vi.resetModules();
    const restored = await import('./profiles');
    expect(restored.loadProfile('defender', 'abigail')).toMatchObject({
      useBuildPreset: false,
      targetMaxHP: 233578,
      targetCurrentHP: 233578,
      targetDefense: 1950,
    });
    expect(restored.loadProfile('attacker', 'alexa')).toMatchObject({
      useBuildPreset: false,
      attack: 3000,
      artifactId: 'daydream_joker',
      artifactLevel: 30,
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
