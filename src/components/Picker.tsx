'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface PickerOption {
  value: string;
  label: string;
  /** Right-hand detail, e.g. a balance. */
  detail?: string;
  /** Options sharing a group are listed under one heading, in first-seen order. */
  group?: string;
}

interface Props {
  name: string;
  options: PickerOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Show the type-to-filter box. Off for short lists. */
  searchable?: boolean;
  /** Labels the trigger for screen readers when the visible label sits elsewhere. */
  'aria-labelledby'?: string;
}

// A searchable select. The chosen value travels in a hidden input, so it posts
// with the form exactly as the <select> it replaces did. Typing filters,
// arrows move, Enter picks, Escape closes.
export function Picker({ name, options, defaultValue = '', placeholder = 'Choose…', required, searchable = true, ...aria }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    const start = Math.max(0, filtered.findIndex((o) => o.value === value));
    setActive(start);
    (searchable ? searchRef.current : listRef.current)?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
    // Only on open: re-running on every keystroke would reset the highlight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active].value); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  }

  let lastGroup: string | undefined;

  return (
    <div className="picker" ref={rootRef} data-open={open || undefined}>
      {/* A visually hidden required input lets the browser block an empty submit
          and point at this field, as it would for a <select>. */}
      <input
        type="text"
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        onInvalid={() => triggerRef.current?.focus()}
        tabIndex={-1}
        aria-hidden
        className="picker-native"
      />
      <button
        ref={triggerRef}
        type="button"
        className="input picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        {...aria}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); }
        }}
      >
        <span className={selected ? 'picker-value' : 'picker-placeholder'}>{selected?.label ?? placeholder}</span>
        {selected?.detail && <span className="picker-detail num">{selected.detail}</span>}
      </button>

      {open && (
        <div className="picker-pop" onKeyDown={onKey}>
          {searchable && (
            <input
              ref={searchRef}
              className="picker-search"
              placeholder="Type to search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
            />
          )}
          <ul id={listId} ref={listRef} role="listbox" tabIndex={-1} className="picker-list">
            {filtered.length === 0 && <li className="picker-empty">Nothing matches “{query}”</li>}
            {filtered.map((o, i) => {
              const heading = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <li key={o.value} role="presentation">
                  {heading && <p className="picker-group" aria-hidden>{heading}</p>}
                  <div
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={o.value === value}
                    data-active={i === active || undefined}
                    className="picker-option"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                  >
                    <span>{o.label}</span>
                    {o.detail && <span className="picker-detail num">{o.detail}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
