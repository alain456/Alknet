import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '../shared/api';

export default function ForgotPasswordPage() {
  const form = useForm({ defaultValues: { email: '' } });
  const email = form.watch('email');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = form.handleSubmit(async ({ email: value }) => {
    setError('');
    setIsLoading(true);
    try {
      await api.post('accounts/password-reset/', { email: value.trim() });
      setIsSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d\'envoyer le lien. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  });

  const handleResend = async () => {
    setError('');
    setIsLoading(true);
    try {
      await api.post('accounts/password-reset/', { email: email.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de renvoyer le lien.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full text-ink">
      <Link to="/login" className="inline-flex items-center text-sm sm:text-base font-bold text-ink-muted hover:text-primary mb-6 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la connexion
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Mot de passe oublié ?</h2>
        <p className="text-base text-ink-muted font-medium">
          {isSent
            ? 'Un lien de réinitialisation a été envoyé à votre e-mail.'
            : 'Indiquez votre e-mail. Nous vous envoyons les instructions.'}
        </p>
      </div>

      {error && (
        <div className="bg-alert/10 border-2 border-alert rounded-xl p-3 text-sm sm:text-base text-ink font-medium mb-4">
          {error}
        </div>
      )}

      {isSent ? (
        <div className="space-y-6">
          <div className="bg-primary/10 border-2 border-accent rounded-xl p-4 text-sm sm:text-base text-ink font-medium">
            Ouvrez la boîte de <strong>{email}</strong> et suivez le lien pour choisir un nouveau mot de passe.
          </div>
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="w-full bg-surface border-2 border-accent hover:bg-primary/5 text-ink font-bold text-base py-3 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-70"
          >
            Rien reçu ? Renvoyer le lien
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">
              E-mail
              <input
                type="email"
                className="mt-1.5 w-full px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium outline-none transition"
                placeholder="vous@exemple.com"
                {...form.register('email', { required: true })}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:opacity-95 text-surface font-bold text-base py-3 rounded-xl border-2 border-accent shadow-sm transition flex justify-center items-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-surface" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </div>
  );
}
