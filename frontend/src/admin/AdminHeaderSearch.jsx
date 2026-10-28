import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Search, Users } from 'lucide-react';
import api from '../shared/api';

const ICONS = {
  businesses: Building2,
  users: Users,
  messages: Mail,
};

export default function AdminHeaderSearch() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(-1);

  const flatItems = groups.flatMap((group) => group.items || []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      setActive(-1);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(
          `analytics/admin-search/?q=${encodeURIComponent(q)}`,
          { auth: true, noCache: true },
        );
        if (cancelled) return;
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
        setActive(-1);
        setOpen(true);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const go = (href) => {
    if (!href) return;
    setOpen(false);
    setQuery('');
    setGroups([]);
    navigate(href);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!flatItems.length) return;
      setOpen(true);
      setActive((prev) => (prev + 1) % flatItems.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!flatItems.length) return;
      setOpen(true);
      setActive((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0 && flatItems[active]) {
        go(flatItems[active].href);
        return;
      }
      const firstGroup = groups[0];
      go(firstGroup?.see_all || firstGroup?.items?.[0]?.href);
    }
  };

  const trimmed = query.trim();
  const showPanel = open && trimmed.length >= 2;

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <div className="search-panel flex items-center bg-paper border border-border rounded-full px-4 py-2 transition-colors focus-within:border-primary w-72">
        <Search className="w-4 h-4 text-ink-faint mr-2 shrink-0" strokeWidth={1.8} />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => trimmed.length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Entreprises, utilisateurs, messages…"
          className="bg-transparent border-none outline-none w-full text-[13px] text-ink placeholder-ink-faint"
          aria-label="Recherche admin"
          autoComplete="off"
        />
      </div>
      {showPanel && (
        <div className="absolute right-0 mt-2 w-[22rem] rounded-2xl bg-white overflow-hidden z-40">
          {loading && (
            <p className="px-4 py-3 text-[13px] text-ink-muted">Recherche…</p>
          )}
          {!loading && groups.length === 0 && (
            <p className="px-4 py-3 text-[13px] text-ink-muted">Aucun résultat.</p>
          )}
          {!loading && groups.map((group) => {
            const Icon = ICONS[group.key] || Search;
            return (
              <div key={group.key} className="py-2">
                <div className="px-4 pb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {group.label}
                  </p>
                  {group.see_all ? (
                    <button
                      type="button"
                      onClick={() => go(group.see_all)}
                      className="text-[11px] font-semibold text-primary"
                    >
                      Tout voir
                    </button>
                  ) : null}
                </div>
                <ul>
                  {(group.items || []).map((item) => {
                    const index = flatItems.indexOf(item);
                    const isActive = index === active;
                    return (
                      <li key={`${group.key}-${item.id}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(item.href)}
                          className={`w-full text-left px-4 py-2 flex items-start gap-2.5 ${
                            isActive ? 'bg-accent text-ink' : 'hover:bg-surface'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-ink' : 'text-ink-faint'}`} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium truncate">{item.title}</span>
                            {item.subtitle ? (
                              <span className={`block text-[11px] truncate ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
