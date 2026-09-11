import React, { useEffect, useState } from 'react';

/**
 * Ordonnances are often stored as data: URLs (base64). Browsers block
 * navigating to data: via target=_blank — open via blob URL or inline modal.
 */
export function openPrescriptionFile(fileUrl) {
  if (!fileUrl) return false;
  if (!fileUrl.startsWith('data:')) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  try {
    const comma = fileUrl.indexOf(',');
    if (comma < 0) return false;
    const header = fileUrl.slice(0, comma);
    const data = fileUrl.slice(comma + 1);
    const mime = header.match(/data:([^;,]+)/)?.[1] || 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);
    let bytes;
    if (isBase64) {
      const binary = atob(data);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } else {
      const decoded = decodeURIComponent(data);
      bytes = new TextEncoder().encode(decoded);
    }
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(blobUrl);
      return false;
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    return true;
  } catch {
    return false;
  }
}

export function isImagePrescription(fileUrl) {
  return Boolean(fileUrl && (/^data:image\//i.test(fileUrl) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(fileUrl)));
}

export function isPdfPrescription(fileUrl) {
  return Boolean(fileUrl && (/^data:application\/pdf/i.test(fileUrl) || /\.pdf(\?|$)/i.test(fileUrl)));
}

/** Bouton / lien qui ouvre l’ordonnance (data: ou URL http). */
export function PrescriptionOpenButton({ fileUrl, label = 'Ouvrir l’ordonnance', className = '', children }) {
  const [viewer, setViewer] = useState(null);

  const handleClick = (event) => {
    event.preventDefault();
    if (!fileUrl) return;
    // Prefers modal for images (reliable); blob tab for PDF / others.
    if (isImagePrescription(fileUrl)) {
      setViewer(fileUrl);
      return;
    }
    const opened = openPrescriptionFile(fileUrl);
    if (!opened) setViewer(fileUrl);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className || 'text-sm text-primary hover:underline font-semibold text-left'}>
        {children || label}
      </button>
      {viewer && <PrescriptionModal fileUrl={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

export function PrescriptionModal({ fileUrl, onClose }) {
  const [blobSrc, setBlobSrc] = useState('');

  useEffect(() => {
    if (!fileUrl) return undefined;
    if (!fileUrl.startsWith('data:')) {
      setBlobSrc(fileUrl);
      return undefined;
    }
    let revoked = null;
    try {
      const comma = fileUrl.indexOf(',');
      const header = fileUrl.slice(0, comma);
      const data = fileUrl.slice(comma + 1);
      const mime = header.match(/data:([^;,]+)/)?.[1] || 'application/octet-stream';
      const isBase64 = /;base64/i.test(header);
      const binary = isBase64 ? atob(data) : decodeURIComponent(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      revoked = URL.createObjectURL(new Blob([bytes], { type: mime }));
      setBlobSrc(revoked);
    } catch {
      setBlobSrc(fileUrl);
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileUrl]);

  const image = isImagePrescription(fileUrl);
  const pdf = isPdfPrescription(fileUrl);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ordonnance"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="font-bold text-ink">Ordonnance</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openPrescriptionFile(fileUrl)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg font-semibold"
            >
              Nouvel onglet
            </button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm bg-paper rounded-lg font-semibold">
              Fermer
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-paper p-4 min-h-[240px]">
          {image && blobSrc && (
            <img src={blobSrc} alt="Ordonnance" className="max-w-full max-h-[75vh] mx-auto object-contain" />
          )}
          {pdf && blobSrc && (
            <iframe title="Ordonnance PDF" src={blobSrc} className="w-full h-[75vh] rounded-lg border border-border bg-white" />
          )}
          {!image && !pdf && blobSrc && (
            <p className="text-sm text-ink-muted text-center py-10">
              Aperçu indisponible.{' '}
              <button type="button" onClick={() => openPrescriptionFile(fileUrl)} className="text-primary underline">
                Télécharger / ouvrir
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
