import React, { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import api from '../shared/api';
import { downloadApplicationPdf } from './dossierPdf';
import { useAuth } from '../context/AuthContext';

const PAYMENT_LABEL = {
  PAID: 'Payé',
  UNPAID: 'Non payé',
  AWAITING_PIN: 'En attente du code',
  FAILED: 'Échoué',
  WAIVED: 'Gratuit',
  BORDEREAU_RECU: 'Bordereau reçu',
};

const METHOD_LABEL = {
  BURUNDIPAY: 'BurundiPay',
  BORDEREAU: 'Bordereau',
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

const LEDGER = [
  ['TO_COLLECT', 'À encaisser', 'Inscription payante, paiement pas encore confirmé.'],
  ['COLLECTED', 'Encaissé et accepté', 'Le paiement est confirmé et le dossier est accepté.'],
  ['PAID_PENDING', 'Payé, décision en cours', 'Le paiement est confirmé. Le dossier est encore dans la file.'],
  ['PAID_REFUSED', 'Payé puis refusé', 'Le paiement est confirmé, puis le dossier a été refusé.'],
  ['BORDEREAU', 'Bordereau reçu', 'Le dossier contient un bordereau PDF. Ce n’est pas un encaissement BurundiPay.'],
  ['FREE', 'Inscription gratuite', 'Aucun paiement n’est demandé.'],
];

export default function SchoolAccounting() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('TO_COLLECT');
  const [accountant, setAccountant] = useState({ email: '', first_name: '', last_name: '', password: '' });
  const [accountantNotice, setAccountantNotice] = useState('');
  const [accountantError, setAccountantError] = useState('');
  const [savingAccountant, setSavingAccountant] = useState(false);
  const isOwner = user?.role === 'BUSINESS_OWNER';

  useEffect(() => {
    api.get('education/accounting/', { auth: true })
      .then(setData)
      .catch((err) => setError(err.message || 'Impossible de charger les frais.'));
  }, []);

  const rows = useMemo(() => {
    const students = data?.students || [];
    return students.filter((row) => (row.ledger || 'TO_COLLECT') === filter);
  }, [data, filter]);

  const inviteAccountant = async (event) => {
    event.preventDefault();
    setAccountantError('');
    setAccountantNotice('');
    setSavingAccountant(true);
    try {
      const roles = await api.get('businesses/my-business/roles/', { auth: true });
      const list = Array.isArray(roles) ? roles : [];
      let role = list.find((item) => (item.name || '').trim().toLowerCase() === 'comptable');
      if (!role) {
        role = await api.post('businesses/my-business/roles/', {
          name: 'Comptable',
          system_access_level: 'CASHIER_ACCESS',
          permissions: ['education.fees.manage'],
        }, { auth: true });
      }
      const saved = await api.post('businesses/my-business/employees/', {
        email: accountant.email.trim(),
        first_name: accountant.first_name.trim(),
        last_name: accountant.last_name.trim(),
        password: accountant.password,
        role_id: role.id,
        position: 'Comptable',
      }, { auth: true });
      setAccountant({ email: '', first_name: '', last_name: '', password: '' });
      setAccountantNotice(saved.message || 'Le comptable peut ouvrir Frais d’inscription.');
    } catch (err) {
      setAccountantError(err.message || 'Impossible de créer le compte comptable.');
    } finally {
      setSavingAccountant(false);
    }
  };

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
          {data.school_name}. Seuls les dossiers acceptés et payés sont des élèves encaissés. Un refus après paiement reste visible ici.
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
          ['Bordereaux', totals.bordereau_count],
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

      {isOwner && (
        <form onSubmit={inviteAccountant} className="rounded-2xl border-2 border-accent bg-surface p-4 space-y-3">
          <h2 className="font-extrabold">Inviter le comptable</h2>
          <p className="text-sm text-gray-500">Ce compte ouvre seulement Frais d’inscription. Il n’y a pas de menu Employés pour l’école.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="px-3 py-2 rounded-xl border-2 border-accent text-sm" placeholder="Prénom" value={accountant.first_name} onChange={(e) => setAccountant({ ...accountant, first_name: e.target.value })} required />
            <input className="px-3 py-2 rounded-xl border-2 border-accent text-sm" placeholder="Nom" value={accountant.last_name} onChange={(e) => setAccountant({ ...accountant, last_name: e.target.value })} required />
            <input className="px-3 py-2 rounded-xl border-2 border-accent text-sm" type="email" placeholder="E-mail" value={accountant.email} onChange={(e) => setAccountant({ ...accountant, email: e.target.value })} required />
            <input className="px-3 py-2 rounded-xl border-2 border-accent text-sm" type="password" placeholder="Mot de passe" value={accountant.password} onChange={(e) => setAccountant({ ...accountant, password: e.target.value })} required />
          </div>
          {accountantError && <p className="text-sm text-red-600">{accountantError}</p>}
          {accountantNotice && <p className="text-sm font-medium">{accountantNotice}</p>}
          <button type="submit" disabled={savingAccountant} className="px-4 py-2 rounded-xl bg-accent text-ink text-sm font-bold">
            {savingAccountant ? 'Enregistrement…' : 'Créer le compte comptable'}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {LEDGER.map(([value, label]) => {
          const count = (data.students || []).filter((row) => (row.ledger || 'TO_COLLECT') === value).length;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-xs rounded-xl border-2 font-bold ${filter === value ? 'bg-accent text-ink border-accent' : 'border-gray-200'}`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-500">{LEDGER.find(([value]) => value === filter)?.[2]}</p>

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
              <th className="px-4 py-3">Mode</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-gray-500">Aucun dossier dans cette file.</td>
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
                <td className="px-4 py-3">
                  <p>{METHOD_LABEL[row.payment_method] || '—'}</p>
                  {row.has_bordereau && (
                    <button
                      type="button"
                      className="text-xs font-bold text-primary"
                      onClick={() => downloadApplicationPdf(`education/accounting/${row.id}/bordereau/`).catch((err) => setError(err.message))}
                    >
                      Télécharger le bordereau
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
