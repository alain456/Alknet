import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, AlertTriangle,
  Store, Power, ExternalLink, Printer, Ban,
} from 'lucide-react';
import commerceService from './commerceService';
import { useSmartPolling } from '../shared/useSmartPolling';

const money = (n) => `${Number(n || 0).toLocaleString('fr-BI')} BIF`;

export default function CommerceDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await commerceService.getDashboard();
      setData(d);
      setError('');
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useSmartPolling(refresh, 30000, true);

  const toggleOpen = async () => {
    if (!data) return;
    setToggling(true);
    setError('');
    try {
      const res = await commerceService.setShopOpen(!data.is_open_for_orders);
      setData((prev) => ({ ...prev, is_open_for_orders: res.is_open_for_orders }));
    } catch (e) {
      setError(e.message || 'Impossible de changer le statut');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;
  if (!data && error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const open = data.is_open_for_orders !== false;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary p-6 rounded-2xl text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-green-100 mb-1">Commerce — retrait en magasin</p>
            <h1 className="text-2xl font-bold">Tableau de bord</h1>
            <p className="text-green-100 text-sm mt-1">{data.business_name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={toggling}
              onClick={toggleOpen}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-60 ${
                open
                  ? 'bg-red-500/90 text-white hover:bg-red-400'
                  : 'bg-emerald-400/90 text-emerald-950 hover:bg-emerald-300'
              }`}
            >
              {open ? <Ban className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              {toggling ? '…' : open ? 'Bloquer les commandes' : 'Autoriser les commandes'}
            </button>
            {data.public_shop_path && (
              <Link
                to={data.public_shop_path}
                target="_blank"
                className="inline-flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold"
              >
                <ExternalLink className="w-4 h-4" /> Voir la boutique
              </Link>
            )}
          </div>
        </div>
        <p className="text-xs text-green-100/90 mt-3">
          {open
            ? 'Les clients peuvent passer commande en ligne.'
            : 'Nouvelles commandes bloquées — le catalogue reste visible.'}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to="/commerce/orders" className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Commandes
          </Link>
          <Link to="/commerce/catalog" className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold">Catalogue</Link>
          <Link to="/commerce/inventory" className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold">Stock</Link>
          <Link to="/commerce/profile" className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5">
            <Store className="w-4 h-4" /> Profil
          </Link>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="CA du jour" value={money(data.revenue_today)} icon={LayoutDashboard} />
        <Link to="/commerce/orders?col=pay" className="block">
          <Card label="À encaisser" value={data.orders_awaiting_payment ?? data.orders_pending} icon={ShoppingCart} />
        </Link>
        <Link to="/commerce/orders?col=prep" className="block">
          <Card label="À préparer" value={data.orders_to_prepare} icon={Package} />
        </Link>
        <Link to="/commerce/orders?col=ready" className="block">
          <Card label="Prêtes" value={data.orders_ready} icon={Printer} />
        </Link>
      </div>

      {(data.low_stock || []).length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Alertes stock ({data.low_stock.length})
            </h2>
            <Link to="/commerce/inventory" className="text-sm text-primary font-semibold underline inline-flex items-center gap-1">
              <Warehouse className="w-4 h-4" /> Ajuster
            </Link>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            {data.low_stock.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="font-mono text-amber-800">{p.stock} restant(s)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition h-full">
      <div className="w-10 h-10 rounded-lg bg-green-50 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
