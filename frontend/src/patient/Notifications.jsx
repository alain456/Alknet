import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, FlaskConical, Calendar, FileText, AlertCircle } from 'lucide-react';
import api from '../shared/api';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

function historyPathFromMessage(message) {
  const m = String(message || '').match(/(\/hotels\/[^/\s]+\/historique)/);
  return m ? m[1] : null;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setError('');
    try {
      const data = await api.get('hospital/notifications/', { auth: true });
      const list = normalizeList(data);
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch (err) {
      setError(err?.message || 'Impossible de charger les notifications');
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.post(`hospital/notifications/${notificationId}/mark_as_read/`, {}, { auth: true });
      await fetchNotifications();
    } catch (err) {
      setError(err?.message || 'Impossible de marquer comme lu');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('hospital/notifications/mark_all_as_read/', {}, { auth: true });
      await fetchNotifications();
    } catch (err) {
      setError(err?.message || 'Impossible de tout marquer comme lu');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'LAB_RESULT':
        return <FlaskConical className="w-5 h-5 text-teal-600" />;
      case 'APPOINTMENT_REMINDER':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'PRESCRIPTION_READY':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'INVOICE_PAYMENT':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'LAB_RESULT':
        return 'Résultat de laboratoire';
      case 'APPOINTMENT_REMINDER':
        return 'Rappel de rendez-vous';
      case 'PRESCRIPTION_READY':
        return 'Prescription prête';
      case 'INVOICE_PAYMENT':
        return 'Facture à payer';
      case 'GENERAL':
        return 'Information';
      default:
        return 'Information';
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'UNREAD') return !notif.is_read;
    return notif.notification_type === filterType;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString('fr-FR');
  };

  if (loading) return <div className="p-8 text-sm text-gray-500">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="text-teal-600" />
            Notifications
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-teal-600 font-medium">
                {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span>Toutes vos alertes sont à jour.</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-sm font-medium text-gray-600">Filtrer:</span>
          {['ALL', 'UNREAD', 'LAB_RESULT', 'APPOINTMENT_REMINDER', 'PRESCRIPTION_READY', 'INVOICE_PAYMENT', 'GENERAL'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filterType === type
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'ALL' ? 'Toutes'
                : type === 'UNREAD' ? 'Non lues'
                  : getNotificationTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune notification</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 transition ${
                notification.is_read ? 'border-gray-200 opacity-75' : 'border-teal-200 border-l-4'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  notification.is_read ? 'bg-gray-100' : 'bg-teal-100'
                }`}>
                  {getNotificationIcon(notification.notification_type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className={`font-semibold ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      {historyPathFromMessage(notification.message) && (
                        <Link
                          to={historyPathFromMessage(notification.message)}
                          className="inline-block mt-2 text-xs font-bold text-primary hover:underline"
                          onClick={() => {
                            if (!notification.is_read) handleMarkAsRead(notification.id);
                          }}
                        >
                          Ouvrir mon historique hôtel →
                        </Link>
                      )}
                      {notification.lab_result_summary && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                          <span className="font-medium">Examen:</span> {notification.lab_result_summary.test_name}
                          <span className="mx-2">•</span>
                          <span className="font-medium">Date:</span> {notification.lab_result_summary.test_date}
                        </div>
                      )}
                    </div>
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="icon-btn"
                        title="Marquer comme lu"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{formatDate(notification.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      notification.is_read ? 'bg-gray-100 text-gray-600' : 'bg-teal-100 text-teal-700'
                    }`}>
                      {getNotificationTypeLabel(notification.notification_type)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
