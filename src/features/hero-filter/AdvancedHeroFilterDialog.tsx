import { Check, ChevronDown, ChevronRight, Filter, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeroTagCategory, HeroTagOption, HeroTagTone } from './heroTags';

type Props = { catalog: HeroTagOption[]; selected: string[]; resultCount: number; onChange: (tags: string[]) => void; onClose: () => void };

const categoryLabels: Record<HeroTagCategory, string> = {
  'self-imprint': '自阵效果', 'team-imprint': '群阵效果', equipment: '专属装备', 'skill-bonus': '技能额外加成', trait: '技能特性',
  buff: '拥有 Buff 效果', debuff: '拥有 Debuff 效果',
};
const toneLabels: Record<HeroTagTone, string> = { general: '一般', blue: '蓝底', gold: '金底' };

export function AdvancedHeroFilterDialog({ catalog, selected, resultCount, onChange, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [openTones, setOpenTones] = useState<Record<string, boolean>>({ 'buff:general': true, 'debuff:general': true });
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return catalog.filter((item) => !needle || [item.label, ...item.searchTerms].some((term) => term.toLocaleLowerCase().includes(needle)));
  }, [catalog, query]);
  const categories = [...new Set(filtered.map((item) => item.category))];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  useEffect(() => {
    searchRef.current?.focus();
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && !event.isComposing && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose]);

  const options = (rows: HeroTagOption[]) => <div className="tag-options">{rows.map((option) => (
    <button type="button" className={`tag-option ${selected.includes(option.id) ? 'active' : ''} tone-${option.tone}`} key={option.id} onClick={() => toggle(option.id)}>
      {option.icon ? <img src={option.icon} alt="" /> : <Sparkles size={18} />}
      <span>{option.label}</span><small>{option.count}</small>{selected.includes(option.id) && <Check className="tag-selected-check" size={13} />}
    </button>
  ))}</div>;

  return (
    <div className="advanced-filter-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="advanced-filter-dialog" role="dialog" aria-modal="true" aria-label="角色高级筛选">
        <header><div><Filter size={23} /><div><h2>高级筛选</h2><p>所有已选词条需同时满足</p></div></div><button type="button" onClick={onClose} aria-label="关闭高级筛选"><X /></button></header>
        <div className="advanced-filter-content">
          {categories.map((category) => {
            const rows = filtered.filter((item) => item.category === category);
            const isEffect = category === 'buff' || category === 'debuff';
            return <section className={`tag-category tag-category--${category}`} key={category}>
              <h3>{categoryLabels[category]} <small>{rows.length}</small></h3>
              {isEffect ? (['general', 'blue', 'gold'] as HeroTagTone[]).map((tone) => {
                const toneRows = rows.filter((item) => item.tone === tone);
                if (!toneRows.length) return null;
                const key = `${category}:${tone}`;
                const open = Boolean(query.trim()) || Boolean(openTones[key]);
                return <div className={`effect-tone-group tone-${tone}`} key={key}>
                  <button type="button" className="effect-tone-toggle" aria-expanded={open} onClick={() => setOpenTones((value) => ({ ...value, [key]: !value[key] }))}>
                    {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}<span>{toneLabels[tone]}</span><small>{toneRows.length}</small>
                  </button>
                  {open && options(toneRows)}
                </div>;
              }) : options(rows)}
            </section>;
          })}
          {!categories.length && <p className="tag-search-empty">没有匹配的词条</p>}
        </div>
        <footer>
          <label className="advanced-filter-search"><Search size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技能效果词条" /></label>
          <div className="advanced-filter-actions">
            <span>已选 {selected.length} 项</span>
            <button type="button" className="advanced-filter-reset" disabled={!selected.length} onClick={() => onChange([])}>重置筛选</button>
            <button type="button" className="primary-action" onClick={onClose}>应用筛选（{resultCount} 个结果）</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
