import React, { useState } from 'react';
import { Calendar, Clock, Video, User, FileText, CheckCircle } from 'lucide-react';
import hospitalService from './hospitalService';
import { useAuth } from '../context/AuthContext';

export default function AppointmentBooking({ doctor, hospitalId, hospitalName, onClose, onSuccess }) {
  const { token, user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    type: 'IN_PERSON',
    reason: '',
    patient_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    patient_phone: user?.phone_number || '',
    patient_email: user?.email || '',
  });

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '16:00'];

  const handleBook = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await hospitalService.createAppointment({
        hospital: hospitalId,
        doctor: doctor.id,
        appointment_date: hospitalService.buildAppointmentDate(formData.date, formData.time),
        consultation_type: formData.type,
        reason: formData.reason,
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        patient_email: formData.patient_email,
      }, !!token);
      setStep(3);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Erreur lors de la réservation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!doctor) return null;

  const doctorName = doctor.user_details
    ? `${doctor.user_details.first_name} ${doctor.user_details.last_name}`
    : doctor.name || 'Médecin';

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-hidden">
      <div className="bg-teal-600 px-6 py-4 flex justify-between items-center text-white">
        <h2 className="font-bold text-lg">Prendre rendez-vous</h2>
        {onClose && (
          <button onClick={onClose} className="text-teal-100 hover:text-white">✕</button>
        )}
      </div>

      <div className="p-6">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        {step < 3 && (
          <div className="flex items-center mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}>1</div>
            <div className={`h-1 flex-1 ${step >= 2 ? 'bg-teal-600' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}>2</div>
          </div>
        )}

        <div className="flex gap-4 items-center mb-6 p-4 bg-gray-50 rounded-xl">
          <User className="text-teal-600 w-6 h-6" />
          <div>
            <h4 className="font-bold">{doctorName}</h4>
            <p className="text-sm text-gray-600">{hospitalName}</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => setFormData({ ...formData, type: 'IN_PERSON' })}
                className={`border rounded-xl p-3 cursor-pointer text-center ${formData.type === 'IN_PERSON' ? 'border-teal-600 bg-teal-50' : ''}`}>
                <User className="w-6 h-6 mx-auto text-teal-600" />
                <span className="text-sm font-medium">Présentiel</span>
              </div>
              <div className="border rounded-xl p-3 text-center opacity-50 cursor-not-allowed border-gray-200 bg-gray-50">
                <Video className="w-6 h-6 mx-auto text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Téléconsultation — bientôt</span>
              </div>
            </div>
            <input type="date" value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border rounded-lg p-2.5" />
            {formData.date && (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => (
                  <div key={time} onClick={() => setFormData({ ...formData, time })}
                    className={`text-center py-2 text-sm rounded-lg border cursor-pointer ${formData.time === time ? 'bg-teal-600 text-white' : ''}`}>
                    {time}
                  </div>
                ))}
              </div>
            )}
            <button type="button" disabled={!formData.date || !formData.time}
              onClick={() => setStep(2)}
              className="w-full bg-teal-600 text-white font-medium py-3 rounded-xl disabled:bg-gray-300">
              Continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleBook} className="space-y-5">
            <textarea rows={3} value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Motif de consultation (optionnel)"
              className="w-full border rounded-lg p-3 resize-none" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 border py-3 rounded-xl">Retour</button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-teal-600 text-white py-3 rounded-xl disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Rendez-vous enregistré !</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Votre demande avec {doctorName} le {formData.date} à {formData.time} est en attente de confirmation.
            </p>
            <button onClick={onClose} className="w-full bg-teal-600 text-white py-3 rounded-xl">Terminer</button>
          </div>
        )}
      </div>
    </div>
  );
}
