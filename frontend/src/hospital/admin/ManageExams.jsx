import React, { useEffect, useMemo, useState } from 'react';
import {
  FlaskConical, Plus, Pencil, Trash2, Search, X, DollarSign, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  currency: 'BIF',
  is_active: true,
  is_public: true,
  display_order: 0,
};

export default function ManageExams() {
  const { token } = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (hid) => {
    setLoading(true);
    try {
      const data = await hospitalService.getExams(hid, true);
      setExams(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les examens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (!list.length || cancelled) {
          setLoading(false);
          return;
        }
        const hid = list[0].id;
        setHospitalId(hid);
        await load(hid);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Hôpital introuvable');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((ex) => {
      if (!q) return true;
      return (
        (ex.name || '').toLowerCase().includes(q)
        || (ex.description || '').toLowerCase().includes(q)
      );
    });
  }, [exams, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (ex) => {
    setEditingId(ex.id);
    setForm({
      name: ex.name || '',
      description: ex.description || '',
      price: ex.price != null ? String(ex.price) : '',
      currency: ex.currency || 'BIF',
      is_active: ex.is_active !== false,
      is_public: ex.is_public !== false,
      display_order: ex.display_order || 0,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hospitalId) return;
    setSaving(true);
    setError('');
    const payload = {
      hospital: hospitalId,
      name: form.name.trim(),
      category: 'OTHER',
      description: form.description.trim(),
      price: Number(form.price || 0),
      currency: form.currency || 'BIF',
      price_notes: '',
      preparation: '',
      is_active: Boolean(form.is_active),
      is_public: Boolean(form.is_public),
      display_order: Number(form.display_order) || 0,
    };
    try {
      if (editingId) {
        await hospitalService.updateExam(editingId, payload);
      } else {
        await hospitalService.createExam(payload);
      }
      setIsModalOpen(false);
      await load(hospitalId);
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex) => {
    if (!window.confirm(`Supprimer l’examen « ${ex.name} » ?`)) return;
    try {
      await hospitalService.deleteExam(ex.id);
      await load(hospitalId);
    } catch (err) {
      alert(err.message || 'Échec de la suppression');
    }
  };

  const formatPrice = (ex) => {
    if (ex.formatted_price) return ex.formatted_price;
    const n = Number(ex.price || 0);
    if (!n) return 'Tarif à confirmer';
    return `${n.toLocaleString('fr-BI')} ${ex.currency || 'BIF'}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-teal-600" />
            Examens & tarifs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Catalogue visible par les patients sur la fiche publique de votre hôpital.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Ajouter un examen
        </button>
      </div>

      {error && !isModalOpen && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un examen…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Examen</th>
                <th className="px-4 py-3 font-semibold">Tarif</th>
                <th className="px-4 py-3 font-semibold">Visibilité</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{ex.name}</div>
                    {ex.description && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ex.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-teal-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatPrice(ex)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ex.is_public ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          <Eye className="w-3 h-3" /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          <EyeOff className="w-3 h-3" /> Masqué
                        </span>
                      )}
                      {!ex.is_active && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Inactif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => openEdit(ex)} className="icon-btn">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(ex)} className="icon-btn icon-btn--danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    Aucun examen. Ajoutez le catalogue pour que les patients voient les tarifs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900">
                {editingId ? 'Modifier l’examen' : 'Nouvel examen'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="icon-btn">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-700">Nom de l’examen *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Ex: NFS, Échographie abdominale…"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-700">Tarif *</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-700">Devise</span>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="BIF">BIF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-700">Description</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-teal-600 resize-none"
                />
              </label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                  />
                  Visible côté client
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Actif
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded-xl">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold bg-teal-700 text-white rounded-xl disabled:opacity-60"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
