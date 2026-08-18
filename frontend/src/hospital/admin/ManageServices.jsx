import React, { useState, useEffect } from 'react';
import { HeartPulse, Plus, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageServices() {
  const [services, setServices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });
  const { token } = useAuth();

  useEffect(() => {
    // 1. Récupérer l'hôpital (business) de l'utilisateur
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
            fetchServices(hid);
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

  const fetchServices = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/services/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, hospital: hospitalId })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', description: '', is_active: true });
        fetchServices(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HeartPulse className="text-teal-600" />
            Départements & Services
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les départements médicaux de votre hôpital.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={!hospitalId}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Ajouter un Service
        </button>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre entreprise (Hôpital). Veuillez en créer une d'abord.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Nom du Service</th>
              <th className="px-6 py-4 font-medium">Description</th>
              <th className="px-6 py-4 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="3" className="text-center py-8">Chargement...</td></tr>
            ) : services.length === 0 ? (
              <tr><td colSpan="3" className="text-center py-8 text-gray-500">Aucun service défini.</td></tr>
            ) : (
              services.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.description || '-'}</td>
                  <td className="px-6 py-4">
                    {s.is_active ? 
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4"/> Actif</span> : 
                      <span className="flex items-center gap-1 text-gray-400 text-sm font-medium"><XCircle className="w-4 h-4"/> Inactif</span>
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Nouveau Département</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom (ex: Urgences, Pédiatrie)</label>
                <input 
                  type="text" required value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  rows="3" value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white font-medium hover:bg-teal-700 rounded-lg">Créer le service</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
