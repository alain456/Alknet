/** Compresse une image pour éviter les payloads multi-Mo (502). */
export function readImageAsDataUrl(file, { maxSize = 800, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Veuillez sélectionner une image (JPG, PNG, WebP…).'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image trop lourde (maximum 5 Mo).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Impossible de lire l\'image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
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
