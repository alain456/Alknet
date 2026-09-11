import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LumicashPayerField from '../shared/components/LumicashPayerField';
import OrderPaymentSuccess from '../shared/components/OrderPaymentSuccess';
import wholesaleService, { PROFORMA_STATUS_LABELS } from './wholesaleService';

const normalize = (d) => (Array.isArray(d) ? d : d?.results || []);
const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

export default function WholesaleCart() {
  const [carts, setCarts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clearCart, setClearCart] = useState(null);
  const [confirmCart, setConfirmCart] = useState(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [payerLumicash, setPayerLumicash] = useState('');
  const [success, setSuccess] = useState(null);

  const load = async () => {
    const d = await wholesaleService.getCart();
    setCarts(normalize(d));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const activeCarts = carts.filter((c) => (c.items || []).length > 0);

  const updateQty = async (itemId, quantity) => {
    setError('');
    try {
      await wholesaleService.updateCartItem({ item_id: itemId, quantity: Number(quantity) });
      await load();
    } catch (e) {
      setError(e.message || 'Impossible de modifier la quantité');
    }
  };

  const removeLine = async (itemId) => {
    setError('');
    try {
      await wholesaleService.removeCartItem({ item_id: itemId });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const doClear = async () => {
    if (!clearCart) return;
    setBusy(true);
    setError('');
    try {
      await wholesaleService.clearCart({ wholesale_id: clearCart.wholesale_business });
      setClearCart(null);
      await load();
    } catch (e) {
      setError(e.message || 'Échec vidage panier');
    } finally {
      setBusy(false);
    }
  };

  const sendOrder = async () => {
    if (!confirmCart || !confirmChecked) return;
    if (!payerLumicash.trim()) {
      setError('Indiquez votre numéro Lumicash pour le paiement.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await wholesaleService.checkout({
        wholesale_id: confirmCart.wholesale_business,
        notification_email: confirmCart._email || undefined,
        payment_method: 'LUMICASH',
        payer_phone: payerLumicash.trim(),
        confirmed: true,
      });
      setConfirmCart(null);
      setConfirmChecked(false);
      setPayerLumicash('');
      setSuccess(order);
      await load();
    } catch (e) {
      setError(e.message || 'Échec envoi commande');
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <OrderPaymentSuccess
        order={success}
        onOrderUpdate={setSuccess}
        onDone={() => setSuccess(null)}
        confirmPayment={(id) => wholesaleService.confirmOrderPayment(id)}
        retryPayment={(id, phone) => wholesaleService.payOrder(id, phone)}
        doneLabel="Continuer"
        paidHint="Paiement validé. Le grossiste pourra accepter votre commande."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panier</h1>
          <p className="text-sm text-slate-500">Sélection temporaire — facture proforma en brouillon</p>
        </div>
        <Link to="/wholesale-pharmacy/client/catalog" className="text-sm text-primary font-semibold hover:underline">
          Catalogue
        </Link>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      {activeCarts.length === 0 && (
        <div className="bg-white border rounded-2xl p-10 text-center space-y-3">
          <p className="text-slate-500">Votre panier est vide.</p>
          <p className="text-2xl font-bold">0 BIF</p>
          <Link
            to="/wholesale-pharmacy/client/catalog"
            className="inline-block px-4 py-2 bg-primary text-white rounded-xl font-semibold"
          >
            Retourner au catalogue
          </Link>
        </div>
      )}

      {activeCarts.map((cart) => {
        const pf = cart.proforma;
        const hasErrors = cart.has_errors;
        return (
          <div key={cart.id} className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white border rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Pharmacie de gros</div>
                  <h2 className="font-bold text-lg">{cart.wholesale_business_name}</h2>
                  <div className="text-sm text-slate-500">Client : {cart.client_business_name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setClearCart(cart)}
                  className="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
                >
                  Vider le panier
                </button>
              </div>

              {(cart.items || []).map((item) => {
                const p = item.product_detail || {};
                const name = item.product_name_snapshot || p.name;
                const pack = item.packaging_snapshot || p.packaging;
                const price = item.unit_price_snapshot ?? p.wholesale_price;
                return (
                  <div key={item.id} className="border-b pb-4 space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-semibold">{name}</div>
                        <div className="text-xs text-slate-500">
                          {p.active_ingredient && <>DCI : {p.active_ingredient} · </>}
                          {pack}
                          {p.stock_status === 'OUT_OF_STOCK' || item.validation_error ? (
                            <span className="text-red-600 ml-2">{item.validation_error || 'Indisponible'}</span>
                          ) : (
                            <span className="text-emerald-700 ml-2">{p.availability || 'Disponible'}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(item.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <span className="text-slate-500">Qté</span>
                        <input
                          type="number"
                          min={1}
                          className="w-20 border rounded-lg px-2 py-1"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.id, e.target.value)}
                        />
                      </label>
                      <span className="text-slate-500">{money(price)} / conditionnement</span>
                      <span className="ml-auto font-semibold">{money(item.line_total)}</span>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  to="/wholesale-pharmacy/client/proforma"
                  className="px-4 py-2 border rounded-xl text-sm font-semibold"
                >
                  Voir la facture
                </Link>
                <button
                  type="button"
                  disabled={hasErrors || !(cart.items || []).length}
                  onClick={() => {
                    setPayerLumicash('');
                    setConfirmCart({ ...cart, _email: '' });
                    setConfirmChecked(false);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  Envoyer la commande
                </button>
              </div>
              {hasErrors && (
                <p className="text-sm text-red-600">Corrigez les erreurs du panier avant l&apos;envoi.</p>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white border rounded-2xl p-5 sticky top-4">
                <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Facture proforma</div>
                <div className="flex justify-between items-baseline mb-3">
                  <h3 className="font-bold">Facture</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                    {PROFORMA_STATUS_LABELS[pf?.status] || 'Brouillon'}
                  </span>
                </div>
                <dl className="text-sm space-y-1 mb-4">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Grossiste</dt>
                    <dd className="text-right font-medium">{cart.wholesale_business_name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Client</dt>
                    <dd className="text-right font-medium">{cart.client_business_name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Date</dt>
                    <dd>{pf?.generated_at ? new Date(pf.generated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</dd>
                  </div>
                </dl>
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-1">Produit</th>
                      <th className="py-1 text-right">Qté</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pf?.lines_snapshot || cart.items || []).map((line, idx) => (
                      <tr key={idx} className="border-b border-slate-50">
                        <td className="py-1.5 pr-1">{line.product_name || line.product_name_snapshot || line.product_detail?.name}</td>
                        <td className="py-1.5 text-right">{line.quantity}</td>
                        <td className="py-1.5 text-right font-medium">{money(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between text-sm pt-2">
                  <span>Sous-total</span>
                  <span>{money(cart.subtotal || cart.total_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span>{money(cart.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {clearCart && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">Vider le panier ?</h3>
            <p className="text-sm text-slate-600">
              Tous les produits sélectionnés chez <strong>{clearCart.wholesale_business_name}</strong> seront
              supprimés. Le total repassera à 0 BIF.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClearCart(null)} className="px-4 py-2 border rounded-xl">
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={doClear}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold"
              >
                Vider le panier
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCart && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="font-bold text-lg">Confirmer l&apos;envoi de la commande</h3>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-slate-500">Pharmacie de détail</dt><dd className="font-medium">{confirmCart.client_business_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Pharmacie de gros</dt><dd className="font-medium">{confirmCart.wholesale_business_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-bold">{money(confirmCart.total_amount)}</dd></div>
            </dl>
            <ul className="text-sm border rounded-xl divide-y max-h-48 overflow-y-auto">
              {(confirmCart.items || []).map((i) => (
                <li key={i.id} className="px-3 py-2 flex justify-between gap-2">
                  <span>
                    {i.product_name_snapshot || i.product_detail?.name} × {i.quantity}
                    <span className="block text-xs text-slate-400">{i.packaging_snapshot || i.product_detail?.packaging}</span>
                  </span>
                  <span className="font-medium">{money(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <label className="text-sm block space-y-1">
              <span className="text-slate-500">Email professionnel de réception</span>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="email@pharmacie.bi"
                value={confirmCart._email || ''}
                onChange={(e) => setConfirmCart({ ...confirmCart, _email: e.target.value })}
              />
            </label>
            <LumicashPayerField
              value={payerLumicash}
              onChange={setPayerLumicash}
              amountLabel={money(confirmCart.total_amount)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
              />
              <span>J&apos;ai vérifié les produits, les quantités et le montant total.</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmCart(null)} className="px-4 py-2 border rounded-xl">
                Annuler
              </button>
              <button
                type="button"
                disabled={!confirmChecked || busy}
                onClick={sendOrder}
                className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {busy ? 'Envoi…' : 'Confirmer et envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
