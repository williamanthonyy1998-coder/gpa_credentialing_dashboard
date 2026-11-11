import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardList,
  FileWarning,
  Info,
  X,
} from 'lucide-react';
import api from '../../api/client';
import { fmt } from '../../utils/format';

const DESKTOP_WIDTH = 400;
const VIEWPORT_GUTTER = 12;
const DROPDOWN_GAP = 6;
const MAX_PANEL_HEIGHT = 500;

function notificationIcon(type) {
  const key = String(type || '').toLowerCase();
  if (key.includes('warn') || key.includes('expir') || key.includes('alert')) return AlertTriangle;
  if (key.includes('task') || key.includes('assign')) return ClipboardList;
  if (key.includes('doc') || key.includes('missing') || key.includes('credential')) return FileWarning;
  if (key.includes('info')) return Info;
  return Bell;
}

function computePanelStyle(triggerEl) {
  if (!triggerEl || typeof window === 'undefined') {
    return {
      top: VIEWPORT_GUTTER,
      left: VIEWPORT_GUTTER,
      width: DESKTOP_WIDTH,
      maxHeight: MAX_PANEL_HEIGHT,
    };
  }

  const rect = triggerEl.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const isCompact = viewportW <= 500;
  const width = isCompact
    ? Math.max(0, viewportW - VIEWPORT_GUTTER * 2)
    : Math.min(DESKTOP_WIDTH, Math.max(360, viewportW - VIEWPORT_GUTTER * 2));

  let left = isCompact
    ? VIEWPORT_GUTTER
    : rect.right - width;
  left = Math.min(Math.max(VIEWPORT_GUTTER, left), viewportW - VIEWPORT_GUTTER - width);

  const top = Math.min(rect.bottom + DROPDOWN_GAP, viewportH - VIEWPORT_GUTTER);
  const maxHeight = Math.max(220, Math.min(MAX_PANEL_HEIGHT, viewportH - top - VIEWPORT_GUTTER));

  return { top, left, width, maxHeight };
}

export default function NotificationBell() {
  const nav = useNavigate();
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelStyle, setPanelStyle] = useState(() => ({
    top: VIEWPORT_GUTTER,
    left: VIEWPORT_GUTTER,
    width: DESKTOP_WIDTH,
    maxHeight: MAX_PANEL_HEIGHT,
  }));

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

  const updatePosition = useCallback(() => {
    setPanelStyle(computePanelStyle(triggerRef.current));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    function onReposition() {
      updatePosition();
    }
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
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

  const listMaxHeight = Math.max(140, panelStyle.maxHeight - 56);

  const dropdown = open
    ? createPortal(
      <div
        ref={dropdownRef}
        className="notify-dropdown"
        role="menu"
        aria-label="Notifications"
        style={{
          top: panelStyle.top,
          left: panelStyle.left,
          width: panelStyle.width,
          maxWidth: panelStyle.width,
          maxHeight: panelStyle.maxHeight,
        }}
      >
        <div className="notify-dropdown-head">
          <div className="notify-dropdown-title">
            <b>Notifications</b>
            {unread > 0 && <span className="notify-count-pill">{unread} unread</span>}
          </div>
          <div className="notify-dropdown-actions">
            <button
              type="button"
              className="text-link notify-mark-all"
              disabled={!unread}
              onClick={markAll}
            >
              <CheckCheck size={13} />
              Mark all as read
            </button>
            <button
              type="button"
              className="notify-close"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <ul className="notify-list" style={{ maxHeight: listMaxHeight }}>
          {loading && !items.length && (
            <li className="notify-empty">Loading…</li>
          )}
          {!loading && !items.length && (
            <li className="notify-empty">
              <span className="notify-empty-icon" aria-hidden="true">
                <Bell size={22} />
              </span>
              <strong>No notifications yet</strong>
              <span>You’re all caught up. New alerts will appear here.</span>
            </li>
          )}
          {items.map(n => {
            const Icon = notificationIcon(n.type || n.entityType);
            const unreadItem = !n.readAt;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notify-item${unreadItem ? ' unread' : ''}`}
                  onClick={() => openItem(n)}
                >
                  <span className={`notify-item-icon${unreadItem ? ' unread' : ''}`} aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className="notify-item-body">
                    <span className="notify-item-top">
                      <b className="notify-item-title">{n.title}</b>
                      {unreadItem && <span className="notify-unread-dot" aria-label="Unread" />}
                    </span>
                    {n.body && <span className="notify-item-desc">{n.body}</span>}
                    <small className="notify-item-time">{fmt(n.createdAt)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="notify-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button notify-trigger"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
      >
        <Bell size={17} />
        {unread > 0 && <span className="notify-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {dropdown}
    </div>
  );
}
