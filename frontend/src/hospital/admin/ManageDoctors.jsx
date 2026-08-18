import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Mail, CreditCard, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    first_name: '', last_name: '', email: '', password: '', 
    medical_license_number: '', consultation_fee: 0, 
    is_available_for_telemedicine: false, bio: '' 
  });
  const { token } = useAuth();

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
            fetchDoctors(hid);
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

  const fetchDoctors = async (hid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
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
      const res = await fetch('http://localhost:8000/api/v1/hospital/doctors/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, hospital: hospitalId })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ 
          first_name: '', last_name: '', email: '', password: '', 
          medical_license_number: '', consultation_fee: 0, 
          is_available_for_telemedicine: false, bio: '' 
        });
        fetchDoctors(hospitalId);
      } else {
        const err = await res.json();
        alert("Erreur lors de la création : " + JSON.stringify(err));
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
            <Stethoscope className="text-teal-600" />
            Médecins
          </h1>
          <p className="text-gray-500 text-sm mt-1">Ajoutez et gérez les profils des médecins de votre établissement.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={!hospitalId}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Ajouter un Médecin
        </button>
      </div>

      {!hospitalId && !loading && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <p>Chargement...</p>
        ) : doctors.length === 0 && hospitalId ? (
          <p className="col-span-full text-gray-500">Aucun médecin enregistré. Cliquez sur "Ajouter un Médecin".</p>
        ) : (
          doctors.map(doc => (
            <div key={doc.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">
                    {doc.user_detail?.first_name?.[0] || 'D'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Dr. {doc.user_detail?.first_name} {doc.user_detail?.last_name}</h3>
                    <p className="text-sm text-gray-500">Licence: {doc.medical_license_number}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 flex-1">
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400"/> {doc.user_detail?.email}</p>
                <p className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-400"/> {doc.consultation_fee} BIF / consultation</p>
                {doc.is_available_for_telemedicine && (
                  <p className="flex items-center gap-2 text-blue-600 font-medium"><Video className="w-4 h-4"/> Téléconsultation disponible</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-bold text-lg">Nouveau Médecin</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de connexion</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe temporaire</label>
                  <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Licence</label>
                  <input type="text" required value={formData.medical_license_number} onChange={e => setFormData({...formData, medical_license_number: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frais de consultation (BIF)</label>
                  <input type="number" required value={formData.consultation_fee} onChange={e => setFormData({...formData, consultation_fee: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600" />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-4">
                  <input type="checkbox" checked={formData.is_available_for_telemedicine} onChange={e => setFormData({...formData, is_available_for_telemedicine: e.target.checked})} className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" />
                  <span className="text-sm font-medium text-gray-700">Ce médecin effectue des téléconsultations (Vidéo)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white font-medium hover:bg-teal-700 rounded-lg">Créer le médecin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
