export function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Photo ronde, ou les initiales si elle manque. */
export default function PersonAvatar({ src, name, className = 'w-8 h-8 text-xs' }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${className} rounded-full object-cover shrink-0 bg-surface`}
      />
    );
  }
  return (
    <span
      className={`${className} rounded-full bg-primary text-surface inline-flex items-center justify-center font-bold shrink-0`}
      aria-hidden="true"
    >
      {initialsFromName(name)}
    </span>
  );
}
