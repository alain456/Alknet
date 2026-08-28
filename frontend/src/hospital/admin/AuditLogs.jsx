import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Eye, Edit3, CheckCircle, Clock, Search, Filter, 
  FileText, User, AlertTriangle
} from 'lucide-react';

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  // Simulated access audit log entries conforming to medical privacy guidelines
  const [logs] = useState([
    {
      id: 'LOG-1001',
      timestamp: new Date().toISOString(),
      user_name: 'Brigitte Nahayo',
      user_role: 'ADMIN_HOSPITAL',
      action: 'CONSULTATION_FICHE',
      resource: "Profil Établissement Hôpital Baho",
      ip_address: '192.168.1.45',
      status: 'SUCCESS'
    },
    {
      id: 'LOG-1002',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      user_name: 'Dr. Jean-Pierre Nkurunziza',
      user_role: 'MEDICAL_DOCTOR',
      action: 'REDACTION_NOTE',
      resource: "Consultation Note #482 (Patient #109)",
      ip_address: '192.168.1.88',
      status: 'SUCCESS'
    },
    {
      id: 'LOG-1003',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      user_name: 'Infirmière Majore Alice',
      user_role: 'NURSE_STAFF',
      action: 'SAISIE_CONSTANTES',
      resource: "Triage & Constantes Vitales (Patient #109)",
      ip_address: '192.168.1.102',
      status: 'SUCCESS'
    },
    {
      id: 'LOG-1004',
      timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
      user_name: 'Laborantin Marc',
      user_role: 'LAB_TECHNICIAN',
      action: 'VALIDATION_LABO',
      resource: "Résultat Examen Bilan Sanguin #882",
      ip_address: '192.168.1.15',
      status: 'SUCCESS'
    },
    {
      id: 'LOG-1005',
      timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
      user_name: 'Caissier Emmanuel',
      user_role: 'CASHIER',
      action: 'ENCAISSEMENT_RECETTE',
      resource: "Facture #INV-9904 (Caisse 1)",
      ip_address: '192.168.1.201',
      status: 'SUCCESS'
    }
  ]);

  const filteredLogs = logs.filter(log => {
    const searchMatch = log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        log.action.toLowerCase().includes(searchQuery.toLowerCase());
    if (!searchMatch) return false;
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'SAISIE_CONSTANTES':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Constantes</span>;
      case 'REDACTION_NOTE':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Note Clinique</span>;
      case 'VALIDATION_LABO':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Laboratoire</span>;
      case 'ENCAISSEMENT_RECETTE':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Facturation</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Consultation</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-gray-900 to-zinc-900 p-6 rounded-2xl text-white shadow-xl border border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Traçabilité & Confidentialité Médicale
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="text-emerald-400" />
            Journal d'Audit & Accès Médicaux
          </h1>
          <p className="text-gray-300 text-sm mt-1">Historique des accès, modifications et actions effectuées par le personnel sur la plateforme.</p>
        </div>
      </div>

      {/* Alert banner */}
      <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
        <div>
          <strong>Politique du Moindre Privilège Actives :</strong> Toutes les actions d'accès aux données cliniques et financières sont enregistrées avec horodatage et adresse IP pour garantir la sécurité du patient.
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par utilisateur, action ou ressource..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="ALL">Toutes les actions</option>
            <option value="SAISIE_CONSTANTES">Saisie Constantes (Infirmier)</option>
            <option value="REDACTION_NOTE">Rédaction Note (Médecin)</option>
            <option value="VALIDATION_LABO">Validation Labo (Laborantin)</option>
            <option value="ENCAISSEMENT_RECETTE">Encaissement (Caisse)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/50">
                <th className="py-3 px-6">ID & Horodatage</th>
                <th className="py-3 px-6">Utilisateur & Rôle</th>
                <th className="py-3 px-6">Type d'Action</th>
                <th className="py-3 px-6">Ressource Concernée</th>
                <th className="py-3 px-6 text-right">Adresse IP / Terminal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {filteredLogs.map(log => {
                const dateFormatted = new Date(log.timestamp).toLocaleString('fr-FR', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3.5 px-6 font-mono text-gray-500 font-medium">
                      <div className="font-bold text-gray-900 dark:text-white text-xs">{log.id}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {dateFormatted}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-bold text-gray-900 dark:text-white">{log.user_name}</div>
                      <div className="text-[11px] text-gray-400">{log.user_role}</div>
                    </td>
                    <td className="py-3.5 px-6">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-gray-700 dark:text-gray-300">
                      {log.resource}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-gray-400">
                      {log.ip_address}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
