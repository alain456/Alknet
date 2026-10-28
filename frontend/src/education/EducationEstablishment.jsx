import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, GraduationCap, MapPin, Phone, Globe, Mail, Award, ShieldCheck,
  Landmark, Library, Bus, UtensilsCrossed, Wrench, HeartPulse, CalendarDays,
  ExternalLink, Briefcase,
} from 'lucide-react';
import educationService from './educationService';
import { EDUCATION_ENUM_FALLBACK, loadEducationEnums, programHeadline, universityLevelLabel } from './educationEnums';
import SchoolHistoryCarousel from './SchoolHistoryCarousel';
import { googleMapsSearchUrl } from '../shared/mapLink';

function mapPreview(lat, lon, zoom = 15) {
  const n = 2 ** zoom;
  const xFloat = (Number(lon) + 180) / 360 * n;
  const latRad = (Number(lat) * Math.PI) / 180;
  const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  return {
    src: `/api/v1/locations/map-tile/${zoom}/${x}/${y}.png`,
    left: `${((xFloat - x) * 100).toFixed(2)}%`,
    top: `${((yFloat - y) * 100).toFixed(2)}%`,
  };
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
    <section id={id} className="p-5 rounded-2xl border border-border bg-surface">
      <h2 className="flex items-center gap-2 font-bold text-ink mb-3">
        {Icon && <Icon className="w-5 h-5 text-primary shrink-0" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function dueLabel(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function TuitionReveal({ lines, academicYear, label }) {
  const [open, setOpen] = React.useState(false);
  if (!lines?.length) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-bold text-primary"
      >
        {open ? 'Masquer les frais de scolarité' : label}
      </button>
      {open && (
        <div className="mt-2 text-sm text-ink">
          {academicYear && <p className="font-semibold">Année {academicYear}</p>}
          {lines.map((line) => {
            const scope = [line.option ? `Option ${line.option}` : '', line.year_label].filter(Boolean).join(' · ') || 'Tous les niveaux';
            const total = (line.installments || []).reduce((sum, row) => sum + Number(row.amount_bif || 0), 0);
            return (
              <div key={`${line.option || ''}-${line.year_label || scope}`} className="mt-1">
                <p>{scope} — {total.toLocaleString('fr-BI')} BIF</p>
                <ul className="text-ink-muted">
                  {(line.installments || []).map((row) => (
                    <li key={`${row.label}-${row.due_date}`}>
                      {row.label} · {Number(row.amount_bif || 0).toLocaleString('fr-BI')} BIF
                      {row.due_date ? ` · au plus tard le ${dueLabel(row.due_date)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function tuitionLines(tuition) {
  return (tuition?.schedules || []).map((schedule) => ({
    option: schedule.option || '',
    year_label: schedule.year_label || '',
    installments: schedule.installments || [],
  }));
}

function ProgramCard({ program }) {
  const options = Array.isArray(program.options) ? program.options : [];
  const cycle = universityLevelLabel(program.level, program.level_label);
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <p className="text-sm font-bold text-ink">{programHeadline(program.title, cycle)}</p>
      {program.duration_label && <p className="text-xs text-ink-muted">{program.duration_label}</p>}
      {program.level === 'MASTER' && program.domain && (
        <p className="text-xs text-ink-muted">{program.domain}</p>
      )}
      {program.level === 'MASTER' && (program.faculty_name || program.unit_name) && (
        <p className="text-xs text-ink-muted">Rattachement : {program.faculty_name || program.unit_name}</p>
      )}
      {options.length > 0 && (
        <ul className="mt-1 text-sm text-ink">
          {program.level === 'MASTER' && <li className="text-xs text-ink-muted">Parcours</li>}
          {options.map((name) => <li key={name}>{name}</li>)}
        </ul>
      )}
      {program.tuition_display?.source === 'programme' && (
        <TuitionReveal
          lines={program.tuition_display.lines}
          academicYear={program.tuition_display.academic_year}
          label="Voir les frais de scolarité"
        />
      )}
    </div>
  );
}

function UniversityOffer({ units, programs }) {
  const masters = programs.filter((program) => program.level === 'MASTER');
  const bachelorPrograms = programs.filter((program) => program.level !== 'MASTER');
  const faculties = units.filter((row) => row.kind === 'FACULTY' || (!row.parent && row.kind !== 'DEPARTMENT'));
  const used = new Set();
  const blocks = faculties.map((faculty) => {
    const departments = units.filter((row) => row.kind === 'DEPARTMENT' && String(row.parent) === String(faculty.id));
    const direct = bachelorPrograms.filter((program) => String(program.unit || '') === String(faculty.id));
    direct.forEach((program) => used.add(program.id));
    const groups = departments.map((department) => {
      const rows = bachelorPrograms.filter((program) => String(program.unit || '') === String(department.id));
      rows.forEach((program) => used.add(program.id));
      return { department, rows };
    }).filter((group) => group.rows.length || (group.department.tuition?.schedules || []).length);
    return { faculty, direct, groups };
  });
  const loose = bachelorPrograms.filter((program) => !used.has(program.id));

  return (
    <div className="space-y-6">
      {(blocks.some((block) => block.direct.length || block.groups.length) || loose.length > 0) && (
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Baccalauréats</p>
      )}
      {blocks.map(({ faculty, direct, groups }) => (
        <div key={faculty.id}>
          <p className="text-sm font-extrabold text-ink">{faculty.name}</p>
          {faculty.description && <p className="mt-1 text-sm text-ink-muted">{faculty.description}</p>}
          <TuitionReveal lines={tuitionLines(faculty.tuition)} academicYear={faculty.tuition?.academic_year} label="Voir les frais de la faculté" />
          {direct.length > 0 && (
            <div className="mt-2 space-y-2">
              {direct.map((program) => <ProgramCard key={program.id} program={program} />)}
            </div>
          )}
          {groups.map(({ department, rows }) => (
            <div key={department.id} className="mt-3">
              <p className="text-sm font-semibold text-ink">{department.name}</p>
              {department.description && <p className="text-sm text-ink-muted">{department.description}</p>}
              <TuitionReveal lines={tuitionLines(department.tuition)} academicYear={department.tuition?.academic_year} label="Voir les frais du département" />
              <div className="mt-2 space-y-2">
                {rows.map((program) => <ProgramCard key={program.id} program={program} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
      {loose.length > 0 && (
        <div>
          {blocks.length > 0 && <p className="text-sm font-extrabold text-ink">Autres programmes</p>}
          <div className="mt-2 space-y-2">
            {loose.map((program) => <ProgramCard key={program.id} program={program} />)}
          </div>
        </div>
      )}
      {masters.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Masters</p>
          <div className="mt-2 space-y-2">
            {masters.map((program) => <ProgramCard key={program.id} program={program} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EducationEstablishment() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [travel, setTravel] = useState(null);
  const [travelError, setTravelError] = useState('');
  const [locating, setLocating] = useState(false);
  const [enums, setEnums] = useState({ particularities: [], ecofo_cycles: [], post_orientations: [] });
  const [schoolYears, setSchoolYears] = useState([]);
  const [offer, setOffer] = useState({ units: [], programs: [] });
  const [mapBroken, setMapBroken] = useState(false);

  useEffect(() => {
    loadEducationEnums().then(setEnums);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setMapBroken(false);
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
        if (!active) return;
        setProfile(data);
        if ((data.business_detail?.category_slug || '') === 'ecole') {
          const years = await educationService.listPublicCampaigns({ business: businessId }).catch(() => []);
          if (active) {
            const rows = Array.isArray(years) ? years : (years?.results || []);
            setSchoolYears(rows.filter((year) => year.is_public !== false));
          }
        }
        if ((data.business_detail?.category_slug || '') === 'universite') {
          const [programList, unitList] = await Promise.all([
            educationService.publicPrograms(data.id).catch(() => []),
            educationService.listPublicUnits({ business: businessId }).catch(() => []),
          ]);
          if (active) {
            setOffer({
              programs: Array.isArray(programList) ? programList : (programList?.results || []),
              units: Array.isArray(unitList) ? unitList : (unitList?.results || []),
            });
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
        <Link to="/education" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="w-4 h-4" /> Retour à l'annuaire
        </Link>
        <div className="p-6 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>
      </div>
    );
  }
  if (!profile) return null;

  const business = profile.business_detail || {};
  const universityCampaigns = (offer.programs || []).flatMap((program) => (
    (program.campaigns || []).map((campaign) => ({
      ...campaign,
      program_title: campaign.program_title || program.title,
    }))
  ));
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

  const mapHref = googleMapsSearchUrl({
    lat: business.latitude,
    lng: business.longitude,
    address,
  });
  const tile = !mapBroken && business.latitude != null && business.longitude != null
    ? mapPreview(business.latitude, business.longitude)
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
          kind: data.kind || 'driving',
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
          <div className="h-[420px] sm:h-[560px] bg-gradient-to-br from-ink to-primary" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/85 via-primary/45 to-primary/10" />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end sm:items-center">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pb-16 sm:pb-0">
            <Link to="/education" className="pointer-events-auto inline-flex items-center gap-1 text-sm font-semibold text-white/90 mb-4">
              <ArrowLeft className="w-4 h-4" /> Retour à l&apos;annuaire
            </Link>
            <p className="text-sm font-semibold text-white/80">
              {profile.category_name || business.category_name || profile.establishment_type_label}
              {statusLabel ? ` · ${statusLabel}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-4">
              {business.logo ? (
                <img
                  src={business.logo}
                  alt={`Logo de ${business.name || 'l’établissement'}`}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-[#F5F5F5] p-1 shrink-0"
                />
              ) : null}
              <h1 className="max-w-xl text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                {business.name}
              </h1>
            </div>
            {(profile.official_name && profile.official_name !== business.name) && (
              <p className="mt-2 text-sm text-white/80">{profile.official_name}</p>
            )}
            {profile.short_description && (
              <p className="mt-4 max-w-lg text-base text-white/90">{profile.short_description}</p>
            )}
            {profile.boarding_regime_label && (
              <p className="mt-2 text-sm font-semibold text-white">
                Régime : {profile.boarding_regime_label}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#informations" className="pointer-events-auto inline-flex items-center px-5 py-2.5 rounded-full bg-accent text-ink text-sm font-bold">
                Voir les informations
              </a>
              {(business.phone || profile.institutional_email || business.email) && (
                <a
                  href={business.phone ? `tel:${business.phone}` : `mailto:${profile.institutional_email || business.email}`}
                  className="pointer-events-auto inline-flex items-center px-5 py-2.5 rounded-full bg-[#132F45] text-[#F5F5F5] text-sm font-bold"
                >
                  Nous contacter
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <section id="informations" className="bg-surface scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div className="relative rounded-2xl overflow-hidden min-h-[220px] bg-primary/10">
            {(business.logo || gallery[0]) ? (
              <img src={business.logo || gallery[0]} alt={business.logo ? `Logo de ${business.name || 'l’établissement'}` : (business.name ? `Photo de ${business.name}` : '')} className="w-full max-h-80 object-contain bg-ink" />
            ) : (
              <div className="h-64 flex items-center justify-center">
                <GraduationCap className="w-16 h-16 text-primary/40" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">L&apos;établissement</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-ink">
              {profile.short_description ? 'Présentation' : business.name}
            </h2>
            {profile.description && (
              <p className="mt-3 text-sm text-ink-muted whitespace-pre-line">{profile.description}</p>
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

      <div className="school-dash-hero bg-ink text-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-2 gap-8">
          <div className="flex flex-col justify-center md:col-span-2">
            <h2 className="text-2xl font-extrabold">Candidater</h2>
            <p className="mt-3 text-sm text-white/85">
              {business.category_slug === 'universite'
                ? 'Choisissez un programme ouvert et déposez le dossier d’inscription.'
                : 'Les périodes et les pièces sont indiquées plus bas, une seule fois.'}
            </p>
            <a href="#inscription" className="inline-flex mt-5 self-start px-4 py-2 rounded-lg bg-accent text-ink text-sm font-bold">
              S’inscrire
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
      {business.category_slug === 'universite' && (
        <Section icon={GraduationCap} title="Facultés et programmes">
          {offer.units.length === 0 && offer.programs.length === 0 ? (
            <p className="text-sm text-ink-muted">Cette université n&apos;a pas encore publié de faculté ni de programme.</p>
          ) : (
            <UniversityOffer units={offer.units} programs={offer.programs} />
          )}
        </Section>
      )}

      {business.category_slug === 'universite' && (
        <section id="inscription" className="p-5 rounded-2xl border border-border bg-surface scroll-mt-20">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink mb-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            Inscription
          </h2>
          {universityCampaigns.length === 0 ? (
            <p className="text-sm text-ink-muted">Cette université n&apos;a pas encore ouvert d&apos;inscription.</p>
          ) : (
            <ul className="divide-y divide-border">
              {universityCampaigns.map((campaign) => {
                const today = new Date().toISOString().slice(0, 10);
                const upcoming = campaign.opens_on && campaign.opens_on > today;
                const closed = campaign.closes_on && campaign.closes_on < today;
                const fee = campaign.enrollment_fee?.fee_mode === 'PAYANT'
                  ? `${Number(campaign.enrollment_fee.amount_bif).toLocaleString('fr-BI')} BIF`
                  : campaign.enrollment_fee?.fee_mode === 'GRATUIT'
                    ? 'Gratuite'
                    : '';
                return (
                  <li key={campaign.id} id={`inscription-${campaign.id}`} className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">{campaign.program_title}</p>
                      <p className="text-sm text-ink-muted">
                        {campaign.academic_year} · {campaign.opens_on} → {campaign.closes_on}
                        {fee ? ` · ${fee}` : ''}
                      </p>
                      {closed && <p className="text-sm text-ink-muted">Inscriptions closes</p>}
                      {upcoming && <p className="text-sm text-ink-muted">Ouverture le {campaign.opens_on}</p>}
                    </div>
                    {campaign.open_today && (
                      <Link
                        to={`/education/inscription?campaign=${campaign.id}`}
                        className="inline-flex shrink-0 justify-center px-4 py-2 rounded-xl bg-accent text-ink text-sm font-bold"
                      >
                        S&apos;inscrire
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

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
                  className="flex items-start gap-3 p-3 rounded-xl bg-paper"
                >
                  <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{s.label}</p>
                    {s.description && (
                      <p className="text-xs text-ink-muted">{s.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(profile.teaching_languages || profile.academic_calendar || profile.active_calendar?.year_start || profile.year_start || profile.year_exam_start || profile.year_deliberation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.teaching_languages && (
            <Section icon={GraduationCap} title="Langues d'enseignement">
              <p className="text-sm text-ink-muted">{profile.teaching_languages}</p>
            </Section>
          )}
          {profile.academic_calendar && (
            <Section icon={CalendarDays} title="Année académique">
              <p className="text-sm text-ink-muted whitespace-pre-line">
                {profile.academic_calendar}
              </p>
            </Section>
          )}
          {(profile.active_calendar?.year_start || profile.year_start || profile.year_exam_start || profile.year_deliberation) && (
            <Section icon={CalendarDays} title={profile.active_calendar?.academic_year ? `Calendrier ${profile.active_calendar.academic_year}` : 'Calendrier'}>
              {(profile.active_calendar?.year_start || profile.year_start) && <p className="text-sm text-ink">Rentrée : {profile.active_calendar?.year_start || profile.year_start}</p>}
              {(profile.active_calendar?.year_break_start || profile.year_break_start) && <p className="text-sm text-ink">Pause : {profile.active_calendar?.year_break_start || profile.year_break_start} → {profile.active_calendar?.year_break_end || profile.year_break_end}</p>}
              {(profile.active_calendar?.year_exam_start || profile.year_exam_start) && <p className="text-sm text-ink">Examens : {profile.active_calendar?.year_exam_start || profile.year_exam_start}</p>}
              {(profile.active_calendar?.year_deliberation || profile.year_deliberation) && <p className="text-sm text-ink">Délibération : {profile.active_calendar?.year_deliberation || profile.year_deliberation}</p>}
            </Section>
          )}
        </div>
      )}

      {(profile.accreditation_number || profile.accreditation_body || profile.accreditation_valid_until) && (
        <div className="p-4 rounded-2xl border border-green-600/30 bg-green-600/5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" /> Agrément officiel
          </h3>
          <p className="text-sm text-ink-muted">
            {[profile.accreditation_body, profile.accreditation_number].filter(Boolean).join(' — ')}
            {profile.accreditation_valid_until && `Valide jusqu'au ${profile.accreditation_valid_until}`}
          </p>
        </div>
      )}

      {business.category_slug === 'ecole' && (
        <section id="inscription" className="p-5 rounded-2xl border border-border bg-surface">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink mb-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            Inscription pour une année scolaire
          </h2>
          {schoolYears.length === 0 ? (
            <p className="text-sm text-ink-muted">L&apos;école n&apos;a pas encore ouvert d&apos;année scolaire.</p>
          ) : schoolYears.map((year) => (
            <article key={year.id} className="mt-3 space-y-2">
              <p className="font-bold text-ink">{year.academic_year}</p>
              <p className="text-sm text-ink-muted">{year.opens_on} → {year.closes_on}</p>
              <p className="text-sm font-semibold text-ink">
                {Number(year.enrollment_fee?.amount_bif) > 0
                  ? `Payante — ${Number(year.enrollment_fee.amount_bif).toLocaleString('fr-BI')} BIF, BurundiPay ou bordereau pendant l’inscription`
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
                              {item.label} : {(item.documents || []).map((d) => d.label).filter(Boolean).join(', ') || 'Aucun document'}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    if (code === 'POST_FONDAMENTAL' && (block.sections || []).some((section) => (section.years || []).some((item) => item.documents))) {
                      return (
                        <div key={code}>
                          <p className="font-semibold text-ink">{block.label}</p>
                          {(block.sections || []).map((section) => (
                            <div key={section.name}>
                              {(section.years || []).map((item) => (
                                <p key={`${section.name}-${item.value}`} className="text-xs mt-0.5">
                                  {section.name} · {item.label} : {(item.documents || []).map((d) => d.label).filter(Boolean).join(', ') || 'Aucun document'}
                                </p>
                              ))}
                            </div>
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
              {(() => {
                const listed = new Set();
                (year.open_tracks || []).forEach((code) => {
                  const block = (year.documents_by_track || {})[code];
                  if (!block) return;
                  (block.documents || []).forEach((doc) => doc?.label && listed.add(doc.label));
                  (block.years || []).forEach((item) => (item.documents || []).forEach((doc) => doc?.label && listed.add(doc.label)));
                  (block.sections || []).forEach((section) => (section.years || []).forEach((item) => (
                    (item.documents || []).forEach((doc) => doc?.label && listed.add(doc.label))
                  )));
                });
                const extra = (year.required_documents || []).map((doc) => doc?.label).filter((label) => label && !listed.has(label));
                if (!extra.length) return null;
                return <p className="text-sm text-ink-muted">Autres pièces : {extra.join(', ')}</p>;
              })()}
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
                    className="inline-flex mt-2 px-4 py-2 rounded-xl bg-accent text-ink text-sm font-bold"
                  >
                    S&apos;inscrire
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex mt-2 px-4 py-2 rounded-xl bg-accent/40 text-ink text-sm font-bold cursor-not-allowed"
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

        </div>

        <aside className="space-y-5">
          {(tile || placeParts.length > 0 || profile.nearby_landmarks) && (
            <Section icon={MapPin} title="Localisation">
              {tile && (
                <div className="relative overflow-hidden rounded-2xl border border-border h-56 bg-surface">
                  <img
                    src={tile.src}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setMapBroken(true)}
                  />
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
                  {travel.kind === 'straight'
                    ? `${Number(travel.km).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km à vol d’oiseau. L’itinéraire routier est indisponible.`
                    : `${Number(travel.km).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km par la route${travel.minutes ? ` · ${travel.minutes} min` : ''}`}
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
          {(profile.library_hours || profile.library_contact || profile.library_access) && (
            <Section icon={Library} title="Bibliothèque">
              <p className="text-sm text-ink-muted">{profile.library_hours}</p>
              {profile.library_access && <p className="mt-1 text-sm text-ink-muted">{profile.library_access}</p>}
              {profile.library_contact && <p className="mt-1 text-sm text-ink">{profile.library_contact}</p>}
            </Section>
          )}
          {(profile.internship_required || profile.internship_duration || profile.internship_contact) && (
            <Section icon={GraduationCap} title="Stages">
              <p className="text-sm text-ink">{profile.internship_required ? 'Stage obligatoire' : 'Stage possible'}</p>
              {profile.internship_duration && <p className="mt-1 text-sm text-ink-muted">Durée : {profile.internship_duration}</p>}
              {profile.internship_period && <p className="text-sm text-ink-muted">Période : {profile.internship_period}</p>}
              {profile.internship_contact && <p className="mt-1 text-sm text-ink">{profile.internship_contact}</p>}
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
