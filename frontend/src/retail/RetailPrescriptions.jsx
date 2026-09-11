import React, { useEffect, useState } from 'react';
import { isImagePrescription, PrescriptionModal, PrescriptionOpenButton } from './PrescriptionViewer';
import retailService from './retailService';

const labels = { PENDING: 'À revoir', REVIEWED: 'Revue', ACCEPTED: 'Acceptée', REJECTED: 'Refusée' };

export default function RetailPrescriptions({ clientMode = false }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');

  const load = () => retailService.getPrescriptions()
    .then((r) => setItems(r.results || r || []))
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const review = async (id, status) => {
    try {
      await retailService.reviewPrescription(id, {
        status,
        comment: window.prompt('Commentaire de revue', '') || '',
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">{clientMode ? 'Mes ordonnances' : 'Ordonnances'}</h1>
        <p className="text-sm text-ink-muted">Documents associés aux commandes patients.</p>
      </div>
      {error && <div className="p-3 bg-red-50 text-error rounded-xl text-sm">{error}</div>}
      <div className="grid lg:grid-cols-2 gap-4">
        {items.map((p) => (
          <article key={p.id} className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <div className="flex justify-between gap-3">
              <div>
                <b className="text-ink">{p.patient_name}</b>
                <small className="block text-ink-muted">{p.patient_email} · {p.order_reference}</small>
              </div>
              <span className={`text-sm font-semibold shrink-0 ${p.status === 'REJECTED' ? 'text-error' : 'text-primary'}`}>
                {labels[p.status] || p.status}
              </span>
            </div>
            {isImagePrescription(p.file_url) ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewerUrl(p.file_url)}
                  className="block w-full text-left"
                >
                  <img
                    src={p.file_url}
                    alt="Ordonnance"
                    className="w-full h-48 object-contain bg-paper rounded-lg border border-border cursor-zoom-in"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setViewerUrl(p.file_url)}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  Agrandir / ouvrir
                </button>
              </>
            ) : (
              <PrescriptionOpenButton
                fileUrl={p.file_url}
                label="Ouvrir l’ordonnance"
                className="text-primary underline font-semibold text-sm"
              />
            )}
            {p.review_comment && (
              <p className="text-sm bg-paper p-2 rounded-lg text-ink-muted">{p.review_comment}</p>
            )}
            {!clientMode && p.status !== 'ACCEPTED' && p.status !== 'REJECTED' && (
              <div className="flex gap-2">
                <button type="button" onClick={() => review(p.id, 'ACCEPTED')} className="bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
                  Accepter
                </button>
                <button type="button" onClick={() => review(p.id, 'REJECTED')} className="bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
                  Refuser
                </button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && !error && (
          <p className="text-ink-muted col-span-full py-8 text-center">Aucune ordonnance.</p>
        )}
      </div>
      {viewerUrl && <PrescriptionModal fileUrl={viewerUrl} onClose={() => setViewerUrl('')} />}
    </section>
  );
}
