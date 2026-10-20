import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import api from './api';

const inventoryApi = {
  get: () => api.get('businesses/me/inventory/', { auth: true }),
  open: () => api.post('businesses/me/inventory/', {}, { auth: true }),
  validate: (lines) => api.post('businesses/me/inventory/validate/', { lines }, { auth: true }),
  cancel: () => api.post('businesses/me/inventory/cancel/', {}, { auth: true }),
};

function payload(lines, drafts) {
  return lines.map((line) => ({
    id: line.id,
    counted_qty: drafts[line.id] === '' || drafts[line.id] == null ? null : Number(drafts[line.id]),
  }));
}

export default function InventoryCount({ onDone }) {
  const [session, setSession] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const applySession = (next) => {
    setSession(next);
    const seed = {};
    (next?.lines || []).forEach((line) => {
      seed[line.id] = line.counted_qty == null ? '' : String(line.counted_qty);
    });
    setDrafts(seed);
  };

  const refresh = useCallback(async () => {
    const data = await inventoryApi.get();
    applySession(data?.session || null);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message || 'Impossible de charger l’inventaire'))
      .finally(() => setLoaded(true));
  }, [refresh]);

  const lines = session?.lines || [];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) => `${line.product_name} ${line.sku} ${line.batch_number}`.toLowerCase().includes(needle));
  }, [lines, query]);
  const pharmacy = session?.sector === 'retail' || session?.sector === 'wholesale';
  const counted = lines.filter((line) => drafts[line.id] !== '' && drafts[line.id] != null).length;

  const start = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const data = await inventoryApi.open();
      applySession(data.session);
    } catch (err) {
      setError(err.message || 'Impossible d’ouvrir l’inventaire');
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!counted) {
      setError('Indiquez au moins une quantité comptée.');
      return;
    }
    if (!window.confirm('Valider l’inventaire ? Les articles comptés seront alignés sur la quantité saisie. Les articles laissés vides ne changent pas.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await inventoryApi.validate(payload(lines, drafts));
      setSession(null);
      const missing = (result.missing || []).length
        ? ` ${result.missing.length} article(s) introuvable(s) ignoré(s).`
        : '';
      setInfo(`${result.adjusted} mouvement(s) enregistré(s), ${result.unchanged} déjà juste(s).${missing}`);
      if (onDone) await onDone();
    } catch (err) {
      setError(err.message || 'Impossible de valider l’inventaire');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Abandonner cet inventaire ? Aucun stock ne sera modifié.')) return;
    setBusy(true);
    setError('');
    try {
      await inventoryApi.cancel();
      setSession(null);
      setInfo('Inventaire abandonné.');
    } catch (err) {
      setError(err.message || 'Impossible d’abandonner l’inventaire');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  if (!session) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-ink flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Inventaire
          </p>
          <p className="text-sm text-ink-muted">Comptez le stock réel, puis validez les écarts en une fois.</p>
          {info && <p className="text-sm text-primary mt-1">{info}</p>}
          {error && <p className="text-sm text-alert mt-1">{error}</p>}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={start}
          className="px-4 py-2 rounded-xl bg-accent text-ink text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Ouverture…' : 'Faire l’inventaire'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-ink flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Inventaire en cours
          </p>
          <p className="text-sm text-ink-muted">
            L’écart est recalculé sur le stock actuel. Une vente pendant le comptage ne fausse pas le résultat.
          </p>
          {session.moved_count > 0 && (
            <p className="text-sm text-ink mt-1">
              {session.moved_count} article(s) ont bougé depuis l’ouverture.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={cancel} disabled={busy} className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold">
            Abandonner
          </button>
          <button type="button" onClick={validate} disabled={busy} className="px-3 py-2 rounded-xl bg-accent text-ink text-sm font-semibold disabled:opacity-50">
            {busy ? 'Validation…' : `Valider (${counted})`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filtrer un article…"
        className="search-panel w-full max-w-md px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-ink-muted text-left">
            <tr>
              <th className="px-2 py-2">Article</th>
              {pharmacy ? <th className="px-2 py-2">Lot / péremption</th> : <th className="px-2 py-2">SKU</th>}
              <th className="px-2 py-2">À l’ouverture</th>
              <th className="px-2 py-2">Actuel</th>
              <th className="px-2 py-2">Compté</th>
              <th className="px-2 py-2">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((line) => {
              const raw = drafts[line.id];
              const countedQty = raw === '' || raw == null ? null : Number(raw);
              const gap = countedQty == null || line.current_qty == null ? null : countedQty - Number(line.current_qty);
              return (
                <tr key={line.id}>
                  <td className="px-2 py-2 font-semibold text-ink">{line.product_name}</td>
                  <td className="px-2 py-2 text-xs text-ink-muted">
                    {pharmacy
                      ? `${line.batch_number || '—'}${line.expiration_date ? ` · ${line.expiration_date}` : ''}`
                      : (line.sku || '—')}
                  </td>
                  <td className="px-2 py-2">{line.theoretical_qty}</td>
                  <td className={`px-2 py-2 font-semibold ${line.stock_moved ? 'text-alert' : 'text-ink'}`}>
                    {line.missing ? 'Introuvable' : line.current_qty}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={raw}
                      aria-label={`Quantité comptée pour ${line.product_name}`}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [line.id]: event.target.value }))}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2 font-semibold">
                    {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
