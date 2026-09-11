import { useEffect, useRef } from 'react';

/**
 * Rafraîchissement périodique léger :
 * - setTimeout chaîné (évite les requêtes empilées)
 * - pause quand l'onglet est masqué
 * - reprise immédiate au retour sur l'onglet
 */
export function useSmartPolling(
  callback: () => void | Promise<void>,
  intervalMs = 30000,
  enabled = true,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let running = false;

    const schedule = (delay = intervalMs) => {
      if (cancelled) return;
      timeoutId = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled || document.hidden) {
        schedule();
        return;
      }
      if (running) {
        schedule();
        return;
      }
      running = true;
      try {
        await callbackRef.current();
      } catch {
        /* polling silencieux */
      } finally {
        running = false;
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.hidden) return;
      if (timeoutId) clearTimeout(timeoutId);
      tick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}

/** Compare légère pour éviter un re-render React inutile */
export function appointmentsFingerprint(
  list: Array<{ id?: string; status?: string; updated_at?: string }>,
): string {
  return list.map((a) => `${a.id}:${a.status}:${a.updated_at || ''}`).join('|');
}
