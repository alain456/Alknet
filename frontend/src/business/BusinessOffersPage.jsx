import React, { useState, useEffect } from 'react';
import { Tag, Plus, Calendar, Megaphone } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';
import { useAuth } from '../context/AuthContext';

export default function BusinessOffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_percentage: '',
    valid_until: ''
  });
  const [submitError, setSubmitError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchOffers();
  }, [token]);

  const fetchOffers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/offers/my-business/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch offers');
      const data = await response.json();
      setOffers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/offers/my-business/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
      }
      setIsModalOpen(false);
      setFormData({ title: '', description: '', discount_percentage: '', valid_until: '' });
      fetchOffers();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const columns = [
    { 
      key: 'title', 
      label: 'Offer Title', 
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center border border-orange-100 dark:border-orange-800/30">
            <Megaphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{val}</div>
            <div className="text-xs text-gray-500 truncate max-w-xs">{row.description}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'discount_percentage', 
      label: 'Discount',
      render: (val) => (
        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md font-bold text-sm">
          -{val}%
        </span>
      )
    },
    { 
      key: 'valid_until', 
      label: 'Valid Until',
      render: (val) => {
        const date = new Date(val);
        const isValid = date > new Date();
        return (
          <span className={`flex items-center gap-1.5 text-sm ${isValid ? 'text-gray-600 dark:text-gray-300' : 'text-red-500'}`}>
            <Calendar className="w-4 h-4" />
            {date.toLocaleDateString()}
          </span>
        );
      }
    },
    { 
      key: 'is_active', 
      label: 'Status',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          val ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {val ? 'Active' : 'Ended'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            Promotional Offers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create and manage discounts and promotions.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-medium shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Offer
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <DataGrid 
          columns={columns}
          data={offers}
          loading={loading}
          error={error}
          searchPlaceholder="Search offers..."
          searchableKeys={['title', 'description']}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Offer</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateOffer} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Offer Title</label>
                <input 
                  type="text" required
                  value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Summer Special 20%"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount (%)</label>
                  <input 
                    type="number" min="1" max="100" required
                    value={formData.discount_percentage} onChange={(e) => setFormData({...formData, discount_percentage: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Until</label>
                  <input 
                    type="date" required
                    value={formData.valid_until} onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea 
                  rows="3" required
                  value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Details of the promotion..."
                ></textarea>
              </div>

              <div className="pt-4 flex items-center gap-3 justify-end">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-primary hover:bg-secondary text-white font-medium rounded-lg transition shadow-sm"
                >
                  Publish Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
