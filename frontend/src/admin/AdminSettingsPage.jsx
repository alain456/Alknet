import React, { useState } from 'react';
import { Settings, Percent, Globe, Server, Save, AlertTriangle } from 'lucide-react';

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState({
    platformFee: '10',
    taxRate: '18',
    currency: 'USD',
    maintenanceMode: false,
    autoApproveBusinesses: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-10 w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Platform Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Configure global settings, fees, and system behaviors.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          
          {/* Financials */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Percent className="w-5 h-5 text-gray-400" />
              Financial Configurations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform Commission Fee (%)</label>
                <div className="relative">
                  <input 
                    type="number" step="0.1" name="platformFee"
                    value={formData.platformFee} onChange={handleChange}
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition"
                  />
                  <Percent className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Percentage taken from every successful transaction.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Default Tax Rate (TVA/VAT %)</label>
                <div className="relative">
                  <input 
                    type="number" step="0.1" name="taxRate"
                    value={formData.taxRate} onChange={handleChange}
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition"
                  />
                  <Percent className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Base Currency</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select 
                    name="currency"
                    value={formData.currency} onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition appearance-none"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="BIF">BIF - Burundian Franc</option>
                    <option value="RWF">RWF - Rwandan Franc</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* System Operations */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Server className="w-5 h-5 text-gray-400" />
              System Operations
            </h2>
            <div className="space-y-5">
              <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <div className="flex items-center h-5 mt-0.5">
                  <input 
                    type="checkbox" name="autoApproveBusinesses"
                    checked={formData.autoApproveBusinesses} onChange={handleChange}
                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-teal-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-200">Auto-Approve New Businesses</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">If checked, businesses will be active immediately upon registration without requiring admin review.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <div className="flex items-center h-5 mt-0.5">
                  <input 
                    type="checkbox" name="maintenanceMode"
                    checked={formData.maintenanceMode} onChange={handleChange}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-600 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                    Enable Maintenance Mode <AlertTriangle className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-red-600/80 dark:text-red-400/80">Take the platform offline for users and businesses. Only Super Admins can log in.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-gray-800">
            <button 
              type="submit" disabled={isSaving}
              className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Global Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
