import { ArrowLeft, Gem, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { artifactTags, buildArtifactTagCatalog } from '../../features/artifact-filter/artifactTags';
import { artifactRoleOptions, roleLabels, toggleValue } from '../../library/catalog';
import { loadLibraryArtifacts } from '../../library/libraryRepository';
import type { LibraryArtifact, LibraryRole } from '../../library/types';
import { FilterChip, LibraryEmpty, LibraryFrame } from './HeroLibraryPage';

export function ArtifactLibraryPage() {
  const [artifacts, setArtifacts] = useState<LibraryArtifact[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roles, setRoles] = useState<LibraryRole[]>([]);
  const [rarities, setRarities] = useState<number[]>([]);
  const [limitedOnly, setLimitedOnly] = useState(false);
  const [effectTags, setEffectTags] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => { loadLibraryArtifacts().then(setArtifacts).catch((reason) => setError(reason instanceof Error ? reason.message : '神器资料加载失败')); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return artifacts.filter((artifact) => {
      const text = [artifact.name, artifact.nameEn, artifact.nameZht].filter(Boolean).join(' ').toLocaleLowerCase();
      return (!needle || text.includes(needle))
        && (!roles.length || roles.includes(artifact.role))
        && (!rarities.length || rarities.includes(artifact.rarity))
        && (!limitedOnly || artifact.limited)
        && effectTags.every((tag) => artifactTags(artifact).includes(tag));
    });
  }, [artifacts, query, roles, rarities, limitedOnly, effectTags]);
  const effectCatalog = useMemo(() => buildArtifactTagCatalog(artifacts), [artifacts]);

  const selected = selectedCode ? artifacts.find((artifact) => artifact.code === selectedCode) : null;
  if (selected) return <ArtifactDetail artifact={selected} onBack={() => setSelectedCode(null)} />;

  return (
    <LibraryFrame eyebrow="Artifact archive" title="神器图鉴" count={`${filtered.length} / ${artifacts.length}`}>
      <section className="filter-deck">
        <div className="filter-line">
          <span className="filter-label">职业</span>
          {artifactRoleOptions.map((role) => <FilterChip key={role} active={roles.includes(role)} onClick={() => setRoles(toggleValue(roles, role))}>{roleLabels[role]}</FilterChip>)}
        </div>
        {!!effectCatalog.length && <div className="filter-line artifact-effect-filters">
          <span className="filter-label">效果</span>
          {effectCatalog.map((option) => <FilterChip key={option.id} active={effectTags.includes(option.id)} onClick={() => setEffectTags(toggleValue(effectTags, option.id))}>{option.label}<small>{option.count}</small></FilterChip>)}
        </div>}
        <div className="filter-line">
          <span className="filter-label">星级</span>
          {[3, 4, 5].map((rarity) => <FilterChip key={rarity} active={rarities.includes(rarity)} onClick={() => setRarities(toggleValue(rarities, rarity))}>{rarity} ★</FilterChip>)}
          <FilterChip active={limitedOnly} onClick={() => setLimitedOnly((value) => !value)}><Sparkles size={15} />仅限定</FilterChip>
        </div>
        <label className="library-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索神器名称或英文名" /></label>
      </section>
      {error ? <LibraryEmpty title="神器资料加载失败" message={error} /> : !artifacts.length ? <LibraryEmpty title="正在整理神器档案" message="首次载入需要一点时间。" /> : !filtered.length ? <LibraryEmpty title="没有符合条件的神器" message="减少筛选条件或清空搜索词。" /> : (
        <section className="artifact-card-grid">{filtered.map((artifact) => (
          <button type="button" className="artifact-card" key={artifact.code} onClick={() => setSelectedCode(artifact.code)}>
            <div className="artifact-card__visual">{artifact.image ? <img src={artifact.image} alt="" loading="lazy" /> : <span className="artifact-glyph"><Gem size={34} />{artifact.name.slice(0, 1)}</span>}{artifact.limited && <small>限定</small>}</div>
            <strong>{artifact.name}</strong><span>{roleLabels[artifact.role]} · {artifact.rarity}★</span>
          </button>
        ))}</section>
      )}
    </LibraryFrame>
  );
}

function ArtifactDetail({ artifact, onBack }: { artifact: LibraryArtifact; onBack: () => void }) {
  const [artworkOpen, setArtworkOpen] = useState(false);
  useEffect(() => {
    if (!artworkOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setArtworkOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [artworkOpen]);
  return (
    <LibraryFrame eyebrow="Artifact dossier" title={artifact.name} count={artifact.nameEn || ''}>
      <section className="artifact-detail">
        <button type="button" className="back-button back-button--dark" onClick={onBack}><ArrowLeft size={17} />返回图鉴</button>
        <div className={`artifact-detail__visual ${artifact.artwork ? 'has-artwork' : ''}`}>
          {artifact.artwork ? <button type="button" onClick={() => setArtworkOpen(true)} aria-label={`查看${artifact.name}神器立绘`}><img src={artifact.artwork} alt={`${artifact.name}神器立绘`} /></button> : artifact.image ? <img src={artifact.image} alt={artifact.name} /> : <span className="artifact-glyph artifact-glyph--large"><Gem size={56} />{artifact.name.slice(0, 1)}</span>}
        </div>
        <div className="artifact-detail__copy">
          <div className="artifact-meta"><span>{roleLabels[artifact.role]}</span><span>{artifact.rarity}★</span>{artifact.limited && <span className="limited-tag">限定</span>}</div>
          <p>{artifact.description || '神器背景资料尚未补全。'}</p>
          <div className="artifact-skill"><small>神器技能</small><p>{artifact.skillDescription || '技能说明尚未补全。'}</p></div>
          <div className="artifact-stats" aria-label="满级神器属性">
            {!!artifact.stats.atk && <span><img src="/assets/skills/le_attack.png" alt="" /><small>攻击</small><strong>{artifact.stats.atk}</strong></span>}
            {!!artifact.stats.hp && <span><img src="/assets/skills/le_health.png" alt="" /><small>生命</small><strong>{artifact.stats.hp}</strong></span>}
            {!!artifact.stats.def && <span><img src="/assets/skills/le_defence.png" alt="" /><small>防御</small><strong>{artifact.stats.def}</strong></span>}
          </div>
        </div>
      </section>
      {artworkOpen && artifact.artwork && <div className="artifact-artwork-lightbox" role="dialog" aria-modal="true" aria-label={`${artifact.name}神器立绘大图`} onClick={() => setArtworkOpen(false)}>
        <button type="button" aria-label="关闭神器立绘"><X /></button>
        <img src={artifact.artwork} alt={`${artifact.name}神器立绘大图`} onClick={(event) => event.stopPropagation()} />
      </div>}
    </LibraryFrame>
  );
}
