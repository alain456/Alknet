const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !ACCEPTED.includes(file.type)) {
      reject(new Error('Formats acceptés : JPG, PNG, WebP.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image trop lourde (maximum 8 Mo).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Impossible de lire l\'image.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresse une image (JPEG). square : recadrage carré autour du point focal (0–1).
 * maxSize et maxSide sont le plus grand côté en pixels.
 */
export function readImageAsDataUrl(file, {
  maxSize,
  maxSide,
  quality = 0.82,
  square = false,
  focalX = 0.5,
  focalY = 0.5,
} = {}) {
  const limit = maxSide || maxSize || 800;
  return loadImage(file).then((img) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (square) {
      const side = Math.min(img.width, img.height);
      const sx = Math.round((img.width - side) * Math.min(1, Math.max(0, focalX)));
      const sy = Math.round((img.height - side) * Math.min(1, Math.max(0, focalY)));
      const out = Math.max(1, Math.min(limit, side));
      canvas.width = out;
      canvas.height = out;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    } else {
      const scale = Math.min(1, limit / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/jpeg', quality);
  });
}

/**
 * PDF ou image pour justificatifs (NIF, RCCM, patente).
 * Images compressées ; PDF en data URL (max 4 Mo).
 */
export async function readDocumentAsDataUrl(file) {
  if (!file) throw new Error('Aucun fichier sélectionné.');
  const okTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (!okTypes.includes(file.type) && !file.name?.toLowerCase().match(/\.(pdf|jpe?g|png|webp)$/)) {
    throw new Error('Formats acceptés : PDF, JPG, PNG, WebP.');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Fichier trop lourd (maximum 4 Mo).');
  }
  if (file.type.startsWith('image/')) {
    return readImageAsDataUrl(file, { maxSize: 1200, quality: 0.85 });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}
