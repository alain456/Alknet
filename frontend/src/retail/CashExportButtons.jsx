/**
 * Boutons d'export de la caisse — partagés par la pharmacie de détail et
 * celle de gros, pour que les deux offering exactement les mêmes exports.
 *
 * Excel : fichier .xlsx construit par le serveur (vrais totaux, 3 feuilles).
 * PDF : le navigateur transforme la feuille en PDF. Aucun moteur PDF n'est
 * installé côté serveur, et `window.print()` rend un PDF texte sélectionnable
 * — bien meilleur qu'une image, et sans dépendance à installer ni à maintenir.
 * L'export PDF se fait sur les lignes déjà chargées à l'écran : même source,
 * donc un PDF ne peut pas dire autre chose que la table affichée.
 */
import React, { useState } from 'react';
import retailService from './retailService';

const money = (value) =>
  `${Number(value || 0).toLocaleString('fr-BI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BIF`;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function downloadPrintablePdf({ title, subtitle, columns, rows, totals }) {
  const w = window.open('', '_blank', 'width=980,height=760');
  if (!w) return false;
  const head = columns.map((c) => `<th class="${c.numeric ? 'num' : ''}">${esc(c.label)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((cell, i) => `<td class="${columns[i]?.numeric ? 'num' : ''}">${esc(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const totalRow = totals
    ? `<tfoot><tr><td colspan="${columns.length - 1}" class="tot-label">${esc(totals.label)}</td><td class="num tot">${esc(totals.value)}</td></tr></tfoot>`
    : '';
  const stamp = new Date().toLocaleString('fr-BI', { dateStyle: 'full', timeStyle: 'short' });

  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; font-size: 11px; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  .sub { color: #64748b; margin: 0 0 2px; }
  .stamp { color: #94a3b8; font-size: 10px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f766e; color: #fff; text-align: left; padding: 6px 7px; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { border: 0; border-top: 2px solid #0f766e; font-weight: 700; padding-top: 7px; }
  .tot-label { text-align: right; }
  .empty { padding: 20px 0; color: #94a3b8; }
  .tip { position: fixed; bottom: 10px; right: 14px; font-size: 10px; color: #94a3b8; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">${esc(subtitle)}</p>
<p class="stamp">Édité le ${esc(stamp)}</p>
${rows.length ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totalRow}</table>` : '<p class="empty">Aucun élément à afficher.</p>'}
<p class="tip">Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF ».</p>
</body></html>`);
  w.document.close();
  w.focus();
  // La fenêtre doit être chargée avant print(), sinon le PDF sort vide.
  w.onload = () => {
    w.print();
  };
  return true;
}

export default function CashExportButtons({ report, title, subtitle, columns, rows, totals }) {
  const [busy, setBusy] = useState('');

  const exportExcel = async () => {
    setBusy('excel');
    try {
      await retailService.exportCash({ filetype: 'excel', report });
    } finally {
      setBusy('');
    }
  };

  const exportPdf = () => {
    setBusy('pdf');
    try {
      downloadPrintablePdf({ title, subtitle, columns, rows, totals });
    } finally {
      setBusy('');
    }
  };

  const base =
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportExcel}
        disabled={Boolean(busy)}
        title="Télécharger le classeur Excel (.xlsx)"
        className={`${base} border-border bg-white text-ink hover:bg-paper`}
      >
        {busy === 'excel' ? 'Export…' : 'Excel'}
      </button>
      <button
        type="button"
        onClick={exportPdf}
        disabled={Boolean(busy)}
        title="Ouvrir la version imprimable, à enregistrer en PDF"
        className={`${base} border-border bg-white text-ink hover:bg-paper`}
      >
        {busy === 'pdf' ? 'Génération…' : 'PDF'}
      </button>
    </div>
  );
}
