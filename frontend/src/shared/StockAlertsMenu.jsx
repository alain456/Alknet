import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from './api';

export default function StockAlertsMenu({ inventoryPath }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('businesses/me/stock-alerts/', { auth: true });
      setUnread(Number(data?.unread_count || 0));
      setItems(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setUnread(0);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const markAll = async () => {
    try {
      await api.post('businesses/me/stock-alerts/', { all: true }, { auth: true });
    } catch {
      /* le prochain rafraîchissement réaffiche le compteur */
    }
    setUnread(0);
    setItems((rows) => rows.map((row) => ({ ...row, is_read: true })));
  };

  const openInventory = async (id) => {
    try {
      await api.post('businesses/me/stock-alerts/', { ids: [id] }, { auth: true });
    } catch {
      /* la navigation reste prioritaire */
    }
    setOpen(false);
    navigate(inventoryPath);
    refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative p-2 text-ink rounded-xl hover:bg-surface"
        title={unread > 0 ? `${unread} alerte(s) de stock` : 'Alertes de stock'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-accent text-ink text-[9px] font-extrabold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-ink">Stock</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-semibold text-primary">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-ink-muted py-3">Aucune alerte de stock.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openInventory(item.id)}
                    className="w-full text-left rounded-xl px-2 py-2 hover:bg-surface"
                  >
                    <p className={`text-sm text-ink ${item.is_read ? 'font-medium' : 'font-semibold'}`}>
                      {(item.level === 'OUT' && 'Rupture')
                        || (item.level === 'EXPIRED' && 'Périmé')
                        || (item.level === 'EXPIRING' && 'Péremption proche')
                        || 'Stock faible'} · {item.product_name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {item.quantity} restant{item.quantity > 1 ? 's' : ''} · seuil {item.threshold}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
