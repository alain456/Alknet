import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SectorAnalyticsWidget from './SectorAnalyticsWidget';

const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function AdminAnalyticsPage() {
  const { token } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [busRes, catRes, dashRes] = await Promise.all([
          fetch('/api/v1/businesses/admin/list/', { headers }),
          fetch('/api/v1/business-categories/'),
          fetch('/api/v1/analytics/dashboard-stats/', { headers }),
        ]);
        const busData = busRes.ok ? await busRes.json() : [];
        const catData = catRes.ok ? await catRes.json() : [];
        const dashData = dashRes.ok ? await dashRes.json() : null;
        if (cancelled) return;
        setBusinesses(normalize(busData));
        setCategories(normalize(catData));
        setStats(dashData);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger l’analytique');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const metrics = stats?.metrics || {};
  const active = businesses.filter((b) => b.is_active && b.verification_status === 'APPROVED').length;
  const pending = businesses.filter((b) => b.verification_status === 'PENDING').length;
  const rejected = businesses.filter((b) => b.verification_status === 'REJECTED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary mb-2">
          <BarChart3 className="w-4 h-4" /> Pilotage plateforme
        </div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">Analytique</h1>
        <p className="text-sm text-ink-muted mt-1">Répartition des tenants et indicateurs globaux Isoko Hub.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-error text-sm">{error}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Entreprises" value={businesses.length} />
        <StatCard icon={Building2} label="Actives & approuvées" value={active} accent="text-success" />
        <StatCard icon={Building2} label="En modération" value={pending} accent="text-accent" />
        <StatCard icon={Users} label="Rejetées / retirées" value={rejected} accent="text-error" />
      </div>

      {(metrics.total_users != null || metrics.total_businesses != null) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {metrics.total_users != null && <StatCard icon={Users} label="Utilisateurs (API)" value={metrics.total_users} />}
          {metrics.total_businesses != null && <StatCard icon={Building2} label="Entreprises (API)" value={metrics.total_businesses} />}
          {/* Pas de CA commandes — revenus plateforme = abonnements SaaS */}
          {metrics.active_subscriptions != null && <StatCard icon={CreditCard} label="Abo actifs" value={metrics.active_subscriptions} />}
        </div>
      )}

      <SectorAnalyticsWidget businesses={businesses} categories={categories} />

      <div className="flex flex-wrap gap-3">
        <Link to="/admin/businesses" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-secondary">
          Voir les entreprises
        </Link>
        <Link to="/admin/payments" className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-ink hover:bg-paper">
          Abonnements SaaS
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'text-ink dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-primary border border-border dark:border-white/10 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value ?? '—'}</div>
    </div>
  );
}
