import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BusinessCSVImporter({ isOpen, onClose, onSuccess }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  if (!isOpen) return null;

  const sampleCSV = `Nom,Email,Téléphone,Province,Commune,Quartier,Adresse,Secteur_Parent,Sous_Categories
Pharmacie de la Paix,contact@paix.bi,+25779001122,Bujumbura Mairie,Mukaza,Rohero I,Blvd Uprona N° 45,Santé,Pharmacie
Hôtel Club du Lac,info@clubdulac.bi,+25779334455,Bujumbura Mairie,Ntahangwa,Ngagara,Chaussée d'Uvira,Hôtellerie & Restauration,Hôtel,Restaurant
Quincaillerie Moderne,qmoderne@gmail.com,+25771889900,Gitega,Gitega,Centre-Ville,Marché Central,Commerce,Quincaillerie`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_importation_entreprises.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, index) => {
        row[h] = values[index] || '';
      });
      items.push(row);
    }
    return items;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSubmitImport = async () => {
    setError(null);
    setResult(null);
    setImporting(true);

    try {
      const items = parseCSV(csvText);
      if (items.length === 0) {
        throw new Error("Aucune ligne d'entreprise valide détectée dans le CSV.");
      }

      const response = await fetch('http://localhost:8000/api/v1/businesses/admin/import-csv/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ items })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'importation');
      }

      setResult(data);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-xl relative">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2 text-green-900 dark:text-white font-bold text-lg">
            <FileSpreadsheet className="w-5 h-5 text-green-700 dark:text-gold-400" />
            Importation Massive CSV / Excel (.xlsx)
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 text-xs font-semibold rounded-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-4 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 text-xs rounded-md space-y-2">
            <div className="font-bold flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-700" /> {result.message}
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="text-red-600 dark:text-red-300 font-normal">
                <span className="font-semibold">Avertissements ({result.errors.length}) :</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-ink-muted dark:text-green-100/70">
            <span>Téléchargez un modèle de fichier CSV structuré avec rapprochement auto des UUIDs :</span>
            <button 
              onClick={handleDownloadSample}
              className="flex items-center gap-1 font-semibold text-green-700 dark:text-gold-400 hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Modèle CSV d'Exemple
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted dark:text-green-100/70 mb-1">
              Charger un fichier CSV ou coller le contenu CSV ci-dessous :
            </label>
            <input 
              type="file" 
              accept=".csv, .txt"
              onChange={handleFileUpload}
              className="w-full text-xs text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-800 dark:file:bg-green-900/50 dark:file:text-green-100 hover:file:bg-green-200 cursor-pointer mb-2"
            />
            <textarea 
              rows="6"
              placeholder="Nom,Email,Téléphone,Adresse,Secteur_Parent,Sous_Categories..."
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full font-mono text-xs px-3 py-2 bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 resize-none"
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold border border-border dark:border-white/10 rounded-md text-ink-muted hover:bg-paper"
            >
              Fermer
            </button>
            <button 
              onClick={handleSubmitImport}
              disabled={importing || !csvText.trim()}
              className="px-4 py-2 text-xs font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {importing ? 'Importation en cours...' : 'Lancer l\'Importation Massive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
