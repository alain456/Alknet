import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Save, RefreshCw } from 'lucide-react';
import hotelService from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../auth/roleAccess';
import { useHotelPerm } from '../useHotelPerm';

const PLACEHOLDERS = [
  '{guest_name}', '{hotel_name}', '{reference}', '{check_in}', '{check_out}',
  '{amount}', '{currency}', '{room_type}', '{room_number}', '{payment_status}',
  '{actual_check_in}', '{actual_check_out}', '{invoice_number}', '{invoice_total}', '{reason}',
];

const FIELDS = [
  {
    key: 'reservation_request_email_message',
    label: 'Message — demande reçue',
    hint: 'Envoyé au client dès qu’une demande de réservation est créée.',
    group: 'reservations',
  },
  {
    key: 'reservation_confirm_email_message',
    label: 'Message — confirmation',
    hint: 'Envoyé lorsque l’agent confirme la réservation.',
    group: 'reservations',
  },
  {
    key: 'reservation_reject_email_message',
    label: 'Message — refus',
    hint: 'Envoyé lorsque l’agent refuse une demande en attente.',
    group: 'reservations',
  },
  {
    key: 'check_in_email_message',
    label: 'Message — check-in (réception)',
    hint: 'Envoyé automatiquement au client après un check-in réussi.',
    group: 'front',
  },
  {
    key: 'check_out_email_message',
    label: 'Message — check-out (réception)',
    hint: 'Envoyé automatiquement au client après un check-out réussi.',
    group: 'front',
  },
];

const emptyForm = () => Object.fromEntries(FIELDS.map((f) => [f.key, '']));

export default function HotelReservationSettings({ focus = 'all' }) {
  const { user } = useAuth();
  const { canUpdate } = useHotelPerm();
  const canEdit = canUpdate('reservations');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const visibleFields = FIELDS.filter((f) => {
    if (focus === 'front') return f.group === 'front';
    if (focus === 'reservations') return f.group === 'reservations';
    return true;
  });

  const load = async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await hotelService.profile();
      const next = emptyForm();
      FIELDS.forEach((f) => { next[f.key] = data[f.key] || ''; });
      setForm(next);
    } catch (err) {
      setError(err.message || 'Impossible de charger les messages.');
    } finally {
      if (!soft) setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === ROLES.BUSINESS_OWNER) return;
    load();
  }, [user?.role]);

  // Propriétaire : menu masqué ; staff sans update : lecture seule / redirection
  if (user?.role === ROLES.BUSINESS_OWNER) {
    return <Navigate to="/hotel/dashboard" replace />;
  }
  if (!canEdit) {
    return <Navigate to="/hotel/dashboard" replace />;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      visibleFields.forEach((f) => { payload[f.key] = form[f.key]; });
      const data = await hotelService.updateProfile(payload);
      const next = { ...form };
      FIELDS.forEach((f) => { next[f.key] = data[f.key] ?? next[f.key]; });
      setForm(next);
      setSuccess('Messages enregistrés. Ils seront utilisés pour les prochains emails.');
    } catch (err) {
      setError(err.message || 'Erreur de sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <HotelPage
      title="Paramètres"
      subtitle={
        focus === 'front'
          ? 'Messages email check-in / check-out (réception)'
          : focus === 'reservations'
            ? 'Messages email réservation (demande, confirmation, refus)'
            : 'Messages email prédéfinis (réservation + réception)'
      }
    >
      <Panel>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-accent flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Textes envoyés au client</p>
            <p className="text-xs text-ink-muted mt-0.5 font-medium">
              Placeholders :{' '}
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="text-[10px] bg-accent/10 px-1 py-0.5 rounded mr-1">{p}</code>
              ))}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink-muted font-medium py-4">Chargement…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="text-xs text-alert bg-alert/10 border border-alert/30 p-3 rounded-xl font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs text-primary bg-primary/10 border border-primary/30 p-3 rounded-xl font-medium">
                {success}
              </div>
            )}

            {visibleFields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-ink mb-1">{f.label}</label>
                <p className="text-[11px] text-ink-muted mb-2 font-medium">{f.hint}</p>
                <textarea
                  rows={8}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className={`${fieldClass} font-mono text-xs leading-relaxed resize-y min-h-[140px]`}
                />
              </div>
            ))}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" onClick={() => load({ soft: true })} className={`${btnGhost} inline-flex items-center gap-1.5`}>
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
              </button>
              <button type="submit" disabled={saving} className={`${btnPrimary} inline-flex items-center gap-1.5`}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </Panel>
    </HotelPage>
  );
}
