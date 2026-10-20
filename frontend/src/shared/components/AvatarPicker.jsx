import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { readImageAsDataUrl } from '../imageUpload';

/**
 * Photo de personne : carré, le glisser choisit le centre du visage.
 */
export default function AvatarPicker({ value, onChange, onError, size = 96 }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  const focalRef = useRef(focal);
  const drag = useRef(null);
  focalRef.current = focal;

  const emit = async (nextFile, nextFocal) => {
    try {
      const dataUrl = await readImageAsDataUrl(nextFile, {
        square: true,
        maxSize: 512,
        quality: 0.82,
        focalX: nextFocal.x,
        focalY: nextFocal.y,
      });
      onChange(dataUrl);
      onError?.('');
    } catch (err) {
      onError?.(err.message || 'Image impossible');
    }
  };

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const next = { x: 0.5, y: 0.5 };
    setFile(picked);
    setFocal(next);
    emit(picked, next);
  };

  const onPointerDown = (e) => {
    if (!file) return;
    drag.current = { x: e.clientX, y: e.clientY, focal };
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / size;
    const dy = (e.clientY - drag.current.y) / size;
    setFocal({
      x: Math.min(1, Math.max(0, drag.current.focal.x - dx)),
      y: Math.min(1, Math.max(0, drag.current.focal.y - dy)),
    });
  };

  const onPointerUp = () => {
    if (!drag.current || !file) {
      drag.current = null;
      return;
    }
    const next = focalRef.current;
    drag.current = null;
    emit(file, next);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="relative rounded-full overflow-hidden border-2 border-accent bg-primary/10 shrink-0"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        title={file ? 'Glissez pour cadrer le visage' : 'Choisir une photo'}
        onClick={() => { if (!file) fileRef.current?.click(); }}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-6 h-6 text-primary absolute inset-0 m-auto" />
        )}
      </button>
      <div>
        <button
          type="button"
          className="text-sm font-bold text-primary"
          onClick={() => fileRef.current?.click()}
        >
          Choisir une photo
        </button>
        <p className="text-xs text-ink-muted mt-1">JPG, PNG ou WebP. Glissez l’aperçu pour centrer le visage.</p>
        {value && (
          <button
            type="button"
            className="text-xs font-bold text-alert mt-1"
            onClick={() => { setFile(null); onChange(''); }}
          >
            Retirer
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
    </div>
  );
}
