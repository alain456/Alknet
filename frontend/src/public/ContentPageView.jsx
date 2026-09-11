import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, Phone, User, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import api from '../shared/api';

export default function ContentPageView() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isContact = slug === 'contact';
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setSent(false);
      setFormError('');
      try {
        const data = await api.get(`cms/public/pages/${slug}/`);
        setPage(data);
      } catch (err) {
        setError(err.message || 'Page introuvable');
        setPage(null);
      } finally {
        setLoading(false);
      }
    };
    if (slug) load();
  }, [slug]);

  const paragraphs = useMemo(
    () => (page?.body || '').split(/\n+/).filter(Boolean),
    [page]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setFormError('');
    try {
      await api.post('cms/public/contact/', form);
      setSent(true);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setFormError(err.message || 'Impossible d’envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-gray-500">Chargement...</div>;
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page introuvable</h1>
        <p className="text-gray-500 mb-6">{error || 'Cette page n’existe pas ou n’est pas publiée.'}</p>
        <Link to="/" className="text-primary font-semibold hover:underline">Retour à l’accueil</Link>
      </div>
    );
  }

  if (isContact) {
    return (
      <div className="bg-gradient-to-b from-emerald-50/80 to-white">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Support</p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{page.title || 'Nous contacter'}</h1>
            <div className="space-y-3 text-gray-600 leading-relaxed">
              {paragraphs.length > 0 ? (
                paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
              ) : (
                <p>Envoyez un message à l’équipe Isoko Hub. Le Super Admin le recevra directement.</p>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
              {sent ? (
                <div className="py-10 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h2 className="text-xl font-bold text-gray-900">Message envoyé</h2>
                  <p className="text-gray-600 text-sm max-w-md mx-auto">
                    Merci. Votre message a été transmis à l’équipe Isoko Hub. Nous vous répondrons à l’adresse indiquée.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-4 text-sm font-semibold text-primary hover:underline"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Formulaire de contact
                  </h2>
                  {formError && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{formError}</div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Nom complet *
                      </span>
                      <input
                        required
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Votre nom"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Email *
                      </span>
                      <input
                        required
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary"
                        placeholder="vous@exemple.com"
                      />
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Téléphone
                      </span>
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary"
                        placeholder="+257 …"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-gray-700">Objet *</span>
                      <input
                        required
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Sujet de votre message"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-gray-700">Message *</span>
                    <textarea
                      required
                      name="message"
                      rows={6}
                      value={form.message}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary resize-y min-h-[140px]"
                      placeholder="Écrivez votre message…"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                  >
                    {sending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? 'Envoi…' : 'Envoyer le message'}
                  </button>
                </form>
              )}
            </div>

            <aside className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
                <h3 className="font-bold text-gray-900 mb-2">À qui s’adresse ce formulaire ?</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Vos messages sont destinés à l’équipe Super Admin d’Isoko Hub (plateforme),
                  pas aux hôpitaux ou pharmacies individuelles.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2 text-sm text-gray-600">
                <p className="font-semibold text-gray-900">Délai de réponse</p>
                <p>Nous traitons les demandes dans les meilleurs délais ouvrables.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{page.title}</h1>
      <div className="prose prose-teal max-w-none space-y-4 text-gray-700 leading-relaxed">
        {paragraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>
    </div>
  );
}
