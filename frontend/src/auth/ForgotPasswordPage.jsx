import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1500);
  };

  return (
    <div className="w-full">
      <Link to="/login" className="inline-flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-teal-300 mb-6 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to log in
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Forgot password?</h2>
        <p className="text-gray-500 dark:text-gray-400">
          {isSent 
            ? "We've sent a password reset link to your email."
            : "No worries, we'll send you reset instructions."
          }
        </p>
      </div>

      {isSent ? (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-4 text-sm text-green-700 dark:text-green-400">
            Check your inbox at <strong>{email}</strong> and click the link to reset your password.
          </div>
          <button 
            onClick={() => setIsSent(false)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2.5 rounded-md shadow-sm transition cursor-pointer"
          >
            Didn't receive the email? Click to resend
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white transition"
              placeholder="Enter your email"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-secondary text-white font-semibold py-2.5 rounded-md shadow-sm transition flex justify-center items-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}
