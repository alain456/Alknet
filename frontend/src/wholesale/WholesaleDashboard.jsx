import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Users, History,
  AlertTriangle, CheckCircle2, XCircle, Plus,
} from 'lucide-react';
import wholesaleService, { ORDER_STATUS_LABELS } from './wholesaleService';

const money = (n) => `${Number(n || 0).toLocaleString('fr-BI')} BIF`;

export default function WholesaleDashboard({ clientMode = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wholesaleService.getDashboard()
      .then(setData)
      .catch((e) => setError(e.message || 'Erreur dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-ink-muted">Chargement...</div>;
  if (error) return <div className="p-8 text-error">{error}</div>;
  if (!data) return null;

  if (data.role === 'CLIENT') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-primary to-secondary p-6 rounded-2xl text-white shadow-lg">
          <h1 className="text-2xl font-bold">Tableau de bord — {data.business_name}</h1>
          <p className="text-green-100 text-sm mt-1">Suivi de vos commandes d&apos;approvisionnement</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard label="Commandes en cours" value={data.orders_pending} icon={ShoppingCart} color="text-accent bg-gold-50" />
          <StatCard label="Acceptées" value={data.orders_accepted} icon={CheckCircle2} color="text-success bg-green-50" />
          <StatCard label="Refusées" value={data.orders_rejected} icon={XCircle} color="text-error bg-red-50" />
        </div>
        <div className="flex gap-3">
          <Link to="/wholesale-pharmacy/client/catalog" className="px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl font-semibold">Voir le catalogue</Link>
          <Link to="/wholesale-pharmacy/client/orders" className="px-4 py-2 border border-border rounded-xl font-semibold text-ink">Mes commandes</Link>
        </div>
        <RecentOrders orders={data.recent_orders || []} base="/wholesale-pharmacy/client/orders" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-primary to-secondary p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-green-100 text-xs font-semibold mb-2">
            <LayoutDashboard className="w-3.5 h-3.5 text-accent" /> Pharmacie de gros
          </div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-green-100 text-sm mt-1">{data.business_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/wholesale-pharmacy/catalog" className="inline-flex items-center gap-1 px-3 py-2 bg-accent hover:bg-yellow-400 text-ink rounded-xl text-sm font-bold">
            <Plus className="w-4 h-4" /> Ajouter un médicament
          </Link>
          <Link to="/wholesale-pharmacy/inventory" className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold">Stock</Link>
          <Link to="/wholesale-pharmacy/orders" className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold">
            Commandes ({data.orders_pending || 0})
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produits actifs" value={data.products_active} icon={Package} color="text-primary bg-green-50" />
        <StatCard label="Valeur stock" value={money(data.stock_value)} icon={Boxes} color="text-ink bg-paper" />
        <StatCard label="Stock faible" value={data.low_stock_count} icon={AlertTriangle} color="text-accent bg-gold-50" />
        <StatCard label="Ruptures" value={data.out_of_stock_count} icon={XCircle} color="text-error bg-red-50" />
        <StatCard label="Commandes reçues" value={data.orders_total} icon={ShoppingCart} color="text-primary bg-green-50" />
        <StatCard label="En attente" value={data.orders_pending} icon={History} color="text-accent bg-gold-50" />
        <StatCard label="Acceptées" value={data.orders_accepted} icon={CheckCircle2} color="text-success bg-green-50" />
        <StatCard label="CA accepté" value={money(data.revenue_accepted)} icon={Users} color="text-success bg-green-50" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <RecentOrders orders={data.recent_orders || []} base="/wholesale-pharmacy/orders" />
        <div className="bg-white border border-border rounded-2xl p-5">
          <h3 className="font-bold text-ink mb-3">Produits les plus commandés</h3>
          {(data.top_products || []).length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune donnée encore.</p>
          ) : (
            <ul className="space-y-2">
              {data.top_products.map((p) => (
                <li key={p.product_name_snapshot} className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="font-medium text-ink">{p.product_name_snapshot}</span>
                  <span className="text-primary font-bold">{p.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-ink-muted font-medium">{label}</div>
        <div className="text-lg font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

function RecentOrders({ orders, base }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <h3 className="font-bold text-ink mb-3">Dernières commandes</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucune commande.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`${base}/${o.id}`} className="flex justify-between gap-3 text-sm hover:bg-paper rounded-lg px-2 py-2">
                <div>
                  <div className="font-semibold text-primary">{o.reference || '—'}</div>
                  <div className="text-xs text-ink-muted">
                    {o.buyer_label || o.client_business_name || o.buyer_name || 'Client'} · {ORDER_STATUS_LABELS[o.status] || o.status}
                  </div>
                </div>
                <div className="font-bold text-ink whitespace-nowrap">{money(o.total_amount)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
