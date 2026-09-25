import React, { useCallback, useEffect, useState } from 'react';
import { Hotel, RefreshCw, Star, Ban, CheckCircle2, Play, X } from 'lucide-react';
import hotelService from '../hotel/hotelService';
import { useAuth } from '../context/AuthContext';
import { userHasPlatformPerm } from '../auth/platformPermissions';

export default function AdminHotelsPage() {
  const { user } = useAuth();
  const canSuspend = userHasPlatformPerm(user, 'platform.businesses.suspend')
    || user?.role === 'SUPER_ADMIN'
    || user?.is_superuser;
  const canVerify = userHasPlatformPerm(user, 'platform.businesses.update')
    || userHasPlatformPerm(user, 'platform.businesses.approve')
    || canSuspend;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [classifyHotel, setClassifyHotel] = useState(null);
  const [starsDraft, setStarsDraft] = useState(3);
  const [verifiedDraft, setVerifiedDraft] = useState(true);
  const [noteDraft, setNoteDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await hotelService.platformHotels();
      setData(payload);
    } catch (err) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3500);
  };

  const setStatus = async (hotel, status) => {
    setBusyId(hotel.id);
    setError('');
    try {
      await hotelService.platformHotelStatus(hotel.id, status);
      flash(status === 'ACTIVE' ? `${hotel.name} réactivé` : `${hotel.name} → ${status}`);
      await load();
    } catch (err) {
      setError(err.message || 'Échec statut');
    } finally {
      setBusyId('');
    }
  };

  const openClassify = (hotel) => {
    setClassifyHotel(hotel);
    setStarsDraft(Number(hotel.stars_verified ?? hotel.stars ?? 3) || 0);
    setVerifiedDraft(true);
    setNoteDraft('');
    setError('');
  };

  const submitClassify = async (event) => {
    event.preventDefault();
    if (!classifyHotel) return;
    const stars = Number(starsDraft);
    if (!Number.isFinite(stars) || stars < 0 || stars > 5) {
      setError('Étoiles invalides (0–5).');
      return;
    }
    setBusyId(classifyHotel.id);
    setError('');
    try {
      await hotelService.platformHotelVerifyClassification(classifyHotel.id, {
        stars_verified: stars,
        classification_verified: verifiedDraft,
        note: noteDraft.trim(),
      });
      flash(
        verifiedDraft
          ? `Classification vérifiée : ${stars}★ — ${classifyHotel.name}`
          : `Classification non vérifiée enregistrée — ${classifyHotel.name}`,
      );
      setClassifyHotel(null);
      await load();
    } catch (err) {
      setError(err.message || 'Échec vérification');
    } finally {
      setBusyId('');
    }
  };

  const hotels = data?.hotels || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Hotel className="w-6 h-6 text-primary" /> Hôtels plateforme
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Suspension, réactivation et vérification de classification (étoiles).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
        >
          <RefreshCw className="w-4 h-4" /> Rafraîchir
        </button>
      </header>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        {[
          ['Hôtels', totals.hotels ?? hotels.length],
          ['Chambres', totals.rooms ?? 0],
          ['Occupées', totals.occupied ?? 0],
          ['In-house', totals.in_house ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
            <p className="text-2xl font-extrabold text-primary mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Chargement…</p>
        ) : hotels.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Aucun hôtel enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Hôtel</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">★</th>
                  <th className="px-4 py-3">Occ.</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => {
                  const busy = busyId === h.id;
                  const suspended = h.status === 'SUSPENDED' || h.status === 'CLOSED' || h.is_active === false;
                  return (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900 dark:text-white">{h.name}</p>
                        <p className="text-xs text-gray-500">
                          {[h.city, h.establishment_type].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          suspended
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                        }`}>
                          {h.status || (suspended ? 'SUSPENDED' : 'ACTIVE')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          {h.stars_verified ?? h.stars ?? '—'}
                          {h.classification_verified ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" title="Vérifié" />
                          ) : null}
                        </span>
                        <p className="text-[11px] text-gray-400">déclaré {h.stars ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {h.occupancy_rate}%
                        <span className="block text-[11px] text-gray-400 font-normal">
                          {h.rooms_occupied}/{h.rooms_total}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canVerify ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openClassify(h)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold text-primary border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                            >
                              <Star className="w-3.5 h-3.5" /> Vérifier ★
                            </button>
                          ) : null}
                          {canSuspend ? (
                            suspended ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setStatus(h, 'ACTIVE')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
                              >
                                <Play className="w-3.5 h-3.5" /> Activer
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setStatus(h, 'SUSPENDED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-950/40"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspendre
                              </button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {classifyHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="classify-title"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="classify-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  Classification hôtelière
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{classifyHotel.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Déclaré : {classifyHotel.stars ?? '—'}★
                  {classifyHotel.classification_verified
                    ? ` · actuellement vérifié ${classifyHotel.stars_verified ?? '—'}★`
                    : ' · non vérifié'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClassifyHotel(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitClassify} className="space-y-4">
              <fieldset>
                <legend className="text-xs font-bold uppercase text-gray-500 mb-2">Étoiles vérifiées</legend>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStarsDraft(n)}
                      className={`min-w-[2.5rem] px-3 py-2 rounded-xl border text-sm font-bold ${
                        starsDraft === n
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={verifiedDraft}
                  onChange={(e) => setVerifiedDraft(e.target.checked)}
                />
                <span>
                  Marquer la classification comme <strong>vérifiée</strong> (affichage public).
                  Décochez pour retirer le badge sans changer le nombre déclaré.
                </span>
              </label>

              <label className="block text-sm space-y-1">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Note d’audit (optionnel)</span>
                <textarea
                  rows={2}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ex. contrôle classement OT 2026…"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setClassifyHotel(null)}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busyId === classifyHotel.id}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
                >
                  {busyId === classifyHotel.id ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
