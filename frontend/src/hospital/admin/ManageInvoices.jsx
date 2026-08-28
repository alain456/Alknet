import React, { useState, useEffect } from 'react';
import { Receipt, DollarSign, User, Calendar, CheckCircle, XCircle, Clock, Search, Plus, Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageInvoices() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    patient: '',
    appointment: '',
    amount: 0,
    description: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await fetch('http://localhost:8000/api/v1/businesses/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (busRes.ok) {
          const businesses = await busRes.json();
          if (businesses.length > 0) {
            const hid = businesses[0].id;
            setHospitalId(hid);
            fetchInvoices(hid);
            fetchPatients();
            fetchAppointments(hid);
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
      const res = await fetch(`http://localhost:8000/api/v1/hospital/invoices/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInvoices(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/accounts/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        setPatients(users.filter(u => u.role === 'CUSTOMER'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAppointments = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/appointments/?hospital=${hid}&status=COMPLETED`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAppointments(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/invoices/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          hospital: hospitalId
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          patient: '',
          appointment: '',
          amount: 0,
          description: ''
        });
        fetchInvoices(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/invoices/${invoiceId}/`, {
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
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> En attente</span>;
      case 'PAID':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Payée</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Annulée</span>;
      default:
        return null;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = filterStatus === 'ALL' || invoice.status === filterStatus;
    const patientName = invoice.patient_name?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    const matchesSearch = patientName.includes(search);
    return matchesStatus && matchesSearch;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('fr-FR') + ' BIF';
  };

  const totalRevenue = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

  const pendingAmount = invoices
    .filter(inv => inv.status === 'PENDING')
    .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="text-teal-600" />
            Gestion de la Facturation
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les factures et paiements de votre hôpital.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={!hospitalId}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Nouvelle Facture
        </button>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Revenu Total</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En Attente</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Factures</p>
                  <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-blue-600" />
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
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'Toutes' : status === 'PENDING' ? 'En attente' : status === 'PAID' ? 'Payées' : 'Annulées'}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher patient..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
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
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Facture #</th>
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
                          <span className="text-sm font-mono text-gray-900">{invoice.id?.substring(0, 8)}...</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{invoice.patient_name}</p>
                              <p className="text-xs text-gray-500">ID: {invoice.patient?.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(invoice.issued_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-bold text-gray-900">{formatCurrency(invoice.amount)}</span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {invoice.status === 'PENDING' && (
                              <button
                                onClick={() => handleStatusChange(invoice.id, 'PAID')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                title="Marquer comme payée"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Nouvelle Facture</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <select 
                  required
                  value={formData.patient}
                  onChange={e => setFormData({...formData, patient: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rendez-vous (optionnel)</label>
                <select 
                  value={formData.appointment}
                  onChange={e => setFormData({...formData, appointment: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Aucun rendez-vous associé</option>
                  {appointments.map(apt => (
                    <option key={apt.id} value={apt.id}>
                      {formatDate(apt.appointment_date)} - {apt.patient_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (BIF)</label>
                <input 
                  type="number"
                  required
                  min="0"
                  step="100"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                  placeholder="50000"
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Détails de la facturation..."
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg"
                >
                  Créer la facture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
