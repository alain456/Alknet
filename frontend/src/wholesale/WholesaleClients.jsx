import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Search, Building2, Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import wholesaleService, { ORDER_STATUS_LABELS } from './wholesaleService';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

export default function WholesaleClients() {
  const { clientKey } = useParams();
  if (clientKey) return <ClientDetail clientKey={decodeURIComponent(clientKey)} />;
  return <ClientList />;
}

function ClientList() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (account) params.account = account;
    if (status) params.status = status;
    wholesaleService.getClients(params)
      .then(setClients)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => ({
    count: clients.length,
    withAccount: clients.filter((c) => c.has_account).length,
    amount: clients.reduce((s, c) => s + Number(c.amount_accepted || 0), 0),
  }), [clients]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pharmacies clientes</h1>
        <p className="text-sm text-slate-500">
          Pharmacies de détail ayant commandé chez vous (comptes Isoko et commandes catalogue).
        </p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-slate-500 uppercase">Clients</div>
          <div className="text-2xl font-bold">{totals.count}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-slate-500 uppercase">Avec compte Isoko</div>
          <div className="text-2xl font-bold">{totals.withAccount}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-slate-500 uppercase">CA accepté</div>
          <div className="text-2xl font-bold">{money(totals.amount)}</div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-[180px] text-xs space-y-1">
          <span className="text-slate-500">Recherche</span>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              className="flex-1 outline-none text-sm"
              placeholder="Nom, email, commune…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Compte</span>
          <select className="border rounded-lg px-3 py-2 text-sm block" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Tous</option>
            <option value="with">Avec compte</option>
            <option value="without">Sans compte</option>
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-500">Statut</span>
          <select className="border rounded-lg px-3 py-2 text-sm block" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">En commande</option>
          </select>
        </label>
        <button type="button" onClick={load} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold">
          Filtrer
        </button>
      </div>

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Pharmacie</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Commandes</th>
              <th className="px-4 py-3">Acceptées</th>
              <th className="px-4 py-3">CA accepté</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Dernière</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Chargement…</td></tr>
            )}
            {!loading && clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/wholesale-pharmacy/clients/${encodeURIComponent(c.id)}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    {c.commune && <><MapPin className="w-3 h-3" />{c.commune}</>}
                    {c.has_account ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Compte Isoko</span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100">Catalogue</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div>{c.email || '—'}</div>
                  <div className="text-slate-400">{c.phone || '—'}</div>
                </td>
                <td className="px-4 py-3">{c.orders_count}</td>
                <td className="px-4 py-3">{c.orders_accepted}</td>
                <td className="px-4 py-3 font-semibold">{money(c.amount_accepted)}</td>
                <td className="px-4 py-3 text-xs font-bold">{c.status_label || c.status}</td>
                <td className="px-4 py-3 text-xs">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleString('fr-FR') : '—'}
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Aucune pharmacie cliente pour le moment
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientDetail({ clientKey }) {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    wholesaleService.getClient(clientKey)
      .then(setClient)
      .catch((e) => setError(e.message || 'Client introuvable'));
  }, [clientKey]);

  if (error && !client) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => navigate('/wholesale-pharmacy/clients')} className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
      </div>
    );
  }

  if (!client) return <div className="p-6 text-slate-500">Chargement…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <button type="button" onClick={() => navigate('/wholesale-pharmacy/clients')} className="text-sm text-primary inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Pharmacies clientes
      </button>

      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 font-semibold">
                  {client.status_label || client.status}
                </span>
                {client.has_account ? (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">Compte Isoko</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-amber-100 bg-amber-50 text-amber-800">Commande catalogue</span>
                )}
              </div>
            </div>
          </div>
          <Link
            to={
              client.client_business_id
                ? `/wholesale-pharmacy/orders?client=${encodeURIComponent(client.client_business_id)}`
                : client.email
                  ? `/wholesale-pharmacy/orders?buyer_email=${encodeURIComponent(client.email)}`
                  : '/wholesale-pharmacy/orders'
            }
            className="px-4 py-2 border rounded-xl text-sm font-semibold"
          >
            Voir les commandes
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-4 h-4 text-slate-400" />
            {client.email || '—'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" />
            {client.phone || '—'}
          </div>
          <div className="flex items-center gap-2 text-slate-600 sm:col-span-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            {[client.address, client.commune].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Commandes" value={client.orders_count} />
        <Stat label="En attente" value={client.orders_submitted} />
        <Stat label="Acceptées" value={client.orders_accepted} />
        <Stat label="CA accepté" value={money(client.amount_accepted)} />
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-bold">Dernières commandes</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(client.recent_orders || []).map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/wholesale-pharmacy/orders/${o.id}`} className="font-semibold text-primary hover:underline">
                    {o.reference || '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.submitted_at || o.created_at
                    ? new Date(o.submitted_at || o.created_at).toLocaleString('fr-FR')
                    : '—'}
                </td>
                <td className="px-4 py-3 font-semibold">{money(o.total_amount, o.currency)}</td>
                <td className="px-4 py-3 text-xs font-bold">{ORDER_STATUS_LABELS[o.status] || o.status}</td>
              </tr>
            ))}
            {(client.recent_orders || []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucune commande</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border rounded-2xl p-4">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
