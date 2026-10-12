import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const yearLabel = (year) => (Number(year) === 1 ? '1ère année' : `${year}ème année`);

export const DEFAULT_ECOFO_CLASSES = Array.from({ length: 9 }, (_, i) => {
  const value = String(i + 1);
  return { value, label: yearLabel(value) };
});

/**
 * CRUD des classes ECOFO (libellé libre) — visible ensuite sur le formulaire élève.
 */
export default function SchoolEcofoClassesEditor({ classes, onChange, inputClass }) {
  const rows = Array.isArray(classes) ? classes : [];
  const [draftValue, setDraftValue] = useState('');
  const [draftLabel, setDraftLabel] = useState('');

  const updateRow = (index, patch) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    const value = (draftValue || '').trim();
    const label = (draftLabel || '').trim() || (value ? yearLabel(value) : '');
    if (!value) return;
    if (rows.some((row) => String(row.value) === value)) return;
    onChange([...rows, { value, label: label || value }]);
    setDraftValue('');
    setDraftLabel('');
  };

  const seedDefaults = () => {
    onChange(DEFAULT_ECOFO_CLASSES.map((row) => ({ ...row })));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">Classes ECOFO</p>
        {rows.length === 0 && (
          <button type="button" onClick={seedDefaults} className="text-xs font-bold text-primary">
            Préremplir 1ère → 9ème
          </button>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        Ajoutez, renommez ou retirez les classes. L&apos;élève les choisira à l&apos;inscription.
      </p>
      {rows.length === 0 && (
        <p className="text-xs text-alert font-medium">Aucune classe — ajoutez-en au moins une.</p>
      )}
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${row.value}-${index}`} className="flex flex-col sm:flex-row gap-2">
            <input
              className={`${inputClass} sm:w-28`}
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              placeholder="Code (ex. 1)"
              aria-label="Code classe ECOFO"
            />
            <input
              className={`${inputClass} flex-1`}
              value={row.label}
              onChange={(e) => updateRow(index, { label: e.target.value })}
              placeholder="Libellé (ex. 1ère année)"
              aria-label="Libellé classe ECOFO"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="px-2 rounded-xl border-2 border-alert text-alert shrink-0"
              title="Retirer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <input
          className={`${inputClass} sm:w-28`}
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          placeholder="Code"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRow();
            }
          }}
        />
        <input
          className={`${inputClass} flex-1`}
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="Libellé de la nouvelle classe"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRow();
            }
          }}
        />
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border-2 border-accent text-sm font-bold text-primary"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>
    </div>
  );
}
