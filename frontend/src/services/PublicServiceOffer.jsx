import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import providerService from './providerService';
import ContactRequestForm from './ContactRequestForm';

export default function PublicServiceOffer() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    providerService.getOffer(id)
      .then(setOffer)
      .catch((err) => setError(err.message || 'Service introuvable'));
  }, [id]);

  if (error) return <div className="p-6 text-error">{error}</div>;
  if (!offer) return <div className="p-6 text-ink-muted">Chargement…</div>;

  const provider = offer.provider;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-ink-muted">
          <Link to="/services" className="text-primary">Prestataires</Link>
          {provider ? (
            <>
              {' · '}
              <Link to={`/services/providers/${provider.business_id}`} className="text-primary">
                {provider.name}
              </Link>
              {' · '}
              {offer.title}
            </>
          ) : null}
        </p>
        <article className="bg-white rounded-3xl p-3 space-y-3">
          {(offer.image || (offer.image_urls || [])[0]) ? (
            <img
              src={offer.image || offer.image_urls[0]}
              alt=""
              className="w-full h-56 object-cover rounded-2xl"
            />
          ) : null}
          <div className="px-3 pb-3 space-y-3">
          <p className="text-xs font-semibold text-primary">{provider?.name || 'Service'}</p>
          <h1 className="text-3xl font-bold text-ink">{offer.title}</h1>
          {offer.description && <p className="text-ink whitespace-pre-line">{offer.description}</p>}
          {offer.modalities && (
            <p className="text-sm text-ink"><span className="font-semibold">Modalités : </span>{offer.modalities}</p>
          )}
          {offer.availability && (
            <p className="text-sm text-ink"><span className="font-semibold">Disponibilités : </span>{offer.availability}</p>
          )}
          {(offer.coverage_zone || offer.location) && (
            <p className="text-sm text-ink">
              <span className="font-semibold">Zone d’intervention : </span>
              {offer.coverage_zone || offer.location}
            </p>
          )}
          </div>
        </article>

        {(offer.sub_items || []).length > 0 && (
          <section className="bg-white rounded-2xl p-6">
            <h2 className="text-lg font-bold text-ink mb-3">Précisions</h2>
            <ul className="space-y-2">
              {offer.sub_items.map((item) => (
                <li key={item.id}>
                  <p className="font-semibold text-ink">{item.title}</p>
                  {item.description && <p className="text-sm text-ink-muted">{item.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ContactRequestForm
          providerId={offer.provider_id}
          offerId={offer.id}
          offerTitle={offer.title}
        />
      </div>
    </div>
  );
}
