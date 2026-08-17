import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileText, AlertCircle, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminModerationModal({ isOpen, onClose, onRefresh }) {
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReject, setSelectedReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { token } = useAuth();

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/businesses/admin/moderation/', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPendingBusinesses(data);
      }
    } catch (err) {
      console.error('Err fetch moderation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPending();
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleApprove = async (business) => {
    if (!window.confirm(`Approuver l'attribution du secteur pour "${business.name}" ?`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/businesses/admin/moderation/${business.id}/approve/`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        fetchPending();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReject) return;
    setProcessing(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/businesses/admin/moderation/${selectedReject.id}/reject/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reason: rejectionReason })
      });
      if (res.ok) {
        setSelectedReject(null);
        setRejectionReason('');
        fetchPending();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-3xl shadow-xl relative max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2 text-green-900 dark:text-white font-bold text-lg">
            <ShieldAlert className="w-5 h-5 text-gold-600 dark:text-gold-400" />
            Espace de Modération (Secteurs Sensibles)
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
          </div>
        ) : pendingBusinesses.length === 0 ? (
          <div className="py-12 text-center text-ink-muted dark:text-green-100/60 text-sm">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2 opacity-80" />
            Aucune demande d'attribution en attente de modération.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ink-muted dark:text-green-100/70">
              Vérifiez les pièces justificatives et agréments ministériels fournis avant d'accorder la certification du secteur :
            </p>

            <div className="divide-y divide-border dark:divide-white/10 border border-border dark:border-white/10 rounded-lg overflow-hidden">
              {pendingBusinesses.map((bus) => {
                const attrs = bus.extra_attributes || {};
                return (
                  <div key={bus.id} className="p-4 bg-paper/50 dark:bg-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink dark:text-white">{bus.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          En attente
                        </span>
                      </div>
                      
                      <div className="text-xs text-ink-muted dark:text-green-100/70">
                        <span className="font-semibold text-gold-700 dark:text-gold-400">Secteur:</span> {bus.primary_category_name || 'Non spécifié'} | <span className="font-semibold">Propriétaire:</span> {bus.owner_email || 'Inconnu'}
                      </div>

                      {attrs.license_number && (
                        <div className="text-xs text-green-800 dark:text-green-200 font-medium flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> N° Agrément Ministériel: <strong>{attrs.license_number}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleApprove(bus)}
                        disabled={processing}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 transition flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                      </button>
                      <button 
                        onClick={() => setSelectedReject(bus)}
                        disabled={processing}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-md hover:bg-red-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Rejet avec Motif */}
        {selectedReject && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h4 className="font-bold text-sm text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Motif du Rejet de l'Attribution
              </h4>
              <p className="text-xs text-ink-muted dark:text-green-100/70 mb-3">
                Expliquez la raison du rejet à l'entreprise <strong>{selectedReject.name}</strong> :
              </p>
              
              <form onSubmit={handleRejectSubmit} className="space-y-3">
                <textarea 
                  required
                  rows="3"
                  placeholder="Ex: Numéro d'agrément ministériel invalide ou document manquant..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-red-600 resize-none"
                ></textarea>

                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedReject(null)}
                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-md text-ink-muted"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={processing}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirmer le Rejet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
