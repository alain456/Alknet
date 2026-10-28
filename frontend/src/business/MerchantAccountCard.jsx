import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/** Compte marchand BurundiPay de l'entreprise, distinct de l'abonnement Isoko Hub. */
export default function MerchantAccountCard({ hint }) {
  const { token, authFetch } = useAuth();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    authFetch('/api/v1/businesses/me/')
      .then(async (response) => {
        if (!response.ok) throw new Error('Impossible de charger le compte marchand.');
        const data = await response.json();
        const business = Array.isArray(data) ? data[0] : data;
        if (!cancelled && business) {
          setValue(business.burundipay_merchant_account || '');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Impossible de charger le compte marchand.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, authFetch]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await authFetch('/api/v1/businesses/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burundipay_merchant_account: value.trim() }),
      });
      if (!response.ok) throw new Error('Le compte marchand n’a pas été enregistré.');
      const saved = await response.json();
      setValue(saved.burundipay_merchant_account || value.trim());
      setMessage('Compte marchand enregistré. Les prochains paiements clients y seront rattachés.');
    } catch (err) {
      setError(err.message || 'Le compte marchand n’a pas été enregistré.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-2xl border-2 border-accent bg-surface p-4 space-y-3">
      <h2 className="font-extrabold text-ink">Compte marchand BurundiPay</h2>
      <p className="text-sm text-ink-muted">
        {hint || 'Ce compte reçoit les paiements des clients. Il est distinct de l’abonnement Isoko Hub.'}
      </p>
      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Compte fourni par BurundiPay"
          className="w-full px-3 py-2 rounded-xl border-2 border-accent text-sm text-ink bg-white"
        />
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
      {message && <p className="text-sm font-medium text-ink">{message}</p>}
      <button type="submit" disabled={saving || loading} className="px-4 py-2 rounded-xl bg-accent text-ink text-sm font-bold disabled:opacity-50">
        {saving ? 'Enregistrement…' : 'Enregistrer le compte'}
      </button>
    </form>
  );
}
