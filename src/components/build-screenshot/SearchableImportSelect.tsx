import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchableImportOption = {
  value: string;
  label: string;
  detail?: string;
  searchText?: string;
  image?: string | null;
};

type Props = {
  value: string;
  options: SearchableImportOption[];
  placeholder: string;
  onChange: (value: string) => void;
};

export function SearchableImportSelect({ value, options, placeholder, onChange }: Props) {
  const selected = options.find((option) => option.value === value) || null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label || '');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery(selected?.label || '');
  }, [open, selected?.label]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  const visible = useMemo(() => {
    const normalized = normalize(query);
    return options
      .filter((option) => !normalized || normalize(`${option.label} ${option.detail || ''} ${option.searchText || ''}`).includes(normalized))
      .slice(0, 80);
  }, [options, query]);

  const choose = (option: SearchableImportOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return <div className={`build-import-combobox ${open ? 'open' : ''}`} ref={rootRef}>
    <div className="build-import-combobox-input">
      <Search size={16} />
      <input
        value={query}
        placeholder={placeholder}
        onFocus={(event) => { setOpen(true); setActiveIndex(0); event.currentTarget.select(); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); setOpen(true); setActiveIndex((index) => Math.min(visible.length - 1, index + 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); setActiveIndex((index) => Math.max(0, index - 1)); }
          if (event.key === 'Enter' && open && visible[activeIndex]) { event.preventDefault(); event.stopPropagation(); choose(visible[activeIndex]); }
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(selected?.label || ''); }
        }}
      />
      <button type="button" aria-label="展开候选" onClick={() => { setOpen((current) => !current); setQuery(open ? selected?.label || '' : ''); }}>
        <ChevronDown size={17} />
      </button>
    </div>
    {open && <div className="build-import-combobox-list" role="listbox">
      {visible.map((option, index) => <button
        type="button"
        role="option"
        aria-selected={option.value === value}
        className={`${option.value === value ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
        key={option.value}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        {option.image ? <img src={option.image} alt="" /> : <span className="build-import-option-fallback">{option.label.slice(0, 1)}</span>}
        <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
      </button>)}
      {!visible.length && <p>没有匹配结果</p>}
    </div>}
  </div>;
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFKC').replace(/[\s·・’'“”"_.-]/g, '');
}
