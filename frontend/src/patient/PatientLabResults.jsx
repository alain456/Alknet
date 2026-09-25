import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, FileText, Download, Calendar, Building2, CheckCircle } from 'lucide-react';
import hospitalService from '../hospital/hospitalService';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function PatientLabResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hospitalService.getLabResults();
      setResults(normalizeList(data));
    } catch (err) {
      setError(err.message || 'Impossible de charger vos résultats.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  if (loading) {
    return <div className="p-8 text-slate-600 dark:text-slate-300">Chargement…</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FlaskConical className="text-teal-600" />
          Mes résultats de laboratoire
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Résultats communiqués par votre établissement (après validation médicale et notification)
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>
      )}

      {results.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-slate-500">
          Aucun résultat disponible pour le moment.
        </div>
      ) : (
        <div className="grid gap-3">
          {results.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-teal-400 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{row.test_name}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {row.hospital_name || 'Établissement'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(row.test_date)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  {row.status_display || row.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                {row.result_value}
                {row.unit ? ` ${row.unit}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <FileText className="text-teal-600 w-5 h-5" />
                {selected.test_name}
              </h2>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-800 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Établissement</p>
                <p className="font-medium">{selected.hospital_name}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Date</p>
                <p className="font-medium">{formatDate(selected.test_date)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Résultat</p>
                <p className="font-bold text-lg">{selected.result_value}{selected.unit ? ` ${selected.unit}` : ''}</p>
              </div>
              {Array.isArray(selected.parameters) && selected.parameters.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">Paramètres</p>
                  <ul className="space-y-1">
                    {selected.parameters.map((p, idx) => (
                      <li key={idx} className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <span className="font-medium">{p.name}</span>
                        {': '}
                        {p.value}
                        {p.unit ? ` ${p.unit}` : ''}
                        {p.reference ? ` (réf. ${p.reference})` : ''}
                        {p.flag ? ` — ${p.flag}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.reference_values && (
                <div>
                  <p className="text-slate-500 text-xs">Valeurs de référence</p>
                  <p className="whitespace-pre-wrap">{selected.reference_values}</p>
                </div>
              )}
              {selected.result_notes && (
                <div>
                  <p className="text-slate-500 text-xs">Commentaires</p>
                  <p className="whitespace-pre-wrap">{selected.result_notes}</p>
                </div>
              )}
              {(selected.document_display_url || selected.document_url) && (
                <a
                  href={selected.document_display_url || selected.document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le compte-rendu
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
