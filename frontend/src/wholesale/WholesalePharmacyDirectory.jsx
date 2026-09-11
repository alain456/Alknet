import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Phone, Package, Building2 } from 'lucide-react';
import api from '../shared/api';

export default function WholesalePharmacyDirectory() {
  const [pharmacies, setPharmacies] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('wholesale/pharmacies/')
      .then((data) => setPharmacies(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || 'Impossible de charger les pharmacies de gros'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pharmacies;
    return pharmacies.filter((p) =>
      `${p.commercial_name} ${p.name} ${p.commune} ${p.description}`.toLowerCase().includes(term)
    );
  }, [pharmacies, q]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Pharmacies de gros</h1>
          <p className="text-blue-100 text-lg max-w-2xl">
            Consultez les catalogues B2B et passez commande depuis votre pharmacie de détail.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une pharmacie de gros..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white"
          />
        </div>

        {loading && <p className="text-slate-500">Chargement...</p>}
        {error && <p className="text-red-600">{error}</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/wholesale-pharmacies/${p.id}`}
              className="bg-white border rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition block"
            >
              <div className="flex items-start gap-3">
                {p.logo ? (
                  <img src={p.logo} alt="" className="w-12 h-12 rounded-xl object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-slate-900 truncate">{p.commercial_name || p.name}</h2>
                  {p.commune && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {p.commune}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 line-clamp-2">
                {p.description || 'Catalogue de médicaments en gros disponible.'}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                  <Package className="w-3.5 h-3.5" /> Voir le catalogue
                </span>
                {p.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {p.phone}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-center text-slate-500 py-12">Aucune pharmacie de gros trouvée.</p>
        )}
      </div>
    </div>
  );
}
