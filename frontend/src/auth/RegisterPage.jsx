import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SocialLogins from '../shared/components/SocialLogins';
import PasswordStrength from '../shared/components/PasswordStrength';
import PasswordInput from '../shared/components/PasswordInput';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'CUSTOMER'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const newUser = await register(formData);
      setIsLoading(false);

      if (newUser.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (newUser.role === 'BUSINESS_OWNER') {
        navigate('/business');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Registration failed. Please check your information.');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create an account</h2>
        <p className="text-gray-500 dark:text-gray-400">Join Isoko Hub today and explore endless possibilities.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">First Name</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white transition"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white transition"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white transition"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <PasswordInput
            required
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            autoComplete="new-password"
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-white transition"
            placeholder="Create a strong password"
          />
          <PasswordStrength password={formData.password} />
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
          ) : "Create Account"}
        </button>
      </form>

      <SocialLogins nextPath="/dashboard" />

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-secondary dark:text-teal-400 dark:hover:text-teal-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
