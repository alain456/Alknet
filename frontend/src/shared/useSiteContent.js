import { useCallback, useEffect, useState } from 'react';
import api, { invalidateApiCache } from './api';

let cachedPayload = null;
let inflight = null;

export function clearSiteContentCache() {
  cachedPayload = null;
  invalidateApiCache('cms/public');
}

export async function fetchSiteContent(force = false) {
  if (!force && cachedPayload) return cachedPayload;
  if (!force && inflight) return inflight;
  inflight = api.get('cms/public/', force ? { noCache: true } : undefined)
    .then((data) => {
      cachedPayload = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSiteContent() {
  const [data, setData] = useState(cachedPayload);
  const [loading, setLoading] = useState(!cachedPayload);
  const [error, setError] = useState('');

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchSiteContent(force);
      setData(payload);
      return payload;
    } catch (err) {
      setError(err.message || 'Impossible de charger le contenu du site.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(false);
  }, [reload]);

  return {
    settings: data?.settings || null,
    footerLinks: data?.footer_links || [],
    partners: data?.partners || [],
    loading,
    error,
    reload,
  };
}

export default useSiteContent;
