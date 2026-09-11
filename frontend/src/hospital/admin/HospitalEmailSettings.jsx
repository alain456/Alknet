import React, { useState, useEffect } from 'react';
import { Mail, Save, RefreshCw } from 'lucide-react';
import hospitalService from '../hospitalService';

const PLACEHOLDER_HINTS = [
  '{patient_name}', '{reference}', '{queue_number}', '{hospital_name}',
  '{doctor_name}', '{appointment_date}', '{request_date}', '{reason}',
];

export default function HospitalEmailSettings() {
  const [settings, setSettings] = useState(null);
  const [ackMessage, setAckMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const data = await hospitalService.getEmailSettings();
      setSettings(data);
      setAckMessage(
        data.appointment_request_ack_message
        || data.default_booking_ack_template
        || '',
      );
    } catch (err) {
      setError(err.message || 'Impossible de charger le modèle email');
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await hospitalService.updateEmailSettings({
        appointment_request_ack_message: ackMessage,
      });
      setSettings(data);
      setSuccess('Modèle enregistré — les prochains accusés de réception utiliseront ce contenu.');
    } catch (err) {
      setError(err.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const resetAck = () => {
    setAckMessage(settings?.default_booking_ack_template || '');
  };

  if (!settings && !error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500">
        Chargement du modèle email...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
        <Mail className="w-5 h-5 text-emerald-600" />
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Email d&apos;accusé de réception</h3>
          <p className="text-xs text-gray-500">
            Message envoyé au patient dès qu&apos;il soumet sa demande de rendez-vous.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-5">
        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
        {success && <div className="text-xs text-green-700 bg-green-50 p-2 rounded-lg">{success}</div>}

        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-[10px] font-bold text-gray-500 uppercase w-full">Variables disponibles</span>
          {PLACEHOLDER_HINTS.map((p) => (
            <code key={p} className="text-[10px] bg-white px-2 py-0.5 rounded border text-emerald-700">{p}</code>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-bold text-gray-700">
              Message d&apos;accusé de réception
            </label>
            <button type="button" onClick={resetAck} className="text-[10px] text-emerald-600 font-semibold hover:underline">
              Réinitialiser au modèle par défaut
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">
            Envoyé automatiquement quand le patient confirme sa demande. La confirmation ou le refus restent gérés manuellement par l&apos;administration.
          </p>
          <textarea
            rows={10}
            value={ackMessage}
            onChange={(e) => setAckMessage(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Message d'accusé de réception..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={load} className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
