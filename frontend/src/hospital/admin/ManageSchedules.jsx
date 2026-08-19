import React, { useState, useEffect } from 'react';
import { Clock, Plus, Calendar, Trash2, Edit2, UserCheck, Stethoscope, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  
  const [formData, setFormData] = useState({
    doctor: '',
    day_of_week: 0,
    start_time: '08:00',
    end_time: '16:00',
    is_available: true
  });

  const { token } = useAuth();

  const daysOfWeek = [
    { id: 0, name: 'Lundi' },
    { id: 1, name: 'Mardi' },
    { id: 2, name: 'Mercredi' },
    { id: 3, name: 'Jeudi' },
    { id: 4, name: 'Vendredi' },
    { id: 5, name: 'Samedi' },
    { id: 6, name: 'Dimanche' },
  ];

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
            fetchSchedules(hid);
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
        const data = await res.json();
        setDoctors(data);
        if (data.length > 0 && !formData.doctor) {
          setFormData(prev => ({ ...prev, doctor: data[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async (hid, docId = '') => {
    try {
      setLoading(true);
      let url = `http://localhost:8000/api/v1/hospital/schedules/?hospital=${hid}`;
      if (docId) url += `&doctor=${docId}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorFilterChange = (docId) => {
    setSelectedDoctorId(docId);
    if (hospitalId) fetchSchedules(hospitalId, docId);
  };

  const openCreateModal = () => {
    setEditingScheduleId(null);
    setFormData({
      doctor: doctors.length > 0 ? doctors[0].id : '',
      day_of_week: 0,
      start_time: '08:00',
      end_time: '16:00',
      is_available: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sch) => {
    setEditingScheduleId(sch.id);
    setFormData({
      doctor: sch.doctor,
      day_of_week: sch.day_of_week,
      start_time: sch.start_time,
      end_time: sch.end_time,
      is_available: sch.is_available
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce créneau d'horaire ?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/schedules/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSchedules(hospitalId, selectedDoctorId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingScheduleId
        ? `http://localhost:8000/api/v1/hospital/schedules/${editingScheduleId}/`
        : 'http://localhost:8000/api/v1/hospital/schedules/';
      
      const method = editingScheduleId ? 'PUT' : 'POST';
      const body = editingScheduleId
        ? { ...formData, hospital: hospitalId }
        : { ...formData, hospital: hospitalId };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchSchedules(hospitalId, selectedDoctorId);
      } else {
        const err = await res.json();
        alert("Erreur lors de la sauvegarde : " + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            Gestion des Horaires & Planning
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Définissez les créneaux de disponibilité des médecins pour la prise de rendez-vous en présentiel et téléconsultation.
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          disabled={!hospitalId || doctors.length === 0}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-md shadow-teal-600/20 transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-5 h-5" /> Nouveau Créneau
        </button>
      </div>

      {/* Filtre Médecin */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 whitespace-nowrap">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          Filtrer par médecin :
        </label>
        <select 
          value={selectedDoctorId} 
          onChange={e => handleDoctorFilterChange(e.target.value)}
          className="w-full sm:w-72 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="">Tous les médecins de l'hôpital</option>
          {doctors.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.user_details?.first_name} {doc.user_details?.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Grille des Jours de la Semaine */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {daysOfWeek.map(day => {
          const daySchedules = schedules.filter(s => s.day_of_week === day.id);
          return (
            <div key={day.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm flex flex-col">
              {/* Entête du Jour */}
              <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  {day.name}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                  {daySchedules.length} créneau(x)
                </span>
              </div>

              {/* Contenu */}
              <div className="p-4 flex-1 space-y-3">
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">Aucun horaire configuré</p>
                ) : (
                  daySchedules.map(sch => (
                    <div key={sch.id} className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs text-gray-900 dark:text-white">
                          {sch.doctor_name}
                        </div>
                        <div className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openEditModal(sch)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(sch.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Création / Édition Horaire */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                {editingScheduleId ? 'Modifier le Créneau' : 'Nouveau Créneau d\'Horaire'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Médecin Praticien</label>
                <select 
                  required
                  value={formData.doctor}
                  onChange={e => setFormData({ ...formData, doctor: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.user_details?.first_name} {doc.user_details?.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jour de la Semaine</label>
                <select 
                  value={formData.day_of_week}
                  onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {daysOfWeek.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure de début</label>
                  <input 
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heure de fin</label>
                  <input 
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input 
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={e => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Médecin disponible sur ce créneau</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-md transition cursor-pointer">
                  {editingScheduleId ? 'Mettre à jour' : 'Enregistrer le créneau'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
