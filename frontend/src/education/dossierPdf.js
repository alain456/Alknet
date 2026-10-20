import { getToken } from '../shared/api';

function messageFrom(data) {
  if (!data || typeof data !== 'object') return 'Le PDF est indisponible.';
  const first = data.detail || data.document || data.campaign || Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (first && typeof first === 'object') return messageFrom(first);
  return String(first || 'Le PDF est indisponible.');
}

/** Télécharge un PDF (GET ou POST multipart). Le jeton part avec la requête. */
export async function downloadApplicationPdf(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token && token.split('.').length === 3) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/v1/${path.replace(/^\//, '')}`, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(messageFrom(data));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dossier-candidature.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
