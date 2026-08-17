import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'

  useEffect(() => {
    // Simulate API call to verify token
    const token = searchParams.get('token');
    
    setTimeout(() => {
      if (token) {
        setStatus('success');
      } else {
        setStatus('error'); // Error state if no token provided for demo purposes
      }
    }, 2000);
  }, [searchParams]);

  return (
    <div className="w-full text-center">
      {status === 'loading' && (
        <div className="py-12">
          <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying your email...</h2>
          <p className="text-gray-500 dark:text-gray-400">Please wait while we confirm your account.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-8 animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Email Verified!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            Your account is now fully active. Welcome to the Isoko Hub community!
          </p>
          <Link to="/login" className="inline-block w-full bg-primary hover:bg-secondary text-white font-semibold py-2.5 rounded-md shadow-sm transition cursor-pointer">
            Continue to Login
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="py-8">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Verification Failed</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            The verification link is invalid or has expired. Please request a new verification email.
          </p>
          <Link to="/login" className="inline-block w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2.5 rounded-md shadow-sm transition cursor-pointer">
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}
