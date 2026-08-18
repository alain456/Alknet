import React, { useState } from 'react';
import { Calendar, Clock, Video, User, FileText, CheckCircle } from 'lucide-react';

export default function AppointmentBooking({ doctor, hospitalName, onClose }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    type: 'IN_PERSON',
    reason: ''
  });

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '16:00'];

  const handleBook = (e) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => {
      setStep(3); // Success step
    }, 1000);
  };

  if (!doctor) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-teal-600 px-6 py-4 flex justify-between items-center text-white">
        <h2 className="font-bold text-lg">Prendre Rendez-vous</h2>
        {onClose && (
          <button onClick={onClose} className="text-teal-100 hover:text-white transition">
            ✕
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Step Indicator */}
        {step < 3 && (
          <div className="flex items-center mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`h-1 flex-1 ${step >= 2 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          </div>
        )}

        {/* Doctor Info Summary */}
        <div className="flex gap-4 items-center mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200">
            <User className="text-teal-600 w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Dr. {doctor.name}</h4>
            <p className="text-sm text-gray-600">{doctor.specialty} • {hospitalName}</p>
          </div>
        </div>

        {/* Step 1: Date & Type */}
        {step === 1 && (
          <form className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de consultation</label>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={() => setFormData({...formData, type: 'IN_PERSON'})}
                  className={`border rounded-xl p-3 cursor-pointer flex flex-col items-center gap-2 transition ${formData.type === 'IN_PERSON' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <User className="w-6 h-6" />
                  <span className="text-sm font-medium">En présentiel</span>
                </div>
                {doctor.isAvailableForTelemedicine && (
                  <div 
                    onClick={() => setFormData({...formData, type: 'TELEMEDICINE'})}
                    className={`border rounded-xl p-3 cursor-pointer flex flex-col items-center gap-2 transition ${formData.type === 'TELEMEDICINE' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-sm font-medium">Téléconsultation</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" /> Date souhaitée
              </label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-600 outline-none"
              />
            </div>

            {formData.date && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-gray-400" /> Heure
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map(time => (
                    <div 
                      key={time}
                      onClick={() => setFormData({...formData, time})}
                      className={`text-center py-2 text-sm rounded-lg border cursor-pointer transition ${formData.time === time ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-700 hover:border-teal-600'}`}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              type="button"
              disabled={!formData.date || !formData.time}
              onClick={() => setStep(2)}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition mt-4"
            >
              Continuer
            </button>
          </form>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <form onSubmit={handleBook} className="space-y-5">
            <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg flex items-start gap-3">
              <Calendar className="w-5 h-5 shrink-0" />
              <div>
                Vous réservez une <strong>{formData.type === 'IN_PERSON' ? 'consultation sur place' : 'téléconsultation'}</strong> le <strong>{formData.date} à {formData.time}</strong> avec le Dr. {doctor.name}.
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <FileText className="w-4 h-4 text-gray-400" /> Motif de consultation (Optionnel)
              </label>
              <textarea 
                rows="3"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Décrivez brièvement vos symptômes ou la raison de votre visite..."
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-teal-600 outline-none resize-none"
              ></textarea>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition"
              >
                Retour
              </button>
              <button 
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-xl transition"
              >
                Confirmer
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Réservation Confirmée !</h3>
            <p className="text-gray-600 mb-8">
              Votre rendez-vous avec le Dr. {doctor.name} le {formData.date} à {formData.time} a été enregistré avec succès.
            </p>
            <button 
              onClick={onClose}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-xl transition"
            >
              Terminer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
