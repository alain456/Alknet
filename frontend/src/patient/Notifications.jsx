import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, FlaskConical, Calendar, FileText, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/notifications/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/hospital/notifications/${notificationId}/mark_as_read/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/hospital/notifications/mark_all_as_read/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
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
      default:
        return 'Information';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
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

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString('fr-FR');
  };

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="text-teal-600" />
            Notifications
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1 text-teal-600 font-medium">
                {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-sm font-medium text-gray-600">Filtrer:</span>
          {['ALL', 'UNREAD', 'LAB_RESULT', 'APPOINTMENT_REMINDER', 'PRESCRIPTION_READY', 'INVOICE_PAYMENT'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filterType === type
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'ALL' ? 'Toutes' : 
               type === 'UNREAD' ? 'Non lues' :
               getNotificationTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des notifications */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune notification</p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
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
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition"
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
