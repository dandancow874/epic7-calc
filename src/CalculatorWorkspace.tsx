import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Artifacts } from 'src/assets/data/artifacts';
import { Heroes } from 'src/assets/data/heroes';
import { FormDefaults } from 'src/app/models/forms';
import { HeroClass } from 'src/app/models/hero';
import { DoT } from 'src/app/models/skill';
import { DamageEngine } from './calc/damageEngine';
import type { BarrierValue, DamageRow, DamageValues, DotDamage } from './calc/damageEngine';
import { solveOpeningSpeeds, type AllySpeedInput, type EnemySpeedInput, type OpeningSpeedSolveResult } from './calc/speedSolver';
import { readReadinessFromScreenshot, type ReadinessRow } from './calc/screenshotReader';
import {
  advantageousElement,
  artifactAliases,
  artifactName,
  counterElement,
  fieldName,
  heroAliasText,
  heroEntries,
  heroName,
  heroNickname,
  hydrateAliasesFromDisk,
  isArtifactAllowed,
  saveHeroAliasText,
  setCatalogLanguage,
  skillIcon,
  skillName,
  type UiLanguage,
} from './data/catalog';
import { checkAssetsUpdate, importLatestAssets, loadAssetsMarker, type AssetsUpdateState } from './data/assetsUpdater';
import { createProfile, deleteProfile, hydrateProfilesFromDisk, listProfiles, loadProfile, renameProfile, saveProfile, selectProfile } from './data/profiles';
import type { ProfileSummary, ProfileValues, Side } from './data/profiles';
import { loadRecentHeroes, rememberHero } from './data/recents';
import { applyBuildToCalculator, calculatorArtifactIdForLibraryArtifact, calculatorBuildOptions, calculatorHeroCode, defaultCalculatorBuild, libraryArtifactForCalculatorId, loadCalculatorBuildCatalog, rememberCalculatorBuild, restoreManualBuildValues, withCalculatorArtifact, withCalculatorStat, type CalculatorBuildCatalog } from './features/build-presets/calculatorBuildBridge';
import { createManualBuildPreset, saveBuildPreset } from './features/build-presets/buildPresetStore';
import { withDerivedCalculatorFields } from './features/calculator/derivedFields';
import { equipmentSet } from './features/build-presets/setCatalog';
import type { BuildPreset } from './features/build-presets/types';
import { resolveDefenderArtifactEffects } from './features/defender-effects/defenderArtifactEffects';
import { defenderBattleMaxHP, mergeCalculatorValues, isLinkedTargetField } from './features/calculator/mergeCalculatorValues';
import { damageRemainingPercent } from './features/calculator/damageDisplay';
import type { LibraryArtifact } from './library/types';

type PickerState = null | 'attacker' | 'defender' | 'artifact' | 'defenderArtifact';
type ProfileModalState = null | Side;
type BuildModalState = null | Side;
type AliasModalState = null | { heroId: string };
type AppMode = 'damage' | 'speed' | 'cr';

const UI_SCALE_KEY = 'epic7.damageDesk.uiScale.v1';
const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.4;
const UI_SCALE_STEP = 0.1;

const numberFields = {
  attacker: [
    ['attack', '攻击', 200, 10000],
    ['critDamage', '爆伤', 150, 350],
    ['damageIncrease', '增伤', 0, 200],
    ['attackImprint', '攻击刻印(%)', 0, 50],
    ['attackIncrease', '攻击增加(%)', 0, 200],
  ],
  defender: [
    ['targetMaxHP', '生命', 1, 50000],
    ['targetDefense', '防御', 0, 5000],
    ['targetBarrier', '防护罩', 0, 100000],
    ['damageReduction', '减伤', 0, 100],
    ['additionalDamageReduction', '额外伤害减少', 0, 100],
    ['damageTransfer', '分摊', 0, 100],
    ['penetrationResistance', '穿透抗性', 0, 100],
  ],
} as const;

const mainAttackerBuffs = [
  ['elementalAdvantage', '属性克制', 'dynamic:advantage'],
  ['decreasedAttack', '攻击力降低', 'debuffs/attack-debuff.png'],
  ['attackUp', '攻击力提升', 'buffs/attack-buff.png'],
  ['attackUpGreat', '攻击力大幅提升', 'buffs/greater-attack-buff.png'],
] as const;

const extraAttackerBuffs = [
  ['increasedCritDamage', '爆伤提升', 'buffs/critical-hit-damage-buff.png'],
  ['casterVigor', '魄力', 'buffs/vigor-buff.png'],
  ['casterEnraged', '狂气', 'buffs/rage-buff.png'],
  ['casterRampage', '暴走', 'buffs/rampage-buff.png'],
  ['casterFury', '狂气', 'buffs/rage-buff.png'],
  ['casterPerception', '洞察', 'buffs/perception-buff.png'],
  ['casterHasStealth', '隐身', 'buffs/stealth-buff.png'],
  ['casterHasBarrier', '屏障', 'buffs/barrier-buff.png'],
  ['casterHasCascade', '暴走', 'buffs/cascade-buff.png'],
  ['casterHasAbundance', '丰饶', 'buffs/abundance-buff.png'],
  ['casterHasChallenge', '挑战', 'buffs/challenge-buff.png'],
  ['casterHasSpecialFriendship', '特别的友情', 'buffs/special-friendship-buff.png'],
  ['casterHasSuperhumanization', '超人化', 'buffs/superhumanization-buff.png'],
  ['casterIndomitable', '不屈', 'buffs/indomitable-buff.webp'],
  ['casterAttackMission', '攻击任务', 'buffs/attack-mission-buff.webp'],
  ['casterDefenseMission', '防御任务', 'buffs/defense-mission-buff.webp'],
  ['casterHasStellarKnowledge', '星辰知识', 'buffs/stellar-knowledge-buff.webp'],
  ['casterPilfered', '抢夺', 'debuffs/pilfer-debuff.png'],
  ['casterHasTrauma', '创伤', 'debuffs/trauma-debuff.png'],
  ['rageSet', '愤怒套', 'sets/rage-set.png'],
  ['fervorSet', '全力套装', 'sets/fervor-set.png'],
  ['penetrationSet', '穿透套', 'sets/penetration-set.png'],
  ['torrentSetStack', '激流套', 'sets/torrent-set.png'],
  ['pursuitSet', '追击套', 'sets/pursuit-set.png'],
] as const;

const stateGroups = [
  {
    title: '攻击增益',
    items: extraAttackerBuffs.slice(0, 17),
  },
  {
    title: '异常 / 减益',
    items: extraAttackerBuffs.slice(17, 19),
  },
  {
    title: '装备套装',
    items: extraAttackerBuffs.slice(19),
  },
] as const;

const defenderBuffs = [
  ['targetDefenseUp', '防守力提升', 'buffs/defense-buff.png'],
  ['targetVigor', '魄力', 'buffs/vigor-buff.png'],
  ['targetIndomitable', '不屈', 'buffs/indomitable-buff.webp'],
  ['targetDefenseDown', '防守力降低', 'debuffs/defense-debuff.png'],
  ['targetTargeted', '标靶', 'debuffs/target-debuff.png'],
  ['targetLaceration', '裂伤', 'debuffs/laceration-debuff.png'],
  ['targetPilfered', '抢夺', 'debuffs/pilfer-debuff.png'],
  ['targetHasTrauma', '创伤', 'debuffs/trauma-debuff.png'],
  ['targetMagicNailed', '魔法钉', 'debuffs/nail-debuff.png'],
  ['targetRuptured', '破裂', 'debuffs/rupture-debuff.png'],
  ['targetLingeringFragranceStack', '余香', 'buffs/lingering-fragrance-buff.png'],
] as const;

export function CalculatorWorkspace() {
  const [attackerId, setAttackerId] = useState(() => readCalculatorHero('attacker'));
  const [mode, setMode] = useState<AppMode>('damage');
  const [defenderId, setDefenderId] = useState(() => readCalculatorHero('defender'));
  const [artifactId, setArtifactId] = useState('noProc');
  const [attacker, setAttacker] = useState<ProfileValues>(() => loadProfile('attacker', 'abigail'));
  const [defender, setDefender] = useState<ProfileValues>(() => loadProfile('defender', 'abigail'));
  const [attackerProfileHeroId, setAttackerProfileHeroId] = useState('');
  const [defenderProfileHeroId, setDefenderProfileHeroId] = useState('');
  const [picker, setPicker] = useState<PickerState>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState>(null);
  const [buildModal, setBuildModal] = useState<BuildModalState>(null);
  const [aliasModal, setAliasModal] = useState<AliasModalState>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [, setAliasVersion] = useState(0);
  const [profileVersion, setProfileVersion] = useState(0);
  const [language, setLanguage] = useState<UiLanguage>(() => (localStorage.getItem('epic7.damageDesk.language.v1') === 'en' ? 'en' : 'cn'));
  const [assetsState, setAssetsState] = useState<AssetsUpdateState>(() => ({
    status: 'idle',
    localDate: loadAssetsMarker().date,
  }));
  const [recentHeroes, setRecentHeroes] = useState<Record<Side, string[]>>(() => ({
    attacker: loadRecentHeroes('attacker'),
    defender: loadRecentHeroes('defender'),
  }));
  const [query, setQuery] = useState('');
  const [uiScale, setUiScale] = useState(() => loadUiScale());
  const [buildCatalog, setBuildCatalog] = useState<CalculatorBuildCatalog | null>(null);
  const [profilesReady, setProfilesReady] = useState(false);
  const [attackerBuildId, setAttackerBuildId] = useState('');
  const [defenderBuildId, setDefenderBuildId] = useState('');
  const [buildVersion, setBuildVersion] = useState(0);
  const loadingAttackerProfileRef = useRef<string | null>(null);
  const loadingDefenderProfileRef = useRef<string | null>(null);
  const skipArtifactValidationRef = useRef<string | null>(null);
  const pendingBuildRef = useRef<Partial<Record<Side, BuildPreset>>>({});
  const buildSaveTimersRef = useRef<Partial<Record<Side, number>>>({});

  const hero = Heroes[attackerId] ?? Heroes.abigail;
  const targetHero = Heroes[defenderId] ?? Heroes.abigail;
  const artifact = Artifacts[artifactId] ?? Artifacts[artifactId.replaceAll('-', '_')] ?? Artifacts.noProc;
  const attackerLibraryArtifact = libraryArtifactForCalculatorId(artifactId, buildCatalog?.artifacts || []);
  const defenderArtifact = buildCatalog?.artifacts.find((item) => item.code === defender.defenderArtifactCode) || null;
  const attackerProfileName = useMemo(
    () => listProfiles('attacker', attackerId).find((profile) => profile.active)?.name || '默认',
    [attackerId, profileVersion],
  );
  const defenderProfileName = useMemo(
    () => listProfiles('defender', defenderId).find((profile) => profile.active)?.name || '默认',
    [defenderId, profileVersion],
  );
  const attackerBuilds = useMemo(() => calculatorBuildOptions(attackerId, buildCatalog), [attackerId, buildCatalog, profileVersion, buildVersion]);
  const defenderBuilds = useMemo(() => calculatorBuildOptions(defenderId, buildCatalog), [defenderId, buildCatalog, profileVersion, buildVersion]);
  const attackerHasAdditionalDamage = useMemo(() => {
    const code = buildCatalog ? calculatorHeroCode(attackerId, buildCatalog.heroes) : null;
    const libraryHero = code ? buildCatalog?.heroes.find((item) => item.code === code) : null;
    return Boolean(libraryHero?.skills.some((skill) =>
      skill.description.includes('额外伤害')
      || skill.multipliers?.some((group) => group.items.some((item) => item.label.includes('额外伤害'))),
    ));
  }, [attackerId, buildCatalog]);

  useEffect(() => {
    setCatalogLanguage(language);
    localStorage.setItem('epic7.damageDesk.language.v1', language);
    setAliasVersion((value) => value + 1);
  }, [language]);

  useEffect(() => {
    setCatalogLanguage(language);
  }, []);

  useEffect(() => {
    hydrateProfilesFromDisk().then((changed) => {
      if (!changed) return;
      const profile = loadProfile('attacker', attackerId);
      setAttacker(profile);
      setAttackerProfileHeroId(attackerId);
      setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
      setDefender(loadProfile('defender', defenderId));
      setDefenderProfileHeroId(defenderId);
      setProfileVersion((value) => value + 1);
    }).finally(() => setProfilesReady(true));
    loadCalculatorBuildCatalog().then(setBuildCatalog).catch((error) => console.error('Unable to load equipment presets', error));
    hydrateAliasesFromDisk().then((changed) => {
      if (changed) setAliasVersion((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    document.body.style.zoom = String(uiScale);
    localStorage.setItem(UI_SCALE_KEY, String(uiScale));
  }, [uiScale]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setUiScale((value) => clampScale(value + (event.deltaY < 0 ? UI_SCALE_STEP : -UI_SCALE_STEP)));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.key !== '0') return;
      event.preventDefault();
      setUiScale(1);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const profile = loadProfile('attacker', attackerId);
    loadingAttackerProfileRef.current = attackerId;
    skipArtifactValidationRef.current = attackerId;
    setAttacker(profile);
    setAttackerProfileHeroId(attackerId);
    setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
  }, [attackerId]);

  useEffect(() => {
    loadingDefenderProfileRef.current = defenderId;
    setDefender(loadProfile('defender', defenderId));
    setDefenderProfileHeroId(defenderId);
  }, [defenderId]);

  useEffect(() => { localStorage.setItem('epic7.tools.calculatorHero.attacker.v1', attackerId); }, [attackerId]);
  useEffect(() => { localStorage.setItem('epic7.tools.calculatorHero.defender.v1', defenderId); }, [defenderId]);

  useEffect(() => {
    if (!buildCatalog || !profilesReady) return;
    if (attackerProfileHeroId !== attackerId) return;
    if (attacker.useBuildPreset === false) {
      setAttackerBuildId(defaultCalculatorBuild('attacker', attackerId, calculatorBuildOptions(attackerId, buildCatalog))?.id || '');
      return;
    }
    const preset = defaultCalculatorBuild('attacker', attackerId, calculatorBuildOptions(attackerId, buildCatalog));
    setAttackerBuildId(preset?.id || '');
    if (!preset) return;
    rememberCalculatorBuild('attacker', attackerId, preset.id);
    skipArtifactValidationRef.current = attackerId;
    setAttacker((current) => {
      const applied = applyBuildToCalculator('attacker', preset, buildCatalog, current);
      setArtifactId(applied.artifactId || 'noProc');
      return applied.values;
    });
  }, [attackerId, attackerProfileHeroId, buildCatalog, profilesReady, profileVersion, buildVersion, attacker.useBuildPreset]);

  useEffect(() => {
    if (!buildCatalog || !profilesReady) return;
    if (defenderProfileHeroId !== defenderId) return;
    if (defender.useBuildPreset === false) {
      setDefenderBuildId(defaultCalculatorBuild('defender', defenderId, calculatorBuildOptions(defenderId, buildCatalog))?.id || '');
      return;
    }
    const preset = defaultCalculatorBuild('defender', defenderId, calculatorBuildOptions(defenderId, buildCatalog));
    setDefenderBuildId(preset?.id || '');
    if (!preset) return;
    rememberCalculatorBuild('defender', defenderId, preset.id);
    setDefender((current) => applyBuildToCalculator('defender', preset, buildCatalog, current).values);
  }, [defenderId, defenderProfileHeroId, buildCatalog, profilesReady, profileVersion, buildVersion, defender.useBuildPreset]);

  useEffect(() => {
    if (attackerProfileHeroId !== attackerId) return;
    if (loadingAttackerProfileRef.current === attackerId) {
      loadingAttackerProfileRef.current = null;
      return;
    }
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      saveProfile('attacker', attackerId, { ...attacker, artifactId }).then(() => setSaveState('saved'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [attacker, attackerId, attackerProfileHeroId, artifactId]);

  useEffect(() => {
    if (defenderProfileHeroId !== defenderId) return;
    if (loadingDefenderProfileRef.current === defenderId) {
      loadingDefenderProfileRef.current = null;
      return;
    }
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      saveProfile('defender', defenderId, defender).then(() => setSaveState('saved'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [defender, defenderId, defenderProfileHeroId]);

  useEffect(() => {
    const auto = advantageousElement(hero.element, targetHero.element);
    setAttacker((value) => ({ ...value, elementalAdvantage: auto }));
  }, [attackerId, defenderId, hero.element, targetHero.element]);

  useEffect(() => {
    if (skipArtifactValidationRef.current === attackerId) {
      skipArtifactValidationRef.current = null;
      return;
    }
    if (!isArtifactAllowed(artifact, attackerId, hero.class)) {
      setArtifactId('noProc');
    }
  }, [artifact, attackerId, hero.class]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPicker(null);
      setMoreOpen(false);
      setProfileModal(null);
      setBuildModal(null);
      setAliasModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const mergedValues = useMemo(
    () => mergeCalculatorValues(attacker, defender, attacker.useDefenderPresetValues !== false),
    [attacker, defender],
  );

  const rows = useMemo<DamageRow[]>(() => {
    try {
      return new DamageEngine(attackerId, artifactId, mergedValues).updateDamages();
    } catch (error) {
      console.error(error);
      return [];
    }
  }, [attackerId, artifactId, mergedValues]);

  const artifactDamage = useMemo(() => {
    try {
      return new DamageEngine(attackerId, artifactId, mergedValues).getArtifactDamage();
    } catch {
      return 0;
    }
  }, [attackerId, artifactId, mergedValues]);

  const dotDamages = useMemo<DotDamage[]>(() => {
    try {
      return new DamageEngine(attackerId, artifactId, mergedValues).getDotDamages();
    } catch {
      return [];
    }
  }, [attackerId, artifactId, mergedValues]);

  const targetFinalMaxHP = useMemo(() => {
    try {
      return new DamageEngine(attackerId, artifactId, mergedValues).form.targetFinalMaxHP();
    } catch {
      return Number(mergedValues.targetMaxHP || 0);
    }
  }, [attackerId, artifactId, mergedValues]);

  const barriers = useMemo<BarrierValue[]>(() => {
    try {
      return new DamageEngine(attackerId, artifactId, mergedValues).getBarriers();
    } catch {
      return [];
    }
  }, [attackerId, artifactId, mergedValues]);

  useEffect(() => {
    const effects = resolveDefenderArtifactEffects(defenderArtifact, Number(defender.defenderArtifactLevel ?? 30));
    setDefender((current) => {
      const battleMaxHP = defenderBattleMaxHP({ ...current, targetMaxHPIncrease: effects.hpIncrease });
      const next: ProfileValues = {
        ...current,
        targetMaxHPIncrease: effects.hpIncrease,
        targetDefenseIncrease: effects.defenseIncrease,
        damageReduction: effects.damageReduction,
        damageTransfer: effects.damageTransfer,
        targetBarrier: Math.round(battleMaxHP * effects.barrierPercent / 100),
      };
      return (['targetMaxHPIncrease', 'targetDefenseIncrease', 'damageReduction', 'damageTransfer', 'targetBarrier'] as const)
        .every((key) => current[key] === next[key]) ? current : next;
    });
  }, [defenderArtifact, defender.defenderArtifactCode, defender.defenderArtifactLevel, defender.targetMaxHP, defender.targetLingeringFragranceStack]);

  const updateSide = (side: Side, key: string, value: number | boolean) => {
    const updatedPreset = typeof value === 'number' ? queueBuildStatSave(side, key, value) : null;
    if (side === 'attacker') setAttacker((prev) => {
      const next: ProfileValues = {
        ...prev,
        [key]: value,
        ...(updatedPreset && key === 'artifactLevel' ? {
        attack: updatedPreset.targetStats.atk,
        casterMaxHP: updatedPreset.targetStats.hp,
        casterDefense: updatedPreset.targetStats.def,
      } : {}),
      };
      if (next.useBuildPreset === false) void saveProfile('attacker', attackerId, { ...next, artifactId });
      return next;
    });
    if (side === 'defender') setDefender((prev) => {
      const next: ProfileValues = {
        ...prev,
        [key]: value,
        ...(updatedPreset && key === 'defenderArtifactLevel' ? {
        targetMaxHP: updatedPreset.targetStats.hp,
        targetCurrentHP: updatedPreset.targetStats.hp,
        targetDefense: updatedPreset.targetStats.def,
      } : {}),
      };
      if (next.useBuildPreset === false) void saveProfile('defender', defenderId, next);
      return next;
    });
  };

  const queueBuildStatSave = (side: Side, key: string, value: number) => {
    if ((side === 'attacker' ? attacker : defender).useBuildPreset === false) return null;
    const options = side === 'attacker' ? attackerBuilds : defenderBuilds;
    const activeId = side === 'attacker' ? attackerBuildId : defenderBuildId;
    const base = pendingBuildRef.current[side] || options.find((preset) => preset.id === activeId);
    if (!base) return null;
    const next = withCalculatorStat(base, side, key, value, buildCatalog?.artifacts || []);
    if (next === base) return null;
    pendingBuildRef.current[side] = next;
    const previousTimer = buildSaveTimersRef.current[side];
    if (previousTimer) window.clearTimeout(previousTimer);
    buildSaveTimersRef.current[side] = window.setTimeout(() => {
      const pending = pendingBuildRef.current[side];
      if (!pending) return;
      saveBuildPreset(pending).then(() => {
        delete pendingBuildRef.current[side];
        setBuildVersion((version) => version + 1);
      });
    }, 350);
    return next;
  };

  const queueBuildArtifactSave = (side: Side, id: string, level: number) => {
    if ((side === 'attacker' ? attacker : defender).useBuildPreset === false) return null;
    if (!buildCatalog) return null;
    const options = side === 'attacker' ? attackerBuilds : defenderBuilds;
    const activeId = side === 'attacker' ? attackerBuildId : defenderBuildId;
    const base = pendingBuildRef.current[side] || options.find((preset) => preset.id === activeId);
    if (!base) return null;
    const next = withCalculatorArtifact(base, id, level, buildCatalog.artifacts);
    pendingBuildRef.current[side] = next;
    const previousTimer = buildSaveTimersRef.current[side];
    if (previousTimer) window.clearTimeout(previousTimer);
    buildSaveTimersRef.current[side] = window.setTimeout(() => {
      const pending = pendingBuildRef.current[side];
      if (!pending) return;
      saveBuildPreset(pending).then(() => {
        delete pendingBuildRef.current[side];
        setBuildVersion((version) => version + 1);
      });
    }, 350);
    return next;
  };

  const updateSkillLevel = (skill: string, value: number) => {
    const key = `molagoras${skill.replace(/\D/g, '') || '1'}`;
    updateSide('attacker', key, value);
  };

  const flushAttackerProfile = (nextValues: ProfileValues = attacker, nextArtifactId: string = artifactId) => {
    void saveProfile('attacker', attackerId, { ...nextValues, artifactId: nextArtifactId });
  };

  const toggleBuildPreset = (side: Side, checked: boolean) => {
    const options = side === 'attacker' ? attackerBuilds : defenderBuilds;
    const activeId = side === 'attacker' ? attackerBuildId : defenderBuildId;
    const preset = options.find((item) => item.id === activeId) || options[0] || null;
    if (side === 'attacker') {
      setAttacker((current) => {
        const stored = loadProfile('attacker', attackerId);
        const next: ProfileValues = checked
          ? { ...current, useBuildPreset: true }
          : { ...restoreManualBuildValues('attacker', current, stored), useBuildPreset: false };
        if (!checked) {
          const restoredArtifactId = typeof next.artifactId === 'string' ? next.artifactId : artifactId;
          setArtifactId(restoredArtifactId);
          void saveProfile('attacker', attackerId, { ...next, artifactId: restoredArtifactId });
          return next;
        }
        if (!preset || !buildCatalog) return next;
        const applied = applyBuildToCalculator('attacker', preset, buildCatalog, next);
        setArtifactId(applied.artifactId || 'noProc');
        return applied.values;
      });
    } else {
      setDefender((current) => {
        const stored = loadProfile('defender', defenderId);
        const next: ProfileValues = checked
          ? { ...current, useBuildPreset: true }
          : { ...restoreManualBuildValues('defender', current, stored), useBuildPreset: false };
        if (!checked) {
          void saveProfile('defender', defenderId, next);
          return next;
        }
        return checked && preset && buildCatalog ? applyBuildToCalculator('defender', preset, buildCatalog, next).values : next;
      });
    }
  };

  useEffect(() => {
    const flushProfiles = () => {
      void saveProfile('attacker', attackerId, { ...attacker, artifactId });
      void saveProfile('defender', defenderId, defender);
    };
    window.addEventListener('beforeunload', flushProfiles);
    return () => window.removeEventListener('beforeunload', flushProfiles);
  }, [attacker, attackerId, artifactId, defender, defenderId]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Epic Seven</span>
          <h1>{mode === 'damage' ? '伤害计算器' : mode === 'speed' ? '速度推算' : '速攻值推算'}</h1>
        </div>
        <div className="mode-switch" role="tablist" aria-label="工具模式">
          <button className={mode === 'damage' ? 'active' : ''} onClick={() => setMode('damage')}>伤害计算</button>
          <button className={mode === 'speed' ? 'active' : ''} onClick={() => setMode('speed')}>速度推算</button>
          <button className={mode === 'cr' ? 'active' : ''} onClick={() => setMode('cr')}>速攻值推算</button>
        </div>
        <div className="top-actions">
          <span className={`save-state ${saveState}`}>
            {saveState === 'saved' && <Check size={16} />}
            {saveState === 'saved' ? '已保存' : '保存中'}
          </span>
          <button
            className="language-button"
            onClick={() => setLanguage((value) => {
              const next = value === 'cn' ? 'en' : 'cn';
              setCatalogLanguage(next);
              localStorage.setItem('epic7.damageDesk.language.v1', next);
              return next;
            })}
            title="切换 CN / EN"
          >
            {language.toUpperCase()} <ChevronDown size={16} />
          </button>
          <button
            className={`asset-update-button ${assetsState.status}`}
            onClick={async () => {
              setAssetsState((state) => ({ ...state, status: 'checking', message: '检查中' }));
              const checked = await checkAssetsUpdate();
              if (checked.status !== 'available') {
                setAssetsState(checked);
                return;
              }
              setAssetsState({ ...checked, status: 'importing', message: '导入中' });
              setAssetsState(await importLatestAssets());
            }}
            title={assetUpdateTitle(assetsState)}
            aria-label="导入最新 assets 数据"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {mode === 'damage' ? (
        <>
          <section className="duel-grid">
            <CombatPanel
              side="attacker"
              heroId={attackerId}
              artifactId={artifactId}
              attackerLibraryArtifact={attackerLibraryArtifact}
              values={mergedValues}
              title="攻击对象"
              tone="attack"
              profileName={attackerProfileName}
              buildOptions={attackerBuilds}
              buildId={attackerBuildId}
              onHeroPick={() => openPicker('attacker')}
              onAliasOpen={() => setAliasModal({ heroId: attackerId })}
              onArtifactPick={() => openPicker('artifact')}
              onProfileOpen={() => setProfileModal('attacker')}
              onBuildOpen={() => setBuildModal('attacker')}
              onValueChange={updateSide}
              onMoreOpen={() => setMoreOpen(true)}
              useDefenderPreset={attacker.useDefenderPresetValues !== false}
              onUseDefenderPreset={(checked) => updateSide('attacker', 'useDefenderPresetValues', checked)}
              useBuildPreset={attacker.useBuildPreset !== false}
              onUseBuildPreset={(checked) => toggleBuildPreset('attacker', checked)}
              hasAdditionalDamage={attackerHasAdditionalDamage}
            />
            <CombatPanel
              side="defender"
              heroId={defenderId}
              values={defender}
              title="防守对象"
              tone="defense"
              profileName={defenderProfileName}
              defenderArtifact={defenderArtifact}
              buildOptions={defenderBuilds}
              buildId={defenderBuildId}
              onHeroPick={() => openPicker('defender')}
              onAliasOpen={() => setAliasModal({ heroId: defenderId })}
              onProfileOpen={() => setProfileModal('defender')}
              onBuildOpen={() => setBuildModal('defender')}
              onArtifactPick={() => openPicker('defenderArtifact')}
              onValueChange={updateSide}
              useBuildPreset={defender.useBuildPreset !== false}
              onUseBuildPreset={(checked) => toggleBuildPreset('defender', checked)}
            />
          </section>

          <DamageTable
            heroId={attackerId}
            hero={hero}
            rows={rows}
            values={attacker}
            dotDamages={dotDamages}
            barriers={barriers}
            artifactDamage={artifactDamage}
            artifactId={artifactId}
            targetMaxHP={targetFinalMaxHP}
            targetBarrier={Number(defender.targetBarrier || 0)}
            onSkillLevel={updateSkillLevel}
          />
        </>
      ) : mode === 'speed' ? (
        <SpeedSolverPage />
      ) : (
        <CombatReadinessPage />
      )}

      {picker && (
        <Picker
          mode={picker}
          query={query}
          attackerId={attackerId}
          attackerClass={hero.class}
          defenderClass={targetHero.class}
          libraryArtifacts={buildCatalog?.artifacts || []}
          recentHeroes={picker === 'defender' ? recentHeroes.defender : recentHeroes.attacker}
          onQuery={setQuery}
          onClose={() => setPicker(null)}
          onSelectHero={(id) => {
            if (picker === 'attacker') {
              flushAttackerProfile();
              setAttackerId(id);
            }
            if (picker === 'defender') setDefenderId(id);
            const side = picker === 'defender' ? 'defender' : 'attacker';
            setRecentHeroes((prev) => ({ ...prev, [side]: rememberHero(side, id) }));
            setPicker(null);
          }}
          onSelectArtifact={(id) => {
            const updatedPreset = queueBuildArtifactSave('attacker', id, 30);
            const nextAttacker = {
              ...attacker,
              artifactId: id,
              artifactLevel: 30,
              ...(updatedPreset ? {
                attack: updatedPreset.targetStats.atk,
                casterMaxHP: updatedPreset.targetStats.hp,
                casterDefense: updatedPreset.targetStats.def,
              } : {}),
            };
            setArtifactId(id);
            setAttacker(nextAttacker);
            flushAttackerProfile(nextAttacker, id);
            setPicker(null);
            window.setTimeout(() => {
              const input = document.querySelector<HTMLInputElement>('[data-artifact-level]');
              input?.focus();
              input?.select();
            }, 50);
          }}
          onSelectDefenderArtifact={(code) => {
            const updatedPreset = queueBuildArtifactSave('defender', code, 30);
            setDefender((current) => ({
              ...current,
              defenderArtifactCode: code,
              defenderArtifactLevel: 30,
              ...(updatedPreset ? {
                targetMaxHP: updatedPreset.targetStats.hp,
                targetCurrentHP: updatedPreset.targetStats.hp,
                targetDefense: updatedPreset.targetStats.def,
              } : {}),
            }));
            setPicker(null);
          }}
        />
      )}

      {moreOpen && (
        <StateModal
          values={attacker}
          onClose={() => setMoreOpen(false)}
          onChange={(key, value) => updateSide('attacker', key, value)}
        />
      )}

      {profileModal && (
        <ProfileModal
          side={profileModal}
          heroId={profileModal === 'attacker' ? attackerId : defenderId}
          profiles={listProfiles(profileModal, profileModal === 'attacker' ? attackerId : defenderId)}
          onSelect={async (index) => {
            const profile = await selectProfile(profileModal, profileModal === 'attacker' ? attackerId : defenderId, index);
            if (profileModal === 'attacker') {
              loadingAttackerProfileRef.current = attackerId;
              skipArtifactValidationRef.current = attackerId;
              setAttacker(profile);
              setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
            } else {
              setDefender(profile);
            }
            setProfileVersion((value) => value + 1);
          }}
          onCreate={async () => {
            const side = profileModal;
            const heroId = side === 'attacker' ? attackerId : defenderId;
            const values = side === 'attacker' ? { ...attacker, artifactId } : defender;
            const profile = await createProfile(side, heroId, values);
            if (side === 'attacker') {
              loadingAttackerProfileRef.current = attackerId;
              skipArtifactValidationRef.current = attackerId;
              setAttacker(profile);
              setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
            } else {
              setDefender(profile);
            }
            setProfileVersion((value) => value + 1);
          }}
          onRename={async (index, name) => {
            const side = profileModal;
            await renameProfile(side, side === 'attacker' ? attackerId : defenderId, index, name);
            setProfileVersion((value) => value + 1);
          }}
          onDelete={async (index) => {
            const side = profileModal;
            const heroId = side === 'attacker' ? attackerId : defenderId;
            const profile = await deleteProfile(side, heroId, index);
            if (side === 'attacker') {
              loadingAttackerProfileRef.current = attackerId;
              skipArtifactValidationRef.current = attackerId;
              setAttacker(profile);
              setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
            } else {
              setDefender(profile);
            }
            setProfileVersion((value) => value + 1);
          }}
          onClose={() => setProfileModal(null)}
        />
      )}

      {buildModal && (() => {
        const side = buildModal;
        const heroId = side === 'attacker' ? attackerId : defenderId;
        const options = side === 'attacker' ? attackerBuilds : defenderBuilds;
        const activeId = side === 'attacker' ? attackerBuildId : defenderBuildId;
        const selectBuild = (preset: BuildPreset) => {
          if (!buildCatalog) return;
          rememberCalculatorBuild(side, heroId, preset.id);
          if (side === 'attacker') {
            setAttackerBuildId(preset.id);
            skipArtifactValidationRef.current = attackerId;
            const applied = applyBuildToCalculator(side, preset, buildCatalog, attacker);
            setAttacker({ ...applied.values, useBuildPreset: true });
            setArtifactId(applied.artifactId || 'noProc');
          } else {
            setDefenderBuildId(preset.id);
            setDefender({ ...applyBuildToCalculator(side, preset, buildCatalog, defender).values, useBuildPreset: true });
          }
        };
        return <BuildPresetModal
          side={side}
          heroId={heroId}
          presets={options}
          activeId={activeId}
          onSelect={selectBuild}
          onCreate={async () => {
            const heroCode = buildCatalog ? calculatorHeroCode(heroId, buildCatalog.heroes) : null;
            if (!heroCode) return;
            const base = options.find((preset) => preset.id === activeId) || options[0] || null;
            const created = await createManualBuildPreset(heroCode, base);
            setBuildVersion((version) => version + 1);
            selectBuild(created);
          }}
          onRename={async (preset) => {
            const name = window.prompt('预设名称', preset.name)?.trim();
            if (!name) return;
            await saveBuildPreset({ ...preset, name: name.slice(0, 24) });
            setBuildVersion((version) => version + 1);
          }}
          onClose={() => setBuildModal(null)}
        />;
      })()}

      {aliasModal && (
        <AliasModal
          heroId={aliasModal.heroId}
          onClose={() => setAliasModal(null)}
          onSave={(text) => {
            saveHeroAliasText(aliasModal.heroId, text);
            setAliasVersion((version) => version + 1);
            setAliasModal(null);
          }}
        />
      )}
    </main>
  );

  function openPicker(next: PickerState) {
    setPicker(next);
    setQuery('');
  }
}

function CombatPanel(props: {
  side: Side;
  heroId: string;
  artifactId?: string;
  attackerLibraryArtifact?: LibraryArtifact | null;
  values: ProfileValues;
  title: string;
  tone: 'attack' | 'defense';
  profileName: string;
  buildOptions: BuildPreset[];
  buildId: string;
  defenderArtifact?: LibraryArtifact | null;
  onHeroPick: () => void;
  onAliasOpen: () => void;
  onArtifactPick?: () => void;
  onProfileOpen?: () => void;
  onBuildOpen: () => void;
  onValueChange: (side: Side, key: string, value: number | boolean) => void;
  onMoreOpen?: () => void;
  useDefenderPreset?: boolean;
  onUseDefenderPreset?: (checked: boolean) => void;
  useBuildPreset: boolean;
  onUseBuildPreset: (checked: boolean) => void;
  hasAdditionalDamage?: boolean;
}) {
  const hero = Heroes[props.heroId] ?? Heroes.abigail;
  const artifact = props.artifactId ? Artifacts[props.artifactId] : null;
  const fields = numberFields[props.side];
  const specialFields = props.side === 'attacker'
    ? uniqueFields(withDerivedCalculatorFields([
      ...(hero.heroSpecific || []),
      ...(artifact?.artifactSpecific || []),
      ...(props.hasAdditionalDamage ? ['casterHasStellarKnowledge'] : []),
    ], props.heroId))
      .filter((field) => !fields.some(([key]) => key === field))
      .filter((field) => !mainAttackerBuffs.some(([key]) => key === field))
    : [];
  const activeExtraBuffs = extraAttackerBuffs
    .filter(([key]) => Boolean(props.values[key]))
    .filter(([key]) => !specialFields.includes(key));
  const buffs = props.side === 'attacker'
    ? [...mainAttackerBuffs, ...activeExtraBuffs]
    : [
      ...defenderBuffs,
      ...(props.heroId === 'lisette'
        ? [['targetDivinityStack', '神圣', 'buffs/divinity-buff.webp'] as const]
        : []),
    ];

  return (
    <section className={`combat-panel ${props.tone}`}>
      <div className="panel-head">
        <button className="portrait-button" onClick={props.onHeroPick} aria-label="选择英雄">
          <img src={`/assets/heroes/${props.heroId}-icon.png`} onError={fallback('/assets/heroes/missing.png')} alt={heroName(props.heroId)} />
        </button>
        <div className="identity">
          <span>{props.title}</span>
          <button className="hero-name-button" onClick={props.onAliasOpen} title="编辑角色别名">
            {heroName(props.heroId)}
          </button>
          <div className="meta-icons">
            <img src={`/assets/elements/${hero.element}.png`} alt={hero.element} />
            <img src={`/assets/classes/${hero.class}.png`} alt={hero.class} />
          </div>
        </div>
        {props.side === 'attacker' && (artifact || props.attackerLibraryArtifact) && (
          <div className="artifact-button">
            <button className="artifact-icon-button" onClick={props.onArtifactPick} aria-label="选择神器" title={props.buildId ? '修改后实时保存到当前装备预设' : '选择神器'}>
              <img src={props.attackerLibraryArtifact?.image || `/assets/artifacts/${artifact?.id || 'noProc'}.png`} onError={fallback('/assets/artifacts/noProc.png')} alt={props.attackerLibraryArtifact?.name || artifactName(artifact?.id || 'noProc')} />
            </button>
            <NumberDraftInput
              dataArtifactLevel
              value={Number(props.values.artifactLevel ?? 30)}
              min={0}
              max={30}
              emptyValue={30}
              blankWhenEmpty={false}
              ariaLabel="神器等级"
              onCommit={(value) => props.onValueChange('attacker', 'artifactLevel', value)}
            />
          </div>
        )}
        {props.side === 'defender' && (
          <div className="artifact-button">
            <button className="artifact-icon-button" onClick={props.onArtifactPick} aria-label="选择防守神器" title="选择防守装备预设中的神器">
              <img src={props.defenderArtifact?.image || '/assets/artifacts/noProc.png'} onError={fallback('/assets/artifacts/noProc.png')} alt={props.defenderArtifact?.name || '未选择神器'} />
            </button>
            <NumberDraftInput
              value={Number(props.values.defenderArtifactLevel ?? 30)}
              min={0}
              max={30}
              emptyValue={30}
              blankWhenEmpty={false}
              ariaLabel="防守神器等级"
              onCommit={(value) => {
                props.onValueChange('defender', 'defenderArtifactLevel', value);
              }}
            />
          </div>
        )}
      </div>

      <div className="calculator-build-row">
        <button type="button" className={`calculator-build-select ${props.buildId ? 'linked' : ''}`} onClick={props.onBuildOpen}>
          <span>装备预设</span>
          <strong>{props.buildOptions.find((preset) => preset.id === props.buildId)?.name || '该角色暂无可用预设'}</strong>
          <ChevronDown size={18} />
          {props.buildId && <small>{props.buildOptions.find((preset) => preset.id === props.buildId)?.sets.map((code) => equipmentSet(code).name).join(' · ') || '未选择套装'}</small>}
        </button>
        <label className="build-use-toggle" title={props.buildId ? '启用时使用并锁定装备预设面板' : '该角色暂无可用装备预设'}>
          <input
            type="checkbox"
            checked={props.useBuildPreset}
            disabled={!props.buildId}
            onChange={(event) => props.onUseBuildPreset(event.target.checked)}
          />
          <span>使用预设</span>
        </label>
      </div>

      <div className="field-stack">
        {fields.map(([key, label, min, max]) => (
          <StatField
            key={key}
            label={label}
            value={Number(props.values[key] ?? min)}
            min={min}
            max={max}
            locked={props.useBuildPreset && Boolean(props.buildId) && isBuildOwnedVisibleField(props.side, key)}
            onChange={(value) => props.onValueChange(props.side, key, value)}
          />
        ))}
      </div>

      {props.side === 'attacker' && <h3 className="section-label">角色特性</h3>}

      {props.side === 'attacker' && specialFields.some(isLinkedTargetField) && (
        <label className="preset-link-toggle">
          <input type="checkbox" checked={props.useDefenderPreset !== false} onChange={(event) => props.onUseDefenderPreset?.(event.target.checked)} />
          <span>套用防守对象数值</span>
        </label>
      )}

      {specialFields.length > 0 && (
        <div className="special-grid">
          {specialFields.map((field) => (
            <SpecialInput
              key={field}
              field={field}
              value={props.values[field]}
              maximum={hero.heroSpecificMaximums?.[field] ?? artifact?.artifactSpecificMaximums?.[field]}
              locked={props.useDefenderPreset !== false && isLinkedTargetField(field)}
              onChange={(value) => props.onValueChange(props.side, field, value)}
            />
          ))}
        </div>
      )}

      <div className="buff-row">
        {buffs.map(([key, label, icon]) => {
          const stackLimit = key === 'torrentSetStack'
            ? 3
            : key === 'targetLingeringFragranceStack'
              ? 5
              : key === 'targetDivinityStack'
                ? 4
                : 0;
          const stackCount = stackLimit ? Math.min(stackLimit, Math.max(0, Number(props.values[key] || 0))) : 0;
          return (
            <Chip
              key={key}
              label={stackCount ? `${label} ${stackCount}` : label}
              icon={icon === 'dynamic:advantage' ? `elements/${counterElement(hero.element)}.png` : icon}
              checked={Boolean(props.values[key])}
              onChange={(checked) => props.onValueChange(
                props.side,
                key,
                stackLimit ? (stackCount >= stackLimit ? 0 : stackCount + 1) : checked,
              )}
            />
          );
        })}
        {props.side === 'attacker' && (
          <button className="more-chip" onClick={props.onMoreOpen}><MoreHorizontal size={18} /> 更多</button>
        )}
      </div>
    </section>
  );
}

function SpecialInput(props: {
  field: string;
  value: unknown;
  maximum?: number;
  locked?: boolean;
  onChange: (value: number | boolean) => void;
}) {
  const [draft, setDraft] = useState(String(props.value ?? FormDefaults[props.field]?.defaultValue ?? ''));
  useEffect(() => {
    setDraft(String(props.value ?? FormDefaults[props.field]?.defaultValue ?? ''));
  }, [props.field, props.value]);

  const config = FormDefaults[props.field];
  const isBoolean = typeof config?.default === 'boolean' || booleanFieldFallback(props.field);
  const isNumeric = !isBoolean && (typeof config?.defaultValue === 'number' || typeof props.maximum === 'number' || numericFieldFallback(props.field));
  if (!isNumeric) {
    return (
      <Chip
        label={shortFieldName(props.field)}
        icon={config?.icon || 'icons/help-circle-outline.svg'}
        checked={Boolean(props.value ?? config?.default ?? false)}
        onChange={props.onChange}
      />
    );
  }

  const min = config?.min ?? 0;
  const max = props.maximum ?? config?.max ?? 100;
  const value = Number(props.value ?? config?.defaultValue ?? min);
  return (
    <label className="special-input">
      <span title={fieldName(props.field)}>{shortFieldName(props.field)}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        disabled={props.locked}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next !== '' && !Number.isNaN(Number(next))) props.onChange(Number(next));
        }}
        onBlur={() => {
          const next = clampNumber(draft, min, max);
          setDraft(String(next));
          props.onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function StatField(props: { label: string; value: number; min: number; max: number; locked?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="stat-field">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        disabled={props.locked}
        onChange={(event) => props.onChange(clampNumber(event.target.value, props.min, props.max))}
      />
      {props.locked ? <output className="number-box locked-number">{props.value}</output> : <NumberDraftInput
        className="number-box"
        min={props.min}
        max={props.max}
        value={props.value}
        emptyValue={props.min}
        blankWhenEmpty={false}
        onCommit={props.onChange}
      />}
    </label>
  );
}

function isBuildOwnedVisibleField(side: Side, key: string) {
  return side === 'attacker'
    ? key === 'attack' || key === 'critDamage'
    : key === 'targetMaxHP' || key === 'targetDefense';
}

function Chip(props: { label: string; icon: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button className={`chip ${props.checked ? 'checked' : ''}`} onClick={() => props.onChange(!props.checked)}>
      <span className="checkmark">{props.checked ? '✓' : ''}</span>
      <img src={`/assets/${props.icon}`} onError={fallback('/assets/icons/help-circle-outline.svg')} alt="" />
      {props.label}
    </button>
  );
}

function DamageTable(props: {
  heroId: string;
  hero: typeof Heroes.abigail;
  rows: DamageRow[];
  values: ProfileValues;
  dotDamages: DotDamage[];
  barriers: BarrierValue[];
  artifactDamage: number;
  artifactId: string;
  targetMaxHP: number;
  targetBarrier: number;
  onSkillLevel: (skill: string, value: number) => void;
}) {
  const hasBadges = props.dotDamages.length > 0 || props.barriers.length > 0 || props.artifactDamage > 0;
  return (
    <section className="damage-dock">
      {hasBadges && (
        <div className="damage-source-bar">
          <span className="damage-source-title">追加来源</span>
          <div className="damage-source-list">
            {props.dotDamages.map((item) => (
              <DamageSourceBadge
                key={item.type}
                icon={`/assets/debuffs/${item.type}-debuff.png`}
                label={dotLabel(item.type)}
                value={item.value}
              />
            ))}
            {props.artifactDamage > 0 && (
              <DamageSourceBadge
                icon="/assets/icons/artifact.png"
                label={artifactName(props.artifactId)}
                value={props.artifactDamage}
              />
            )}
            {props.barriers.map((barrier) => (
              <DamageSourceBadge
                key={`barrier-${barrier.label}`}
                icon="/assets/buffs/barrier-buff.png"
                label={`${barrierLabel(barrier.label)} 护盾`}
                value={barrier.value}
              />
            ))}
          </div>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>技能</th>
            <th>暴击</th>
            <th>强击</th>
            <th>普通</th>
            <th>闪避</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const base = row.skill.match(/s[123]/)?.[0] || 's1';
            const levelKey = `molagoras${base.slice(1)}`;
            const max = props.hero.skills[base]?.enhance.length || 0;
            return (
              <React.Fragment key={row.skill}>
                <tr className={row.breakdown ? 'damage-total-row' : undefined}>
                  <td>
                    <span className="skill-cell">
                      <img src={skillIcon(props.heroId, row.skill)} onError={fallback('/assets/skills/missing.png')} alt="" />
                      <span>{skillName(row.skill)}</span>
                      <NumberDraftInput
                        className="level-input"
                        value={Number(props.values[levelKey] ?? max)}
                        min={0}
                        max={max}
                        emptyValue={max}
                        blankWhenEmpty={false}
                        onCommit={(value) => props.onSkillLevel(base, value)}
                      />
                    </span>
                  </td>
                  <DamageCell value={row.crit} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} />
                  <DamageCell value={row.crush} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} />
                  <DamageCell value={row.normal} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} />
                  <DamageCell value={row.miss} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} />
                </tr>
                {row.breakdown && (
                  <>
                    <DamageDetailRow label="直伤" values={row.breakdown.direct} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} />
                    <DamageDetailRow label="激爆" values={row.breakdown.detonate} targetMaxHP={props.targetMaxHP} targetBarrier={props.targetBarrier} accent />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function DamageCell({ value, targetMaxHP, targetBarrier }: { value: number | null; targetMaxHP: number; targetBarrier: number }) {
  if (value == null) return <td className="none">无</td>;
  const percent = damageRemainingPercent(value, targetBarrier, targetMaxHP);
  return (
    <td>
      <span className="damage-value">{value.toLocaleString('zh-CN')}</span>
      <small className="damage-percent">({percent.toFixed(1)}%)</small>
    </td>
  );
}

function DamageSourceBadge({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <span className="damage-source-badge" title={`${label}: ${value.toLocaleString('zh-CN')}`}>
      <img src={icon} onError={fallback('/assets/icons/artifact.png')} alt="" />
      <span>{label}</span>
      <strong>{value.toLocaleString('zh-CN')}</strong>
    </span>
  );
}

function dotLabel(type: DoT) {
  const labels: Record<DoT, string> = {
    [DoT.bleed]: '流血',
    [DoT.burn]: '烧伤',
    [DoT.bomb]: '炸弹',
    [DoT.nail]: '魔法钉',
    [DoT.rupture]: '破裂',
  };
  return labels[type] || type;
}

function DamageDetailRow({ label, values, targetMaxHP, targetBarrier, accent = false }: {
  label: string;
  values: DamageValues;
  targetMaxHP: number;
  targetBarrier: number;
  accent?: boolean;
}) {
  return (
    <tr className={`damage-detail-row ${accent ? 'accent' : ''}`}>
      <td><span>{label}</span></td>
      <DamageCell value={values.crit} targetMaxHP={targetMaxHP} targetBarrier={targetBarrier} />
      <DamageCell value={values.crush} targetMaxHP={targetMaxHP} targetBarrier={targetBarrier} />
      <DamageCell value={values.normal} targetMaxHP={targetMaxHP} targetBarrier={targetBarrier} />
      <DamageCell value={values.miss} targetMaxHP={targetMaxHP} targetBarrier={targetBarrier} />
    </tr>
  );
}

function SpeedSolverPage() {
  const [allies, setAllies] = useState<AllySpeedInput[]>(() => loadSpeedAllies());
  const [enemies, setEnemies] = useState<EnemySpeedInput[]>(() => loadSpeedEnemies());
  const [screenshot, setScreenshot] = useState<string>('');
  const [readinessRows, setReadinessRows] = useState<ReadinessRow[]>([]);
  const [ocrState, setOcrState] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [ocrApplied, setOcrApplied] = useState(false);

  useEffect(() => {
    localStorage.setItem('epic7.damageDesk.speedSolver.allies.v1', JSON.stringify(allies));
  }, [allies]);

  useEffect(() => {
    localStorage.setItem('epic7.damageDesk.speedSolver.enemies.v1', JSON.stringify(enemies));
  }, [enemies]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
      const file = image?.getAsFile();
      if (!file) return;
      event.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshot(String(reader.result || ''));
        setReadinessRows([]);
        setOcrState('idle');
        setOcrApplied(false);
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (!screenshot) return;
    let canceled = false;
    setOcrState('reading');
    readReadinessFromScreenshot(screenshot)
      .then((readiness) => {
        if (canceled) return;
        setReadinessRows(readiness.rows);
        let applied = false;
        const completeRead = (readiness.allies.length === 3 && readiness.enemies.length === 3)
          || (readiness.allies.length === 4 && readiness.enemies.length === 4);
        if (completeRead) {
          setAllies((current) => current.map((ally, index) => ({
            ...ally,
            cr: readiness.allies[index] ?? 0,
          })));
          setEnemies((current) => current.map((enemy, index) => ({
            ...enemy,
            cr: readiness.enemies[index] ?? 0,
          })));
          applied = true;
        }
        setOcrApplied(applied);
        setOcrState('done');
      })
      .catch((error) => {
        console.error(error);
        if (!canceled) setOcrState('error');
      });
    return () => {
      canceled = true;
    };
  }, [screenshot]);

  const result = useMemo<OpeningSpeedSolveResult>(() => solveOpeningSpeeds(allies, enemies, { displayTolerance: true }), [allies, enemies]);

  const updateAlly = (index: number, key: keyof AllySpeedInput, value: number) => {
    setAllies((current) => current.map((ally, itemIndex) => itemIndex === index ? { ...ally, [key]: value } : ally));
  };

  const updateEnemy = (index: number, value: number) => {
    setEnemies((current) => current.map((enemy, itemIndex) => itemIndex === index ? { ...enemy, cr: value } : enemy));
  };

  return (
    <section className="speed-solver-page">
      <section className={`screenshot-card ${screenshot ? 'has-image' : ''}`}>
        <div>
          <span className="eyebrow">Screenshot</span>
          <h3>{screenshot ? '已粘贴截图' : 'Ctrl+V 粘贴截图'}</h3>
        </div>
        {screenshot ? (
          <>
            <img src={screenshot} alt="速攻值截图预览" />
            <div className="screenshot-actions">
              <span className={`ocr-state ${ocrState}`}>{ocrStateText(ocrState, readinessRows.length, ocrApplied)}</span>
              {readinessRows.length > 0 && (
                <div className="ocr-chips">
                  {readinessRows.map((row, index) => (
                    <span className={row.side} key={`${row.y}-${index}`}>{row.side === 'enemy' ? '敌' : '我'} {row.cr}%</span>
                  ))}
                </div>
              )}
              <button className="ghost-button" onClick={() => {
                setScreenshot('');
                setReadinessRows([]);
                setOcrState('idle');
                setOcrApplied(false);
              }}>清除</button>
            </div>
          </>
        ) : (
          <p>也可以不放截图，直接手动输入。粘贴截图后会自动识别 CR 并填表。</p>
        )}
      </section>

      <div className="speed-grid">
        <section className="speed-card">
          <div className="speed-card-head">
            <span>我方行动条</span>
            <strong>填速度就参与计算</strong>
          </div>
          <div className="speed-input-list">
            {allies.map((ally, index) => (
              <div className="speed-row ally-speed-row" key={`ally-${index}`}>
                <span className="unit-dot ally">{index + 1}</span>
                <label>
                  <span>速度</span>
                  <NumberDraftInput
                    min={index === 0 ? 90 : 0}
                    max={400}
                    placeholder={index === 0 ? '必填' : '可留空'}
                    value={ally.speed}
                    emptyValue={index === 0 ? 90 : 0}
                    blankWhenEmpty={index !== 0}
                    onCommit={(value) => updateAlly(index, 'speed', value)}
                  />
                </label>
                <label>
                  <span>CR</span>
                  <NumberDraftInput
                    min={0}
                    max={100}
                    placeholder="可留空"
                    value={ally.cr}
                    emptyValue={0}
                    blankWhenEmpty
                    onCommit={(value) => updateAlly(index, 'cr', value)}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="speed-card enemy-card">
          <div className="speed-card-head">
            <span>敌方行动条</span>
            <strong>按截图顺序填</strong>
          </div>
          <div className="speed-input-list">
            {enemies.map((enemy, index) => (
              <div className="speed-row enemy-speed-row" key={enemy.label}>
                <span className="unit-dot enemy">{index + 1}</span>
                <label>
                  <span>{enemy.label} CR</span>
                  <NumberDraftInput
                    min={0}
                    max={100}
                    value={enemy.cr}
                    emptyValue={0}
                    blankWhenEmpty={false}
                    onCommit={(value) => updateEnemy(index, value)}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SpeedResultPanel result={result} />
    </section>
  );
}

function SpeedResultPanel({ result }: { result: OpeningSpeedSolveResult }) {
  if (!result.allyFit) {
    return (
      <section className="speed-results empty">
        <h3>结果</h3>
        <p>还缺少可用的我方速度和 CR，或者几行数值暂时对不上开局随机范围。</p>
      </section>
    );
  }

  return (
    <section className="speed-results">
      <div className="speed-results-head">
        <div>
          <span className="eyebrow">Result</span>
          <h3>敌方速度结果</h3>
        </div>
        <span className="time-pill">时间校准 {result.timeRange[0].toFixed(3)} - {result.timeRange[1].toFixed(3)}</span>
      </div>
      <div className="enemy-result-list">
        {result.results.map((item, index) => (
          <article className={`enemy-result ${index === 0 ? 'primary' : ''}`} key={item.label}>
            <div className="enemy-result-main">
              <span>{item.label}</span>
              <strong>{item.mode}</strong>
              <em>最可能速度</em>
            </div>
            <div className="enemy-result-meta">
              <span>完整范围 {item.min} - {item.max}</span>
              <span>80%区间 {item.p80[0]} - {item.p80[1]}</span>
              <span>95%区间 {item.p95[0]} - {item.p95[1]}</span>
              <span>平均 {item.mean.toFixed(1)}</span>
              <span>可信度 {item.confidence}</span>
            </div>
            <MiniHistogram histogram={item.histogram} mode={item.mode} />
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniHistogram({ histogram, mode }: { histogram: Array<{ speed: number; probability: number }>; mode: number }) {
  const peak = Math.max(...histogram.map((item) => item.probability), 0.0001);
  const bars = histogram.filter((_, index) => index % Math.max(1, Math.floor(histogram.length / 36)) === 0).slice(0, 40);
  return (
    <div className="mini-histogram" aria-label="速度概率分布">
      {bars.map((item) => (
        <span
          key={item.speed}
          className={Math.abs(item.speed - mode) <= 1 ? 'hot' : ''}
          style={{ height: `${Math.max(8, (item.probability / peak) * 44)}px` }}
          title={`${item.speed}: ${(item.probability * 100).toFixed(2)}%`}
        />
      ))}
    </div>
  );
}

type ReadinessCalcRow = {
  label: string;
  side: Side;
  speed: number;
  delta: number;
  direction: 1 | -1;
};

function CombatReadinessPage() {
  const [rows, setRows] = useState<ReadinessCalcRow[]>(() => loadReadinessRows());
  const maxSpeed = useMemo(() => Math.max(...rows.map((row) => row.speed).filter((speed) => speed > 0), 0), [rows]);

  useEffect(() => {
    localStorage.setItem('epic7.damageDesk.readinessCalc.rows.v1', JSON.stringify(rows));
  }, [rows]);

  const updateRow = (index: number, patch: Partial<ReadinessCalcRow>) => {
    setRows((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, ...patch } : row));
  };

  return (
    <section className="speed-solver-page readiness-page">
      <section className="speed-card readiness-card">
        <div className="speed-card-head">
          <span>速攻值推算</span>
          <strong>最高速度自动视为 100%</strong>
        </div>
        <div className="readiness-list">
          <ReadinessSideRows side="attacker" rows={rows} maxSpeed={maxSpeed} onUpdate={updateRow} />
          <ReadinessSideRows side="defender" rows={rows} maxSpeed={maxSpeed} onUpdate={updateRow} />
        </div>
      </section>
    </section>
  );
}

function ReadinessSideRows(props: {
  side: Side;
  rows: ReadinessCalcRow[];
  maxSpeed: number;
  onUpdate: (index: number, patch: Partial<ReadinessCalcRow>) => void;
}) {
  const sideRows = props.rows
    .map((row, index) => ({ row, index }))
    .filter((item) => item.row.side === props.side);
  const title = props.side === 'attacker' ? '我方行动条' : '敌方行动条';

  return (
    <div className={`readiness-side ${props.side}`}>
      <div className="readiness-side-title">
        <span>{title}</span>
      </div>
      {sideRows.map(({ row, index }, localIndex) => {
        const base = props.maxSpeed > 0 && row.speed > 0 ? (row.speed / props.maxSpeed) * 100 : 0;
        const signedDelta = row.direction * row.delta;
        const final = base + signedDelta;
        return (
          <div className="readiness-row" key={row.label}>
            <span className={`unit-dot ${props.side === 'attacker' ? 'ally' : 'enemy'}`}>{localIndex + 1}</span>
            <label>
              <span>速度</span>
              <NumberDraftInput
                min={0}
                max={500}
                value={row.speed}
                emptyValue={0}
                blankWhenEmpty
                placeholder="可留空"
                onCommit={(value) => props.onUpdate(index, { speed: value })}
              />
            </label>
            <button
              className={`readiness-sign ${row.direction > 0 ? 'increase' : 'decrease'}`}
              onClick={() => props.onUpdate(index, { direction: row.direction > 0 ? -1 : 1 })}
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                event.preventDefault();
                props.onUpdate(index, { direction: row.direction > 0 ? -1 : 1 });
              }}
              title="点击切换增加 / 减少，聚焦时按 Tab 也可切换"
            >
              {row.direction > 0 ? '+' : '-'}
            </button>
            <label className={`readiness-delta ${row.direction > 0 ? 'increase' : 'decrease'}`}>
              <span>{row.direction > 0 ? '速攻值增加' : '速攻值减少'}</span>
              <NumberDraftInput
                min={0}
                max={300}
                value={row.delta}
                emptyValue={0}
                blankWhenEmpty
                placeholder="0"
                onCommit={(value) => props.onUpdate(index, { delta: value })}
              />
            </label>
            <div className="readiness-result">
              <span>速攻值</span>
              <strong>
                {formatReadiness(base)}
                <em className={row.direction > 0 ? 'increase' : 'decrease'}>
                  ({formatReadiness(final)})
                </em>
              </strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NumberDraftInput(props: {
  value: number;
  min: number;
  max: number;
  emptyValue: number;
  blankWhenEmpty: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  dataArtifactLevel?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(formatDraft(props.value, props.emptyValue, props.blankWhenEmpty));

  useEffect(() => {
    setDraft(formatDraft(props.value, props.emptyValue, props.blankWhenEmpty));
  }, [props.value, props.emptyValue, props.blankWhenEmpty]);

  const commit = () => {
    if (draft.trim() === '') {
      props.onCommit(props.emptyValue);
      setDraft(formatDraft(props.emptyValue, props.emptyValue, props.blankWhenEmpty));
      return;
    }
    const next = clampNumber(draft, props.min, props.max);
    props.onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      className={props.className}
      data-artifact-level={props.dataArtifactLevel ? true : undefined}
      type="text"
      inputMode="numeric"
      disabled={props.disabled}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      value={props.disabled ? String(props.value) : draft}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d]/g, '');
        setDraft(next);
        const parsed = Number(next);
        if (next !== '' && parsed >= props.min && parsed <= props.max) props.onCommit(parsed);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      onDoubleClick={(event) => event.currentTarget.select()}
    />
  );
}

function formatDraft(value: number, emptyValue: number, blankWhenEmpty: boolean) {
  return blankWhenEmpty && value === emptyValue ? '' : String(value);
}

function Picker(props: {
  mode: Exclude<PickerState, null>;
  query: string;
  attackerId: string;
  attackerClass: HeroClass;
  defenderClass: HeroClass;
  libraryArtifacts: LibraryArtifact[];
  recentHeroes: string[];
  onQuery: (value: string) => void;
  onClose: () => void;
  onSelectHero: (id: string) => void;
  onSelectArtifact: (id: string) => void;
  onSelectDefenderArtifact: (code: string) => void;
}) {
  const q = props.query.trim().toLowerCase();
  const artifactItems = props.mode === 'artifact'
    ? props.libraryArtifacts
      .filter((artifact) => artifact.role === 'common' || artifact.role === props.attackerClass)
      .filter((artifact) => !q || `${artifact.code} ${artifact.name} ${artifact.nameEn || ''} ${artifactAliases(artifact.code.replaceAll('-', '_'))}`.toLowerCase().includes(q))
      .slice(0, 80)
    : [];
  const defenderArtifactItems = props.mode === 'defenderArtifact'
    ? props.libraryArtifacts
      .filter((artifact) => artifact.role === 'common' || artifact.role === props.defenderClass)
      .filter((artifact) => !q || `${artifact.code} ${artifact.name} ${artifact.nameEn || ''}`.toLocaleLowerCase().includes(q))
      .slice(0, 80)
    : [];
  const recentSet = new Set(props.recentHeroes);
  const filteredHeroes = props.mode !== 'artifact' && props.mode !== 'defenderArtifact'
    ? heroEntries
      .filter(([id]) => !q || `${id} ${heroName(id)} ${heroNickname(id)}`.toLowerCase().includes(q))
      .sort(([a], [b]) => recentRank(a, props.recentHeroes) - recentRank(b, props.recentHeroes))
      .slice(0, 120)
    : [];
  const recentHeroItems = !q ? filteredHeroes.filter(([id]) => recentSet.has(id)).slice(0, 10) : [];
  const heroItems = !q ? filteredHeroes.filter(([id]) => !recentSet.has(id)) : filteredHeroes;

  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="picker" onClick={(event) => event.stopPropagation()}>
        <div className="searchbox">
          <Search size={20} />
          <input autoFocus value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder={props.mode === 'artifact' || props.mode === 'defenderArtifact' ? '搜索神器' : '搜索角色名 / 别名'} />
        </div>
        <div className="picker-list">
          {props.mode === 'artifact'
            ? (
              <>
                <button className="picker-row" onClick={() => props.onSelectArtifact('noProc')}>
                  <img src="/assets/artifacts/noProc.png" alt="" />
                  <span>不使用神器</span>
                </button>
                {artifactItems.map((artifact) => (
                  <button key={artifact.code} className="picker-row" onClick={() => props.onSelectArtifact(calculatorArtifactIdForLibraryArtifact(artifact))}>
                    <img src={artifact.image || '/assets/artifacts/noProc.png'} onError={fallback('/assets/artifacts/noProc.png')} alt="" />
                    <span>{artifact.name}</span>
                  </button>
                ))}
              </>
            )
            : props.mode === 'defenderArtifact'
              ? (
                <>
                  <button className="picker-row" onClick={() => props.onSelectDefenderArtifact('')}>
                    <img src="/assets/artifacts/noProc.png" alt="" />
                    <span>不使用神器</span>
                  </button>
                  {defenderArtifactItems.map((artifact) => (
                    <button key={artifact.code} className="picker-row" onClick={() => props.onSelectDefenderArtifact(artifact.code)}>
                      <img src={artifact.image || '/assets/artifacts/noProc.png'} onError={fallback('/assets/artifacts/noProc.png')} alt="" />
                      <span>{artifact.name}</span>
                    </button>
                  ))}
                </>
              )
            : (
              <>
                {recentHeroItems.length > 0 && <PickerSection title="最近使用" />}
                {recentHeroItems.map(([id, hero]) => <HeroPickerRow key={`recent-${id}`} id={id} hero={hero} onSelect={props.onSelectHero} />)}
                {recentHeroItems.length > 0 && <PickerSection title="全部角色" />}
                {heroItems.map(([id, hero]) => <HeroPickerRow key={id} id={id} hero={hero} onSelect={props.onSelectHero} />)}
              </>
            )}
        </div>
      </div>
    </div>
  );
}

function PickerSection({ title }: { title: string }) {
  return <div className="picker-section">{title}</div>;
}

function HeroPickerRow({ id, hero, onSelect }: { id: string; hero: typeof Heroes.abigail; onSelect: (id: string) => void }) {
  return (
    <button className="picker-row hero-row" onClick={() => onSelect(id)}>
      <img src={`/assets/heroes/${id}-icon.png`} onError={fallback('/assets/heroes/missing.png')} alt="" />
      <img src={`/assets/elements/${hero.element}.png`} alt="" />
      <img src={`/assets/classes/${hero.class}.png`} alt="" />
      <span>{heroName(id)}</span>
    </button>
  );
}

function recentRank(id: string, recentHeroes: string[]) {
  const index = recentHeroes.indexOf(id);
  return index === -1 ? 999 : index;
}

function assetUpdateTitle(state: AssetsUpdateState) {
  const parts = ['导入最新 assets 数据'];
  if (state.localDate) parts.push(`本地：${state.localDate}`);
  if (state.remoteDate) parts.push(`最新：${state.remoteDate}`);
  if (state.message) parts.push(state.message);
  return parts.join('\n');
}

function ocrStateText(state: 'idle' | 'reading' | 'done' | 'error', count: number, applied: boolean) {
  if (state === 'reading') return '识别中';
  if (state === 'done') return applied ? `识别到 ${count} 行，已填表` : (count ? `识别到 ${count} 行，请手动确认` : '没有识别到 CR');
  if (state === 'error') return '识别失败';
  return '等待识别';
}

function StateModal(props: {
  values: ProfileValues;
  onClose: () => void;
  onChange: (key: string, value: boolean | number) => void;
}) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const groups = stateGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(([key, label]) => !q || `${key} ${label}`.toLowerCase().includes(q)),
    }))
    .filter((group) => group.items.length);

  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="state-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Attacker</span>
            <h2>更多状态</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </div>
        <div className="modal-search">
          <Search size={18} />
          <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索状态 / 套装" />
        </div>
        <div className="state-groups">
          {groups.map((group) => (
            <StateGroup key={group.title} title={group.title} items={group.items} values={props.values} onChange={props.onChange} />
          ))}
          {!groups.length && <div className="empty-state">没有匹配的状态</div>}
        </div>
      </div>
    </div>
  );
}

function BuildPresetModal(props: {
  side: Side;
  heroId: string;
  presets: BuildPreset[];
  activeId: string;
  onSelect: (preset: BuildPreset) => void;
  onCreate: () => void;
  onRename: (preset: BuildPreset) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="profile-modal build-preset-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">{props.side === 'attacker' ? 'Attacker build' : 'Defender build'}</span><h2>{heroName(props.heroId)} 的装备预设</h2></div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭"><X size={22} /></button>
        </div>
        <div className="profile-body">
          <div className="profile-toolbar">
            <span>拖动计算器数值后，当前预设会自动保存</span>
            <button className="primary-button" onClick={props.onCreate}><Plus size={16} />复制为新预设</button>
          </div>
          <div className="profile-list">
            {props.presets.map((preset) => <div className={`profile-row ${preset.id === props.activeId ? 'active' : ''}`} key={preset.id}>
              <button className="profile-main" onClick={() => props.onSelect(preset)}><span>{preset.name}</span><strong>{preset.id === props.activeId ? '当前使用' : preset.source === 'community' ? '社区推荐' : '点击切换'}</strong></button>
              <div className="profile-row-actions"><button className="ghost-button compact" onClick={() => props.onRename(preset)}>重命名</button></div>
            </div>)}
            {!props.presets.length && <div className="empty-state">暂无预设，可复制一份默认数值开始编辑。</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileModal(props: {
  side: Side;
  heroId: string;
  profiles: ProfileSummary[];
  onSelect: (index: number) => void;
  onCreate: () => void;
  onRename: (index: number, name: string) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}) {
  const title = props.side === 'attacker' ? '攻击配置' : '防守配置';

  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">{props.side === 'attacker' ? 'Attacker' : 'Defender'}</span>
            <h2>{heroName(props.heroId)} 的 {title}</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </div>
        <div className="profile-body">
          <div className="profile-toolbar">
            <span>当前配置会自动保存</span>
            <button className="primary-button" onClick={props.onCreate}>新增配置</button>
          </div>
          <div className="profile-list">
            {props.profiles.map((profile) => (
              <div className={`profile-row ${profile.active ? 'active' : ''}`} key={profile.index}>
                <button className="profile-main" onClick={() => props.onSelect(profile.index)}>
                  <span>{profile.name}</span>
                  <strong>{profile.active ? '当前使用' : '点击切换'}</strong>
                </button>
                <div className="profile-row-actions">
                  <button
                    className="ghost-button compact"
                    onClick={() => {
                      const nextName = window.prompt('配置名称', profile.name);
                      if (nextName !== null) props.onRename(profile.index, nextName);
                    }}
                  >
                    重命名
                  </button>
                  <button
                    className="ghost-button compact danger"
                    onClick={() => {
                      if (window.confirm(`删除配置「${profile.name}」？`)) props.onDelete(profile.index);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AliasModal(props: {
  heroId: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(() => heroAliasText(props.heroId) || heroName(props.heroId));
  const names = text.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const displayName = names[0] || heroName(props.heroId);

  useEffect(() => {
    setText(heroAliasText(props.heroId) || heroName(props.heroId));
  }, [props.heroId]);

  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="alias-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Hero Alias</span>
            <h2>{heroName(props.heroId)}</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </div>
        <div className="alias-body">
          <label className="alias-editor">
            <span>角色名字 / 别名</span>
            <input
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') props.onSave(text);
              }}
              placeholder="史瑞杰思,史哥"
            />
          </label>
          <div className="alias-preview">
            <span>页面显示</span>
            <strong>{displayName}</strong>
          </div>
          <div className="alias-actions">
            <button className="ghost-button" onClick={props.onClose}>取消</button>
            <button className="primary-button" onClick={() => props.onSave(text)}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateGroup(props: {
  title: string;
  items: readonly (readonly [string, string, string])[];
  values: ProfileValues;
  onChange: (key: string, value: boolean | number) => void;
}) {
  return (
    <section>
      <h3>{props.title}</h3>
      <div className="state-grid">
        {props.items.map(([key, label, icon]) => (
          key === 'torrentSetStack'
            ? (
              <TorrentSetControl
                key={key}
                label={label}
                icon={icon}
                value={Number(props.values[key] || 0)}
                onChange={(value) => props.onChange(key, value)}
              />
            )
            : (
              <Chip
                key={key}
                label={label}
                icon={icon}
                checked={Boolean(props.values[key])}
                onChange={(checked) => props.onChange(key, checked)}
              />
            )
        ))}
      </div>
    </section>
  );
}

function barrierLabel(label: string) {
  return label.replace(/^s([123])$/i, 'S$1').replace(/\bSoulburn\b/g, 'Soulburn');
}

function TorrentSetControl(props: {
  label: string;
  icon: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const value = Math.min(3, Math.max(0, Math.round(props.value || 0)));
  return (
    <div className={`torrent-control ${value ? 'checked' : ''}`}>
      <button className="torrent-main" onClick={() => props.onChange(value ? 0 : 1)}>
        <span className="checkmark">{value ? '✓' : ''}</span>
        <img src={`/assets/${props.icon}`} onError={fallback('/assets/icons/help-circle-outline.svg')} alt="" />
        <span>{props.label}</span>
      </button>
      <div className="torrent-count" aria-label="激流套数量">
        {[1, 2, 3].map((count) => (
          <button
            key={count}
            className={value === count ? 'active' : ''}
            onClick={() => props.onChange(value === count ? 0 : count)}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}

function uniqueFields(fields: string[]) {
  return Array.from(new Set(fields.filter(Boolean)));
}

function shortFieldName(field: string) {
  const names: Record<string, string> = {
    casterMaxHP: '施法者最大生命',
    casterMaxHPIncrease: '最大生命增加(%)',
    casterLingeringFragranceStack: '余香',
    casterDefenseUp: '防御力提升',
    casterDefenseDown: '防御力降低',
    casterVigor: '魄力',
    casterPilfered: '抢夺',
    casterHasTrauma: '创伤',
    casterHasSuperhumanization: '超人化',
    casterIndomitable: '不屈',
    casterAttackMission: '攻击任务',
    casterDefenseMission: '防御任务',
    casterHasStellarKnowledge: '星辰知识',
    casterDivinityStack: '神圣层数',
    targetDivinityStack: '神圣层数',
    casterSpeedUp: '速度提升',
    casterSpeedDown: '速度降低',
    casterEnraged: '狂气',
    casterRampage: '暴走',
    casterFury: '狂气',
    casterHasCascade: '暴走',
    targetSpeedUp: '目标速度提升',
    targetSpeedDown: '目标速度降低',
    targetHasRampage: '目标暴走',
    targetDefenseDownAftermath: '追加前防破',
  };
  return names[field] || fieldName(field);
}

function numericFieldFallback(field: string) {
  return /(?:HP|Defense|Attack|Speed|Stack|Percent|Targets|Hits|Souls|Deaths|Injuries|Level|Resistance|Effectiveness|Current)/.test(field);
}

function booleanFieldFallback(field: string) {
  return /(?:^is|Is|Has|Above|Below|Completed|Aftermath|Highest|Buff$|Debuff$|Down$|Up$|Great$|Barrier$|Stealth$|Pilfered$|Ruptured$|Nailed$|Fractured$|Laceration$)/.test(field);
}

function clampNumber(value: string | number, min: number, max: number) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function optionalNumber(value: string | number, max: number) {
  if (value === '') return 0;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(max, Math.max(0, parsed));
}

function loadSpeedAllies(): AllySpeedInput[] {
  const defaults = [
    { speed: 313, cr: 100 },
    { speed: 0, cr: 0 },
    { speed: 0, cr: 0 },
    { speed: 0, cr: 0 },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem('epic7.damageDesk.speedSolver.allies.v1') || '[]');
    return defaults.map((item, index) => ({ ...item, ...(saved[index] || {}), cr: Number(saved[index]?.cr ?? item.cr) }));
  } catch {
    return defaults;
  }
}

function loadSpeedEnemies(): EnemySpeedInput[] {
  const defaults = [
    { label: '敌方1速', cr: 95 },
    { label: '敌方2速', cr: 80 },
    { label: '敌方3速', cr: 45 },
    { label: '敌方4速', cr: 0 },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem('epic7.damageDesk.speedSolver.enemies.v1') || '[]');
    return defaults.map((item, index) => ({ ...item, cr: Number(saved[index]?.cr ?? item.cr) }));
  } catch {
    return defaults;
  }
}

function loadReadinessRows(): ReadinessCalcRow[] {
  const defaults: ReadinessCalcRow[] = [
    { label: 'ally-1', side: 'attacker', speed: 0, delta: 0, direction: 1 },
    { label: 'ally-2', side: 'attacker', speed: 0, delta: 0, direction: 1 },
    { label: 'ally-3', side: 'attacker', speed: 0, delta: 0, direction: 1 },
    { label: 'ally-4', side: 'attacker', speed: 0, delta: 0, direction: 1 },
    { label: 'enemy-1', side: 'defender', speed: 0, delta: 0, direction: 1 },
    { label: 'enemy-2', side: 'defender', speed: 0, delta: 0, direction: 1 },
    { label: 'enemy-3', side: 'defender', speed: 0, delta: 0, direction: 1 },
    { label: 'enemy-4', side: 'defender', speed: 0, delta: 0, direction: 1 },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem('epic7.damageDesk.readinessCalc.rows.v1') || '[]');
    return defaults.map((item, index) => ({
      ...item,
      ...(saved[index] || {}),
      side: saved[index]?.side === 'defender' ? 'defender' : item.side,
      direction: saved[index]?.direction === -1 ? -1 : 1,
      speed: Number(saved[index]?.speed ?? item.speed),
      delta: Number(saved[index]?.delta ?? item.delta),
    }));
  } catch {
    return defaults;
  }
}

function formatReadiness(value: number) {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function fallback(src: string) {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = src;
  };
}

function loadUiScale() {
  const value = Number(localStorage.getItem(UI_SCALE_KEY) || '1');
  return clampScale(Number.isFinite(value) ? value : 1);
}

function readCalculatorHero(side: Side) {
  const saved = localStorage.getItem(`epic7.tools.calculatorHero.${side}.v1`) || '';
  const currentId = saved.endsWith('_old') ? saved.slice(0, -4) : saved;
  return Heroes[currentId] ? currentId : 'abigail';
}

function clampScale(value: number) {
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(value.toFixed(2))));
}
