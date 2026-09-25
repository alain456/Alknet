import React, { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import hotelService from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';
import { readImageAsDataUrl } from '../../shared/components/BusinessRegistrationForm';

const emptyGuestInfo = () => ({
  wifi: '',
  reception: '',
  safety: '',
  wellness: '',
  room_guide: '',
  dining: { breakfast: '', restaurant: '', room_service: '' },
  local_tips: [],
  gallery: [],
});

export default function HotelCompany() {
  const { canUpdate } = useHotelPerm();
  const canEdit = canUpdate('company');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    hotelService.profile().then((p) => {
      const gi = { ...emptyGuestInfo(), ...(p.guest_info || {}) };
      gi.dining = { ...emptyGuestInfo().dining, ...(gi.dining || {}) };
      gi.local_tips = Array.isArray(gi.local_tips) ? gi.local_tips : [];
      gi.gallery = Array.isArray(gi.gallery) ? gi.gallery.filter(Boolean) : [];
      setForm({
        ...p,
        amenities_text: Array.isArray(p.amenities) ? p.amenities.join(', ') : '',
        guest_info: gi,
      });
    }).catch((e) => setErr(e.message));
  }, []);

  const setGuest = (key, value) => {
    setForm((prev) => ({
      ...prev,
      guest_info: { ...prev.guest_info, [key]: value },
    }));
  };

  const setDining = (key, value) => {
    setForm((prev) => ({
      ...prev,
      guest_info: {
        ...prev.guest_info,
        dining: { ...prev.guest_info.dining, [key]: value },
      },
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      setErr('Droit insuffisant pour modifier la fiche hôtel.');
      return;
    }
    setMsg('');
    setErr('');
    try {
      const amenities = (form.amenities_text || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tips = (form.guest_info.local_tips || [])
        .filter((t) => (t.title || t.detail || '').trim());
      const gallery = Array.isArray(form.guest_info.gallery)
        ? form.guest_info.gallery.filter(Boolean).slice(0, 8)
        : [];
      const updated = await hotelService.updateProfile({
        trade_name: form.trade_name,
        establishment_type: form.establishment_type || 'HOTEL',
        stars: form.stars ? Number(form.stars) : null,
        license_number: form.license_number,
        status: form.status,
        check_in_time: form.check_in_time,
        check_out_time: form.check_out_time,
        customer_service_hours: form.customer_service_hours || '',
        languages: Array.isArray(form.languages)
          ? form.languages
          : String(form.languages_text || '').split(',').map((s) => s.trim()).filter(Boolean),
        currency: form.currency,
        cancellation_policy: form.cancellation_policy,
        stay_conditions: form.stay_conditions || '',
        deposit_policy: form.deposit_policy || '',
        pets_allowed: !!form.pets_allowed,
        smoking_allowed: !!form.smoking_allowed,
        reference_prefix: form.reference_prefix,
        amenities,
        guest_info: { ...form.guest_info, local_tips: tips, gallery },
      });
      const gi = { ...emptyGuestInfo(), ...(updated.guest_info || {}) };
      gi.dining = { ...emptyGuestInfo().dining, ...(gi.dining || {}) };
      gi.local_tips = Array.isArray(gi.local_tips) ? gi.local_tips : [];
      gi.gallery = Array.isArray(gi.gallery) ? gi.gallery.filter(Boolean) : [];
      setForm({
        ...updated,
        amenities_text: Array.isArray(updated.amenities) ? updated.amenities.join(', ') : '',
        guest_info: gi,
      });
      setMsg('Profil enregistré.');
    } catch (ex) {
      setErr(ex.message || 'Erreur');
    }
  };

  if (!form) return <HotelPage title="Mon hôtel"><Empty>{err || 'Chargement…'}</Empty></HotelPage>;

  const gi = form.guest_info || emptyGuestInfo();

  return (
    <HotelPage
      title="Mon hôtel"
      subtitle={canEdit
        ? (form.business_name || '')
        : `${form.business_name || ''} · lecture seule`}
    >
      <Panel>
        <form onSubmit={save} className="space-y-6 max-w-3xl">
          <fieldset disabled={!canEdit} className="space-y-6 border-0 p-0 m-0 min-w-0 disabled:opacity-90">
          {msg && <p className="text-sm font-bold text-primary">{msg}</p>}
          {err && <p className="text-sm font-bold text-alert">{err}</p>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-ink">Nom commercial</label>
              <input className={fieldClass} value={form.trade_name || ''} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Type d&apos;établissement</label>
              <select className={fieldClass} value={form.establishment_type || 'HOTEL'} onChange={(e) => setForm({ ...form, establishment_type: e.target.value })}>
                <option value="HOTEL">Hôtel</option>
                <option value="GUEST_HOUSE">Guest house</option>
                <option value="LODGE">Lodge</option>
                <option value="RESIDENCE">Résidence</option>
                <option value="HOSTEL">Auberge</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Étoiles déclarées</label>
              <input type="number" min="1" max="5" className={fieldClass} value={form.stars || ''} onChange={(e) => setForm({ ...form, stars: e.target.value })} />
              <p className="text-[11px] text-ink-muted mt-1">
                Les étoiles vérifiées sont validées par l&apos;admin plateforme
                {form.classification_verified && form.stars_verified != null
                  ? ` (actuellement ${form.stars_verified}★ vérifiées)`
                  : ' (pas encore vérifiées)'}
                .
              </p>
            </div>
            <div>
              <label className="text-sm font-bold text-ink">N° autorisation</label>
              <input className={fieldClass} value={form.license_number || ''} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Statut</label>
              <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Actif</option>
                <option value="SUSPENDED">Suspendu</option>
                <option value="CLOSED">Fermé</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Horaires service clientèle</label>
              <input className={fieldClass} placeholder="Lun–Dim 07:00–22:00" value={form.customer_service_hours || ''} onChange={(e) => setForm({ ...form, customer_service_hours: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Check-in</label>
              <input type="time" className={fieldClass} value={(form.check_in_time || '14:00').slice(0, 5)} onChange={(e) => setForm({ ...form, check_in_time: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Check-out</label>
              <input type="time" className={fieldClass} value={(form.check_out_time || '12:00').slice(0, 5)} onChange={(e) => setForm({ ...form, check_out_time: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Langues parlées</label>
              <input
                className={fieldClass}
                placeholder="fr, en, rn (séparées par des virgules)"
                value={Array.isArray(form.languages) ? form.languages.join(', ') : (form.languages_text || '')}
                onChange={(e) => setForm({ ...form, languages_text: e.target.value, languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Devise</label>
              <select className={fieldClass} value={form.currency || 'BIF'} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="BIF">BIF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Préfixe références</label>
              <input className={fieldClass} value={form.reference_prefix || 'HOT'} onChange={(e) => setForm({ ...form, reference_prefix: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-ink cursor-pointer">
              <input type="checkbox" checked={!!form.pets_allowed} onChange={(e) => setForm({ ...form, pets_allowed: e.target.checked })} />
              Animaux acceptés
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink cursor-pointer">
              <input type="checkbox" checked={!!form.smoking_allowed} onChange={(e) => setForm({ ...form, smoking_allowed: e.target.checked })} />
              Fumeur autorisé
            </label>
          </div>

          <div>
            <label className="text-sm font-bold text-ink">Politique d&apos;annulation</label>
            <textarea rows={3} className={fieldClass} value={form.cancellation_policy || ''} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold text-ink">Conditions de séjour</label>
            <textarea rows={3} className={fieldClass} placeholder="Documents, âge minimum, visiteurs, dépôt…" value={form.stay_conditions || ''} onChange={(e) => setForm({ ...form, stay_conditions: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold text-ink">Dépôt de garantie</label>
            <textarea rows={2} className={fieldClass} value={form.deposit_policy || ''} onChange={(e) => setForm({ ...form, deposit_policy: e.target.value })} />
          </div>

          <div>
            <label className="text-sm font-bold text-ink">Équipements (séparés par des virgules)</label>
            <input
              className={fieldClass}
              placeholder="Wi‑Fi, Piscine, Spa, Salle de sport…"
              value={form.amenities_text || ''}
              onChange={(e) => setForm({ ...form, amenities_text: e.target.value })}
            />
          </div>

          <div className="border-t-2 border-accent/30 pt-4 space-y-4">
            <h3 className="font-extrabold text-ink">Infos clients (fiche publique)</h3>
            <p className="text-xs text-ink-muted">Ces textes apparaissent avant la réservation sur la page établissement.</p>

            <div>
              <label className="text-sm font-bold text-ink flex items-center gap-1.5 mb-1">
                <ImagePlus className="w-4 h-4 text-accent" /> Galerie photos (hero & cartes clients)
              </label>
              <p className="text-[11px] text-ink-muted mb-2">
                La 1ʳᵉ photo sert de couverture. Max 8. Sinon : photos des types de chambres / logo.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(gi.gallery || []).map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-accent">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      title="Retirer"
                      onClick={() => setGuest(
                        'gallery',
                        (gi.gallery || []).filter((_, idx) => idx !== i),
                      )}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-alert text-white text-xs font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {(gi.gallery || []).length < 8 && (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-accent bg-primary/5 text-xs font-bold text-ink cursor-pointer hover:bg-primary/10">
                  <ImagePlus className="w-4 h-4 text-accent" />
                  Ajouter une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        const dataUrl = await readImageAsDataUrl(file, { maxSide: 1400, quality: 0.78 });
                        setGuest('gallery', [...(gi.gallery || []), dataUrl].slice(0, 8));
                        setErr('');
                      } catch (ex) {
                        setErr(ex.message || 'Image invalide');
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold text-ink">Wi‑Fi</label>
                <input className={fieldClass} placeholder="Réseau / accès" value={gi.wifi || ''} onChange={(e) => setGuest('wifi', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold text-ink">Réception</label>
                <input className={fieldClass} placeholder="Horaires, consignes" value={gi.reception || ''} onChange={(e) => setGuest('reception', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Sécurité</label>
              <textarea rows={2} className={fieldClass} value={gi.safety || ''} onChange={(e) => setGuest('safety', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Bien-être (spa, piscine…)</label>
              <input className={fieldClass} value={gi.wellness || ''} onChange={(e) => setGuest('wellness', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-bold text-ink">Guide chambre</label>
              <textarea rows={2} className={fieldClass} placeholder="Clim, TV, coffre…" value={gi.room_guide || ''} onChange={(e) => setGuest('room_guide', e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-bold text-ink">Petit-déjeuner</label>
                <input className={fieldClass} value={gi.dining?.breakfast || ''} onChange={(e) => setDining('breakfast', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold text-ink">Restaurant</label>
                <input className={fieldClass} value={gi.dining?.restaurant || ''} onChange={(e) => setDining('restaurant', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold text-ink">Room service</label>
                <input className={fieldClass} value={gi.dining?.room_service || ''} onChange={(e) => setDining('room_service', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-bold text-ink">Recommandations locales</label>
                <button
                  type="button"
                  className="text-sm font-bold text-accent"
                  onClick={() => setGuest('local_tips', [...(gi.local_tips || []), { title: '', detail: '' }])}
                >
                  + Ajouter
                </button>
              </div>
              {(gi.local_tips || []).map((tip, i) => (
                <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
                  <input
                    className={fieldClass}
                    placeholder="Titre"
                    value={tip.title || ''}
                    onChange={(e) => {
                      const next = [...gi.local_tips];
                      next[i] = { ...next[i], title: e.target.value };
                      setGuest('local_tips', next);
                    }}
                  />
                  <input
                    className={fieldClass}
                    placeholder="Détail"
                    value={tip.detail || ''}
                    onChange={(e) => {
                      const next = [...gi.local_tips];
                      next[i] = { ...next[i], detail: e.target.value };
                      setGuest('local_tips', next);
                    }}
                  />
                  <button
                    type="button"
                    className="text-sm font-bold text-alert px-2"
                    onClick={() => setGuest('local_tips', gi.local_tips.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-muted">Adresse / téléphone issus de la fiche entreprise ({form.address || '—'} · {form.phone || '—'}). Site web : Paramètres → Site web officiel.</p>
          </fieldset>
          {canEdit ? (
            <button type="submit" className={btnPrimary}>Enregistrer</button>
          ) : (
            <p className="text-xs font-bold text-ink-muted">Lecture seule — pas de droit de modification.</p>
          )}
        </form>
      </Panel>
    </HotelPage>
  );
}
