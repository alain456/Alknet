import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../shared/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('accounts/password-reset/', { email: email.trim() });
      setIsSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d\'envoyer le lien. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

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
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to log in
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Forgot password?</h2>
        <p className="text-base text-ink-muted font-medium">
          {isSent
            ? "We've sent a password reset link to your email."
            : "No worries, we'll send you reset instructions."}
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
            Check your inbox at <strong>{email}</strong> and click the link to reset your password.
          </div>
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="w-full bg-surface border-2 border-accent hover:bg-primary/5 text-ink font-bold text-base py-3 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-70"
          >
            Didn&apos;t receive the email? Click to resend
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium outline-none transition"
              placeholder="Enter your email"
            />
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
            ) : 'Reset password'}
          </button>
        </form>
      )}
    </div>
  );
}
