import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';
import api from '../shared/api';

const STATUS_MAP = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export default function BusinessOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.get('orders/', { auth: true });
      setOrders(
        (data || []).map((o) => ({
          id: String(o.id).slice(0, 8).toUpperCase(),
          fullId: o.id,
          customer: o.customer_name,
          amount: Number(o.total_amount),
          items: o.items?.length || 0,
          date: o.created_at?.split('T')[0],
          status: STATUS_MAP[o.status] || o.status,
          rawStatus: o.status,
        }))
      );
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await api.post(`orders/${id}/confirm/`, {}, { auth: true });
      loadOrders();
    } catch (err) {
      alert(err.message || 'Erreur');
    }
  };

  const columns = [
    { key: 'id', label: 'N° Commande', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'customer', label: 'Client' },
    { key: 'date', label: 'Date' },
    {
      key: 'amount',
      label: 'Montant',
      render: (val) => <span className="font-medium">{val.toLocaleString()} BIF</span>,
    },
    { key: 'items', label: 'Articles' },
    {
      key: 'status',
      label: 'Statut',
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
          val === 'Confirmée' ? 'bg-green-100 text-green-700'
            : val === 'En attente' ? 'bg-orange-100 text-orange-700'
            : val === 'Terminée' ? 'bg-blue-100 text-blue-700'
            : 'bg-red-100 text-red-700'
        }`}>{val}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        row.rawStatus === 'PENDING' ? (
          <button onClick={() => handleConfirm(row.fullId)}
            className="text-xs text-teal-600 font-semibold hover:underline">
            Confirmer
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingBag className="w-7 h-7 text-teal-600" /> Commandes
        </h1>
        <p className="text-gray-500 text-sm mt-1">Gestion des commandes produits de votre entreprise.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune commande pour le moment.</p>
          <p className="text-xs text-gray-400 mt-1">Les commandes apparaîtront ici lorsque des clients achèteront vos produits.</p>
        </div>
      ) : (
        <DataGrid columns={columns} data={orders} emptyMessage="Aucune commande." />
      )}
    </div>
  );
}
