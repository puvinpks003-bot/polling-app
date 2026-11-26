import React, { useState, useEffect } from 'react';
import { notificationApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Notification } from '../../types';
import { Card, Badge, Button, Skeleton } from '../../components/ui';
import { Bell, CheckCheck, Clock, ArrowRight } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.list();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: number) => {
    await notificationApi.markRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    loadNotifications();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-slate-400">System alerts, poll invitations, and voting announcements</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
            <CheckCheck className="w-4 h-4 text-blue-400" />
            <span>Mark All Read</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Bell className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No notifications yet</p>
          <p className="text-xs text-slate-500 mt-1">You are all caught up!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`p-4 transition-colors ${
                notif.is_read ? 'bg-slate-900/40 opacity-70' : 'bg-slate-900 border-blue-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{notif.title}</h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{notif.message}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3" />
                    {formatIndiaDateTime(notif.created_at, true)}
                  </p>
                </div>
                {!notif.is_read && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkRead(notif.id)}>
                    Mark Read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
