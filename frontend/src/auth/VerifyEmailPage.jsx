import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../shared/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'

  useEffect(() => {
    const uid = searchParams.get('uid');
    const token = searchParams.get('token');

    if (!uid || !token) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await api.post('accounts/verify-email/', { uid, token });
        if (!cancelled) setStatus('success');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams]);

  return (
    <div className="w-full text-center text-ink">
      {status === 'loading' && (
        <div className="py-12">
          <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink mb-2">Verifying your email...</h2>
          <p className="text-base text-ink-muted font-medium">Please wait while we confirm your account.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-8">
          <div className="w-20 h-20 bg-primary text-surface rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-accent">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-4">Email Verified!</h2>
          <p className="text-base text-ink-muted font-medium mb-8 max-w-sm mx-auto">
            Your account is now fully active. Welcome to the Isoko Hub community!
          </p>
          <Link
            to="/login"
            className="inline-block w-full bg-primary hover:opacity-95 text-surface font-bold text-base py-3 rounded-xl border-2 border-accent shadow-sm transition cursor-pointer"
          >
            Continue to Login
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="py-8">
          <div className="w-20 h-20 bg-alert text-surface rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-accent">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mb-4">Verification Failed</h2>
          <p className="text-base text-ink-muted font-medium mb-8 max-w-sm mx-auto">
            The verification link is invalid or has expired. Please request a new verification email.
          </p>
          <Link
            to="/login"
            className="inline-block w-full bg-surface border-2 border-accent hover:bg-primary/5 text-ink font-bold text-base py-3 rounded-xl shadow-sm transition cursor-pointer"
          >
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}
