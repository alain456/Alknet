/** Demande un motif non vide (prompt). Retourne null si l’utilisateur annule. */
export function promptRequiredMotif(label = 'Motif du refus (visible par le client) :', minLen = 3) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const raw = window.prompt(label, '');
    if (raw === null) return null;
    const note = String(raw).trim();
    if (note.length >= minLen) return note;
    window.alert(`Motif obligatoire (au moins ${minLen} caractères).`);
  }
}
