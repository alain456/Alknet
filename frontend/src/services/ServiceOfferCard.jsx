import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, MapPin, Star, Store } from 'lucide-react';

export default function ServiceOfferCard({ offer, provider }) {
  const [broken, setBroken] = useState(false);
  const image = offer?.image || (offer?.image_urls || [])[0] || '';
  const showImage = Boolean(image) && !broken;
  const location = offer?.coverage_zone
    || [provider?.commune, provider?.province].filter(Boolean).join(' · ')
    || provider?.coverage_zones
    || '';
  const availability = offer?.availability || provider?.opening_hours || '';
  const rating = Number(offer?.rating || 0);
  const reviews = Number(offer?.reviews_count || 0);
  return (
    <article className="bg-white rounded-3xl p-3 flex flex-col h-full">
      <div className="relative overflow-hidden rounded-2xl h-44 bg-surface">
        {showImage ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/25">
            <Briefcase className="w-12 h-12 text-primary" />
          </div>
        )}
      </div>
      <div className="px-2 pt-3 pb-1 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-ink leading-snug line-clamp-2">{offer?.title}</h3>
          {reviews > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-ink">
              <Star className="w-3.5 h-3.5 text-accent fill-accent" />
              {rating.toFixed(1)}/5
            </span>
          )}
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
          {provider?.name && (
            <li className="flex items-center gap-2">
              <Store className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{provider.name}</span>
            </li>
          )}
          {location && (
            <li className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{location}</span>
            </li>
          )}
          {availability && (
            <li className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{availability}</span>
            </li>
          )}
        </ul>
        {offer?.description ? (
          <p className="mt-2 text-xs text-ink line-clamp-2">{offer.description}</p>
        ) : null}
        <div className="mt-auto pt-3 flex items-end justify-end">
          <Link
            to={`/services/offers/${offer.id}`}
            className="shrink-0 px-4 py-2 rounded-full bg-accent text-ink text-sm font-semibold"
          >
            Voir
          </Link>
        </div>
      </div>
    </article>
  );
}
