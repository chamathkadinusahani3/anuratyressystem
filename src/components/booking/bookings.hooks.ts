// bookings.hooks.ts — all custom hooks

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Booking, CustomerNote, LateAlert, AlertLevel, Toast, BookingStatus } from './bookings.types';
import { minutesLate, resolveBranchName } from './bookings.types';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://anuratyres-backend-emm1774.vercel.app/api'
).replace(/\/$/, '');

// ─── Toast ────────────────────────────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, push };
}

// ─── Online status + auto-refresh ────────────────────────────────────────────
export function useAutoRefresh(silentFetchFn: () => Promise<void>, intervalMs = 30_000) {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [online, setOnline]           = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    await silentFetchFn();
    setLastRefresh(new Date());
  }, [silentFetchFn]);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { lastRefresh, online };
}

// ─── Customer notes (localStorage) ───────────────────────────────────────────
export function useCustomerNotes() {
  const [notes, setNotes] = useState<CustomerNote[]>(() => {
    try { return JSON.parse(localStorage.getItem('atCustomerNotes') || '[]'); }
    catch { return []; }
  });

  const save = (updated: CustomerNote[]) => {
    setNotes(updated);
    localStorage.setItem('atCustomerNotes', JSON.stringify(updated));
  };

  const getNote  = (phone: string) => notes.find(n => n.phone === phone);
  const upsert   = (phone: string, text: string, tag?: CustomerNote['tag']) =>
    save([...notes.filter(n => n.phone !== phone), { phone, text, tag, createdAt: new Date().toISOString() }]);

  return { getNote, upsert, notes };
}

// ─── Late alert engine ────────────────────────────────────────────────────────
export function useLateAlerts(
  bookings: Booking[],
  onAutoCancel: (bookingId: string) => void,
  userRole: string,
  userBranch: string,
) {
  const [alerts, setAlerts] = useState<LateAlert[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  const runCheck = useCallback(async () => {
    const todayStr  = new Date().toISOString().split('T')[0];
    const candidates = bookings.filter(
      b => b.status === 'Pending' && b.date === todayStr && b.timeSlot,
    );

    for (const booking of candidates) {
      const late = minutesLate(booking.date, booking.timeSlot!);
      if (late < 10) continue;

      const levels: AlertLevel[] = late >= 30 ? [10, 30] : [10];

      for (const level of levels) {
        const key = `${booking.id}-${level}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);

        let smsSent = false, autoCancelled = false;
        try {
          const res  = await fetch(`${API_URL}/bookings`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole, 'X-User-Branch': userBranch },
            body:    JSON.stringify({ action: 'late-alert', bookingId: booking.id, minutesLate: level }),
          });
          const data = await res.json();
          smsSent       = data.smsSent      ?? false;
          autoCancelled = data.autoCancelled ?? false;
        } catch (e) { console.error('[late-alert]', e); }

        setAlerts(p => [...p, {
          bookingId:     booking.id,
          level,
          customer:      booking.customer,
          timeSlot:      booking.timeSlot!,
          service:       booking.service,
          branch:        resolveBranchName(booking.branch),
          phone:         booking.phone,
          smsSent,
          dismissed:     false,
          autoCancelled,
        }]);

        if (autoCancelled) onAutoCancel(booking.id);
      }
    }
  }, [bookings, userRole, userBranch, onAutoCancel]);

  useEffect(() => {
    runCheck();
    const id = setInterval(runCheck, 60_000);
    return () => clearInterval(id);
  }, [runCheck]);

  const dismissAlert = (bookingId: string, level: AlertLevel) =>
    setAlerts(p => p.map(a =>
      a.bookingId === bookingId && a.level === level ? { ...a, dismissed: true } : a,
    ));

  return { visibleAlerts: alerts.filter(a => !a.dismissed), dismissAlert };
}

// ─── Bulk selection ───────────────────────────────────────────────────────────
export function useBulkSelect(filteredIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle        = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll     = () =>
    setSelectedIds(selectedIds.size === filteredIds.length
      ? new Set()
      : new Set(filteredIds),
    );
  const clear         = () => setSelectedIds(new Set());
  const allSelected   = filteredIds.length > 0 && selectedIds.size === filteredIds.length;
  const someSelected  = selectedIds.size > 0 && selectedIds.size < filteredIds.length;

  return { selectedIds, toggle, toggleAll, clear, allSelected, someSelected };
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
interface ShortcutHandlers {
  onNew:      () => void;
  onTimeline: () => void;
  onToggleView: () => void;
  onRefresh:  () => void;
  onFocusSearch: () => void;
  onPalette:  () => void;
  onExport:   () => void;
  onShortcuts: () => void;
  onEscape:   () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        if (e.key === 'k') { e.preventDefault(); handlers.onPalette(); }
        if (e.key === 'f') { e.preventDefault(); handlers.onFocusSearch(); }
        if (e.key === 'e') { e.preventDefault(); handlers.onExport(); }
        return;
      }
      if (e.key === 'n' || e.key === 'N') handlers.onNew();
      if (e.key === 't' || e.key === 'T') handlers.onTimeline();
      if (e.key === 'k' || e.key === 'K') handlers.onToggleView();
      if (e.key === 'r' || e.key === 'R') handlers.onRefresh();
      if (e.key === '?')                   handlers.onShortcuts();
      if (e.key === 'Escape')              handlers.onEscape();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handlers]);
}