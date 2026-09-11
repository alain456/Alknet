import React, { useEffect, useState } from 'react';
import retailService, { PROFORMA_STATUS_LABELS } from './retailService';

export default function RetailProforma({ clientMode = false }) {
  const [items, setItems] = useState([]);
  useEffect(() => { retailService.getProformas().then((r) => setItems(r.results || r || [])).catch(() => {}); }, []);
  return <section className="space-y-5"><div><h1 className="text-2xl font-bold">Factures</h1><p className="text-sm text-gray-500">{clientMode ? 'Vos factures de commande.' : 'Factures des commandes patients.'}</p></div><div className="grid lg:grid-cols-2 gap-4">{items.map((p) => <article key={p.id} className="bg-white border rounded-xl p-5"><div className="flex justify-between"><div><b>{p.reference}</b><small className="block text-gray-500">{p.patient_name} · {p.retail_business_name}</small></div><span className="text-sm">{PROFORMA_STATUS_LABELS[p.status] || p.status}</span></div><div className="mt-4 border-t pt-3 flex justify-between font-bold"><span>Total</span><span>{Number(p.total).toLocaleString('fr-BI')} {p.currency}</span></div></article>)}</div></section>;
}
