import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EDUCATION_ENUM_FALLBACK } from './educationEnums';

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const examplesFor = (filiere) => (filiere.sections || []).join(', ');

const yearLabel = (year) => (Number(year) === 1 ? '1ère année' : `${year}ème année`);

function normalizeClasses(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object') {
      const value = String(item.value || '').trim();
      const label = String(item.label || '').trim() || (value ? yearLabel(value) : '');
      return { value, label };
    }
    const value = String(item);
    return { value, label: yearLabel(value) };
  }).filter((row) => row.value);
}

/**
 * Sections post-fondamental + CRUD des classes par section.
 */
export default function SchoolSectionsEditor({ sections, catalog, onChange, inputClass }) {
  const source = catalog?.families?.length ? catalog : EDUCATION_ENUM_FALLBACK.post_filieres;
  const rows = Array.isArray(sections) ? sections : [];
  const [drafts, setDrafts] = useState({});
  const [edits, setEdits] = useState({});
  const [classDrafts, setClassDrafts] = useState({});

  const add = (orientation) => {
    const name = (drafts[orientation] || '').trim();
    if (!name || rows.some((row) => row.orientation === orientation && same(row.name, name))) return;
    onChange([
      ...rows,
      {
        orientation,
        name,
        classes: [],
        years: [],
      },
    ]);
    setDrafts((prev) => ({ ...prev, [orientation]: '' }));
  };

  const commitName = (index, raw) => {
    const name = (raw || '').trim();
    setEdits((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (!name) {
      onChange(rows.filter((_, i) => i !== index));
      return;
    }
    if (name === (rows[index]?.name || '')) return;
    onChange(rows.map((row, i) => (i === index ? { ...row, name } : row)));
  };

  const setClasses = (index, classes) => {
    const normalized = normalizeClasses(classes);
    onChange(rows.map((row, i) => (
      i === index
        ? { ...row, classes: normalized, years: normalized.map((item) => item.value) }
        : row
    )));
  };

  const updateClass = (sectionIndex, classIndex, patch) => {
    const current = normalizeClasses(rows[sectionIndex]?.classes || rows[sectionIndex]?.years);
    const next = current.map((row, i) => (i === classIndex ? { ...row, ...patch } : row));
    setClasses(sectionIndex, next);
  };

  const removeClass = (sectionIndex, classIndex) => {
    const current = normalizeClasses(rows[sectionIndex]?.classes || rows[sectionIndex]?.years);
    setClasses(sectionIndex, current.filter((_, i) => i !== classIndex));
  };

  const addClass = (sectionIndex) => {
    const draft = classDrafts[sectionIndex] || { value: '', label: '' };
    const value = (draft.value || '').trim();
    const label = (draft.label || '').trim() || (value ? yearLabel(value) : '');
    if (!value) return;
    const current = normalizeClasses(rows[sectionIndex]?.classes || rows[sectionIndex]?.years);
    if (current.some((row) => row.value === value)) return;
    setClasses(sectionIndex, [...current, { value, label: label || value }]);
    setClassDrafts((prev) => ({ ...prev, [sectionIndex]: { value: '', label: '' } }));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink font-bold">Enseignement post-fondamental</p>
      <p className="text-xs text-ink-muted">{source.intro}</p>
      <p className="text-xs text-ink-muted">
        Pour chaque section, gérez les classes (ajout, renommage, suppression). Elles apparaissent sur le formulaire élève.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs text-ink-muted">
        {(source.families || []).map((family) => (
          <li key={family.key}>
            <span className="font-semibold text-ink">{family.title}</span>
            {' : '}
            {family.description}
          </li>
        ))}
      </ul>
      {(source.families || []).map((family) => (
        <div key={family.key} className="space-y-3 rounded-xl border-2 border-accent/40 p-3">
          {(family.filieres || []).map((filiere) => {
            const mine = rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.orientation === filiere.value);
            const placeholder = examplesFor(filiere)
              ? `Ex. ${examplesFor(filiere)}`
              : 'Nom de la section';
            return (
              <div key={filiere.value} className="space-y-2">
                <p className="text-sm font-semibold text-ink">{filiere.label}</p>
                {mine.length === 0 && (
                  <p className="text-xs text-ink-muted">Aucune section saisie.</p>
                )}
                {mine.map(({ row, index }) => {
                  const classes = normalizeClasses(row.classes || row.years);
                  const draft = classDrafts[index] || { value: '', label: '' };
                  return (
                    <div key={`${filiere.value}-${index}`} className="space-y-2 rounded-xl bg-paper/60 dark:bg-black/20 p-3 border border-border">
                      <div className="flex gap-2">
                        <input
                          value={edits[index] !== undefined ? edits[index] : row.name}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [index]: e.target.value }))}
                          onBlur={(e) => commitName(index, e.target.value)}
                          className={inputClass}
                          aria-label={`Section ${filiere.label}`}
                        />
                        <button
                          type="button"
                          onClick={() => onChange(rows.filter((_, i) => i !== index))}
                          className="text-alert text-sm shrink-0 font-bold"
                        >
                          Retirer
                        </button>
                      </div>
                      <p className="text-xs font-bold text-ink-muted">Classes de la section</p>
                      {classes.length === 0 && (
                        <p className="text-xs text-ink-muted">Aucune classe. Ajoutez le code et le libellé que cette école utilise.</p>
                      )}
                      <div className="space-y-2">
                        {classes.map((item, classIndex) => (
                          <div key={`${item.value}-${classIndex}`} className="flex flex-col sm:flex-row gap-2">
                            <input
                              className={`${inputClass} sm:w-24`}
                              value={item.value}
                              onChange={(e) => updateClass(index, classIndex, { value: e.target.value })}
                              placeholder="Code"
                            />
                            <input
                              className={`${inputClass} flex-1`}
                              value={item.label}
                              onChange={(e) => updateClass(index, classIndex, { label: e.target.value })}
                              placeholder="Libellé"
                            />
                            <button
                              type="button"
                              onClick={() => removeClass(index, classIndex)}
                              className="px-2 rounded-xl border-2 border-alert text-alert shrink-0"
                              title="Retirer la classe"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className={`${inputClass} sm:w-24`}
                          value={draft.value}
                          onChange={(e) => setClassDrafts((prev) => ({
                            ...prev,
                            [index]: { ...draft, value: e.target.value },
                          }))}
                          placeholder="Code"
                        />
                        <input
                          className={`${inputClass} flex-1`}
                          value={draft.label}
                          onChange={(e) => setClassDrafts((prev) => ({
                            ...prev,
                            [index]: { ...draft, label: e.target.value },
                          }))}
                          placeholder="Nouvelle classe"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addClass(index);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addClass(index)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" /> Classe
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <input
                    value={drafts[filiere.value] || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [filiere.value]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        add(filiere.value);
                      }
                    }}
                    placeholder={placeholder}
                    className={inputClass}
                    aria-label={`Nouvelle section ${filiere.label}`}
                  />
                  <button
                    type="button"
                    onClick={() => add(filiere.value)}
                    className="text-sm font-semibold text-primary whitespace-nowrap"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
