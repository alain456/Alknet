import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import providerService from './providerService';

const empty = {
  client_name: '',
  client_email: '',
  client_phone: '',
  client_address: '',
  service_id: '',
  message: '',
};

const fieldClass = 'w-full border border-border rounded-lg px-3 py-2 bg-white';

const displayName = (user) => (
  user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : ''
);

export default function ContactRequestForm({ providerId, offerId, offerTitle, offers = [] }) {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [followUrl, setFollowUrl] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      client_name: prev.client_name || displayName(user),
      client_email: prev.client_email || user.email || '',
      client_phone: prev.client_phone || user.phone_number || '',
    }));
  }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    setFollowUrl('');
    setReference('');
    try {
      if (!form.client_phone.trim()) {
        throw new Error('Indiquez un téléphone.');
      }
      const chosenService = offerId || form.service_id || undefined;
      const payload = {
        client_name: form.client_name,
        client_email: form.client_email,
        client_phone: form.client_phone,
        client_address: form.client_address,
        message: form.message,
        service_id: chosenService,
      };
      const result = offerId
        ? await providerService.contactOffer(offerId, payload)
        : await providerService.contactProvider(providerId, payload);
      setDone(result.message || 'Votre demande a été envoyée.');
      setFollowUrl(result.follow_url || '');
      setReference(result.reference || '');
      setForm({
        ...empty,
        client_name: displayName(user),
        client_email: user?.email || '',
        client_phone: user?.phone_number || '',
      });
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 space-y-3">
      <h2 className="text-lg font-bold text-ink">Contactez-nous</h2>
      {offerTitle && (
        <p className="text-sm text-ink-muted">Au sujet de : {offerTitle}</p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      {done && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">{done}</p>
          {reference ? <p className="text-sm text-ink-muted">Numéro de dossier : {reference}</p> : null}
          {followUrl ? (
            <a href={followUrl} className="text-sm text-primary font-semibold">Suivre cette demande</a>
          ) : null}
        </div>
      )}
      <label className="block text-sm space-y-1">
        <span className="font-medium text-ink">Nom et prénom *</span>
        <input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className={fieldClass} />
      </label>
      <label className="block text-sm space-y-1">
        <span className="font-medium text-ink">E-mail *</span>
        <input required type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className={fieldClass} />
      </label>
      <label className="block text-sm space-y-1">
        <span className="font-medium text-ink">Téléphone *</span>
        <input
          required
          value={form.client_phone}
          onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm space-y-1">
        <span className="font-medium text-ink">Adresse *</span>
        <input required value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} className={fieldClass} />
      </label>
      {!offerId && offers.length > 0 && (
        <label className="block text-sm space-y-1">
          <span className="font-medium text-ink">Service concerné</span>
          <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className={fieldClass}>
            <option value="">Demande générale</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>{offer.title}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm space-y-1">
        <span className="font-medium text-ink">Votre besoin *</span>
        <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={fieldClass} />
      </label>
      <button type="submit" disabled={busy} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-40">
        {busy ? 'Envoi…' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
