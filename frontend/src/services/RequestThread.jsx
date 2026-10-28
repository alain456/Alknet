import React from 'react';
import { formatRequestWhen } from './requestUtils';

const KIND_LABELS = {
  CLIENT: 'Client',
  PROVIDER: 'Prestataire',
  INTERNAL: 'Note interne',
};

export default function RequestThread({ messages = [], showInternal = false }) {
  const rows = (messages || []).filter((item) => showInternal || item.kind !== 'INTERNAL');
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">Aucun message pour le moment.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <article
          key={item.id}
          className={`rounded-2xl p-3 ${item.kind === 'INTERNAL' ? 'bg-surface' : 'bg-white'}`}
        >
          <p className="text-xs font-semibold text-ink-muted">
            {KIND_LABELS[item.kind] || item.kind}
            {item.created_at ? ` · ${formatRequestWhen(item.created_at)}` : ''}
          </p>
          <p className="text-sm text-ink whitespace-pre-line mt-1">{item.body}</p>
        </article>
      ))}
    </div>
  );
}
