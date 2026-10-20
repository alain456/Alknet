import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import { tenantSlugFromHost } from '../shared/tenantHost';

export default function TenantHome() {
  const navigate = useNavigate();
  const slug = tenantSlugFromHost(window.location.hostname);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    fetch(`/api/v1/businesses/by-slug/${encodeURIComponent(slug)}/`)
      .then(async (response) => {
        if (!response.ok) throw new Error('missing');
        return response.json();
      })
      .then((data) => {
        if (!cancelled && data?.public_path) navigate(data.public_path, { replace: true });
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => { cancelled = true; };
  }, [slug, navigate]);

  if (!slug) return <LandingPage />;

  if (missing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-ink">Établissement introuvable</h1>
          <p className="mt-3 text-sm text-ink">
            L&apos;adresse <strong>{slug}.isokohub.com</strong> ne correspond à aucun établissement publié.
          </p>
          <a
            href={`${window.location.protocol}//${window.location.hostname.split('.').slice(1).join('.')}${window.location.port ? `:${window.location.port}` : ''}/`}
            className="inline-flex mt-6 px-4 py-2.5 rounded-xl bg-accent text-ink text-sm font-bold"
          >
            Retour à Isoko Hub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] grid place-items-center text-sm text-ink">
      Ouverture de l&apos;établissement…
    </div>
  );
}
