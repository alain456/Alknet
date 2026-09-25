import React, { useState, useEffect } from 'react';
import { Hash, Save, RefreshCw } from 'lucide-react';
import hospitalService from '../hospitalService';

export default function HospitalReferenceSettings() {
  const [settings, setSettings] = useState(null);
  const [acronym, setAcronym] = useState('');
  const [prefix, setPrefix] = useState('RDV');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setError('');
    setSuccess('');
    try {
      const data = await hospitalService.getReferenceSettings();
      setSettings(data);
      setAcronym(data.acronym || '');
      setPrefix(data.appointment_reference_prefix || 'RDV');
    } catch (err) {
      setError(err.message || 'Impossible de charger les paramètres');
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await hospitalService.updateReferenceSettings({
        acronym: acronym.trim(),
        appointment_reference_prefix: prefix.trim() || 'RDV',
      });
      setSettings(data);
      setSuccess('Paramètres enregistrés — les prochains RDV utiliseront ce format.');
    } catch (err) {
      setError(err.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500">
        Chargement des paramètres de référence...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <Hash className="w-5 h-5 text-indigo-600" />
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Numéros de suivi des rendez-vous</h3>
          <p className="text-xs text-gray-500">Format dynamique : {settings?.format_template || 'RDV-{SIGLE}-{ANNÉE}-{######}'}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-4">
        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
        {success && <div className="text-xs text-green-700 bg-green-50 p-2 rounded-lg">{success}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sigle hôpital *</label>
            <input
              type="text"
              required
              maxLength={10}
              value={acronym}
              onChange={(e) => setAcronym(e.target.value.toUpperCase())}
              placeholder="ex: BAHO"
              className="w-full px-3 py-2 border rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">Utilisé dans RDV-<strong>BAHO</strong>-2026-000128</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Préfixe</label>
            <input
              type="text"
              maxLength={10}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="RDV"
              className="w-full px-3 py-2 border rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Exemple</p>
            <p className="text-lg font-mono font-bold text-indigo-700">
              {prefix || 'RDV'}-{(acronym || 'BAHO').toUpperCase()}-2026-000128
            </p>
          </div>
          <div className="border-l border-gray-200 pl-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Prochain numéro</p>
            <p className="text-sm font-mono font-bold text-teal-700">{settings?.next_reference || '—'}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={load} className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
