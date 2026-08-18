import { ArrowLeft, BookOpen, ChevronRight, Expand, Filter, Flame, Gem, Heart, Pencil, Quote, Search, Shield, Sparkles, Star, Swords, ThumbsDown, ThumbsUp, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { HeroDataEditorDialog } from '../../features/hero-editor/HeroDataEditorDialog';
import { calculatorHeroIdForLibraryCode } from '../../features/build-presets/calculatorBuildBridge';
import { AdvancedHeroFilterDialog } from '../../features/hero-filter/AdvancedHeroFilterDialog';
import { filterHeroes } from '../../features/hero-filter/filterHeroes';
import { buildHeroTagCatalog, withHeroTags } from '../../features/hero-filter/heroTags';
import { attributeLabels, attributeOptions, elementIcon, roleIcon, roleLabels, roleOptions, toggleValue, zodiacLabels, zodiacOptions } from '../../library/catalog';
import { loadLibraryHeroes, reloadLibraryHeroes } from '../../library/libraryRepository';
import type { LibraryAttribute, LibraryHero, LibraryRole, LibraryZodiac } from '../../library/types';
import type { LibrarySkillEffect } from '../../library/types';
import { heroAliasText, heroName, heroSearchNames, hydrateAliasesFromDisk, saveHeroAliasText } from '../../data/catalog';

type Props = {
  onOpenBuild: (heroCode: string) => void;
};
const HERO_DETAIL_KEY = 'epic7.tools.heroDetail.v1';

export function HeroLibraryPage({ onOpenBuild }: Props) {
  const [heroes, setHeroes] = useState<LibraryHero[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roles, setRoles] = useState<LibraryRole[]>([]);
  const [attributes, setAttributes] = useState<LibraryAttribute[]>([]);
  const [rarities, setRarities] = useState<number[]>([]);
  const [zodiacs, setZodiacs] = useState<LibraryZodiac[]>([]);
  const [advancedTags, setAdvancedTags] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(() => localStorage.getItem(HERO_DETAIL_KEY));
  const [navigationNotice, setNavigationNotice] = useState('');
  const [aliasVersion, setAliasVersion] = useState(0);

  useEffect(() => {
    loadLibraryHeroes().then(setHeroes).catch((reason) => setError(reason instanceof Error ? reason.message : '角色资料加载失败'));
    hydrateAliasesFromDisk().then(() => setAliasVersion((version) => version + 1));
  }, []);

  useEffect(() => {
    if (!heroes.length || !selectedCode) return;
    if (!heroes.some((hero) => hero.code === selectedCode)) {
      localStorage.removeItem(HERO_DETAIL_KEY);
      setSelectedCode(null);
      setNavigationNotice('未找到角色，已返回角色图鉴。');
    }
  }, [heroes, selectedCode]);

  const taggedHeroes = useMemo(() => heroes.map((hero) => {
    const aliasId = libraryAliasId(hero.code);
    const extraNames = heroSearchNames(aliasId).split(/[,，\s]+/).filter(Boolean);
    return withHeroTags({ ...hero, nicknames: [...new Set([...hero.nicknames, ...extraNames])] });
  }), [heroes, aliasVersion]);
  const tagCatalog = useMemo(() => buildHeroTagCatalog(taggedHeroes), [taggedHeroes]);
  const filtered = useMemo(() => filterHeroes(taggedHeroes, { query, roles, attributes, rarities, zodiacs, advancedTags }), [taggedHeroes, query, roles, attributes, rarities, zodiacs, advancedTags]);

  const selected = selectedCode ? taggedHeroes.find((hero) => hero.code === selectedCode) : null;
  if (selected) return <HeroDetail hero={selected} onBack={() => { localStorage.removeItem(HERO_DETAIL_KEY); setSelectedCode(null); }} onOpenBuild={onOpenBuild} onHeroSaved={async () => setHeroes(await reloadLibraryHeroes())} onAliasChanged={() => setAliasVersion((version) => version + 1)} />;

  return (
    <LibraryFrame eyebrow="Hero archive" title="角色图鉴" count={`${filtered.length} / ${heroes.length}`}>
      <section className="filter-deck" aria-label="角色筛选">
        <div className="filter-deck__heading">
          <div><Filter size={18} /><strong>筛选条件</strong></div>
          <button type="button" className={`advanced-filter-trigger ${advancedTags.length ? 'active' : ''}`} onClick={() => setAdvancedOpen(true)}><Sparkles size={16} />高级筛选{advancedTags.length ? ` · ${advancedTags.length}` : ''}</button>
        </div>
        <div className="filter-line">
          <span className="filter-label">职业</span>
          {roleOptions.map((role) => <FilterChip key={role} active={roles.includes(role)} onClick={() => setRoles(toggleValue(roles, role))}>{roleLabels[role]}</FilterChip>)}
        </div>
        <div className="filter-line">
          <span className="filter-label">属性</span>
          {attributeOptions.map((attribute) => (
            <FilterChip key={attribute} active={attributes.includes(attribute)} onClick={() => setAttributes(toggleValue(attributes, attribute))}>
              <img src={elementIcon(attribute)} alt="" />{attributeLabels[attribute]}
            </FilterChip>
          ))}
        </div>
        <div className="filter-line">
          <span className="filter-label">星级</span>
          {[3, 4, 5].map((rarity) => <FilterChip key={rarity} active={rarities.includes(rarity)} onClick={() => setRarities(toggleValue(rarities, rarity))}>{rarity} ★</FilterChip>)}
        </div>
        <div className="filter-line zodiac-filter-line">
          <span className="filter-label">星座</span>
          {zodiacOptions.map((zodiac) => <FilterChip key={zodiac} active={zodiacs.includes(zodiac)} onClick={() => setZodiacs(toggleValue(zodiacs, zodiac))}>
            <span className="zodiac-symbol">{zodiacLabels[zodiac].symbol}</span>{zodiacLabels[zodiac].name}
          </FilterChip>)}
        </div>
        <label className="library-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索角色名称、英文名或昵称" /></label>
      </section>
      {navigationNotice && <p className="library-notice" role="status">{navigationNotice}</p>}

      {error ? <LibraryEmpty title="角色资料加载失败" message={error} /> : !heroes.length ? <LibraryEmpty title="正在整理角色档案" message="首次载入需要一点时间。" /> : !filtered.length ? <LibraryEmpty title="没有符合条件的角色" message="减少筛选条件或清空搜索词。" /> : (
        <section className="hero-card-grid" aria-label="角色列表">
          {filtered.map((hero) => <HeroCard key={hero.code} hero={hero} onClick={() => { localStorage.setItem(HERO_DETAIL_KEY, hero.code); setSelectedCode(hero.code); }} />)}
        </section>
      )}
      {advancedOpen && <AdvancedHeroFilterDialog catalog={tagCatalog} selected={advancedTags} resultCount={filtered.length} onChange={setAdvancedTags} onClose={() => setAdvancedOpen(false)} />}
    </LibraryFrame>
  );
}

function HeroCard({ hero, onClick }: { hero: LibraryHero; onClick: () => void }) {
  return (
    <button className="hero-card" type="button" onClick={onClick}>
      <div className={`hero-card__visual attribute-${hero.attribute}`}>
        <img className="hero-card__element" src={elementIcon(hero.attribute)} alt={attributeLabels[hero.attribute]} />
        <span className="hero-card__role">{roleLabels[hero.role]}</span>
        {hero.avatar ? <img className="hero-card__portrait" src={hero.avatar} alt="" loading="lazy" /> : <span className="image-fallback">{hero.name.slice(0, 1)}</span>}
      </div>
      <span className="hero-card__name">{hero.name}</span>
      <span className="rarity-stars">{'★'.repeat(hero.rarity)}</span>
      {hero.dataStatus === 'summary-only' && <small className="data-status">资料待补全</small>}
    </button>
  );
}

function HeroDetail({ hero, onBack, onOpenBuild, onHeroSaved, onAliasChanged }: { hero: LibraryHero; onBack: () => void; onOpenBuild: (code: string) => void; onHeroSaved: () => Promise<void>; onAliasChanged: () => void }) {
  const stats = hero.baseStats;
  const aliasId = libraryAliasId(hero.code);
  const displayName = heroName(aliasId) || hero.name;
  const [artworkOpen, setArtworkOpen] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<LibrarySkillEffect | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  useEffect(() => {
    if (!artworkOpen && !selectedEffect && !editorOpen && !aliasOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (aliasOpen) setAliasOpen(false);
      else if (editorOpen) setEditorOpen(false);
      else if (selectedEffect) setSelectedEffect(null);
      else setArtworkOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [artworkOpen, selectedEffect, editorOpen, aliasOpen]);
  return (
    <LibraryFrame eyebrow="Combat dossier" title={<button type="button" className="library-hero-title-button" onClick={() => setAliasOpen(true)} title="编辑角色名字和别名">{displayName}<Pencil size={18} /></button>} count={hero.nameEn || heroSearchNames(aliasId).split(' ').find((name) => /[A-Za-z]/.test(name)) || ''}>
      <div className={`hero-dossier attribute-${hero.attribute}`}>
        <aside className="hero-dossier__sidebar">
          <div className="hero-dossier__art">
            <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={17} />返回图鉴</button>
            {hero.artwork ? <button type="button" className="hero-artwork-button" onClick={() => setArtworkOpen(true)} aria-label={`查看${hero.name}完整立绘`}><img src={hero.artwork} alt={hero.name} /><span><Expand size={17} />查看大图</span></button> : hero.avatar ? <img className="avatar-art" src={hero.avatar} alt={hero.name} /> : <span className="image-fallback image-fallback--large">{hero.name.slice(0, 1)}</span>}
          </div>
          <div className="hero-dossier__sidebar-info">
          <div className="hero-dossier__identity">
            <div className="hero-identity-pills">
              <span><img src={elementIcon(hero.attribute)} alt="" />{attributeLabels[hero.attribute]}</span>
              <span><img src={roleIcon(hero.role)} alt="" />{roleLabels[hero.role]}</span>
              {hero.zodiac && <span><b aria-hidden="true">{zodiacLabels[hero.zodiac].symbol}</b>{zodiacLabels[hero.zodiac].name}</span>}
            </div>
            <p>{hero.descriptionLine || hero.story || '角色详细资料正在整理。'}</p>
          </div>
          {stats && (
            <section className="stat-ribbon" aria-label="满觉醒基础属性">
              <Stat label="攻击力" value={stats.atk} /><Stat label="生命值" value={stats.hp} /><Stat label="防御力" value={stats.def} /><Stat label="速度" value={stats.spd} />
              <Stat label="暴击率" value={`${formatPercent(stats.chc)}%`} /><Stat label="暴击伤害" value={`${formatPercent(stats.chd)}%`} /><Stat label="效果命中" value={`${formatPercent(stats.eff)}%`} /><Stat label="效果抗性" value={`${formatPercent(stats.efr)}%`} /><Stat label="夹攻率" value="3.0%" />
            </section>
          )}
          {!!hero.devotion.length && <DevotionPanel devotion={(hero.devotion as Array<Record<string, unknown>>)[0]} />}
            <HeroProfileFacts profile={hero.profile} />
          </div>
        </aside>
        <div className="hero-dossier__content">
          <div className="dossier-actions">
            <button type="button" className="secondary-action" onClick={() => setEditorOpen(true)}><Pencil size={17} />编辑角色数据</button>
            <button type="button" className="primary-action" onClick={() => onOpenBuild(hero.code)}><Shield size={18} />查看角色装备<ChevronRight size={16} /></button>
          </div>
          <section className="dossier-section">
            <h2><Swords size={19} />技能档案</h2>
            {hero.skills.length ? <div className="skill-list">{hero.skills.map((skill, index) => {
              const exclusiveOptions = (hero.exclusives || []).flatMap((equipment) => equipment.skillOptions
                .filter((option) => option.skillNumber === index + 1)
                .map((option) => ({ ...option, equipmentName: equipment.name })));
              return <article className="skill-card" key={skill.id}>
                <div className="skill-card__icon">{skill.icon ? <img src={skill.icon} alt="" /> : <span>S{index + 1}</span>}</div>
                <div><div className="skill-card__title"><strong>{skill.name}</strong><small>{skill.isAoe ? '群攻' : '单体'} {skill.cooldown}</small></div><p>{skill.description}</p>
                  {!!exclusiveOptions.length && <div className="skill-exclusive-options">{exclusiveOptions.map((option, optionIndex) => <div key={`${skill.id}-exclusive-${optionIndex}`}><strong>专属装备强化效果</strong><p>{option.description}</p></div>)}</div>}
                  {skill.soulBurn && <section className="skill-soul-burn"><strong>灵魂燃烧</strong><span><Flame size={17} />消耗 {skill.soulBurn.cost} 灵魂</span><p>{skill.soulBurn.description}</p></section>}
                  {!!skill.multipliers?.length && <div className="skill-multipliers" aria-label={`${skill.name}技能倍率`}>{skill.multipliers.map((group) => (
                    <div className="skill-multiplier-group" key={`${skill.id}-${group.id}`}><strong>{group.name}</strong><div>{group.items.map((item) => <span key={`${group.id}-${item.key}`}><small>{item.label}</small><b>{item.displayValue || item.value}</b></span>)}</div></div>
                  ))}</div>}
                  {!!skill.enhancements.length && <details className="skill-enhancements">
                    <summary><span>技能强化</span><small>{skill.enhancements.length}级</small><ChevronRight size={16} aria-hidden="true" /></summary>
                    <ol>{skill.enhancements.map((enhancement) => <li key={`${skill.id}-enhance-${enhancement.level}`}><Star size={15} aria-hidden="true" /><span>{enhancement.text}</span></li>)}</ol>
                  </details>}
                  {!!skill.effects.length && <div className="effect-tags">{skill.effects.map((effect) => <button type="button" key={`${skill.id}-${effect.id}`} onClick={() => setSelectedEffect(effect)}>{effect.icon ? <img src={effect.icon} alt="" /> : <Sparkles size={14} />}{effect.name}</button>)}</div>}
                </div>
              </article>
            })}</div> : <LibraryEmpty title="技能资料待补全" message="角色仍可用于基础筛选，完整详情会在数据更新后出现。" />}
          </section>
          {!!hero.exclusives?.length && <section className="dossier-section exclusive-equipment-section">
            <h2><Gem size={19} />专属装备</h2>
            <div className="exclusive-equipment-list">{hero.exclusives.map((equipment) => <article className="exclusive-equipment-card" key={equipment.id}>
              <div className="exclusive-equipment-mark">{equipment.iconKey ? <img src={equipment.iconKey} alt="" /> : <Gem size={25} />}<span>专属</span></div>
              <div className="exclusive-equipment-content"><div className="exclusive-equipment-title"><div><strong>{equipment.name}</strong><p>{equipment.description}</p></div>{equipment.mainStat && <span><small>{exclusiveStatLabel(equipment.mainStat.type)}</small><b>{formatExclusiveStat(equipment.mainStat.max, equipment.mainStat.type)}</b></span>}</div>
              </div>
            </article>)}</div>
          </section>}
          {hero.story && <section className="dossier-section story-block"><h2><BookOpen size={19} />角色故事</h2><p>{hero.story}</p></section>}
        </div>
      </div>
      {artworkOpen && hero.artwork && <div className="hero-artwork-lightbox" role="dialog" aria-modal="true" aria-label={`${hero.name}立绘大图`} onClick={() => setArtworkOpen(false)}>
        <button type="button" onClick={() => setArtworkOpen(false)} aria-label="关闭大图"><X size={24} /></button>
        <img src={hero.artwork} alt={`${hero.name}完整立绘`} onClick={(event) => event.stopPropagation()} />
      </div>}
      {selectedEffect && <div className="library-modal-backdrop" onClick={() => setSelectedEffect(null)}><section className={`skill-effect-dialog effect-${selectedEffect.type}`} role="dialog" aria-modal="true" aria-label={`${selectedEffect.name}效果说明`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="skill-effect-dialog__close" onClick={() => setSelectedEffect(null)} aria-label="关闭效果说明"><X size={20} /></button>
        <div className="skill-effect-dialog__icon">{selectedEffect.icon ? <img src={selectedEffect.icon} alt="" /> : <Sparkles size={28} />}</div>
        <div><span>技能特效</span><h2>{selectedEffect.name}</h2><p>{selectedEffect.description || '该效果的详细说明正在补充。'}</p></div>
      </section></div>}
      {editorOpen && <HeroDataEditorDialog hero={hero} onClose={() => setEditorOpen(false)} onSaved={onHeroSaved} />}
      {aliasOpen && <LibraryHeroAliasDialog hero={hero} aliasId={aliasId} onClose={() => setAliasOpen(false)} onSaved={() => { onAliasChanged(); setAliasOpen(false); }} />}
    </LibraryFrame>
  );
}

function LibraryHeroAliasDialog({ hero, aliasId, onClose, onSaved }: { hero: LibraryHero; aliasId: string; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(() => heroAliasText(aliasId) || hero.name);
  const names = text.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const displayName = names[0] || hero.name;
  return <div className="modal-scrim" onClick={onClose}><section className="alias-modal" role="dialog" aria-modal="true" aria-label={`${hero.name}别名设置`} onClick={(event) => event.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">Hero Alias</span><h2>{hero.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭别名设置"><X size={22} /></button></div>
    <div className="alias-body"><label className="alias-editor"><span>角色名字 / 别名</span><input autoFocus value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { saveHeroAliasText(aliasId, text); onSaved(); } }} placeholder={`${hero.name},常用别名`} /></label><div className="alias-preview"><span>页面显示</span><strong>{displayName}</strong></div><div className="alias-actions"><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => { saveHeroAliasText(aliasId, text); onSaved(); }}>保存</button></div></div>
  </section></div>;
}

function libraryAliasId(heroCode: string) {
  return calculatorHeroIdForLibraryCode(heroCode) || heroCode.replaceAll('-', '_');
}

function Stat({ label, value }: { label: string; value: number | string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function HeroProfileFacts({ profile }: { profile: Record<string, unknown> | null }) {
  if (!profile) return null;
  const facts = [
    { key: 'hobby', label: '爱好', icon: Heart },
    { key: 'likes', label: '喜欢', icon: ThumbsUp },
    { key: 'dislikes', label: '不喜欢', icon: ThumbsDown },
    { key: 'motto', label: '座右铭', icon: Quote },
  ].map((item) => ({ ...item, value: typeof profile[item.key] === 'string' ? String(profile[item.key]).trim() : '' })).filter((item) => item.value);
  if (!facts.length) return null;
  return <section className="hero-profile-facts" aria-label="角色资料">{facts.map(({ key, label, icon: Icon, value }) => <div key={key}><Icon size={17} /><strong>{label}：</strong><span>{value}</span></div>)}</section>;
}

function DevotionPanel({ devotion }: { devotion: Record<string, unknown> }) {
  const self = devotionText(String(devotion.self_type || ''), Number(devotion.self_effect_max || 0));
  const team = devotionText(String(devotion.public_type || ''), Number(devotion.public_effect_max || 0));
  return <details className="devotion-panel"><summary><strong>刻印</strong><span>自阵 {self}｜群阵 {team}</span></summary><div><p><b>SSS 自阵</b><span>{self}（作用自身）</span></p><p><b>SSS 群阵</b><span>{team}（不作用自身）</span></p></div></details>;
}

function devotionText(type: string, value: number) {
  const label = ({ att_rate: '攻击力', max_hp_rate: '生命值', def_rate: '防御力', cri: '暴击率', cri_dmg: '暴击伤害', acc: '效果命中', res: '效果抗性', speed: '速度' } as Record<string, string>)[type] || type || '未知属性';
  const percentTypes = new Set(['att_rate', 'max_hp_rate', 'def_rate', 'cri', 'cri_dmg', 'acc', 'res']);
  return `${label} +${percentTypes.has(type) ? `${formatPercent(value)}%` : value}`;
}

function formatPercent(value: number) { return (value * 100).toFixed(1); }

function exclusiveStatLabel(type: string) {
  return ({ acc: '效果命中', max_hp_rate: '生命值', att_rate: '攻击力', def_rate: '防御力', speed: '速度', cri: '暴击率', cri_dmg: '暴击伤害', res: '效果抗性' } as Record<string, string>)[type] || type || '主属性';
}

function formatExclusiveStat(value: number, type: string) {
  return ['acc', 'max_hp_rate', 'att_rate', 'def_rate', 'cri', 'cri_dmg', 'res'].includes(type) ? `${Math.round(value * 100)}%` : String(value);
}

export function LibraryFrame({ eyebrow, title, count, children }: { eyebrow: string; title: React.ReactNode; count: string; children: React.ReactNode }) {
  return <main className="app-shell library-shell"><header className="library-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div><span className="library-count">{count}</span></header>{children}</main>;
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`filter-chip ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

export function LibraryEmpty({ title, message }: { title: string; message: string }) {
  return <div className="library-empty"><UserRound size={28} /><strong>{title}</strong><p>{message}</p></div>;
}
