import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PasswordStrength from '../shared/components/PasswordStrength';
import PasswordInput from '../shared/components/PasswordInput';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../shared/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!uid || !token) {
      setError('Lien de réinitialisation invalide. Demandez un nouveau lien.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('accounts/password-reset/confirm/', {
        uid,
        token,
        password,
      });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de réinitialiser le mot de passe.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full text-center text-ink">
        <div className="w-16 h-16 bg-primary text-surface rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-accent">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Password reset</h2>
        <p className="text-base text-ink-muted font-medium mb-8">
          Your password has been successfully reset. Click below to log in.
        </p>
        <Link
          to="/login"
          className="inline-block w-full bg-primary hover:opacity-95 text-surface font-bold text-base py-3 rounded-xl border-2 border-accent shadow-sm transition cursor-pointer"
        >
          Continue to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full text-ink">
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Set new password</h2>
        <p className="text-base text-ink-muted font-medium">
          Your new password must be different from previously used passwords.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-alert/10 border-2 border-alert rounded-xl p-3 text-sm sm:text-base text-ink font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">New Password</label>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium transition"
            placeholder="Create a strong password"
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Confirm Password</label>
          <PasswordInput
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium transition"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:opacity-95 text-surface font-bold text-base py-3 rounded-xl border-2 border-accent shadow-sm transition flex justify-center items-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-surface" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
