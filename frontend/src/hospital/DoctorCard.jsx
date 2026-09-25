import React from 'react';
import {
  User, Video, ChevronRight, Award, Globe, MapPin, HeartPulse, GraduationCap,
} from 'lucide-react';

function InfoRow({ icon: Icon, label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-1.5 text-xs text-ink">
      <Icon className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
      <span className="text-ink">
        {label}: <strong className="text-ink font-bold">{value}</strong>
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
  const officeAddress = doctor.office_address?.trim();
  const isPhysical = doctor.is_physical_consultation !== false;
  const isTelemed = !!doctor.is_available_for_telemedicine;
  const assignedServices = (doctor.services || [])
    .map((s) => (typeof s === 'string' ? { id: s, name: s } : s))
    .filter((s) => s?.name);

  const photo = doctor.public_photo_url || doctor.photo_url || doctor.user_details?.avatar;

  return (
    <div className="bg-surface text-ink border-2 border-accent rounded-2xl shadow-sm hover:shadow-md transition p-5 flex flex-col sm:flex-row gap-5">
      <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border-2 border-accent/40 overflow-hidden">
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-primary w-10 h-10" />
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div className="mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-ink text-lg">
                {titleLabel ? `${titleLabel} ` : ''}{name}
              </h4>
              {licenseNumber && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary text-surface">
                  Licence: {licenseNumber}
                </span>
              )}
            </div>
            {categoryLabel && (
              <p className="text-primary font-semibold text-sm mt-0.5">
                {categoryLabel}
              </p>
            )}
            {specialtyLine && (
              <p className="text-sm text-ink mt-0.5 font-medium">{specialtyLine}</p>
            )}
            <p className="text-xs text-ink-muted flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-accent" />
              Établissement: <span className="font-semibold text-ink">{hospitalName}</span>
            </p>
            {officeAddress && (
              <p className="text-xs text-ink flex items-center gap-1 mt-1 font-medium">
                <MapPin className="w-3 h-3 text-accent" />
                Bureau: <span className="font-semibold">{officeAddress}</span>
              </p>
            )}
          </div>

          {bio ? (
            <div className="mb-3">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Biographie</p>
              <p className="text-ink text-sm leading-relaxed whitespace-pre-line">{bio}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 bg-primary/5 p-3 rounded-xl border-2 border-alert/40">
            <InfoRow icon={Globe} label="Langues" value={languages} />
            <InfoRow
              icon={Award}
              label="Expérience"
              value={experienceYears != null ? `${experienceYears} an${experienceYears > 1 ? 's' : ''}` : null}
            />
            <InfoRow icon={GraduationCap} label="Qualifications" value={qualifications} />
          </div>

          <div className="mb-4">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <HeartPulse className="w-3 h-3 text-accent" /> Services
            </p>
            {assignedServices.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {assignedServices.map((svc) => (
                  <span
                    key={svc.id || svc.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-ink border border-accent/50"
                  >
                    {svc.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic">Aucun service associé pour le moment.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {isPhysical && (
              <span className="px-2.5 py-1 bg-primary/10 text-ink text-xs font-semibold rounded-lg border border-accent/40">
                Consultation présentielle
              </span>
            )}
            {isTelemed && (
              <span className="px-2.5 py-1 bg-primary/10 text-ink-muted text-xs font-semibold rounded-lg border border-border flex items-center gap-1">
                <Video className="w-3 h-3" /> Téléconsultation — bientôt
              </span>
            )}
          </div>
        </div>

        {hasPublishedSlots && (
          <button
            type="button"
            onClick={() => onBook(doctor)}
            className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary text-surface font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer border-2 border-accent"
          >
            Prendre Rendez-vous <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
