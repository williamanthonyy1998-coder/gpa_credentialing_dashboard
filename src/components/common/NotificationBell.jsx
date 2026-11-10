import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../../api/client';
import { fmt } from '../../utils/format';

export default function NotificationBell() {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setItems(r.data?.data || []);
      setUnread(r.data?.unread ?? 0);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function markRead(n, e) {
    e?.stopPropagation();
    if (n.readAt) return;
    try {
      await api.post(`/notifications/${n.id}/read`);
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread(u => Math.max(0, u - 1));
    } catch { /* ignore */ }
  }

  async function markAll(e) {
    e?.stopPropagation();
    if (!unread) return;
    try {
      await api.post('/notifications/read-all');
      setItems(prev => prev.map(x => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  function openItem(n) {
    if (!n.readAt) markRead(n);
    if (n.href) {
      nav(n.href);
      setOpen(false);
    }
  }

  return (
    <div className="notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-button notify-trigger"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Bell size={17} />
        {unread > 0 && <span className="notify-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notify-dropdown" role="menu">
          <div className="notify-dropdown-head">
            <b>Notifications</b>
            <button type="button" className="text-link notify-mark-all" disabled={!unread} onClick={markAll}>
              <CheckCheck size={12} /> Mark all read
            </button>
          </div>
          <ul className="notify-list">
            {loading && !items.length && (
              <li className="notify-empty">Loading…</li>
            )}
            {!loading && !items.length && (
              <li className="notify-empty">No notifications yet.</li>
            )}
            {items.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notify-item${n.readAt ? '' : ' unread'}`}
                  onClick={() => openItem(n)}
                >
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                  <small>{fmt(n.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
