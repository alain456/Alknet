const ROOTS = ['isokohub.com', 'isoko-hub.com', 'localhost'];
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'static', 'media', 'mail', 'support', 'localhost']);

/** Sous-domaine d'un établissement, ou null sur la plateforme. */
export function tenantSlugFromHost(hostname) {
  const host = String(hostname || '').split(':')[0].toLowerCase();
  for (const root of ROOTS) {
    if (host === root || !host.endsWith(`.${root}`)) continue;
    const label = host.slice(0, -(root.length + 1));
    if (!label || label.includes('.') || RESERVED.has(label)) return null;
    return label;
  }
  return null;
}
