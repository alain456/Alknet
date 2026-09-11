import React from 'react';
import {
  User, Video, ChevronRight, Award, Globe, MapPin, HeartPulse, GraduationCap,
} from 'lucide-react';

function InfoRow({ icon: Icon, label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      <Icon className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
      <span>
        {label}: <strong className="text-gray-900 dark:text-white">{value}</strong>
      </span>
    </div>
  );
}

export default function DoctorCard({ doctor, onBook, hasPublishedSlots = false }) {
  const firstName = doctor.user_details?.first_name || '';
  const lastName = doctor.user_details?.last_name || '';
  const name = doctor.full_name || `${firstName} ${lastName}`.trim() || 'Médecin';

  const titleLabel = doctor.professional_title_display || '';
  const categoryLabel = doctor.staff_category_display || '';

  const specialtyNames = (doctor.specialties || [])
    .map((s) => s.name)
    .filter(Boolean);
  const specialtyLine = specialtyNames.length > 0
    ? specialtyNames.join(', ')
    : (doctor.sub_specialty || null);

  const hospitalName = doctor.hospital_name || 'Hôpital';
  const licenseNumber = doctor.medical_license_number;
  const languages = doctor.languages_spoken?.trim();
  const experienceYears = doctor.experience_years;
  const qualifications = doctor.qualifications?.trim();
  const bio = doctor.bio?.trim();
  const fee = Number(doctor.consultation_fee || 0);
  const formattedFee = doctor.formatted_fee;
  const isPhysical = doctor.is_physical_consultation !== false;
  const isTelemed = !!doctor.is_available_for_telemedicine;
  const assignedServices = (doctor.services || [])
    .map((s) => (typeof s === 'string' ? { id: s, name: s } : s))
    .filter((s) => s?.name);

  const photo = doctor.public_photo_url || doctor.photo_url || doctor.user_details?.avatar;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition p-5 flex flex-col sm:flex-row gap-5">
      <div className="w-24 h-24 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-800 overflow-hidden shadow-inner">
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-teal-600 dark:text-teal-400 w-10 h-10" />
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                {titleLabel ? `${titleLabel} ` : ''}{name}
              </h4>
              {licenseNumber && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  Licence: {licenseNumber}
                </span>
              )}
            </div>
            {categoryLabel && (
              <p className="text-teal-600 dark:text-teal-400 font-semibold text-sm mt-0.5">
                {categoryLabel}
              </p>
            )}
            {specialtyLine && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{specialtyLine}</p>
            )}
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              Établissement: <span className="font-medium text-gray-700 dark:text-gray-300">{hospitalName}</span>
            </p>
          </div>

          {bio ? (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Biographie</p>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">{bio}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
            <InfoRow icon={Globe} label="Langues" value={languages} />
            <InfoRow
              icon={Award}
              label="Expérience"
              value={experienceYears != null ? `${experienceYears} an${experienceYears > 1 ? 's' : ''}` : null}
            />
            <InfoRow icon={GraduationCap} label="Qualifications" value={qualifications} />
          </div>

          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <HeartPulse className="w-3 h-3 text-teal-500" /> Services
            </p>
            {assignedServices.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {assignedServices.map((svc) => (
                  <span
                    key={svc.id || svc.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-100 dark:border-teal-800"
                  >
                    {svc.name}
                    {svc.formatted_cost && svc.formatted_cost !== 'Gratuit / Non renseigné' && (
                      <span className="text-teal-600/80 dark:text-teal-400/80 font-normal">
                        · {svc.formatted_cost}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Aucun service associé pour le moment.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {isPhysical && (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800">
                Consultation présentielle
              </span>
            )}
            {isTelemed && (
              <span className="px-2.5 py-1 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-xs font-semibold rounded-lg border border-gray-200 flex items-center gap-1">
                <Video className="w-3 h-3" /> Téléconsultation — bientôt
              </span>
            )}
            {fee > 0 && (
              <span className="px-2.5 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg shadow-xs">
                Tarif: {formattedFee || `${fee.toLocaleString()} BIF`}
              </span>
            )}
          </div>
        </div>

        {hasPublishedSlots && (
          <button
            type="button"
            onClick={() => onBook(doctor)}
            className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            Prendre Rendez-vous <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
