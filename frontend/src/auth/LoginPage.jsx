import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import SocialLogins from '../shared/components/SocialLogins';
import PasswordInput from '../shared/components/PasswordInput';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from;
  const infoMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email, password);
      setIsLoading(false);
      if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')) {
        navigate(returnTo);
        return;
      }
      navigate(getRedirectPath(loggedUser));
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Unable to sign in. Please check your credentials.');
    }
  };

  return (
    <div className="w-full text-ink">
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-2">Welcome back</h2>
        <p className="text-base text-ink-muted font-medium">Please enter your details to sign in.</p>
      </div>

      {infoMessage && (
        <div className="mb-6 p-4 bg-primary/10 border-2 border-accent rounded-xl text-sm sm:text-base text-ink font-medium">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-alert/10 border-2 border-alert rounded-xl text-sm sm:text-base text-ink font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            autoComplete="username"
            className="w-full px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium outline-none transition"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-sm sm:text-base font-bold text-ink mb-1.5">Password</label>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="px-4 py-3 border-2 border-accent rounded-xl focus:border-alert bg-surface text-ink text-base font-medium transition"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-2 border-accent text-primary focus:ring-accent" />
            <span className="ml-2 text-sm sm:text-base text-ink font-medium">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-sm sm:text-base font-bold text-accent hover:text-alert">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:opacity-95 text-surface font-bold text-base py-3 rounded-xl border-2 border-accent shadow-sm transition flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-surface" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : 'Sign in'}
        </button>
      </form>

      <SocialLogins nextPath={typeof returnTo === 'string' ? returnTo : undefined} />

      <p className="mt-8 text-center text-sm sm:text-base text-ink font-medium">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-extrabold text-primary hover:text-accent">
          Sign up
        </Link>
      </p>
    </div>
  );
}
