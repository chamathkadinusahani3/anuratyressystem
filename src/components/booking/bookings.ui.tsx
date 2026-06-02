// bookings.ui.tsx — small reusable UI pieces used across multiple components

import React, { useEffect, useReducer } from 'react';
import {
  CheckSquare, Square, X, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import type { BookingStatus, Toast } from './bookings.types';
import { slotToDate } from './bookings.types';

// ─── Status badge ─────────────────────────────────────────────────────────────
export function statusBadge(status: BookingStatus) {
  const map: Record<BookingStatus, string> = {
    'Pending':     'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'In Progress': 'bg-blue-500/20   text-blue-400   border border-blue-500/30',
    'Completed':   'bg-green-500/20  text-green-400  border border-green-500/30',
    'Cancelled':   'bg-red-500/20    text-red-400    border border-red-500/30',
    'Waiting':     'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Countdown / overtime timer ───────────────────────────────────────────────
export function CountdownTimer({ dateStr, timeSlot }: { dateStr: string; timeSlot: string }) {
  const [, tick] = useReducer(n => n + 1, 0);
  useEffect(() => { const id = setInterval(() => tick(), 1000); return () => clearInterval(id); }, []);

  const slot = slotToDate(dateStr, timeSlot);
  if (!slot) return null;

  const diffMs  = Date.now() - slot.getTime();
  const isOver  = diffMs >= 0;
  const absMins = Math.abs(diffMs) / 60_000;
  const h = Math.floor(absMins / 60), m = Math.floor(absMins % 60), s = Math.floor((absMins * 60) % 60);
  const fmt = `${h ? `${h}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;

  const color = isOver
    ? 'bg-red-500/15 border-red-500/30 text-red-400'
    : absMins <= 30
      ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
      : 'bg-green-500/15 border-green-500/30 text-green-400';
  const dot = isOver ? 'bg-red-400 animate-pulse' : absMins <= 30 ? 'bg-orange-400' : 'bg-green-500';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono whitespace-nowrap ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {isOver ? `+${fmt} OT` : fmt}
    </span>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({
  title, message,
  confirmLabel = 'Confirm',
  confirmClass  = 'bg-[#FFD700] text-black',
  onConfirm, onCancel,
}: {
  title: string; message: string;
  confirmLabel?: string; confirmClass?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-3">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast container ──────────────────────────────────────────────────────────
export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const colors: Record<Toast['type'], string> = {
    info:    'bg-neutral-800 border-neutral-700 text-neutral-200',
    success: 'bg-green-500/20 border-green-500/40 text-green-300',
    warning: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    error:   'bg-red-500/20 border-red-500/40 text-red-300',
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2 duration-200 ${colors[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Online badge ─────────────────────────────────────────────────────────────
export function OnlineBadge({ online, lastRefresh }: { online: boolean; lastRefresh: Date }) {
  const [, tick] = useReducer(n => n + 1, 0);
  useEffect(() => { const id = setInterval(() => tick(), 10_000); return () => clearInterval(id); }, []);
  const secs  = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
  const label = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${online ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {online ? `Live · ${label}` : 'Offline'}
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────
export function BulkActionBar({
  selectedIds, onClear, onBulkStatus, loading,
}: {
  selectedIds: Set<string>;
  onClear: () => void;
  onBulkStatus: (s: BookingStatus) => void;
  loading: boolean;
}) {
  if (selectedIds.size === 0) return null;

  const actions: { status: BookingStatus; label: string; color: string }[] = [
    { status: 'In Progress', label: 'Start',    color: 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30' },
    { status: 'Completed',   label: 'Complete', color: 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30' },
    { status: 'Waiting',     label: 'Waiting',  color: 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30' },
    { status: 'Cancelled',   label: 'Cancel',   color: 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-xl animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 flex-shrink-0">
        <CheckSquare className="w-4 h-4 text-[#FFD700]" />
        <span className="text-sm font-bold text-[#FFD700]">{selectedIds.size} selected</span>
      </div>
      <div className="h-4 w-px bg-neutral-700 flex-shrink-0" />
      <div className="flex flex-wrap gap-2 flex-1">
        {actions.map(a => (
          <button key={a.status} onClick={() => onBulkStatus(a.status)} disabled={loading}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${a.color}`}>
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : a.label}
          </button>
        ))}
      </div>
      <button onClick={onClear}
        className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Row checkbox ─────────────────────────────────────────────────────────────
export function RowCheckbox({
  checked, indeterminate = false, onChange,
}: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }}
      className="text-neutral-500 hover:text-[#FFD700] transition-colors">
      {checked || indeterminate
        ? <CheckSquare className={`w-4 h-4 ${checked ? 'text-[#FFD700]' : 'text-neutral-500'}`} />
        : <Square className="w-4 h-4" />}
    </button>
  );
}