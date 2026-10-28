import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, Plus, Upload, Video } from 'lucide-react';
import { readImageAsDataUrl, readVideoAsDataUrl } from '../shared/imageUpload';
import providerService from './providerService';
import { isCarouselProof, isPaperImage, TestimonyPlayer } from './ServiceProofCarousel';

const empty = {
  title: '',
  kind: 'ACTIVITY',
  description: '',
  file_url: '',
  is_public: true,
};
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const fieldClass = 'w-full border border-border rounded-lg px-3 py-2 bg-white';

const KIND_LABELS = {
  ACTIVITY: 'Image d’activité',
  TESTIMONY: 'Vidéo témoignage',
  ATTESTATION: 'Attestation',
  CERTIFICATE: 'Certificat',
  OTHER: 'Autre document',
};

function Thumb({ row }) {
  if (row.kind === 'TESTIMONY') {
    return <Video className="w-7 h-7 text-primary" />;
  }
  if (row.file_url && (row.kind !== 'OTHER' || row.file_url.startsWith('data:image/') || row.file_url.startsWith('/media/') || /\.(jpe?g|png|webp)(\?|$)/i.test(row.file_url))) {
    return <img src={row.file_url} alt="" className="w-full h-full object-contain" />;
  }
  return <ImageIcon className="w-7 h-7 text-white/80" />;
}

export default function ProviderDocuments() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = () => providerService.listDocuments()
    .then((data) => setRows(normalize(data)))
    .catch((err) => setError(err.message || 'Justificatifs indisponibles'));

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setForm(empty);
    setEditingId(null);
    setMediaError('');
    setError('');
    setOpen(true);
  };

  const startEdit = (row) => {
    setForm({
      title: row.title || '',
      kind: row.kind || 'ACTIVITY',
      description: row.description || '',
      file_url: row.file_url || '',
      is_public: row.is_public !== false,
    });
    setEditingId(row.id);
    setMediaError('');
    setError('');
    setOpen(true);
  };

  const setKind = (kind) => {
    const media = kind === 'ACTIVITY' || kind === 'TESTIMONY' || kind === 'ATTESTATION' || kind === 'CERTIFICATE';
    setForm((current) => ({
      ...current,
      kind,
      is_public: media ? true : current.is_public,
      file_url: current.kind === kind ? current.file_url : '',
    }));
    setMediaError('');
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMediaError('');
    setUploading(true);
    try {
      const dataUrl = form.kind === 'TESTIMONY'
        ? await readVideoAsDataUrl(file)
        : await readImageAsDataUrl(file, {
          maxSize: form.kind === 'ATTESTATION' || form.kind === 'CERTIFICATE' ? 1400 : 900,
          quality: 0.85,
        });
      setForm((current) => ({ ...current, file_url: dataUrl }));
    } catch (err) {
      setMediaError(err.message || 'Fichier invalide');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await providerService.saveDocument(editingId, form);
      setForm(empty);
      setEditingId(null);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Retirer « ${row.title} » ?`)) return;
    setError('');
    try {
      await providerService.deleteDocument(row.id);
      if (editingId === row.id) {
        setOpen(false);
        setEditingId(null);
        setForm(empty);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    }
  };

  const move = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    setError('');
    try {
      await providerService.saveDocument(rows[index].id, { ...rows[index], sort_order: next });
      await providerService.saveDocument(rows[next].id, { ...rows[next], sort_order: index });
      await load();
    } catch (err) {
      setError(err.message || 'Réordonnancement impossible');
    }
  };

  const isVideo = form.kind === 'TESTIMONY';
  const isImage = form.kind === 'ACTIVITY' || form.kind === 'ATTESTATION' || form.kind === 'CERTIFICATE';
  const isMedia = isVideo || isImage;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Justificatifs</h1>
          <p className="text-sm text-ink-muted mt-1">
            Ajoutez les attestations et certificats comme des images. Les photos d’activités et les
            vidéos de témoignage défilent sur la fiche publique ; chaque élément peut avoir une description.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {open && (
        <form onSubmit={save} className="bg-white rounded-2xl p-5 space-y-4">
          <p className="font-semibold text-ink">{editingId ? 'Modifier' : 'Nouveau justificatif'}</p>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Type</span>
            <select value={form.kind} onChange={(e) => setKind(e.target.value)} className={fieldClass}>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <input
            required
            placeholder="Titre"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={fieldClass}
          />
          <textarea
            placeholder="Description (affichée avec l’image ou la vidéo)"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={fieldClass}
          />
          {isMedia ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{isVideo ? 'Vidéo' : 'Image'}</p>
              <div className="flex gap-3 items-start">
                <div className="w-28 h-20 rounded-xl border border-dashed border-border bg-[#132F45] overflow-hidden flex items-center justify-center shrink-0">
                  {isImage && form.file_url ? (
                    <img src={form.file_url} alt="" className="w-full h-full object-contain" />
                  ) : isVideo && form.file_url ? (
                    <Video className="w-8 h-8 text-primary" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-white/80" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {isVideo && (
                    <input
                      placeholder="Lien YouTube, Vimeo ou fichier MP4"
                      value={form.file_url.startsWith('data:') ? '' : form.file_url}
                      onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                      className={fieldClass}
                    />
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={isVideo ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp,image/jpg'}
                    className="hidden"
                    onChange={pickFile}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Chargement…' : (isVideo ? 'Téléverser une courte vidéo' : 'Téléverser une image')}
                  </button>
                  {form.file_url && (
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, file_url: '' }))}
                      className="block text-xs text-error underline"
                    >
                      Retirer le média
                    </button>
                  )}
                  {mediaError && <p className="text-xs text-error">{mediaError}</p>}
                  {isVideo && (
                    <p className="text-xs text-ink-muted">
                      Vérifiez le son avec le lecteur ci-dessous. Lien YouTube, Vimeo ou fichier MP4/WebM (1,5 Mo max).
                    </p>
                  )}
                  {isImage && (
                    <p className="text-xs text-ink-muted">JPG, PNG ou WebP. Photo ou scan du document.</p>
                  )}
                </div>
              </div>
              {isVideo && form.file_url ? (
                <div className="rounded-xl overflow-hidden bg-[#132F45] aspect-video">
                  <TestimonyPlayer
                    key={form.file_url.slice(0, 80)}
                    src={form.file_url}
                    title={form.title || 'Aperçu'}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : null}
              {isImage && form.file_url ? (
                <div className="rounded-xl overflow-hidden bg-[#132F45] border border-border">
                  <img src={form.file_url} alt="" className="w-full max-h-64 object-contain mx-auto" />
                </div>
              ) : null}
            </div>
          ) : (
            <input
              placeholder="Lien du fichier (optionnel)"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
              className={fieldClass}
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
            />
            Visible publiquement
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || uploading} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-60">
              {saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Ajouter')}
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-border rounded-xl font-semibold"
              onClick={() => { setOpen(false); setEditingId(null); setForm(empty); }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 && !open && (
        <p className="text-sm text-ink-muted bg-white rounded-2xl p-5">
          Aucun justificatif. Ajoutez l’image d’une attestation, d’un certificat, d’une activité ou une vidéo.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <article key={row.id} className="bg-white rounded-2xl p-4 flex items-start gap-4">
            <div className="w-20 h-16 rounded-xl overflow-hidden bg-[#132F45] flex items-center justify-center shrink-0">
              <Thumb row={row} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{row.title}</p>
              <p className="text-sm text-primary">{KIND_LABELS[row.kind] || row.kind}</p>
              <p className="text-xs text-ink-muted mt-1">
                {row.is_public ? 'Public' : 'Privé'}
                {isCarouselProof(row) || isPaperImage(row) ? ' · Carrousel' : ''}
              </p>
              {row.description ? (
                <p className="text-sm text-ink mt-2 line-clamp-2">{row.description}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button type="button" className="text-sm font-semibold" onClick={() => startEdit(row)}>Modifier</button>
              <button
                type="button"
                className="text-sm font-semibold disabled:opacity-40"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Monter
              </button>
              <button
                type="button"
                className="text-sm font-semibold disabled:opacity-40"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                Descendre
              </button>
              <button type="button" className="text-sm font-semibold text-error" onClick={() => remove(row)}>Retirer</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
