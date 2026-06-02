// bookings.types.ts — shared types, constants, static data, and pure helpers

// ─── Types ────────────────────────────────────────────────────────────────────
export type BookingStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Waiting';
export type ViewMode      = 'table' | 'kanban';
export type AlertLevel    = 10 | 30;
export type CustomerTag   = 'vip' | 'flagged' | 'regular';

export interface Booking {
  id:        string;
  bookingId?: string;
  date:      string;
  customer:  string;
  vehicle:   string;
  service:   string;
  status:    BookingStatus;
  amount:    string;
  timeSlot?: string;
  branch?:   string;
  email?:    string;
  phone?:    string;
  source?:   string; // 'manual' | 'website' | 'walkin' | 'rebook'
  bay?:      string;
  notes?:    string;
}

export interface CustomerNote {
  phone:     string;
  text:      string;
  createdAt: string;
  tag?:      CustomerTag;
}

export interface LateAlert {
  bookingId:     string;
  level:         AlertLevel;
  customer:      string;
  timeSlot:      string;
  service:       string;
  branch:        string;
  phone?:        string;
  smsSent:       boolean;
  dismissed:     boolean;
  autoCancelled: boolean;
}

export interface AdvancedFilters {
  dateFrom: string;
  dateTo:   string;
  category: string;
  source:   string;
  vehicle:  string;
  hasNotes: boolean;
}

export interface Toast {
  id:      string;
  message: string;
  type:    'info' | 'success' | 'warning' | 'error';
}

export interface ConfirmState {
  bookingId: string;
  status:    BookingStatus;
  label:     string;
  message:   string;
  btnClass:  string;
}

// ─── Static data ──────────────────────────────────────────────────────────────
export const BRANCHES = [
  { id: '1', name: 'Pannipitiya Branch', shortName: 'Pannipitiya', address: '278/2 High Level Rd, Pannipitiya',          phone: '077 578 5785',  hasFullService: true,  maxBookingsPerSlot: 3 },
  { id: '2', name: 'Ratnapura Branch',   shortName: 'Ratnapura',   address: '151 Colombo Rd, Ratnapura',                 phone: '076 688 5885',  hasFullService: false, maxBookingsPerSlot: 2 },
  { id: '3', name: 'Kalawana Branch',    shortName: 'Kalawana',    address: 'Rathnapura Road, Kalawana',                 phone: '0777 32 95 32', hasFullService: false, maxBookingsPerSlot: 2 },
  { id: '4', name: 'Nivithigala Branch', shortName: 'Nivithigala', address: 'Tiruwanaketiya-Agalawatte Rd, Nivithigala', phone: '045 227 9396',  hasFullService: false, maxBookingsPerSlot: 2 },
] as const;

export const SERVICE_CATEGORIES = [
  { id: 'Anura Tyres', label: 'Anura Tyres', description: 'Tyre fitting, balancing & alignment' },
  { id: 'Mechanix',    label: 'Mechanix',    description: 'Full mechanical services' },
  { id: 'Truck & Bus', label: 'Truck & Bus', description: 'Heavy vehicle services' },
] as const;

export const SERVICES = [
  { id: 't1', name: 'Wheel Alignment',        category: 'Anura Tyres', durationMin: 45  },
  { id: 't2', name: 'Wheel Balancing',         category: 'Anura Tyres', durationMin: 30  },
  { id: 't3', name: 'Tyre Change',             category: 'Anura Tyres', durationMin: 40  },
  { id: 't4', name: 'Tyre Repair (Puncture)',  category: 'Anura Tyres', durationMin: 20  },
  { id: 't5', name: 'Nitrogen Filling',        category: 'Anura Tyres', durationMin: 15  },
  { id: 'm1', name: 'Full Service',            category: 'Mechanix',    durationMin: 120 },
  { id: 'm2', name: 'Oil Change',              category: 'Mechanix',    durationMin: 45  },
  { id: 'm3', name: 'Battery Check & Replace', category: 'Mechanix',    durationMin: 30  },
  { id: 'm4', name: 'Brake Service',           category: 'Mechanix',    durationMin: 60  },
  { id: 'm5', name: 'AC Service',              category: 'Mechanix',    durationMin: 90  },
  { id: 'b1', name: 'Heavy Vehicle Alignment', category: 'Truck & Bus', durationMin: 60  },
  { id: 'b2', name: 'Truck Tyre Change',       category: 'Truck & Bus', durationMin: 60  },
  { id: 'b3', name: 'Bus Full Service',        category: 'Truck & Bus', durationMin: 180 },
] as const;

export const TIME_SLOTS = [
  '08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00',
  '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00','18:30','19:00',
] as const;

export const BAYS = ['Bay 1','Bay 2','Bay 3','Bay 4','Bay 5','Heavy Bay'] as const;

export const KANBAN_COLUMNS: BookingStatus[] = ['Pending','Waiting','In Progress','Completed','Cancelled'];

export const PLATE_FORMATS = [
  { label: 'Modern 3-Letter', example: 'WP CBA-1234' },
  { label: 'Modern 2-Letter', example: 'WP GA-1234'  },
  { label: 'Historical',      example: '19-1234'      },
  { label: 'Sri Series',      example: '15 ශ්‍රී 1234'  },
] as const;

export const STATUS_CONFIRM_CONFIG: Record<BookingStatus, { label: string; message: string; btnClass: string }> = {
  'In Progress': { label: 'Start',            message: 'Mark this booking as In Progress?',                btnClass: 'bg-blue-500 text-white hover:bg-blue-400'   },
  'Completed':   { label: 'Complete',          message: 'Mark this booking as Completed?',                  btnClass: 'bg-green-500 text-white hover:bg-green-400'  },
  'Cancelled':   { label: 'Cancel Booking',    message: 'Are you sure you want to cancel this booking?',    btnClass: 'bg-red-500 text-white hover:bg-red-400'      },
  'Waiting':     { label: 'Move to Waiting',   message: 'Move this booking to the Waiting queue?',          btnClass: 'bg-orange-500 text-black hover:bg-orange-400'},
  'Pending':     { label: 'Revert to Pending', message: 'Revert this booking back to Pending?',             btnClass: 'bg-yellow-500 text-black hover:bg-yellow-400'},
};

export const TAG_STYLE: Record<CustomerTag, string> = {
  vip:     'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  flagged: 'bg-red-500/20 border-red-500/40 text-red-400',
  regular: 'bg-green-500/20 border-green-500/40 text-green-400',
};
export const TAG_LABEL: Record<CustomerTag, string> = {
  vip: '⭐ VIP', flagged: '⚠️ Flagged', regular: '✓ Regular',
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: 'Staff', website: 'Website', walkin: 'Walk-in', rebook: 'Rebook',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
export function slotToDate(dateStr: string, timeSlot: string): Date | null {
  const [h, m] = timeSlot.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export function minutesLate(dateStr: string, timeSlot: string): number {
  const slot = slotToDate(dateStr, timeSlot);
  if (!slot) return -1;
  return Math.floor((Date.now() - slot.getTime()) / 60_000);
}

export function resolveBranchName(raw?: string): string {
  if (!raw) return 'N/A';
  const m = BRANCHES.find(b =>
    b.shortName.toLowerCase() === raw.toLowerCase() ||
    b.name.toLowerCase()      === raw.toLowerCase() ||
    raw.toLowerCase().includes(b.shortName.toLowerCase()),
  );
  return m ? m.shortName : raw;
}

export function exportToCSV(bookings: Booking[], filename = 'bookings') {
  const headers = ['Booking ID','Date','Time','Customer','Vehicle','Service','Branch','Status','Source','Bay','Phone','Email'];
  const rows    = bookings.map(b => [
    b.id, b.date, b.timeSlot || '', b.customer, b.vehicle || '',
    b.service, resolveBranchName(b.branch), b.status,
    b.source || '', b.bay || '', b.phone || '', b.email || '',
  ]);
  const esc  = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv  = [headers, ...rows].map(r => r.map(c => esc(c)).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url, download: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
  }).click();
  URL.revokeObjectURL(url);
}

// SL plate helpers
const SL_PLATE_PATTERNS: RegExp[] = [
  /^[A-Z]{2,3}\s[A-Z]{3}-\d{4}$/,
  /^[A-Z]{2,3}\s[A-Z]{2}-\d{4}$/,
  /^\d{2}-\d{4}$/,
  /^\d{1,2}\sශ්‍රී\s\d{4}$/,
];
export const validateSLPlate = (v: string) =>
  !v.trim() || SL_PLATE_PATTERNS.some(p => p.test(v.trim()));

export function formatPlate(raw: string): { formatted: string; maxLength: number } {
  if (/ශ/.test(raw)) return { formatted: raw, maxLength: 9 };
  const up      = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d/.test(up)) {
    const digits    = up.replace(/\D/g, '');
    const formatted = digits.length > 2 ? `${digits.slice(0,2)}-${digits.slice(2,6)}` : digits;
    return { formatted, maxLength: 7 };
  }
  const letters   = up.replace(/\d/g, '');
  const digits    = up.replace(/\D/g, '');
  const province  = letters.slice(0, 2);
  if (letters.length <= 2) {
    if (!digits.length) return { formatted: province, maxLength: 10 };
    return { formatted: `${province} ${letters.slice(2)}-${digits.slice(0,4)}`.replace(/\s$/, ''), maxLength: 10 };
  }
  const series    = letters.slice(2, 5);
  const is3Letter = letters.length >= 5 || (letters.length === 4 && digits.length > 0);
  if (!series.length) return { formatted: province, maxLength: 11 };
  const formatted = digits.length > 0
    ? `${province} ${series}-${digits.slice(0, 4)}`
    : `${province} ${series}`;
  return { formatted, maxLength: is3Letter ? 11 : 10 };
}