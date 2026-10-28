import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone, Globe } from 'lucide-react';
import providerService from './providerService';
import ContactRequestForm from './ContactRequestForm';
import ServiceOfferCard from './ServiceOfferCard';
import ServiceProofCarousel, {
  isCarouselProof,
  isPaperImage,
  PAPER_KINDS,
  REALIZATION_KINDS,
} from './ServiceProofCarousel';
import ServiceTeamCarousel from './ServiceTeamCarousel';

function offerSections(offers) {
  const list = offers || [];
  const childrenByParent = new Map();
  list.forEach((offer) => {
    if (!offer.parent) return;
    const key = String(offer.parent);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(offer);
  });
  const groupingIds = new Set(childrenByParent.keys());
  const sections = [];
  const used = new Set();

  list.forEach((offer) => {
    const id = String(offer.id);
    if (!groupingIds.has(id) || used.has(id)) return;
    used.add(id);
    sections.push({
      id,
      title: offer.title,
      offers: childrenByParent.get(id) || [],
    });
  });

  const ungrouped = list.filter((offer) => {
    const id = String(offer.id);
    return !offer.parent && !groupingIds.has(id);
  });
  if (ungrouped.length) {
    sections.push({ id: 'autres', title: null, offers: ungrouped });
  }
  return sections;
}

export default function PublicProvider() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromCategory = params.get('from');
  const backTo = fromCategory
    ? `/services?category=${encodeURIComponent(fromCategory)}`
    : '/services';
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState('');
  const [activeGroup, setActiveGroup] = useState('');

  useEffect(() => {
    providerService.getProvider(id)
      .then(setProvider)
      .catch((err) => setError(err.message || 'Prestataire introuvable'));
  }, [id]);

  const sections = useMemo(() => offerSections(provider?.offers), [provider]);
  const visibleSections = useMemo(
    () => (activeGroup ? sections.filter((row) => row.id === activeGroup) : sections),
    [sections, activeGroup],
  );

  if (error) return <div className="p-6 text-error">{error}</div>;
  if (!provider) return <div className="p-6 text-ink-muted">Chargement…</div>;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Link to={backTo} className="text-sm text-primary">← Toutes les entreprises</Link>
        <div className="bg-white rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold text-primary">{provider.category_name}</p>
          <h1 className="text-3xl font-bold text-ink">{provider.name}</h1>
          {provider.about && <p className="text-ink whitespace-pre-line">{provider.about}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-ink">
            {provider.phone && <a href={`tel:${provider.phone}`} className="inline-flex items-center gap-1"><Phone className="w-4 h-4" />{provider.phone}</a>}
            {provider.email && <a href={`mailto:${provider.email}`} className="inline-flex items-center gap-1"><Mail className="w-4 h-4" />{provider.email}</a>}
            {provider.website && <a href={provider.website} className="inline-flex items-center gap-1"><Globe className="w-4 h-4" />Site</a>}
            {provider.address && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{provider.address}</span>}
            {provider.opening_hours && <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" />{provider.opening_hours}</span>}
          </div>
          {provider.coverage_zones && (
            <p className="text-sm text-ink-muted">Zones d’intervention : {provider.coverage_zones}</p>
          )}
        </div>

        {(provider.documents || []).some(isCarouselProof) && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink">Réalisations et témoignages</h2>
            <ServiceProofCarousel items={provider.documents} kinds={REALIZATION_KINDS} />
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-xl font-bold text-ink">Services</h2>
          {sections.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup('')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  !activeGroup ? 'bg-accent text-ink border-accent' : 'bg-white text-ink border-border'
                }`}
              >
                Tous
              </button>
              {sections.filter((row) => row.title).map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setActiveGroup(row.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                    activeGroup === row.id ? 'bg-accent text-ink border-accent' : 'bg-white text-ink border-border'
                  }`}
                >
                  {row.title}
                </button>
              ))}
            </div>
          )}
          {(provider.offers || []).length === 0 && (
            <p className="text-ink-muted text-sm">Aucun service publié pour le moment.</p>
          )}
          {visibleSections.map((section) => (
            <div key={section.id} className="space-y-3">
              {section.title && (
                <h3 className="text-lg font-bold text-ink">{section.title}</h3>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                {section.offers.map((offer) => (
                  <ServiceOfferCard key={offer.id} offer={offer} provider={provider} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {(provider.team || []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink">Équipe</h2>
            <ServiceTeamCarousel members={provider.team} />
          </section>
        )}

        {(provider.documents || []).some(isPaperImage) && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink">Justificatifs</h2>
            <ServiceProofCarousel items={provider.documents} kinds={PAPER_KINDS} />
          </section>
        )}

        {(provider.documents || []).filter((doc) => !isCarouselProof(doc) && !isPaperImage(doc)).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-ink">Autres documents</h2>
            <ul className="bg-white rounded-2xl p-4 space-y-2">
              {provider.documents.filter((doc) => !isCarouselProof(doc) && !isPaperImage(doc)).map((doc) => (
                <li key={doc.id} className="text-sm text-ink">
                  {doc.file_url
                    ? <a href={doc.file_url} className="text-primary font-semibold">{doc.title}</a>
                    : (
                      <span>
                        {doc.title}
                        {doc.description ? <span className="text-ink-muted"> — {doc.description}</span> : null}
                      </span>
                    )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ContactRequestForm
          providerId={provider.business_id}
          offers={sections.flatMap((section) => section.offers || [])}
        />
      </div>
    </div>
  );
}
