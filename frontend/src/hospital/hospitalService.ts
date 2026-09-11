import api, { toLocalDateTimeISO } from '../shared/api';

export interface AppointmentPayload {
  hospital?: string;
  doctor?: string;
  service?: string;
  slot?: string | null;
  appointment_date?: string;
  consultation_type?: 'IN_PERSON' | 'TELEMEDICINE' | 'TELE_EXPERTISE';
  appointment_category?: string;
  reason?: string;
  notes?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  REQUEST_SENT: 'Demande envoyée',
  PENDING: 'En attente de confirmation',
  CONFIRMED: 'Confirmé',
  PATIENT_ARRIVED: 'Patient arrivé',
  WAITING_ROOM: 'En salle d\'attente',
  PRESENT: 'Présent',
  IN_PROGRESS: 'En consultation',
  COMPLETED: 'Terminé',
  REJECTED: 'Refusé',
  CANCELLED: 'Annulé',
  RESCHEDULED: 'Reprogrammé',
  NO_SHOW: 'Patient absent',
};

export const hospitalService = {
  getMyHospital: () => api.get<Array<{ id: string; name: string }>>('businesses/me/', { auth: true }),

  getSpecialties: () => api.get('hospital/specialties/'),

  getDoctors: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`hospital/doctors/${params ? `?${params}` : ''}`, { auth: true });
  },

  getDoctor: (id: string) => api.get(`hospital/doctors/${id}/`),

  createDoctor: (data: Record<string, unknown>) =>
    api.post('hospital/doctors/', data, { auth: true }),

  updateDoctor: (id: string, data: Record<string, unknown>) =>
    api.put(`hospital/doctors/${id}/`, data, { auth: true }),

  deleteDoctor: (id: string) =>
    api.delete(`hospital/doctors/${id}/`, { auth: true }),

  getBusinessRoles: () =>
    api.get('businesses/my-business/roles/', { auth: true }),

  getServices: (hospitalId: string, auth = false) =>
    api.get(`hospital/services/?hospital=${hospitalId}`, { auth }),

  getPublicServices: (hospitalId: string) =>
    api.get(`hospital/services/?hospital=${hospitalId}`),

  getExams: (hospitalId: string, auth = false) =>
    api.get(`hospital/exams/?hospital=${hospitalId}`, { auth }),

  getPublicExams: (hospitalId: string) =>
    api.get(`hospital/exams/?hospital=${hospitalId}&public=true`),

  createExam: (data: Record<string, unknown>) =>
    api.post('hospital/exams/', data, { auth: true }),

  updateExam: (id: string, data: Record<string, unknown>) =>
    api.patch(`hospital/exams/${id}/`, data, { auth: true }),

  deleteExam: (id: string) =>
    api.delete(`hospital/exams/${id}/`, { auth: true }),

  getPublicDoctors: (hospitalId: string) =>
    api.get(`hospital/doctors/?hospital=${hospitalId}&public=true`),

  getDoctorSchedules: (doctorId: string) =>
    api.get(`hospital/schedules/?doctor=${doctorId}`, { auth: true }),

  getSchedules: (filters: Record<string, string> = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return api.get(`hospital/schedules/${qs ? `?${qs}` : ''}`, { auth: true });
  },

  createSchedule: (data: Record<string, unknown>) =>
    api.post('hospital/schedules/', data, { auth: true }),

  updateSchedule: (id: string, data: Record<string, unknown>) =>
    api.put(`hospital/schedules/${id}/`, data, { auth: true }),

  deleteSchedule: (id: string) =>
    api.delete(`hospital/schedules/${id}/`, { auth: true }),

  applyScheduleTemplate: (data: Record<string, unknown>) =>
    api.post('hospital/schedules/apply_template/', data, { auth: true }),

  generateMonthlySlots: (data: Record<string, unknown>) =>
    api.post('hospital/appointment-slots/generate_monthly/', data, { auth: true }),

  generateMonthlySlotsAll: (data: Record<string, unknown>) =>
    api.post('hospital/appointment-slots/generate_monthly_all/', data, { auth: true }),

  getAppointmentSlots: (filters: Record<string, string> = {}, auth = false) => {
    const params = new URLSearchParams({ public: 'true', ...filters }).toString();
    return api.get(`hospital/appointment-slots/?${params}`, { auth });
  },

  getAdminAppointmentSlots: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`hospital/appointment-slots/${params ? `?${params}` : ''}`, { auth: true });
  },

  getPublishedSlots: (hospitalId: string, doctorId?: string, serviceId?: string) => {
    const params: Record<string, string> = { hospital: hospitalId, public: 'true', upcoming: 'true' };
    if (doctorId) params.doctor = doctorId;
    if (serviceId) params.service = serviceId;
    return api.get(`hospital/appointment-slots/?${new URLSearchParams(params)}`);
  },

  createAppointmentSlot: (data: Record<string, unknown>) =>
    api.post('hospital/appointment-slots/', data, { auth: true }),

  updateAppointmentSlot: (id: string, data: Record<string, unknown>) =>
    api.patch(`hospital/appointment-slots/${id}/`, data, { auth: true }),

  publishSlot: (id: string) =>
    api.post(`hospital/appointment-slots/${id}/publish/`, {}, { auth: true }),

  unpublishSlot: (id: string) =>
    api.post(`hospital/appointment-slots/${id}/unpublish/`, {}, { auth: true }),

  getAppointments: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`hospital/appointments/${qs ? `?${qs}` : ''}`, { auth: true });
  },

  searchConfirmedAppointments: (hospitalId: string, patientSearch: string) =>
    api.get(
      `hospital/appointments/?hospital=${hospitalId}&status=CONFIRMED&patient_search=${encodeURIComponent(patientSearch)}`,
      { auth: true }
    ),

  getQueue: (hospitalId: string) =>
    api.get(`hospital/appointments/queue/?hospital=${hospitalId}`, { auth: true }),

  getStats: (hospitalId: string) =>
    api.get(`hospital/appointments/stats/?hospital=${hospitalId}`, { auth: true }),

  getPatientsRegistry: (hospitalId: string) =>
    api.get(`hospital/appointments/patients/?hospital=${hospitalId}`, { auth: true }),

  getReports: (hospitalId: string, period = 'MONTH') =>
    api.get(`hospital/profiles/reports/?period=${period}`, { auth: true }),

  getHospitalAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`hospital/profiles/audit-logs/${qs ? `?${qs}` : ''}`, { auth: true });
  },

  getInvoices: (hospitalId: string) =>
    api.get(`hospital/invoices/?hospital=${hospitalId}`, { auth: true }),

  getLabResults: (hospitalId: string) =>
    api.get(`hospital/lab-results/?hospital=${hospitalId}`, { auth: true }),

  getLabEligibleAppointments: (hospitalId: string) =>
    api.get(`hospital/lab-results/eligible-appointments/?hospital=${hospitalId}`, { auth: true }),

  createLabResult: (data: Record<string, unknown>) =>
    api.post('hospital/lab-results/', data, { auth: true }),

  updateLabResultStatus: (id: string, data: Record<string, unknown>) =>
    api.post(`hospital/lab-results/${id}/update_status/`, data, { auth: true }),

  getMedicalRecords: (hospitalId: string) =>
    api.get(`hospital/medical-records/?hospital=${hospitalId}`, { auth: true }),

  getAppointmentHistory: (id: string) =>
    api.get(`hospital/appointments/${id}/history/`, { auth: true }),

  createAppointment: (data: AppointmentPayload, auth = false) =>
    api.post('hospital/appointments/', data, { auth }),

  payAppointment: (id: string, payerPhone: string, auth = false) =>
    api.post(`hospital/appointments/${id}/pay/`, { payer_phone: payerPhone }, { auth }),

  confirmAppointmentPayment: (id: string, auth = false) =>
    api.post(`hospital/appointments/${id}/confirm-payment/`, {}, { auth }),

  markAppointmentPaid: (id: string, data: Record<string, unknown> = {}) =>
    api.post(`hospital/appointments/${id}/mark-paid/`, data, { auth: true }),

  refundAppointmentPayment: (id: string, data: Record<string, unknown> = {}) =>
    api.post(`hospital/appointments/${id}/refund-payment/`, data, { auth: true }),

  cancelAppointment: (id: string, reason?: string) =>
    api.post(`hospital/appointments/${id}/cancel/`, reason ? { reason } : {}, { auth: true }),

  requestAppointmentAnticipation: (
    id: string,
    data: { reason: string; preferred_date?: string },
  ) => api.post(`hospital/appointments/${id}/request-anticipation/`, data, { auth: true }),

  respondAppointmentAnticipation: (
    id: string,
    data: { action: 'accept' | 'refuse'; note?: string; new_date?: string; new_slot?: string },
  ) => api.post(`hospital/appointments/${id}/respond-anticipation/`, data, { auth: true }),

  confirmAppointment: (id: string, message?: string) =>
    api.post(`hospital/appointments/${id}/confirm/`, message ? { message } : {}, { auth: true }),

  rejectAppointment: (id: string, reason: string, options: { refund?: boolean } = {}) =>
    api.post(
      `hospital/appointments/${id}/reject/`,
      { reason, ...(options.refund ? { refund: true } : {}) },
      { auth: true }
    ),

  checkInAppointment: (id: string, data: Record<string, unknown> = {}) =>
    api.post(`hospital/appointments/${id}/check_in/`, data, { auth: true }),

  waitingRoomAppointment: (id: string) =>
    api.post(`hospital/appointments/${id}/waiting_room/`, {}, { auth: true }),

  startAppointment: (id: string) =>
    api.post(`hospital/appointments/${id}/start/`, {}, { auth: true }),

  completeAppointment: (id: string, notes?: string) =>
    api.post(`hospital/appointments/${id}/complete/`, notes ? { notes } : {}, { auth: true }),

  markNoShow: (id: string, reason?: string) =>
    api.post(`hospital/appointments/${id}/mark_no_show/`, reason ? { reason } : {}, { auth: true }),

  getNotifications: () => api.get('hospital/notifications/', { auth: true }),

  markNotificationRead: (id: string) =>
    api.post(`hospital/notifications/${id}/mark_as_read/`, {}, { auth: true }),

  markAllNotificationsRead: () =>
    api.post('hospital/notifications/mark_all_as_read/', {}, { auth: true }),

  getReferenceSettings: () =>
    api.get('hospital/profiles/reference-settings/', { auth: true }),

  updateReferenceSettings: (data: { acronym?: string; appointment_reference_prefix?: string }) =>
    api.patch('hospital/profiles/reference-settings/', data, { auth: true }),

  getEmailSettings: () =>
    api.get('hospital/profiles/email-settings/', { auth: true }),

  updateEmailSettings: (data: { appointment_request_ack_message?: string }) =>
    api.patch('hospital/profiles/email-settings/', data, { auth: true }),

  seedReceptionistRole: () =>
    api.post('businesses/my-business/roles/seed-receptionist/', {}, { auth: true }),

  buildAppointmentDate: toLocalDateTimeISO,
};

export default hospitalService;
