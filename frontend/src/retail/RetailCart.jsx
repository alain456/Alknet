import React, { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import retailService from './retailService';

const money = (n) => `${Number(n || 0).toLocaleString('fr-BI')} BIF`;

export default function RetailCart() {
  const [carts, setCarts] = useState([]);
  const [patient, setPatient] = useState({
    patient_name: '',
    patient_email: '',
    patient_phone: '',
    payer_phone: '',
  });
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [error, setError] = useState('');
  const load = () => retailService.getCart().then((r) => setCarts(Array.isArray(r) ? r : [r])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const change = async (item, quantity) => {
    try {
      await retailService.updateCartItem({ item_id: item.id, quantity });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const checkout = async (cart) => {
    const needsPrescription = cart.items.some((i) => i.product_detail?.prescription_required);
    if (needsPrescription && !prescriptionFile) {
      return setError('Joignez le fichier de l’ordonnance (image ou PDF).');
    }
    if (!patient.payer_phone.trim()) {
      return setError('Indiquez votre numéro BurundiPay pour le paiement.');
    }
    try {
      await retailService.checkout({
        pharmacy_id: cart.retail_business,
        ...patient,
        payment_method: 'BURUNDIPAY',
        prescription_file: prescriptionFile || undefined,
      });
      setPatient((p) => ({ ...p, payer_phone: '' }));
      setPrescriptionFile(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mon panier</h1>
        <p className="text-sm text-gray-500">Un panier par pharmacie de détail.</p>
      </div>
      {error && <div className="bg-red-50 text-red-700 rounded-xl p-3">{error}</div>}
      {carts.map((cart) => {
        const needsPrescription = cart.items.some((i) => i.product_detail?.prescription_required);
        return (
          <article key={cart.id} className="bg-white border rounded-xl p-5 space-y-4">
            <h2 className="font-bold">{cart.retail_business_name}</h2>
            {cart.items.map((i) => (
              <div key={i.id} className="border-t pt-3 flex justify-between">
                <span>
                  <b>{i.product_name_snapshot}</b>
                  <small className="block text-gray-500">{money(i.unit_price_snapshot)} × {i.quantity}</small>
                  {i.product_detail?.prescription_required && (
                    <small className="block text-amber-700 font-semibold">Ordonnance requise</small>
                  )}
                </span>
                <div>
                  <button type="button" onClick={() => change(i, i.quantity - 1)} className="border px-2 rounded">−</button>
                  <span className="px-3">{i.quantity}</span>
                  <button type="button" onClick={() => change(i, i.quantity + 1)} className="border px-2 rounded">+</button>
                </div>
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-2">
              {['patient_name', 'patient_email', 'patient_phone'].map((key) => (
                <input
                  key={key}
                  value={patient[key]}
                  onChange={(e) => setPatient({ ...patient, [key]: e.target.value })}
                  placeholder={key.replace('patient_', '')}
                  className="border rounded-lg p-2"
                />
              ))}
            </div>
            {needsPrescription && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Ordonnance (fichier)
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm"
                />
                {prescriptionFile && (
                  <div className="flex items-center justify-between gap-2 text-xs text-amber-900">
                    <span className="truncate font-medium">{prescriptionFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setPrescriptionFile(null)}
                      className="inline-flex items-center gap-1 text-amber-800 hover:underline"
                    >
                      <X className="w-3.5 h-3.5" /> Retirer
                    </button>
                  </div>
                )}
              </div>
            )}
            <BurundiPayPayerField
              value={patient.payer_phone}
              onChange={(v) => setPatient({ ...patient, payer_phone: v })}
              amountLabel={money(cart.total_amount)}
            />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{money(cart.total_amount)}</span>
            </div>
            <button
              type="button"
              disabled={!cart.items.length || cart.has_errors}
              onClick={() => checkout(cart)}
              className="bg-teal-700 text-white px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Envoyer la commande
            </button>
          </article>
        );
      })}
    </section>
  );
}
