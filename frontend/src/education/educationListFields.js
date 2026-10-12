/**
 * Saisie de listes JSON (`{label, description}`) sous forme de lignes.
 *
 * Le modèle stocke des listes d'objets, mais un `<textarea>` ne sait produire
 * que du texte. La conversion est donc symétrique : `parse` au chargement du
 * formulaire, `serialize` à l'enregistrement. Une ligne « Bibliothèque —
 * 20 000 ouvrages » donne `{label: 'Bibliothèque', description: '20 000 ouvrages'}`.
 */

export const EMPTY_ITEM = { label: '', description: '' };

/** Liste JSON → tableau de lignes éditables. Toujours un tableau. */
export function parseListField(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return {
          label: String(item.label ?? ''),
          description: String(item.description ?? ''),
        };
      }
      // Entrée ancienne en texte simple : on la garde comme libellé.
      return { label: String(item ?? ''), description: '' };
    });
  }
  return [];
}

/** Lignes éditables → liste JSON, sans ligne vide. */
export function serializeListField(rows) {
  return (rows || [])
    .map((row) => ({
      label: String(row?.label ?? '').trim(),
      description: String(row?.description ?? '').trim(),
    }))
    .filter((row) => row.label || row.description);
}

/** Ajoute une ligne vide si la liste n'en a pas, pour toujours avoir un champ. */
export const withTrailingBlank = (rows) =>
  (rows.length === 0 || rows[rows.length - 1].label || rows[rows.length - 1].description)
    ? [...rows, { ...EMPTY_ITEM }]
    : rows;
