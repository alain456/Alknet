import React, { useEffect, useState } from 'react';
import {
  Settings, Percent, Globe, Server, Save, AlertTriangle,
  Shield, Database, HardDrive, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';
import api from '../shared/api';

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary';

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState({
    platform_fee_percent: '10',
    tax_rate_percent: '18',
    currency: 'BIF',
    maintenance_mode: false,
    auto_approve_businesses: false,
    brand_name: 'Isoko Hub',
    password_min_length: '8',
  });
  const [governance, setGovernance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadGovernance = async () => {
    try {
      const data = await api.get('analytics/governance/', { auth: true });
      setGovernance(data);
    } catch {
      /* optionnel si API indisponible */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [settingsRes] = await Promise.all([
          api.get('cms/admin/settings/', { auth: true }),
          loadGovernance(),
        ]);
        const settings = Array.isArray(settingsRes) ? settingsRes[0] : settingsRes;
        if (!cancelled && settings) {
          setFormData({
            platform_fee_percent: String(settings.platform_fee_percent ?? 10),
            tax_rate_percent: String(settings.tax_rate_percent ?? 18),
            currency: settings.currency || 'BIF',
            maintenance_mode: Boolean(settings.maintenance_mode),
            auto_approve_businesses: Boolean(settings.auto_approve_businesses),
            brand_name: settings.brand_name || 'Isoko Hub',
            password_min_length: String(settings.password_min_length ?? 8),
            id: settings.id,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les paramètres');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        platform_fee_percent: Number(formData.platform_fee_percent),
        tax_rate_percent: Number(formData.tax_rate_percent),
        currency: formData.currency,
        maintenance_mode: formData.maintenance_mode,
        auto_approve_businesses: formData.auto_approve_businesses,
        brand_name: formData.brand_name,
        password_min_length: Number(formData.password_min_length),
      };
      const updated = await api.patch('cms/admin/settings/', payload, { auth: true });
      const settings = Array.isArray(updated) ? updated[0] : updated;
      if (settings) {
        setFormData((prev) => ({
          ...prev,
          platform_fee_percent: String(settings.platform_fee_percent ?? prev.platform_fee_percent),
          tax_rate_percent: String(settings.tax_rate_percent ?? prev.tax_rate_percent),
          currency: settings.currency || prev.currency,
          maintenance_mode: Boolean(settings.maintenance_mode),
          auto_approve_businesses: Boolean(settings.auto_approve_businesses),
          brand_name: settings.brand_name || prev.brand_name,
          password_min_length: String(settings.password_min_length ?? prev.password_min_length),
        }));
      }
      setMessage('Paramètres enregistrés.');
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const runBackup = async () => {
    setBackingUp(true);
    setMessage('');
    setError('');
    try {
      const data = await api.post('analytics/governance/', {}, { auth: true });
      setGovernance(data);
      setMessage('Sauvegarde applicative terminée.');
    } catch (err) {
      setError(err.message || 'Échec de la sauvegarde');
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  const checklist = governance?.security_checklist || {};
  const checklistItems = [
    ['debug_disabled', 'DEBUG désactivé (prod)'],
    ['https_headers', 'HTTPS / HSTS activés'],
    ['api_throttling', 'Limitation de débit API'],
    ['cors_restricted', 'CORS restreint (ou mode DEBUG)'],
    ['jwt_auth', 'Authentification JWT'],
    ['tenant_isolation', 'Isolation multi-tenant'],
    ['audit_logs', 'Journaux d’audit'],
  ];

  return (
    <div className="space-y-6 pb-10 w-full max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Paramètres plateforme
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Configuration métier + gouvernance des données SaaS (sécurité, backups, responsabilité partagée).
        </p>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}

      {/* Gouvernance SaaS */}
      {governance && (
        <div className="bg-white border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Gouvernance & données
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                Visibilité du portefeuille applicatif et checklist de protection des données.
              </p>
            </div>
            <button
              type="button"
              onClick={runBackup}
              disabled={backingUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              {backingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              Lancer une sauvegarde
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-4 bg-paper/50">
              <h3 className="text-sm font-bold text-ink mb-2">Responsabilité hébergeur / infra</h3>
              <ul className="text-sm text-ink-muted space-y-1 list-disc pl-4">
                {(governance.shared_responsibility?.provider || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border p-4 bg-paper/50">
              <h3 className="text-sm font-bold text-ink mb-2">Votre responsabilité (opérateur)</h3>
              <ul className="text-sm text-ink-muted space-y-1 list-disc pl-4">
                {(governance.shared_responsibility?.operator || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" /> Portefeuille de données
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(governance.portfolio || []).map((item) => (
                <div key={item.app} className="rounded-xl border border-border p-3">
                  <div className="text-xs text-ink-faint uppercase tracking-wide">{item.app}</div>
                  <div className="font-semibold text-ink text-sm mt-0.5">{item.title}</div>
                  <div className="text-lg font-mono font-bold text-primary mt-1">
                    {Number(item.records || 0).toLocaleString('fr-BI')}
                  </div>
                  <div className="text-[11px] text-ink-muted">enregistrements</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-ink mb-3">Checklist sécurité</h3>
              <ul className="space-y-2">
                {checklistItems.map(([key, label]) => {
                  const ok = Boolean(checklist[key]);
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      {ok
                        ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        : <XCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span className={ok ? 'text-ink' : 'text-amber-800'}>{label}</span>
                    </li>
                  );
                })}
                {checklist.password_min_length != null && (
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    Mot de passe min. : {checklist.password_min_length} caractères
                  </li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-border p-4 bg-paper/50 space-y-2 text-sm">
              <h3 className="font-bold text-ink">Sauvegardes</h3>
              <p className="text-ink-muted">
                Dernière sauvegarde applicative :{' '}
                <strong className="text-ink">
                  {governance.backups?.latest?.created_at
                    ? new Date(governance.backups.latest.created_at).toLocaleString('fr-FR')
                    : 'aucune'}
                </strong>
              </p>
              {governance.backups?.latest?.total_records != null && (
                <p className="text-ink-muted">
                  Volume : {Number(governance.backups.latest.total_records).toLocaleString('fr-BI')} enregistrements
                </p>
              )}
              <p className="text-xs text-ink-faint pt-2 border-t border-border">
                Dump PostgreSQL recommandé côté ops :<br />
                <code className="text-[11px]">{governance.backups?.postgres_hint}</code>
              </p>
              <p className="text-xs text-ink-faint">
                Rétention : {governance.backups?.retention_days ?? 14} jours · dossier{' '}
                <code>{governance.backups?.root}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2 border-b border-border pb-2">
              <Globe className="w-5 h-5 text-ink-faint" />
              Identité
            </h2>
            <label className="block space-y-1.5 max-w-md">
              <span className="text-sm font-medium text-gray-700">Nom de la marque</span>
              <input name="brand_name" value={formData.brand_name} onChange={handleChange} className={inputClass} />
            </label>
          </div>

          <div>
            <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2 border-b border-border pb-2">
              <Percent className="w-5 h-5 text-ink-faint" />
              Configuration financière
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Commission plateforme (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  name="platform_fee_percent"
                  value={formData.platform_fee_percent}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">TVA par défaut (%)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  name="tax_rate_percent"
                  value={formData.tax_rate_percent}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Devise de base</span>
                <select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}>
                  <option value="BIF">BIF — Franc burundais</option>
                  <option value="USD">USD — Dollar US</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="RWF">RWF — Franc rwandais</option>
                </select>
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2 border-b border-border pb-2">
              <Shield className="w-5 h-5 text-ink-faint" />
              Sécurité des mots de passe
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Longueur minimale</span>
                <input
                  type="number"
                  min="4"
                  max="128"
                  step="1"
                  name="password_min_length"
                  value={formData.password_min_length}
                  onChange={handleChange}
                  className={inputClass}
                />
                <span className="text-xs text-ink-muted">
                  Ex. : 7 pour assouplir, 12 pour renforcer. Appliqué à l’inscription et à la création d’utilisateurs.
                </span>
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2 border-b border-border pb-2">
              <Server className="w-5 h-5 text-ink-faint" />
              Opérations système
            </h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 border border-border rounded-xl cursor-pointer hover:bg-paper transition">
                <input
                  type="checkbox"
                  name="auto_approve_businesses"
                  checked={formData.auto_approve_businesses}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 text-primary rounded"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">Auto-approuver les entreprises</span>
                  <span className="text-sm text-ink-muted">
                    Les nouvelles inscriptions passent directement en Actif & Approuvé.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 p-4 border border-red-200 bg-red-50/50 rounded-xl cursor-pointer hover:bg-red-50 transition">
                <input
                  type="checkbox"
                  name="maintenance_mode"
                  checked={formData.maintenance_mode}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 text-red-600 rounded"
                />
                <span>
                  <span className="flex text-sm font-bold text-red-700 items-center gap-2">
                    Mode maintenance <AlertTriangle className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-red-600/80">
                    Plateforme hors ligne pour le public. Les Super Admin restent connectés.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-border">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-white px-6 py-2.5 rounded-xl font-semibold shadow-sm transition disabled:opacity-70"
            >
              {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
