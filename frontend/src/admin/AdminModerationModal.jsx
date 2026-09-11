import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, FileText, AlertCircle, X,
  ExternalLink, MapPin, Mail, Building2, Eye
} from 'lucide-react';
import api from '../shared/api';

function emailFeedback(emailInfo, fallback) {
  if (!emailInfo) return fallback;
  if (emailInfo.status === 'SENT') {
    return `${fallback} Email envoyé à ${emailInfo.recipient}.`;
  }
  if (emailInfo.status === 'FAILED') {
    return `${fallback} Mais l’email n’a pas pu être envoyé : ${emailInfo.error || 'erreur SMTP'}.`;
  }
  if (emailInfo.status === 'SKIPPED') {
    return `${fallback} Aucun email : ${emailInfo.reason || 'adresse manquante'}.`;
  }
  return fallback;
}

function DetailRow({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs py-1.5 border-b border-border/60 dark:border-white/5 last:border-0">
      <span className="text-ink-muted dark:text-green-100/50 font-medium">{label}</span>
      <span className={`text-ink dark:text-white break-words ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}

export default function AdminModerationModal({ isOpen, onClose, onRefresh }) {
  const [pendingBusinesses, setPendingBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [decisionMode, setDecisionMode] = useState(null); // 'approve' | 'reject' | null
  const [decisionMessage, setDecisionMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await api.get('businesses/admin/moderation/', { auth: true });
      const list = Array.isArray(data) ? data : (data?.results || []);
      setPendingBusinesses(list);
      if (selectedBusiness) {
        const still = list.find((b) => b.id === selectedBusiness.id);
        setSelectedBusiness(still || null);
        if (!still) {
          setDecisionMode(null);
          setDecisionMessage('');
        }
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
      setSelectedBusiness(null);
      setDecisionMode(null);
      setDecisionMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openDecision = (mode) => {
    if (!selectedBusiness) return;
    setDecisionMode(mode);
    setDecisionMessage(
      mode === 'approve'
        ? `Bonjour,\n\nNous avons le plaisir de vous confirmer que l’inscription de « ${selectedBusiness.name} » a été approuvée sur Isoko Hub. Vous pouvez dès à présent vous connecter à votre espace professionnel.\n\nCordialement,\nL’équipe Isoko Hub`
        : `Bonjour,\n\nAprès examen de votre dossier, l’inscription de « ${selectedBusiness.name} » n’a pas pu être acceptée.\n\nMotif : [précisez ici]\n\nCordialement,\nL’équipe Isoko Hub`
    );
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness || !decisionMode) return;
    const message = decisionMessage.trim();
    if (!message) {
      alert(decisionMode === 'approve'
        ? 'Veuillez rédiger le message de confirmation envoyé à l’entreprise.'
        : 'Veuillez rédiger le motif de refus envoyé à l’entreprise.');
      return;
    }

    setProcessing(true);
    try {
      const isApprove = decisionMode === 'approve';
      const path = `businesses/admin/moderation/${selectedBusiness.id}/${isApprove ? 'approve' : 'reject'}/`;
      const body = isApprove ? { message } : { reason: message, message };
      const data = await api.post(path, body, { auth: true });
      alert(emailFeedback(data.email_notification, data.message || (isApprove ? 'Entreprise approuvée.' : 'Entreprise rejetée.')));
      setDecisionMode(null);
      setDecisionMessage('');
      setSelectedBusiness(null);
      await fetchPending();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const bus = selectedBusiness;
  const attrs = bus?.extra_attributes || {};
  const mapsUrl = bus?.latitude && bus?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${bus.latitude},${bus.longitude}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-5xl shadow-xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2 text-green-900 dark:text-white font-bold text-lg">
            <ShieldAlert className="w-5 h-5 text-gold-600 dark:text-gold-400" />
            Espace de Modération
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-700" />
          </div>
        ) : pendingBusinesses.length === 0 ? (
          <div className="py-12 text-center text-ink-muted dark:text-green-100/60 text-sm">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2 opacity-80" />
            Aucune demande d&apos;inscription en attente de modération.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <p className="text-xs text-ink-muted dark:text-green-100/70 mb-2">
                Sélectionnez une entreprise pour vérifier toutes ses informations avant d&apos;approuver ou de refuser.
              </p>
              <div className="divide-y divide-border dark:divide-white/10 border border-border dark:border-white/10 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                {pendingBusinesses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedBusiness(item);
                      setDecisionMode(null);
                      setDecisionMessage('');
                    }}
                    className={`w-full text-left p-3 transition cursor-pointer ${
                      selectedBusiness?.id === item.id
                        ? 'bg-green-50 dark:bg-green-900/30'
                        : 'bg-paper/50 dark:bg-black/20 hover:bg-paper dark:hover:bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-ink dark:text-white">{item.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        En attente
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted dark:text-green-100/70">
                      {item.primary_category_name || 'Secteur non précisé'} · {item.email || item.owner_email || '—'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 border border-border dark:border-white/10 rounded-lg p-4 bg-paper/30 dark:bg-black/20 min-h-[320px]">
              {!bus ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-ink-muted dark:text-green-100/60 py-16">
                  <Eye className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Vérifiez le dossier complet</p>
                  <p className="text-xs mt-1 max-w-xs">
                    Cliquez sur une entreprise à gauche pour afficher toutes les informations avant toute décision.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-ink dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gold-600" />
                        {bus.name}
                      </h3>
                      <p className="text-xs text-ink-muted dark:text-green-100/60 mt-0.5">
                        Dossier soumis · statut {bus.verification_status || 'PENDING'}
                      </p>
                    </div>
                    {bus.logo ? (
                      <img src={bus.logo} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gold-700 dark:text-gold-400 mb-1">Identité</h4>
                    <DetailRow label="Secteur" value={bus.primary_category_name} />
                    <DetailRow label="Description" value={bus.description} />
                    <DetailRow label="Email entreprise" value={bus.email} />
                    <DetailRow label="Propriétaire" value={bus.owner_email} />
                    <DetailRow label="Téléphone" value={bus.phone} />
                    <DetailRow label="Site web" value={bus.website} />
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gold-700 dark:text-gold-400 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Localisation
                    </h4>
                    <DetailRow label="Adresse" value={bus.full_address || bus.address} />
                    <DetailRow label="Province" value={bus.province} />
                    <DetailRow label="Commune" value={bus.commune} />
                    <DetailRow label="Zone" value={bus.zone} />
                    <DetailRow label="Quartier" value={bus.quartier} />
                    <DetailRow label="Avenue" value={bus.avenue} />
                    <DetailRow label="Latitude GPS" value={bus.latitude} mono />
                    <DetailRow label="Longitude GPS" value={bus.longitude} mono />
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-green-700 dark:text-green-300 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Voir sur Google Maps
                      </a>
                    )}
                    {!bus.latitude && !bus.longitude && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Coordonnées GPS absentes
                      </p>
                    )}
                  </div>

                  {(attrs && Object.keys(attrs).length > 0) || bus.proof_document || bus.commerce_compliance ? (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wide text-gold-700 dark:text-gold-400 mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Justificatifs / attributs secteur
                      </h4>
                      {bus.proof_document && (
                        <a
                          href={bus.proof_document}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300 hover:underline mb-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Document justificatif
                        </a>
                      )}
                      {bus.commerce_compliance && (
                        <div className="mb-3 space-y-2 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                          <p className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-300">NIF Commerce (OBR)</p>
                          <DetailRow label="NIF" value={bus.commerce_compliance.nif_number || '—'} />
                          {bus.commerce_compliance.nif_document && (
                            <a href={bus.commerce_compliance.nif_document} target="_blank" rel="noreferrer" className="text-xs text-green-700 dark:text-green-300 underline inline-flex items-center gap-1">
                              <ExternalLink className="w-3.5 h-3.5" /> Voir le scan NIF
                            </a>
                          )}
                        </div>
                      )}
                      {Object.entries(attrs)
                        .filter(([key]) => !['nif_document', 'rccm_document', 'permit_document', 'rccm_number', 'permit_number'].includes(key))
                        .map(([key, val]) => (
                          <DetailRow key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
                        ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border dark:border-white/10">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => openDecision('approve')}
                      className="px-3 py-2 text-xs font-semibold bg-green-700 text-white rounded-md hover:bg-green-800 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approuver avec message
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => openDecision('reject')}
                      className="px-3 py-2 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-md hover:bg-red-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Refuser avec message
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-muted dark:text-green-100/50 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Le message sera envoyé à {bus.email || bus.owner_email || 'l’adresse de l’entreprise'}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {decisionMode && selectedBusiness && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
              <h4
                className={`font-bold text-sm mb-2 flex items-center gap-2 ${
                  decisionMode === 'approve' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {decisionMode === 'approve' ? (
                  <><CheckCircle2 className="w-4 h-4" /> Confirmer l&apos;approbation</>
                ) : (
                  <><AlertCircle className="w-4 h-4" /> Confirmer le refus</>
                )}
              </h4>
              <p className="text-xs text-ink-muted dark:text-green-100/70 mb-3">
                {decisionMode === 'approve'
                  ? <>Rédigez le message de confirmation qui sera envoyé par email à <strong>{selectedBusiness.email || selectedBusiness.owner_email}</strong> pour <strong>{selectedBusiness.name}</strong>.</>
                  : <>Rédigez le motif de refus qui sera envoyé par email à <strong>{selectedBusiness.email || selectedBusiness.owner_email}</strong> pour <strong>{selectedBusiness.name}</strong>.</>}
              </p>

              <form onSubmit={handleDecisionSubmit} className="space-y-3">
                <textarea
                  required
                  rows={8}
                  value={decisionMessage}
                  onChange={(e) => setDecisionMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 resize-y min-h-[140px]"
                  placeholder={decisionMode === 'approve' ? 'Message de confirmation…' : 'Motif de refus…'}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode(null);
                      setDecisionMessage('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-md text-ink-muted cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md disabled:opacity-50 cursor-pointer ${
                      decisionMode === 'approve' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {processing
                      ? 'Envoi…'
                      : decisionMode === 'approve'
                        ? 'Approuver et envoyer l’email'
                        : 'Refuser et envoyer l’email'}
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
