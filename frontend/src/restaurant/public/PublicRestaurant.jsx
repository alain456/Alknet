import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, History, MapPin, Phone, Utensils } from 'lucide-react';
import restaurantService, { listOf } from '../restaurantService';
import { btnPrimary, fieldClass } from '../ui';
import { googleMapsSearchUrl } from '../../shared/mapLink';
import { useAuth } from '../../context/AuthContext';

const SECTIONS = {
  entrees: 'Entrées',
  plats: 'Plats',
  desserts: 'Desserts',
  boissons: 'Boissons',
  autre: 'Autre',
};

function Section({ id, title, icon: Icon, children }) {
  return (
    <section id={id} className="bg-surface rounded-2xl p-5 space-y-3 scroll-mt-36">
      <h2 className="text-lg font-extrabold text-ink flex items-center gap-2 font-display">
        {Icon && <Icon className="w-5 h-5 text-accent shrink-0" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PublicRestaurant() {
  const { id } = useParams();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: 2,
    date: '',
    time: '19:00',
    notes: '',
  });

  useEffect(() => {
    restaurantService.publicVenue(id).then(setVenue).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      guest_name: prev.guest_name || [user.first_name, user.last_name].filter(Boolean).join(' '),
      guest_email: prev.guest_email || user.email || '',
      guest_phone: prev.guest_phone || user.phone_number || '',
    }));
  }, [user]);

  const menu = listOf(venue?.menu);
  const grouped = menu.reduce((acc, item) => {
    const key = item.section || 'autre';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
  const mapHref = googleMapsSearchUrl({
    lat: venue?.latitude,
    lng: venue?.longitude,
    address: venue?.address,
  });

  const book = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setOk('');
    try {
      await restaurantService.publicBook(id, {
        guest_name: form.guest_name,
        guest_phone: form.guest_phone,
        guest_email: form.guest_email,
        party_size: Number(form.party_size) || 2,
        booked_for: `${form.date}T${form.time}:00`,
        notes: form.notes,
      });
      setOk('Demande envoyée. L’établissement confirmera votre table.');
    } catch (error) {
      setErr(error.message || 'Réservation impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (!venue && !err) return <p className="p-8 text-ink-muted">Chargement…</p>;
  if (!venue) return <p className="p-8 text-error">{err}</p>;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="relative overflow-hidden min-h-[min(52vh,420px)] flex flex-col justify-end">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 10%, #EA8B33 0%, transparent 45%), linear-gradient(160deg, #132F45 0%, #153a75 55%, #4a1512 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
        <div className="school-dash-hero relative max-w-5xl mx-auto w-full px-4 pt-10 pb-10 space-y-4">
          <Link to="/restaurants" className="text-sm font-bold text-accent inline-flex items-center gap-1 hover:underline">
            ← Restaurants & cafés
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {venue.venue_kind_label || 'Restaurant'}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight">
            {venue.trade_name || venue.name}
          </h1>
          {venue.cuisine_type ? <p className="font-medium">{venue.cuisine_type}</p> : null}
          <p className="font-medium flex items-start gap-2 text-sm sm:text-base">
            <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span>{venue.address || 'Adresse non renseignée'}</span>
          </p>
        </div>
      </header>

      <nav className="sticky top-16 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap gap-2">
          {[
            { href: '#infos', label: 'Infos' },
            { href: '#menu', label: 'Menu' },
            { href: '#reserver', label: 'Réserver' },
            { href: `/restaurants/${id}/historique`, label: 'Historique', to: true },
          ].map((item) => (
            item.to ? (
              <Link key={item.label} to={item.href} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-surface text-ink inline-flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-surface text-ink">
                {item.label}
              </a>
            )
          ))}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <Section id="infos" title="Infos" icon={MapPin}>
          {venue.description ? <p className="text-sm text-ink">{venue.description}</p> : null}
          {venue.opening_hours ? (
            <p className="text-sm text-ink-muted flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" /> {venue.opening_hours}
            </p>
          ) : null}
          {venue.phone ? (
            <p className="text-sm text-ink-muted flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" /> {venue.phone}
            </p>
          ) : null}
          {mapHref ? (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex font-bold text-accent hover:underline">
              Voir sur Google Maps
            </a>
          ) : null}
          <p className="text-xs text-ink-muted">
            {[venue.takeaway && 'À emporter', venue.delivery && 'Livraison', venue.seats && `${venue.seats} places`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </Section>

        <Section id="menu" title="Menu" icon={Utensils}>
          {menu.length === 0 ? (
            <p className="text-sm text-ink-muted">Le menu n’est pas encore publié.</p>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="space-y-2">
                <h3 className="text-sm font-extrabold text-ink">{SECTIONS[section] || section}</h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink">{item.name}</p>
                        {item.description ? <p className="text-xs text-ink-muted">{item.description}</p> : null}
                      </div>
                      <p className="text-sm font-extrabold text-ink shrink-0">
                        {Number(item.price || 0).toLocaleString('fr-FR')} {item.currency || 'BIF'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Section>

        <Section id="reserver" title="Réserver une table" icon={Utensils}>
          {!venue.reservations_open ? (
            <p className="text-sm text-ink-muted">Les réservations en ligne sont fermées pour le moment.</p>
          ) : (
            <form onSubmit={book} className="grid sm:grid-cols-2 gap-3">
              {err && <p className="sm:col-span-2 text-error text-sm">{err}</p>}
              {ok && <p className="sm:col-span-2 text-sm font-bold text-ink">{ok}</p>}
              <input className={fieldClass} required placeholder="Votre nom" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
              <input className={fieldClass} placeholder="Téléphone" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
              <input className={fieldClass} type="email" placeholder="E-mail" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} />
              <input className={fieldClass} type="number" min="1" max="40" value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} />
              <input className={fieldClass} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className={fieldClass} type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              <textarea className={`sm:col-span-2 ${fieldClass}`} rows={3} placeholder="Note (anniversaire, terrasse…)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Envoi…' : 'Demander une table'}
              </button>
            </form>
          )}
        </Section>
      </div>
    </div>
  );
}
