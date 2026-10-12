import React, { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import api from '../shared/api';

const PAYMENT_LABEL = {
  PAID: 'Payé',
  UNPAID: 'Non payé',
  AWAITING_PIN: 'En attente du code',
  FAILED: 'Échoué',
  WAIVED: 'Gratuit',
};

const STATUS_LABEL = {
  LISTE_ATTENTE: 'Liste d’attente',
  ENVOYEE: 'Liste d’attente',
  EN_INSTRUCTION: 'Liste d’attente',
  COMPLEMENT_DEMANDE: 'Liste d’attente',
  ACCEPTEE: 'Accepté',
  CONFIRMEE: 'Accepté',
  REFUSEE: 'Refusé',
};

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} BIF`;
}

export default function SchoolAccounting() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('education/accounting/', { auth: true })
      .then(setData)
      .catch((err) => setError(err.message || 'Impossible de charger les frais.'));
  }, []);

  const rows = useMemo(() => {
    const students = data?.students || [];
    if (filter === 'ALL') return students;
    return students.filter((row) => row.payment_status === filter);
  }, [data, filter]);

  if (error) {
    return <p className="text-sm text-red-600 bg-red-50 rounded-xl p-4">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-gray-500">Chargement des frais d’inscription…</p>;
  }

  const totals = data.totals || {};

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div className="rounded-2xl border-duo bg-surface p-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-7 h-7 text-accent" /> Frais d’inscription
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Élèves de {data.school_name}. Une inscription gratuite n’a pas de paiement. Une inscription payante reste non payée, en attente du code, ou payée.
        </p>
        {data.simulation && (
          <p className="text-sm font-medium text-ink mt-3 rounded-xl border-2 border-accent bg-accent/10 p-3">
            Mode simulation : « Payé » veut dire que le code de simulation a été confirmé. Ce n’est pas encore un encaissement BurundiPay.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Élèves', totals.students],
          ['Payés', totals.paid_count],
          ['En attente du code', totals.awaiting_count],
          ['Non payés', totals.unpaid_count],
          ['Gratuits', totals.free_count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border-2 border-accent bg-surface p-4">
            <p className="text-xs font-bold text-gray-500">{label}</p>
            <p className="text-xl font-extrabold mt-1">{value ?? 0}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        Attendu sur les inscriptions payantes : {money(totals.expected_bif)}. Marqué encaissé en simulation : {money(totals.collected_bif)}.
      </p>

      <div className="flex flex-wrap gap-2">
        {[
          ['ALL', 'Tous'],
          ['PAID', 'Payés'],
          ['AWAITING_PIN', 'En attente du code'],
          ['UNPAID', 'Non payés'],
          ['FAILED', 'Échoués'],
          ['WAIVED', 'Gratuits'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 text-xs rounded-xl border-2 font-bold ${filter === value ? 'border-accent bg-primary/10' : 'border-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-accent bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Élève</th>
              <th className="px-4 py-3">Classe</th>
              <th className="px-4 py-3">Année</th>
              <th className="px-4 py-3">Dossier</th>
              <th className="px-4 py-3">Frais</th>
              <th className="px-4 py-3">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-gray-500">Aucun élève pour ce filtre.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <p className="font-bold">{row.student_name || '—'}</p>
                  <p className="text-xs text-gray-500">{row.guardian_name} {row.guardian_phone}</p>
                </td>
                <td className="px-4 py-3">{row.classroom || '—'}</td>
                <td className="px-4 py-3">{row.academic_year}</td>
                <td className="px-4 py-3">{STATUS_LABEL[row.status] || row.status}</td>
                <td className="px-4 py-3">
                  <p className="font-bold">{row.fee_mode === 'GRATUIT' ? 'Gratuite' : 'Payante'}</p>
                  <p>{row.fee_label || (row.fee_mode === 'GRATUIT' ? 'Aucun paiement' : 'Frais d’inscription')}</p>
                  <p className="font-bold">{row.fee_mode === 'GRATUIT' ? '0 BIF' : money(row.amount_bif)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold">{PAYMENT_LABEL[row.payment_status] || row.payment_status}</p>
                  {row.payer_phone && <p className="text-xs text-gray-500">{row.payer_phone}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
