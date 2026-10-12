import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'isoko_hub_consent';

export default function ConsentBanner() {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });

  if (!open) return null;

  const choose = (value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] max-w-3xl mx-auto bg-white border border-[#D5E0F0] shadow-lg rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-sm text-[#0D2347] flex-1">
        Isoko Hub utilise les données de compte pour fournir le service.
        Consultez la{' '}
        <Link to="/pages/privacy" className="font-semibold text-[#1B4F9C] underline">politique de confidentialité</Link>
        {' '}et les{' '}
        <Link to="/pages/terms" className="font-semibold text-[#1B4F9C] underline">conditions</Link>.
      </p>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={() => choose('essential')} className="px-3 py-2 rounded-xl border border-[#1B4F9C] text-[#1B4F9C] text-sm font-semibold">
          Essentiel
        </button>
        <button type="button" onClick={() => choose('all')} className="px-3 py-2 rounded-xl bg-[#1B4F9C] text-white text-sm font-semibold">
          Accepter
        </button>
      </div>
    </div>
  );
}
