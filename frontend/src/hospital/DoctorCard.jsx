import React from 'react';
import { User, Star, Video, Clock, ChevronRight, Award, Globe, CreditCard, Shield, MapPin } from 'lucide-react';

export default function DoctorCard({ doctor, onBook }) {
  const name = doctor.user_details 
    ? `${doctor.user_details.first_name} ${doctor.user_details.last_name}`
    : doctor.full_name || doctor.name || 'Médecin';

  const mainSpecialty = (doctor.specialties && doctor.specialties.length > 0)
    ? doctor.specialties[0].name
    : doctor.specialty || 'Spécialiste Général';

  const subSpecialty = doctor.sub_specialty;
  const hospitalName = doctor.hospital_name || doctor.hospitalName || 'Hôpital';
  const licenseNumber = doctor.medical_license_number;
  const experienceYears = doctor.experience_years || 5;
  const languages = doctor.languages_spoken || 'Français, Kirundi';
  const paymentMethods = doctor.accepted_payment_methods || 'Espèces, Mobile Money';
  const fee = doctor.consultation_fee || doctor.fee || 0;
  const isTelemed = doctor.is_available_for_telemedicine || doctor.isAvailableForTelemedicine;

  // Format Horaires
  const daysMap = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const formattedSchedules = doctor.schedules && doctor.schedules.length > 0
    ? doctor.schedules.map(s => `${daysMap[s.day_of_week] || ''} (${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})`).join(', ')
    : 'Lundi–Vendredi (08h00–16h00)';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition p-5 flex flex-col sm:flex-row gap-5">
      {/* Doctor Avatar / Photo */}
      <div className="w-24 h-24 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-800 overflow-hidden shadow-inner">
        {doctor.photo_url || doctor.avatar ? (
          <img src={doctor.photo_url || doctor.avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-teal-600 dark:text-teal-400 w-10 h-10" />
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 dark:text-white text-lg">{name}</h4>
                {licenseNumber && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Licence: {licenseNumber}
                  </span>
                )}
              </div>
              <p className="text-teal-600 dark:text-teal-400 font-semibold text-sm">
                {mainSpecialty} {subSpecialty ? `• ${subSpecialty}` : ''}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-gray-400" /> Établissement: <span className="font-medium text-gray-700 dark:text-gray-300">{hospitalName}</span>
              </p>
            </div>
            
            <div className="flex items-center text-xs text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 mt-2 sm:mt-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
              <span>4.9 (24 avis)</span>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 text-xs mb-3 line-clamp-2">
            {doctor.bio || `${mainSpecialty} expérimenté avec ${experienceYears} ans d'expérience praticienne.`}
          </p>

          {/* Details GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-4 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate">Horaires: <strong className="text-gray-900 dark:text-white">{formattedSchedules}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Langues: <strong className="text-gray-900 dark:text-white">{languages}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Paiement: <strong className="text-gray-900 dark:text-white">{paymentMethods}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Expérience: <strong className="text-gray-900 dark:text-white">{experienceYears} ans</strong></span>
            </div>
          </div>

          {/* Badges de mode de consultation */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800">
              Consultation Présentielle : Oui
            </span>
            {isTelemed ? (
              <span className="px-2.5 py-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 text-xs font-semibold rounded-lg border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                <Video className="w-3 h-3 text-teal-600" /> Téléconsultation : Oui
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                Téléconsultation : Non
              </span>
            )}
            <span className="px-2.5 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg shadow-xs">
              Tarif: {Number(fee).toLocaleString()} BIF
            </span>
          </div>
        </div>

        {/* Bouton Prendre RDV */}
        <button 
          onClick={() => onBook(doctor)}
          className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          Prendre Rendez-vous <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
