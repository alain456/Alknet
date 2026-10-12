import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, GraduationCap, MapPin, Phone, Globe, Mail, BookOpen, Award, ShieldCheck,
  Landmark, Library, Bus, UtensilsCrossed, Wrench, HeartPulse, CalendarDays,
  ExternalLink, FileText, Briefcase,
} from 'lucide-react';
import educationService from './educationService';
import { EDUCATION_ENUM_FALLBACK, loadEducationEnums } from './educationEnums';
import SchoolHistoryCarousel from './SchoolHistoryCarousel';

function mapGrid(lat, lon, zoom = 16) {
  const n = 2 ** zoom;
  const xFloat = (Number(lon) + 180) / 360 * n;
  const latRad = (Number(lat) * Math.PI) / 180;
  const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  const tiles = [];
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      tiles.push({
        key: `${x + col}-${y + row}`,
        src: `/api/v1/locations/map-tile/${zoom}/${x + col}/${y + row}.png`,
      });
    }
  }
  return {
    tiles,
    left: `${(((xFloat - (x - 1)) / 3) * 100).toFixed(2)}%`,
    top: `${(((yFloat - (y - 1)) / 3) * 100).toFixed(2)}%`,
  };
}
function offerSections(units, programs) {
  const byParent = new Map();
  units.forEach((unit) => {
    const key = unit.parent || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(unit);
  });
  const used = new Set();
  const take = (id) => programs.filter((program) => {
    if (String(program.unit || '') !== String(id)) return false;
    used.add(program.id);
    return true;
  });
  const sections = [];
  (byParent.get('') || []).forEach((root) => {
    sections.push({
      key: root.id,
      title: root.name,
      eyebrow: root.kind_label,
      description: root.description,
      programs: take(root.id),
    });
    (byParent.get(root.id) || []).forEach((dept) => {
      sections.push({
        key: dept.id,
        title: dept.name,
        eyebrow: dept.kind_label,
        description: dept.description,
        nested: true,
        programs: take(dept.id),
      });
    });
  });
  const loose = programs.filter((program) => !used.has(program.id));
  if (loose.length) {
    sections.push({
      key: 'loose',
      title: units.length ? 'Autres formations' : '',
      programs: loose,
    });
  }
  return sections.filter((section) => section.programs.length || section.description);
}

/** Icône selon le libellé du service saisi par l'établissement. */
function serviceIcon(label = '') {
  const l = label.toLowerCase();
  if (l.includes('biblioth')) return Library;
  if (l.includes('transport') || l.includes('bus')) return Bus;
  if (l.includes('restaur') || l.includes('cantine') || l.includes('repas')) return UtensilsCrossed;
  if (l.includes('santé') || l.includes('sante') || l.includes('infirm') || l.includes('médic')) return HeartPulse;
  if (l.includes('labo') || l.includes('scientif') || l.includes('informatique')) return Wrench;
  return Landmark;
}

function Contact({ icon: Icon, children, href }) {
  if (!children) return null;
  const content = (
    <>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
      {content}
    </a>
  ) : (
    <span className="flex items-center gap-1.5">{content}</span>
  );
}

function Section({ icon: Icon, title, children, id }) {
  return (
    <section id={id} className="p-5 rounded-2xl border border-border dark:border-white/10 bg-white dark:bg-black/20">
      <h2 className="flex items-center gap-2 font-bold text-ink dark:text-white mb-3">
        {Icon && <Icon className="w-5 h-5 text-green-700 dark:text-green-300 shrink-0" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function DocumentList({ items }) {
  const list = (items || []).filter((d) => d && (d.label || d.description));
  if (!list.length) return null;
  return (
    <ul className="space-y-1.5">
      {list.map((doc, i) => (
        <li key={`${doc.label}-${i}`} className="flex items-start gap-2 text-sm text-ink-muted dark:text-white/80">
          <FileText className="w-4 h-4 mt-0.5 shrink-0 text-green-700 dark:text-green-300" />
          <span>
            {doc.label}
            {doc.description ? <span className="text-gray-500"> — {doc.description}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function EducationEstablishment() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [travel, setTravel] = useState(null);
  const [travelError, setTravelError] = useState('');
  const [locating, setLocating] = useState(false);
  const [enums, setEnums] = useState({ particularities: [], ecofo_cycles: [], post_orientations: [] });
  const [schoolYears, setSchoolYears] = useState([]);

  useEffect(() => {
    loadEducationEnums().then(setEnums);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // Le détail n'est servi que si la fiche est publiée : un brouillon
        // renvoie 404, ce qui est le comportement attendu côté API. Si l'id
        // reçu est un id Business (clic depuis la liste générale), on
        // ressout la fiche correspondante.
        let data;
        try {
          data = await educationService.getEstablishment(id);
        } catch (e) {
          if (e.status !== 404) throw e;
          data = await educationService.getEstablishmentByBusiness(id);
        }
        const businessId = data.business_detail?.id || data.business;
        const [list, unitList] = await Promise.all([
          educationService.publicPrograms(data.id),
          educationService.listPublicUnits({ business: businessId }).catch(() => []),
        ]);
        if (!active) return;
        setProfile(data);
        setPrograms(Array.isArray(list) ? list : (list?.results || []));
        setUnits(Array.isArray(unitList) ? unitList : (unitList?.results || []));
        if ((data.business_detail?.category_slug || '') === 'ecole') {
          const years = await educationService.listPublicCampaigns({ business: businessId }).catch(() => []);
          if (active) {
            const rows = Array.isArray(years) ? years : (years?.results || []);
            setSchoolYears(rows.filter((year) => year.is_public !== false));
          }
        }
        setError('');
      } catch (e) {
        if (!active) return;
        setError(
          e.status === 404
            ? "Cet établissement n'est pas disponible publiquement."
            : (e.message || 'Erreur de chargement'),
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !id) return;
      educationService.getEstablishment(id)
        .catch((err) => (err.status === 404 ? educationService.getEstablishmentByBusiness(id) : Promise.reject(err)))
        .then((data) => setProfile(data))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/education" className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-300">
          <ArrowLeft className="w-4 h-4" /> Retour à l'annuaire
        </Link>
        <div className="p-6 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>
      </div>
    );
  }
  if (!profile) return null;

  const business = profile.business_detail || {};
  const services = (profile.student_services || []).filter((s) => s && (s.label || s.description));
  const gallery = (profile.gallery || []).filter(Boolean);
  const hasContact = business.phone || profile.institutional_email || business.email || business.website;
  const placeParts = [
    ['Adresse', business.address],
    ['Avenue', business.avenue],
    ['Quartier', business.quartier],
    ['Zone', business.zone],
    ['Commune', business.commune],
    ['Province', business.province],
  ].filter(([, value]) => value);
  const address = placeParts.map(([, value]) => value).join(', ');
  const statusLabel = profile.operational_status_label;
  const schoolTracks = [
    profile.offers_prescolaire && 'Enseignement préscolaire',
    profile.offers_ecofo && 'École fondamentale (ECOFO)',
    profile.offers_post_fondamental && 'Post-fondamental',
  ].filter(Boolean);
  const enumsCycles = enums.ecofo_cycles || [];

  const mapHref = business.latitude != null && business.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${business.latitude}&mlon=${business.longitude}#map=16/${business.latitude}/${business.longitude}`
    : '';
  const tile = business.latitude != null && business.longitude != null
    ? mapGrid(business.latitude, business.longitude)
    : null;

  const locate = () => {
    if (!navigator.geolocation || business.latitude == null || business.longitude == null) {
      setTravelError('La position de cet appareil n’est pas disponible.');
      return;
    }
    setLocating(true);
    setTravelError('');

    const applyPosition = async (pos) => {
      try {
        const data = await educationService.distanceFrom(
          pos.coords.latitude,
          pos.coords.longitude,
          business.latitude,
          business.longitude,
        );
        setTravel({
          km: data.distance_km,
          minutes: data.duration_minutes,
        });
      } catch (err) {
        setTravel(null);
        setTravelError(err.message || 'Distance indisponible.');
      } finally {
        setLocating(false);
      }
    };

    const geoMessage = (err) => {
      if (err?.code === 1) return 'Autorisez la localisation dans le navigateur pour calculer la distance.';
      if (err?.code === 2) return 'Position introuvable (GPS ou réseau). Vérifiez la connexion ou activez le GPS.';
      if (err?.code === 3) return 'Délai dépassé pour obtenir votre position. Réessayez.';
      return 'Impossible d’obtenir votre position pour le moment.';
    };

    // GPS appareil d’abord ; en secours, position mise en cache (évite le fournisseur réseau Google).
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      () => {
        navigator.geolocation.getCurrentPosition(
          applyPosition,
          (err) => {
            setLocating(false);
            setTravelError(geoMessage(err));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  return (
    <div className="w-full">
      <div className="relative bg-primary">
        {gallery.length > 0 ? (
          <SchoolHistoryCarousel hero images={gallery} name={business.name} />
        ) : (
          <div className="h-[420px] sm:h-[560px] bg-gradient-to-br from-primary to-[#132F45]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end sm:items-center">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pb-16 sm:pb-0">
            <Link to="/education" className="pointer-events-auto inline-flex items-center gap-1 text-sm font-semibold text-white/90 mb-4">
              <ArrowLeft className="w-4 h-4" /> Retour à l&apos;annuaire
            </Link>
            <p className="text-sm font-semibold text-white/80">
              {profile.category_name || business.category_name || profile.establishment_type_label}
              {statusLabel ? ` · ${statusLabel}` : ''}
            </p>
            <h1 className="mt-2 max-w-xl text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              {business.name}
            </h1>
            {(profile.official_name && profile.official_name !== business.name) && (
              <p className="mt-2 text-sm text-white/80">{profile.official_name}</p>
            )}
            {profile.short_description && (
              <p className="mt-4 max-w-lg text-base text-white/90">{profile.short_description}</p>
            )}
            {schoolTracks.length > 0 && (
              <p className="mt-3 text-sm font-semibold text-white">Cette école est : {schoolTracks.join(' · ')}</p>
            )}
            {profile.boarding_regime_label && (
              <p className="mt-2 text-sm font-semibold text-white">
                Régime : {profile.boarding_regime_label}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#informations" className="pointer-events-auto inline-flex items-center px-5 py-2.5 rounded-full bg-[#EA8B33] text-white text-sm font-bold">
                Voir les informations
              </a>
              {(business.phone || profile.institutional_email || business.email) && (
                <a
                  href={business.phone ? `tel:${business.phone}` : `mailto:${profile.institutional_email || business.email}`}
                  className="pointer-events-auto inline-flex items-center px-5 py-2.5 rounded-full bg-[#1a1a1a] text-white text-sm font-bold"
                >
                  Nous contacter
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <section id="informations" className="bg-white scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div className="relative rounded-2xl overflow-hidden min-h-[220px] bg-primary/10">
            {(gallery[1] || gallery[0] || business.logo) ? (
              <img src={gallery[1] || gallery[0] || business.logo} alt="" className="w-full max-h-80 object-contain bg-[#132F45]" />
            ) : (
              <div className="h-64 flex items-center justify-center">
                <GraduationCap className="w-16 h-16 text-primary/40" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">L&apos;établissement</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-ink">
              {profile.short_description || business.name}
            </h2>
            {profile.description && (
              <p className="mt-3 text-sm text-ink-muted whitespace-pre-line">{profile.description}</p>
            )}
            {profile.boarding_regime_label && (
              <p className="mt-3 text-sm font-semibold text-ink">Régime : {profile.boarding_regime_label}</p>
            )}
            {address && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-muted">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                {address}
              </p>
            )}
            {hasContact && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="inline-flex items-center gap-1.5 font-semibold">
                    <Phone className="w-4 h-4 text-primary" /> {business.phone}
                  </a>
                )}
                {(profile.institutional_email || business.email) && (
                  <a href={`mailto:${profile.institutional_email || business.email}`} className="inline-flex items-center gap-1.5 font-semibold min-w-0">
                    <Mail className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{profile.institutional_email || business.email}</span>
                  </a>
                )}
                {business.website && (
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold">
                    <Globe className="w-4 h-4 text-primary" /> Site web
                  </a>
                )}
              </div>
            )}
            {(() => {
              const stats = [
                programs.length > 0 && { value: programs.length, label: 'Formations' },
                (profile.ecofo_cycles || []).length > 0 && { value: profile.ecofo_cycles.length, label: 'Cycles ECOFO' },
                (profile.post_fondamental_sections || []).length > 0 && { value: profile.post_fondamental_sections.length, label: 'Sections' },
                schoolTracks.length > 0 && { value: schoolTracks.length, label: 'Parcours' },
              ].filter(Boolean);
              if (!stats.length) return null;
              return (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-extrabold text-ink">{stat.value}</p>
                      <p className="text-xs text-ink-muted">{stat.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <div className="bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-extrabold">Venir à {business.name}</h2>
            {address && <p className="mt-3 text-sm text-white/85">{address}</p>}
            <div className="mt-4 space-y-2 text-sm">
              {business.phone && <p>{business.phone}</p>}
              {(profile.institutional_email || business.email) && <p>{profile.institutional_email || business.email}</p>}
            </div>
            {mapHref && (
              <a href={mapHref} target="_blank" rel="noopener noreferrer" className="school-light-btn bg-white inline-flex mt-5 px-4 py-2 rounded-lg text-sm font-bold">
                Voir l&apos;itinéraire
              </a>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-2xl font-extrabold">Candidater</h2>
            <p className="mt-3 text-sm text-white/85">
              Les formations publiées indiquent les périodes d&apos;inscription encore ouvertes.
            </p>
            <a href="#informations" className="inline-flex mt-5 self-start px-4 py-2 rounded-lg bg-[#EA8B33] text-white text-sm font-bold">
              Voir les informations
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
      {(business.category_slug === 'ecole' || profile.offers_prescolaire || profile.offers_ecofo || profile.offers_post_fondamental) && (
        <Section icon={GraduationCap} title="Parcours">
          {!profile.offers_prescolaire && !profile.offers_ecofo && !profile.offers_post_fondamental && (
            <p className="text-sm text-ink-muted">
              L&apos;école n&apos;a pas encore indiqué si elle propose le préscolaire, l&apos;ECOFO ou le post-fondamental.
            </p>
          )}
          {profile.offers_prescolaire && (
            <div>
              <p className="text-sm font-semibold text-ink">Enseignement préscolaire</p>
              <p className="mt-1 text-sm text-ink-muted">
                Premier palier, non obligatoire. Il prépare l&apos;enfant à entrer dans l&apos;enseignement fondamental.
              </p>
            </div>
          )}
          {profile.offers_ecofo && (
            <div className={profile.offers_prescolaire ? 'mt-4' : ''}>
              <p className="text-sm font-semibold text-ink">École fondamentale (ECOFO)</p>
              <ul className="mt-1 text-sm text-ink-muted">
                {(profile.ecofo_classes || []).length > 0
                  ? (profile.ecofo_classes || []).map((row) => (
                    <li key={row.value}>{row.label || row.value}</li>
                  ))
                  : (enumsCycles.length ? enumsCycles : [])
                    .filter((cycle) => (profile.ecofo_cycles || []).includes(cycle.value))
                    .map((cycle) => (
                      <li key={cycle.value}>{cycle.label}</li>
                    ))}
              </ul>
              {(profile.ecofo_classes || []).length === 0 && (profile.ecofo_cycles || []).length === 0 && (
                <p className="text-sm text-ink-muted">Classes non précisées.</p>
              )}
            </div>
          )}
          {profile.offers_post_fondamental && (
            <div className={(profile.offers_prescolaire || profile.offers_ecofo) ? 'mt-4' : ''}>
              <p className="text-sm font-semibold text-ink">Enseignement post-fondamental</p>
              {(() => {
                const catalog = enums.post_filieres || EDUCATION_ENUM_FALLBACK.post_filieres;
                const filieres = (catalog.families || []).flatMap((family) => family.filieres || []);
                const chosen = filieres.map((filiere) => ({
                  key: filiere.value,
                  label: filiere.label,
                  sections: (profile.post_fondamental_sections || [])
                    .filter((section) => section.orientation === filiere.value && section.name)
                    .map((section) => {
                      const classes = section.classes || section.years || [];
                      const classLabels = classes.map((item) => (
                        item && typeof item === 'object'
                          ? (item.label || item.value)
                          : String(item)
                      )).filter(Boolean);
                      return {
                        name: section.name,
                        classes: classLabels,
                      };
                    }),
                })).filter((item) => item.sections.length);
                if (!chosen.length) return null;
                return (
                  <div className="mt-2 space-y-2">
                    {chosen.map((item) => (
                      <div key={item.key} className="text-sm text-ink-muted">
                        <p className="font-semibold text-ink">{item.label}</p>
                        {item.sections.map((section) => (
                          <p key={section.name} className="mt-0.5">
                            {section.name}
                            {section.classes.length ? ` — ${section.classes.join(', ')}` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </Section>
      )}

      {services.length > 0 && (
        <Section icon={Library} title="Services aux étudiants">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map((s, i) => {
              const Icon = serviceIcon(s.label);
              return (
                <div
                  key={`${s.label}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5"
                >
                  <Icon className="w-5 h-5 text-green-700 dark:text-green-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink dark:text-white">{s.label}</p>
                    {s.description && (
                      <p className="text-xs text-ink-muted dark:text-white/70">{s.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(profile.teaching_languages || profile.academic_calendar) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.teaching_languages && (
            <Section icon={GraduationCap} title="Langues d'enseignement">
              <p className="text-sm text-ink-muted dark:text-white/70">{profile.teaching_languages}</p>
            </Section>
          )}
          {profile.academic_calendar && (
            <Section icon={CalendarDays} title="Année académique">
              <p className="text-sm text-ink-muted dark:text-white/70 whitespace-pre-line">
                {profile.academic_calendar}
              </p>
            </Section>
          )}
        </div>
      )}

      {(profile.accreditation_number || profile.accreditation_body || profile.accreditation_valid_until) && (
        <div className="p-4 rounded-2xl border border-green-600/30 bg-green-600/5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink dark:text-white mb-1">
            <ShieldCheck className="w-4 h-4 text-green-700 dark:text-green-300" /> Agrément officiel
          </h3>
          <p className="text-sm text-ink-muted dark:text-white/70">
            {[profile.accreditation_body, profile.accreditation_number].filter(Boolean).join(' — ')}
            {profile.accreditation_valid_until && `Valide jusqu'au ${profile.accreditation_valid_until}`}
          </p>
        </div>
      )}

      {business.category_slug === 'ecole' && (
        <section id="inscription" className="p-5 rounded-2xl border border-border bg-white dark:bg-black/20">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-white mb-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            Inscription pour une année scolaire
          </h2>
          {schoolYears.length === 0 ? (
            <p className="text-sm text-ink-muted">L&apos;école n&apos;a pas encore ouvert d&apos;année scolaire.</p>
          ) : schoolYears.map((year) => (
            <article key={year.id} className="mt-3 space-y-2">
              <p className="font-bold text-ink">
                {year.academic_year}
                {year.enrollment_fee?.fee_mode === 'PAYANT' ? ' · Inscription payante' : ''}
                {year.enrollment_fee?.fee_mode === 'GRATUIT' ? ' · Inscription gratuite' : ''}
              </p>
              <p className="text-sm text-ink-muted">{year.opens_on} → {year.closes_on}</p>
              <p className="text-sm font-semibold text-ink">
                {Number(year.enrollment_fee?.amount_bif) > 0
                  ? `Payante — ${Number(year.enrollment_fee.amount_bif).toLocaleString('fr-BI')} BIF, règlement BurundiPay pendant l’inscription`
                  : 'Gratuite — le dossier est envoyé sans paiement'}
              </p>
              {(year.open_tracks || []).length > 0 && (
                <div className="space-y-2 text-sm text-ink-muted">
                  {(year.open_tracks || []).map((code) => {
                    const block = (year.documents_by_track || {})[code];
                    if (!block) return null;
                    if (code === 'ECOFO') {
                      return (
                        <div key={code}>
                          <p className="font-semibold text-ink">{block.label}</p>
                          {(block.years || []).map((item) => (
                            <p key={item.value} className="text-xs mt-0.5">
                              {item.label} : {(item.documents || []).map((d) => d.label).filter(Boolean).join(', ')}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <p key={code}>
                        <span className="font-semibold text-ink">{block.label}</span>
                        {' : '}
                        {(block.documents || []).map((d) => d.label).filter(Boolean).join(', ')}
                      </p>
                    );
                  })}
                </div>
              )}
              {(year.required_documents || []).filter((doc) => doc && doc.label).length > 0 && (
                <p className="text-sm text-ink-muted">
                  Pièces locales : {(year.required_documents || []).map((doc) => doc.label).filter(Boolean).join(', ')}
                </p>
              )}
              {(year.extra_criteria || []).length > 0 && (
                <div className="text-sm text-ink">
                  <p className="font-semibold">Critères supplémentaires</p>
                  <ul className="mt-1 space-y-1 text-ink-muted">
                    {(year.extra_criteria || []).map((item, index) => (
                      <li key={index}>
                        {item.label}
                        {item.date ? ` · ${item.date}` : ''}
                        {item.place ? ` · ${item.place}` : ''}
                        {item.details ? ` — ${item.details}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-1">
                {year.open_today ? (
                  <Link
                    to={user ? `/education/inscription?campaign=${year.id}` : '/login'}
                    state={user ? undefined : { from: `/education/inscription?campaign=${year.id}` }}
                    className="inline-flex mt-2 px-4 py-2 rounded-xl bg-[#EA8B33] text-white text-sm font-bold"
                  >
                    S&apos;inscrire
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex mt-2 px-4 py-2 rounded-xl bg-[#EA8B33]/40 text-white text-sm font-bold cursor-not-allowed"
                    >
                      S&apos;inscrire
                    </button>
                    <p className="mt-2 text-xs font-medium text-ink-muted">
                      {year.opens_on && year.opens_on > new Date().toISOString().slice(0, 10)
                        ? `Les inscriptions ouvrent le ${year.opens_on}.`
                        : `Les inscriptions sont closes (période : ${year.opens_on} → ${year.closes_on}).`}
                    </p>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {business.category_slug !== 'ecole' && (
      <section id="formations">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-white mb-3">
          <BookOpen className="w-5 h-5 text-green-700 dark:text-green-300" />
          Formations publiées ({programs.length})
        </h2>

        {programs.length === 0 ? (
          <div className="p-10 rounded-3xl border border-border bg-surface text-center">
            <BookOpen className="w-8 h-8 mx-auto text-primary/50 mb-2" />
            <p className="font-semibold text-ink">Aucune formation publiée</p>
            <p className="mt-1 text-sm text-ink-muted">L&apos;établissement n&apos;a pas encore rendu son offre visible.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {offerSections(units, programs).map((section) => (
              <div key={section.key} className={section.nested ? 'pl-4 border-l-2 border-primary/20 space-y-3' : 'space-y-3'}>
                {section.title && (
                  <div>
                    {section.eyebrow && (
                      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{section.eyebrow}</p>
                    )}
                    <h3 className="font-bold text-ink dark:text-white">{section.title}</h3>
                    {section.description && (
                      <p className="mt-1 text-sm text-ink-muted">{section.description}</p>
                    )}
                  </div>
                )}
                {section.programs.map((p) => (
              <article
                key={p.id}
                className="p-5 rounded-2xl border border-border dark:border-white/10 bg-white dark:bg-black/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold text-ink dark:text-white">{p.title}</h3>
                  {p.level_label && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-600/10 text-green-700 dark:text-green-300">
                      {p.level_label}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {p.unit_name && <span className="font-medium">{p.unit_name}</span>}
                  {p.degree_awarded && <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {p.degree_awarded}</span>}
                  {p.domain && <span>{p.domain}</span>}
                  {p.duration_label && <span>{p.duration_label}</span>}
                  {p.semester_organization && <span>{p.semester_organization}</span>}
                </div>

                {(p.entry_level || p.exit_level) && (
                  <p className="mt-2 text-sm text-ink-muted dark:text-white/80">
                    Niveau d'entrée : {p.entry_level || '—'}
                    {p.exit_level ? ` · Sortie : ${p.exit_level}` : ''}
                  </p>
                )}

                {p.main_subjects && (
                  <div className="mt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Matières principales</h4>
                    <p className="mt-1 text-sm text-ink-muted dark:text-white/70 whitespace-pre-line">{p.main_subjects}</p>
                  </div>
                )}

                {p.admission_conditions && (
                  <div className="mt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Conditions d'admission</h4>
                    <p className="mt-1 text-sm text-ink-muted dark:text-white/70 whitespace-pre-line">{p.admission_conditions}</p>
                  </div>
                )}

                {(p.required_documents || []).filter((d) => d && d.label).length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Pièces à fournir</h4>
                    <div className="mt-1">
                      <DocumentList items={p.required_documents} />
                    </div>
                  </div>
                )}

                {p.internship_details && (
                  <div className="mt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Stage</h4>
                    <p className="mt-1 text-sm text-ink-muted dark:text-white/70 whitespace-pre-line">{p.internship_details}</p>
                  </div>
                )}

                {p.career_outlook && (
                  <div className="mt-3 flex items-start gap-2">
                    <Briefcase className="w-4 h-4 mt-0.5 shrink-0 text-green-700 dark:text-green-300" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Débouchés</h4>
                      <p className="mt-1 text-sm text-ink-muted dark:text-white/70 whitespace-pre-line">{p.career_outlook}</p>
                    </div>
                  </div>
                )}
                {(p.campaigns || []).map((campaign) => (
                  <div key={campaign.id} className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 space-y-1">
                    <p className="text-sm font-semibold text-ink dark:text-white">
                      Admission {campaign.academic_year}
                      {campaign.open_today ? ' · inscriptions ouvertes' : ''}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {campaign.opens_on} → {campaign.closes_on}
                      {campaign.late_opens_on ? ` · tardive ${campaign.late_opens_on} → ${campaign.late_closes_on}` : ''}
                    </p>
                    {campaign.required_diploma && <p className="text-sm text-ink">Diplôme requis : {campaign.required_diploma}</p>}
                    {campaign.prerequisites && <p className="text-sm text-ink-muted">Prérequis : {campaign.prerequisites}</p>}
                    {campaign.min_grade && <p className="text-sm text-ink-muted">Note minimale : {campaign.min_grade}</p>}
                    {campaign.contest_name && (
                      <p className="text-sm text-ink-muted">
                        {campaign.contest_name}{campaign.contest_date ? ` · ${campaign.contest_date}` : ''}
                      </p>
                    )}
                    {campaign.results_date && <p className="text-sm text-ink-muted">Résultats : {campaign.results_date}</p>}
                    {campaign.confirmation_start && (
                      <p className="text-sm text-ink-muted">
                        Confirmation : {campaign.confirmation_start} → {campaign.confirmation_end}
                      </p>
                    )}
                    {campaign.extra_conditions && <p className="text-sm text-ink-muted">{campaign.extra_conditions}</p>}
                    {campaign.regulatory_requirements && <p className="text-sm text-ink-muted">{campaign.regulatory_requirements}</p>}
                    {(campaign.required_documents || []).filter((d) => d && d.label).length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pièces {campaign.academic_year}</p>
                        <DocumentList items={campaign.required_documents} />
                      </div>
                    )}
                    {campaign.open_today && (
                      <Link
                        to={user ? `/education/inscription?campaign=${campaign.id}` : '/login'}
                        state={user ? undefined : { from: `/education/inscription?campaign=${campaign.id}` }}
                        className="mt-2 inline-flex text-sm font-semibold text-primary"
                      >
                        Candidater
                      </Link>
                    )}
                  </div>
                ))}
                {(p.fees || []).length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {p.fees.map((fee) => (
                      <li key={fee.id} className="text-sm text-ink">
                        {fee.label}
                        {fee.academic_year ? ` (${fee.academic_year})` : ''}
                        {' — '}
                        {Number(fee.amount_bif).toLocaleString('fr-FR')} BIF
                        {fee.is_required ? '' : ' · facultatif'}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
      )}
        </div>

        <aside className="space-y-5">
          {(tile || placeParts.length > 0 || profile.nearby_landmarks) && (
            <Section icon={MapPin} title="Localisation">
              {tile && (
                <div className="relative overflow-hidden rounded-2xl border border-border h-56">
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
                    {tile.tiles.map((part) => (
                      <img key={part.key} src={part.src} alt="" className="w-full h-full object-fill" />
                    ))}
                  </div>
                  <MapPin
                    className="absolute w-7 h-7 text-alert -translate-x-1/2 -translate-y-full drop-shadow"
                    style={{ left: tile.left, top: tile.top }}
                  />
                  <p className="absolute bottom-1 right-2 text-[10px] text-ink bg-surface/80 px-1 rounded">
                    © OpenStreetMap
                  </p>
                </div>
              )}
              {placeParts.length > 0 && (
                <dl className="mt-3 space-y-1.5">
                  {placeParts.map(([label, value]) => (
                    <div key={label} className="flex gap-2 text-sm">
                      <dt className="w-20 shrink-0 font-semibold text-ink-muted">{label}</dt>
                      <dd className="text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {business.latitude != null && business.longitude != null && (
                <p className="mt-1 text-xs text-ink-muted">
                  GPS {Number(business.latitude).toFixed(5)}, {Number(business.longitude).toFixed(5)}
                </p>
              )}
              {mapHref && (
                <a href={mapHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
                  Itinéraire <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {business.latitude != null && (
                <button type="button" onClick={locate} className="mt-3 block text-sm font-semibold text-primary">
                  {locating ? 'Calcul…' : 'Distance depuis ma position'}
                </button>
              )}
              {travel && (
                <p className="mt-2 text-sm font-semibold text-ink">
                  {Number(travel.km).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km par la route
                  {travel.minutes ? ` · ${travel.minutes} min` : ''}
                </p>
              )}
              {travelError && <p className="mt-2 text-sm text-alert">{travelError}</p>}
              {profile.nearby_landmarks && (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Zones de référence à proximité</p>
                  <p className="mt-1 text-sm text-ink">{profile.nearby_landmarks}</p>
                </div>
              )}
            </Section>
          )}
          {(profile.library_hours || profile.library_contact) && (
            <Section icon={Library} title="Bibliothèque">
              <p className="text-sm text-ink-muted">{profile.library_hours}</p>
              {profile.library_access && <p className="mt-1 text-sm text-ink-muted">{profile.library_access}</p>}
              {profile.library_contact && <p className="mt-1 text-sm text-ink">{profile.library_contact}</p>}
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
