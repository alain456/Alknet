import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { api } from '../shared/api';

const STATUS = {
  ENVOYEE: 'Reçu',
  EN_INSTRUCTION: 'En instruction',
  COMPLEMENT_DEMANDE: 'Complément demandé',
  LISTE_ATTENTE: 'Liste d’attente',
  ACCEPTEE: 'Accepté',
  REFUSEE: 'Refusé',
  CONFIRMEE: 'Confirmé',
};

const PAY = {
  PAID: 'Payé',
  UNPAID: 'Non payé',
  AWAITING_PIN: 'Paiement en cours',
  FAILED: 'Paiement échoué',
  WAIVED: 'Sans frais',
};

export default function MyEnrollments() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('education/applications/', { auth: true })
      .then((data) => setRows(Array.isArray(data) ? data : (data?.results || [])))
      .catch((err) => setError(err.message || 'Impossible de charger vos dossiers.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold text-ink flex items-center gap-2">
        <GraduationCap className="w-7 h-7 text-accent" /> Mes inscriptions
      </h1>
      {loading && <p className="text-sm text-ink-muted">Chargement…</p>}
      {error && <p className="text-sm text-alert">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-ink-muted">Aucun dossier n’est lié à ce compte. Utilisez le même e-mail que lors de l’inscription.</p>
      )}
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl bg-white ring-1 ring-border p-4 space-y-1">
          <p className="font-bold text-ink">{row.student_name || row.program_title}</p>
          <p className="text-sm text-ink-muted">{row.program_title} · {row.academic_year}</p>
          <p className="text-sm font-semibold text-ink">{STATUS[row.status] || row.status}</p>
          <p className="text-sm text-ink">Paiement : {PAY[row.payment_status] || row.payment_status || '—'}</p>
          {row.status === 'COMPLEMENT_DEMANDE' && row.decision_note && (
            <p className="text-sm text-ink">À fournir : {row.decision_note}</p>
          )}
          {row.suivi_url && (
            <a href={row.suivi_url} className="inline-flex text-sm font-bold text-primary underline">
              Ouvrir le dossier
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
