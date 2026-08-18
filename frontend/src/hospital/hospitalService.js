const API_URL = 'http://localhost:8000/api/v1/hospital';

// Fonction utilitaire pour gérer les requêtes
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Une erreur est survenue');
  }
  
  // Si c'est une 204 No Content, pas de JSON à parser
  if (response.status === 204) return null;
  return response.json();
};

export const hospitalService = {
  // Spécialités
  getSpecialties: () => fetchWithAuth(`${API_URL}/specialties/`),
  
  // Médecins
  getDoctors: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.hospital) params.append('hospital', filters.hospital);
    if (filters.is_available_for_telemedicine) params.append('is_available_for_telemedicine', filters.is_available_for_telemedicine);
    if (filters.search) params.append('search', filters.search);
    
    const queryString = params.toString();
    const url = `${API_URL}/doctors/${queryString ? `?${queryString}` : ''}`;
    return fetchWithAuth(url);
  },
  
  getDoctor: (id) => fetchWithAuth(`${API_URL}/doctors/${id}/`),
  
  // Services médicaux (Départements)
  getServices: (hospitalId) => fetchWithAuth(`${API_URL}/services/?hospital=${hospitalId}`),
  
  // Horaires des médecins
  getDoctorSchedules: (doctorId) => fetchWithAuth(`${API_URL}/schedules/?doctor=${doctorId}`),
  
  // Rendez-vous (Appointments)
  getAppointments: (status) => {
    const url = status ? `${API_URL}/appointments/?status=${status}` : `${API_URL}/appointments/`;
    return fetchWithAuth(url);
  },
  
  createAppointment: (data) => fetchWithAuth(`${API_URL}/appointments/`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  cancelAppointment: (id) => fetchWithAuth(`${API_URL}/appointments/${id}/cancel/`, {
    method: 'POST'
  })
};
