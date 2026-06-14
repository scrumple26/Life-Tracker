"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  id: number;
  name: string;
  country: string;
  logo: string;
}

export function TeamAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false); // don't re-search right after a selection

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    const ac = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setItems([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/football/teams?search=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        const teams: Suggestion[] = res.ok ? data.teams ?? [] : [];
        setItems(teams);
        setOpen(teams.length > 0);
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(s: Suggestion) {
    skipNext.current = true;
    onChange(s.name);
    setOpen(false);
    setItems([]);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="field"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          …
        </span>
      )}
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-card border border-line rounded-xl shadow-[var(--shadow-lift)] max-h-64 overflow-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s)}
                className="w-full text-left px-3 py-2 hover:bg-paper-2 flex items-center gap-2.5"
              >
                {s.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt="" className="h-5 w-5 object-contain shrink-0" />
                )}
                <span className="text-sm text-ink truncate">{s.name}</span>
                {s.country && (
                  <span className="text-xs text-muted ml-auto shrink-0">{s.country}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
