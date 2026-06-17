import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronDown, MoreHorizontal, RefreshCw, Search, X } from 'lucide-react';
import './style.css';
import { Artifacts } from 'src/assets/data/artifacts';
import { Heroes } from 'src/assets/data/heroes';
import { FormDefaults } from 'src/app/models/forms';
import { HeroClass } from 'src/app/models/hero';
import { DoT } from 'src/app/models/skill';
import { DamageEngine } from './calc/damageEngine';
import type { DamageRow, DamageValues, DotDamage } from './calc/damageEngine';
import { solveOpeningSpeeds, type AllySpeedInput, type EnemySpeedInput, type OpeningSpeedSolveResult } from './calc/speedSolver';
import { readReadinessFromScreenshot, type ReadinessRow } from './calc/screenshotReader';
import {
  advantageousElement,
  artifactEntries,
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
import { hydrateProfilesFromDisk, loadProfile, saveProfile } from './data/profiles';
import type { ProfileValues, Side } from './data/profiles';
import { loadRecentHeroes, rememberHero } from './data/recents';

type PickerState = null | 'attacker' | 'defender' | 'artifact';
type ProfileModalState = null | Side;
type AliasModalState = null | { heroId: string };
type AppMode = 'damage' | 'speed';

const UI_SCALE_KEY = 'epic7.damageDesk.uiScale.v1';
const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.4;
const UI_SCALE_STEP = 0.1;

const numberFields = {
  attacker: [
    ['attack', '攻击', 200, 10000],
    ['critDamage', '爆伤', 150, 350],
    ['damageIncrease', '增伤', 0, 200],
    ['attackIncreasePercent', '攻击烙印(%)', 0, 50],
    ['attackIncrease', '攻击增加(%)', 0, 200],
  ],
  defender: [
    ['targetDefense', '防御', 0, 5000],
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
  ['casterEnraged', '激怒', 'buffs/rage-buff.png'],
  ['casterRampage', '暴走', 'buffs/rampage-buff.png'],
  ['casterFury', '愤怒', 'buffs/rage-buff.png'],
  ['casterPerception', '洞察', 'buffs/perception-buff.png'],
  ['casterHasStealth', '隐身', 'buffs/stealth-buff.png'],
  ['casterHasBarrier', '屏障', 'buffs/barrier-buff.png'],
  ['casterHasCascade', '连锁', 'buffs/cascade-buff.png'],
  ['casterHasAbundance', '丰饶', 'buffs/abundance-buff.png'],
  ['casterHasChallenge', '挑战', 'buffs/challenge-buff.png'],
  ['casterHasSpecialFriendship', '特别的友情', 'buffs/special-friendship-buff.png'],
  ['casterHasSuperhumanization', '超人化', 'buffs/superhumanization-buff.png'],
  ['casterPilfered', '抢夺', 'debuffs/pilfer-debuff.png'],
  ['casterHasTrauma', '创伤', 'debuffs/trauma-debuff.png'],
  ['rageSet', '愤怒套', 'sets/rage-set.png'],
  ['penetrationSet', '穿透套', 'sets/penetration-set.png'],
  ['torrentSetStack', '激流套', 'sets/torrent-set.png'],
  ['pursuitSet', '追击套', 'sets/pursuit-set.png'],
] as const;

const stateGroups = [
  {
    title: '攻击增益',
    items: extraAttackerBuffs.slice(0, 13),
  },
  {
    title: '异常 / 减益',
    items: extraAttackerBuffs.slice(13, 15),
  },
  {
    title: '装备套装',
    items: extraAttackerBuffs.slice(15),
  },
] as const;

const defenderBuffs = [
  ['targetDefenseUp', '防守力提升', 'buffs/defense-buff.png'],
  ['targetVigor', '魄力', 'buffs/vigor-buff.png'],
  ['targetDefenseDown', '防守力降低', 'debuffs/defense-debuff.png'],
  ['targetTargeted', '标靶', 'debuffs/target-debuff.png'],
  ['targetLaceration', '裂伤', 'debuffs/laceration-debuff.png'],
  ['targetPilfered', '抢夺', 'debuffs/pilfer-debuff.png'],
  ['targetHasTrauma', '创伤', 'debuffs/trauma-debuff.png'],
  ['targetMagicNailed', '魔法钉', 'debuffs/nail-debuff.png'],
  ['targetRuptured', '破裂', 'debuffs/rupture-debuff.png'],
] as const;

function App() {
  const [attackerId, setAttackerId] = useState('abigail');
  const [mode, setMode] = useState<AppMode>('damage');
  const [defenderId, setDefenderId] = useState('abigail');
  const [artifactId, setArtifactId] = useState('noProc');
  const [attacker, setAttacker] = useState<ProfileValues>(() => loadProfile('attacker', 'abigail'));
  const [defender, setDefender] = useState<ProfileValues>(() => loadProfile('defender', 'abigail'));
  const [picker, setPicker] = useState<PickerState>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState>(null);
  const [aliasModal, setAliasModal] = useState<AliasModalState>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [, setAliasVersion] = useState(0);
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

  const hero = Heroes[attackerId] ?? Heroes.abigail;
  const targetHero = Heroes[defenderId] ?? Heroes.abigail;
  const artifact = Artifacts[artifactId] ?? Artifacts.noProc;

  useEffect(() => {
    setCatalogLanguage(language);
    localStorage.setItem('epic7.damageDesk.language.v1', language);
  }, [language]);

  useEffect(() => {
    setCatalogLanguage(language);
  }, []);

  useEffect(() => {
    hydrateProfilesFromDisk().then((changed) => {
      if (!changed) return;
      const profile = loadProfile('attacker', attackerId);
      setAttacker(profile);
      setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
      setDefender(loadProfile('defender', defenderId));
    });
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
    setAttacker(profile);
    setArtifactId(typeof profile.artifactId === 'string' ? profile.artifactId : 'noProc');
  }, [attackerId]);

  useEffect(() => {
    setDefender(loadProfile('defender', defenderId));
  }, [defenderId]);

  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      saveProfile('attacker', attackerId, { ...attacker, artifactId }).then(() => setSaveState('saved'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [attacker, attackerId, artifactId]);

  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      saveProfile('defender', defenderId, defender).then(() => setSaveState('saved'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [defender, defenderId]);

  useEffect(() => {
    const auto = advantageousElement(hero.element, targetHero.element);
    setAttacker((value) => ({ ...value, elementalAdvantage: auto }));
  }, [attackerId, defenderId, hero.element, targetHero.element]);

  useEffect(() => {
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
      setAliasModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const mergedValues = useMemo(() => ({ ...defender, ...attacker }), [attacker, defender]);

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

  const updateSide = (side: Side, key: string, value: number | boolean) => {
    if (side === 'attacker') setAttacker((prev) => ({ ...prev, [key]: value }));
    if (side === 'defender') setDefender((prev) => ({ ...prev, [key]: value }));
  };

  const updateSkillLevel = (skill: string, value: number) => {
    const key = `molagoras${skill.replace(/\D/g, '') || '1'}`;
    updateSide('attacker', key, value);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Epic Seven</span>
          <h1>{mode === 'damage' ? '伤害计算器' : '速度推算'}</h1>
        </div>
        <div className="mode-switch" role="tablist" aria-label="工具模式">
          <button className={mode === 'damage' ? 'active' : ''} onClick={() => setMode('damage')}>伤害计算</button>
          <button className={mode === 'speed' ? 'active' : ''} onClick={() => setMode('speed')}>速度推算</button>
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
              values={mergedValues}
              title="攻击对象"
              tone="attack"
              onHeroPick={() => openPicker('attacker')}
              onAliasOpen={() => setAliasModal({ heroId: attackerId })}
              onArtifactPick={() => openPicker('artifact')}
              onProfileOpen={() => setProfileModal('attacker')}
              onValueChange={updateSide}
              onMoreOpen={() => setMoreOpen(true)}
            />
            <CombatPanel
              side="defender"
              heroId={defenderId}
              values={defender}
              title="防守对象"
              tone="defense"
              onHeroPick={() => openPicker('defender')}
              onAliasOpen={() => setAliasModal({ heroId: defenderId })}
              onProfileOpen={() => setProfileModal('defender')}
              onValueChange={updateSide}
            />
          </section>

          <DamageTable
            heroId={attackerId}
            hero={hero}
            rows={rows}
            values={attacker}
            dotDamages={dotDamages}
            artifactDamage={artifactDamage}
            artifactId={artifactId}
            onSkillLevel={updateSkillLevel}
          />
        </>
      ) : (
        <SpeedSolverPage />
      )}

      {picker && (
        <Picker
          mode={picker}
          query={query}
          attackerId={attackerId}
          attackerClass={hero.class}
          recentHeroes={picker === 'defender' ? recentHeroes.defender : recentHeroes.attacker}
          onQuery={setQuery}
          onClose={() => setPicker(null)}
          onSelectHero={(id) => {
            if (picker === 'attacker') setAttackerId(id);
            if (picker === 'defender') setDefenderId(id);
            const side = picker === 'defender' ? 'defender' : 'attacker';
            setRecentHeroes((prev) => ({ ...prev, [side]: rememberHero(side, id) }));
            setPicker(null);
          }}
          onSelectArtifact={(id) => {
            setArtifactId(id);
            setAttacker((prev) => ({ ...prev, artifactId: id, artifactLevel: 30 }));
            setPicker(null);
            window.setTimeout(() => {
              const input = document.querySelector<HTMLInputElement>('[data-artifact-level]');
              input?.focus();
              input?.select();
            }, 50);
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
          onClose={() => setProfileModal(null)}
        />
      )}

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
  values: ProfileValues;
  title: string;
  tone: 'attack' | 'defense';
  onHeroPick: () => void;
  onAliasOpen: () => void;
  onArtifactPick?: () => void;
  onProfileOpen?: () => void;
  onValueChange: (side: Side, key: string, value: number | boolean) => void;
  onMoreOpen?: () => void;
}) {
  const hero = Heroes[props.heroId] ?? Heroes.abigail;
  const artifact = props.artifactId ? Artifacts[props.artifactId] : null;
  const fields = numberFields[props.side];
  const activeExtraBuffs = extraAttackerBuffs.filter(([key]) => Boolean(props.values[key]));
  const buffs = props.side === 'attacker' ? [...mainAttackerBuffs, ...activeExtraBuffs] : defenderBuffs;
  const specialFields = props.side === 'attacker'
    ? uniqueFields(withDerivedFields([...(hero.heroSpecific || []), ...(artifact?.artifactSpecific || [])]))
      .filter((field) => !fields.some(([key]) => key === field))
      .filter((field) => !mainAttackerBuffs.some(([key]) => key === field))
      .filter((field) => !extraAttackerBuffs.some(([key]) => key === field))
    : [];

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
            <button className="profile-pill" onClick={props.onProfileOpen}>profile 默认</button>
          </div>
        </div>
        {props.side === 'attacker' && artifact && (
          <div className="artifact-button">
            <button className="artifact-icon-button" onClick={props.onArtifactPick} aria-label="选择神器">
              <img src={`/assets/artifacts/${artifact.id || 'noProc'}.png`} onError={fallback('/assets/artifacts/noProc.png')} alt={artifactName(artifact.id || 'noProc')} />
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
      </div>

      <div className="field-stack">
        {fields.map(([key, label, min, max]) => (
          <StatField
            key={key}
            label={label}
            value={Number(props.values[key] ?? min)}
            min={min}
            max={max}
            onChange={(value) => props.onValueChange(props.side, key, value)}
          />
        ))}
      </div>

      {props.side === 'attacker' && <h3 className="section-label">角色特性</h3>}

      {specialFields.length > 0 && (
        <div className="special-grid">
          {specialFields.map((field) => (
            <SpecialInput
              key={field}
              field={field}
              value={props.values[field]}
              maximum={hero.heroSpecificMaximums?.[field] ?? artifact?.artifactSpecificMaximums?.[field]}
              onChange={(value) => props.onValueChange(props.side, field, value)}
            />
          ))}
        </div>
      )}

      <div className="buff-row">
        {buffs.map(([key, label, icon]) => (
          <Chip
            key={key}
            label={label}
            icon={icon === 'dynamic:advantage' ? `elements/${counterElement(hero.element)}.png` : icon}
            checked={Boolean(props.values[key])}
            onChange={(checked) => props.onValueChange(props.side, key, checked)}
          />
        ))}
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
        label={fieldName(props.field)}
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

function StatField(props: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="stat-field">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => props.onChange(clampNumber(event.target.value, props.min, props.max))}
      />
      <NumberDraftInput
        className="number-box"
        min={props.min}
        max={props.max}
        value={props.value}
        emptyValue={props.min}
        blankWhenEmpty={false}
        onCommit={props.onChange}
      />
    </label>
  );
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
  artifactDamage: number;
  artifactId: string;
  onSkillLevel: (skill: string, value: number) => void;
}) {
  const hasBadges = props.dotDamages.length > 0 || props.artifactDamage > 0;
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
                  <DamageCell value={row.crit} />
                  <DamageCell value={row.crush} />
                  <DamageCell value={row.normal} />
                  <DamageCell value={row.miss} />
                </tr>
                {row.breakdown && (
                  <>
                    <DamageDetailRow label="直伤" values={row.breakdown.direct} />
                    <DamageDetailRow label="激爆" values={row.breakdown.detonate} accent />
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

function DamageCell({ value }: { value: number | null }) {
  return <td className={value == null ? 'none' : ''}>{value == null ? '无' : value.toLocaleString('zh-CN')}</td>;
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

function DamageDetailRow({ label, values, accent = false }: {
  label: string;
  values: DamageValues;
  accent?: boolean;
}) {
  return (
    <tr className={`damage-detail-row ${accent ? 'accent' : ''}`}>
      <td><span>{label}</span></td>
      <DamageCell value={values.crit} />
      <DamageCell value={values.crush} />
      <DamageCell value={values.normal} />
      <DamageCell value={values.miss} />
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
  recentHeroes: string[];
  onQuery: (value: string) => void;
  onClose: () => void;
  onSelectHero: (id: string) => void;
  onSelectArtifact: (id: string) => void;
}) {
  const q = props.query.trim().toLowerCase();
  const artifactItems = props.mode === 'artifact'
    ? artifactEntries
      .filter(([, artifact]) => isArtifactAllowed(artifact, props.attackerId, props.attackerClass))
      .filter(([id]) => !q || `${id} ${artifactName(id)} ${artifactAliases(id)}`.toLowerCase().includes(q))
      .slice(0, 80)
    : [];
  const recentSet = new Set(props.recentHeroes);
  const filteredHeroes = props.mode !== 'artifact'
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
          <input autoFocus value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder={props.mode === 'artifact' ? '搜索神器' : '搜索角色名 / 别名'} />
        </div>
        <div className="picker-list">
          {props.mode === 'artifact'
            ? artifactItems.map(([id, artifact]) => (
              <button key={id} className="picker-row" onClick={() => props.onSelectArtifact(id)}>
                <img src={`/assets/artifacts/${artifact.id || 'noProc'}.png`} onError={fallback('/assets/artifacts/noProc.png')} alt="" />
                <span>{artifactName(id)}</span>
              </button>
            ))
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

function ProfileModal(props: {
  side: Side;
  heroId: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">{props.side === 'attacker' ? 'Attacker' : 'Defender'}</span>
            <h2>{heroName(props.heroId)} 的 Profile</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </div>
        <div className="profile-body">
          <button className="profile-row active">
            <span>默认</span>
            <strong>当前自动保存配置</strong>
          </button>
          <p>第一版先固定使用默认 profile。之后会在这里加入新建、复制、重命名、删除和排序。</p>
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
          <Chip
            key={key}
            label={label}
            icon={icon}
            checked={Boolean(props.values[key])}
            onChange={(checked) => props.onChange(key, key === 'torrentSetStack' ? (checked ? 1 : 0) : checked)}
          />
        ))}
      </div>
    </section>
  );
}

function uniqueFields(fields: string[]) {
  return Array.from(new Set(fields.filter(Boolean)));
}

function withDerivedFields(fields: string[]) {
  const next = [...fields];
  if (next.includes('casterMaxHP') && !next.includes('casterMaxHPIncrease')) {
    next.push('casterMaxHPIncrease');
  }
  return next;
}

function shortFieldName(field: string) {
  const names: Record<string, string> = {
    casterMaxHP: '施法者最大生命',
    casterMaxHPIncrease: '最大生命增加(%)',
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

function clampScale(value: number) {
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(value.toFixed(2))));
}

createRoot(document.getElementById('root')!).render(<App />);
