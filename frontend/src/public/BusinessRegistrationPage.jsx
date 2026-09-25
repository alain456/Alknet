import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, ShieldCheck } from 'lucide-react';
import BusinessRegistrationForm, {
  emptyBusinessRegistrationForm,
  validateBusinessRegistrationForm,
  buildBusinessRegistrationPayload,
} from '../shared/components/BusinessRegistrationForm';

export default function BusinessRegistrationPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(() => emptyBusinessRegistrationForm());

  useEffect(() => {
    fetch('/api/v1/business-categories/')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results || []);
        setCategories(list);
        if (list.length > 0) {
          setFormData((prev) => (
            prev.primary_category ? prev : { ...prev, primary_category: list[0].id }
          ));
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const validationError = validateBusinessRegistrationForm(formData, categories, {
        requirePassword: true,
      });
      if (validationError) throw new Error(validationError);

      const payload = buildBusinessRegistrationPayload(formData);
      const response = await fetch('/api/v1/businesses/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.error || data.detail
          || (typeof data === 'object' && Object.values(data).flat?.()?.[0])
          || 'Erreur lors de la soumission.';
        throw new Error(String(detail));
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface text-ink flex flex-col items-center justify-center p-4">
        <div className="bg-surface p-8 rounded-2xl border-2 border-accent shadow-md max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary text-surface rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-accent">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink mb-2">Demande envoyée !</h2>
          <p className="text-base text-ink font-medium mb-6">
            Votre demande d&apos;inscription pour l&apos;entreprise <strong>{formData.name}</strong> a été soumise avec succès.
            Elle est actuellement <strong>en attente de validation</strong> par nos administrateurs.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary text-surface font-bold text-base rounded-xl border-2 border-accent hover:opacity-95 transition"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink pb-16">
      <div className="bg-primary text-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 15% 0%, #1E8B4A 0%, transparent 50%), radial-gradient(ellipse at 95% 90%, #E1302A 0%, transparent 45%)',
          }}
        />
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-16 relative text-center space-y-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface text-primary border-2 border-accent shadow-md hover:scale-105 transition-transform"
          >
            <Store className="w-7 h-7" />
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface tracking-tight">
            Inscrivez votre établissement
          </h1>
          <p className="text-base sm:text-lg text-surface/90 max-w-xl mx-auto font-medium">
            Rejoignez le réseau Isoko Hub et développez votre activité avec la même identité visuelle que le reste de la plateforme.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-8 relative">
        <BusinessRegistrationForm
          formData={formData}
          onChange={setFormData}
          categories={categories}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
          submitLabel="Soumettre ma demande"
        />
      </div>
    </div>
  );
}
