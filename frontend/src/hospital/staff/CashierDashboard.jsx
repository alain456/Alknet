import React, { useState, useEffect } from 'react';
import { Receipt, DollarSign, User, Calendar, CheckCircle, XCircle, Clock, Search, Printer, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CashierDashboard() {
  const { token , authFetch} = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidCount: 0,
    pendingCount: 0
  });

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await authFetch('/api/v1/businesses/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (busRes.ok) {
          const businesses = await busRes.json();
          if (businesses.length > 0) {
            const hid = businesses[0].id;
            setHospitalId(hid);
            fetchInvoices(hid);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (token) init();
  }, [token]);

  const fetchInvoices = async (hid) => {
    try {
      const res = await authFetch(`/api/v1/hospital/invoices/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
        
        // Calculer les statistiques
        const paidInvoices = data.filter(i => i.status === 'PAID');
        const pendingInvoices = data.filter(i => i.status === 'PENDING');
        
        setStats({
          totalRevenue: paidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
          pendingAmount: pendingInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
          paidCount: paidInvoices.length,
          pendingCount: pendingInvoices.length
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentStatusUpdate = async (invoiceId, newStatus) => {
    try {
      const res = await authFetch(`/api/v1/hospital/invoices/${invoiceId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchInvoices(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING': { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
      'PAID': { label: 'Payée', color: 'bg-green-100 text-green-700' },
      'CANCELLED': { label: 'Annulée', color: 'bg-red-100 text-red-700' },
    };
    const config = statusConfig[status] || statusConfig['PENDING'];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${config.color}`}>
        {status === 'PAID' && <CheckCircle className="w-3 h-3" />}
        {status === 'PENDING' && <Clock className="w-3 h-3" />}
        {status === 'CANCELLED' && <XCircle className="w-3 h-3" />}
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount || 0);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = filterStatus === 'ALL' || invoice.status === filterStatus;
    const patientName = invoice.patient_name?.toLowerCase() || '';
    const invoiceNumber = invoice.invoice_number?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    const matchesSearch = patientName.includes(search) || invoiceNumber.includes(search);
    return matchesStatus && matchesSearch;
  });

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="text-orange-600" />
            Espace Caissier
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestion des factures et paiements
          </p>
        </div>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas accès à un hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Revenu Total</p>
                  <p className="text-3xl font-bold text-gray-900">{formatAmount(stats.totalRevenue)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En Attente</p>
                  <p className="text-3xl font-bold text-gray-900">{formatAmount(stats.pendingAmount)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Factures Payées</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.paidCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En Attente</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filtres */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600">Statut:</span>
                {['ALL', 'PENDING', 'PAID', 'CANCELLED'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      filterStatus === status
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'Toutes' :
                     status === 'PENDING' ? 'En attente' :
                     status === 'PAID' ? 'Payées' : 'Annulées'}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher patient ou facture..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-600"
                />
              </div>
            </div>
          </div>

          {/* Tableau des factures */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">N° Facture</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Montant</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        Aucune facture trouvée.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(invoice => (
                      <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{invoice.invoice_number || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{invoice.patient_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(invoice.invoice_date)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900">{formatAmount(invoice.amount)}</span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Imprimer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {invoice.status === 'PENDING' && (
                              <button
                                onClick={() => handlePaymentStatusUpdate(invoice.id, 'PAID')}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                              >
                                Marquer Payée
                              </button>
                            )}
                            {invoice.status === 'PAID' && (
                              <button
                                onClick={() => handlePaymentStatusUpdate(invoice.id, 'PENDING')}
                                className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 transition"
                              >
                                Marquer En attente
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
