import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  Building2, Shield, FileText, Settings, Bell, Database,
  Wrench, Calendar, Plus, X, Edit2, Trash2, Check,
  Download, Upload, RefreshCw, Search, AlertTriangle,
  Clock, User, ChevronDown, ChevronUp, Eye, EyeOff,
  Copy, CheckCircle, MapPin, Phone, Globe, Hash,
  DollarSign, ToggleLeft, ToggleRight, Package, Key,
  Loader2, Save, RotateCcw, Filter,
} from 'lucide-react';
import {
  collection, getDocs, doc, setDoc, addDoc, deleteDoc,
  updateDoc, query, orderBy, limit, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { getSessionUser } from '../lib/auth';

// ── API ────────────────────────────────────────────────────────────────────────
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
async function apiFetch(path: string, opts?: RequestInit) {
  const res  = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Firestore collections ─────────────────────────────────────────────────────
const COL = {
  branches:  'at_branches',
  audit:     'at_audit_logs',
  templates: 'at_notif_templates',
  sysconfig: 'at_system_config',
  perms:     'at_permissions',
  holidays:  'at_holidays',
};

// ── Audit helper (called by every section on significant events) ────────────
async function writeAudit(user: string, action: string, module: string, description: string) {
  try {
    await addDoc(collection(db, COL.audit), {
      user, action, module, description,
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Branch {
  id?:          string;
  name:         string;
  address:      string;
  phone:        string;
  email:        string;
  openTime:     string;
  closeTime:    string;
  workDays:     string[];
  manager:      string;
  taxRate:      number;
  currency:     string;
  active:       boolean;
}

interface AuditEntry {
  id?:         string;
  user:        string;
  action:      string;
  module:      string;
  description: string;
  timestamp:   string;
}

interface NotifTemplate {
  id?:      string;
  key:      string;
  label:    string;
  channel:  'sms' | 'email' | 'both';
  subject?: string;
  body:     string;
  enabled:  boolean;
}

interface SysConfig {
  appName:          string;
  timezone:         string;
  dateFormat:       string;
  currency:         string;
  invoicePrefix:    string;
  invoiceNextNum:   number;
  defaultTaxRate:   number;
  logoUrl:          string;
}

interface ServiceItem {
  id?:      string;
  name:     string;
  code:     string;
  price:    number;
  duration: number;
  category: string;
}

interface Holiday {
  id?:    string;
  date:   string;
  label:  string;
  allDay: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Default branches — seeded to Firestore on first load if collection is empty
const DEFAULT_BRANCHES: Omit<Branch,'id'>[] = [
  { name:'Pannipitiya', address:'278/2 High Level Rd, Pannipitiya', phone:'077 578 5785', email:'pannipitiya@anuratyres.lk', openTime:'08:30', closeTime:'19:00', workDays:['Mon','Tue','Wed','Thu','Fri','Sat'], manager:'', taxRate:0, currency:'LKR', active:true },
  { name:'Ratnapura',   address:'Ratnapura, Sri Lanka',            phone:'076 688 5885',  email:'ratnapura@anuratyres.lk',   openTime:'08:30', closeTime:'19:00', workDays:['Mon','Tue','Wed','Thu','Fri','Sat'], manager:'', taxRate:0, currency:'LKR', active:true },
  { name:'Kalawana',    address:'Kalawana, Sri Lanka',             phone:'0777 32 95 32', email:'kalawana@anuratyres.lk',    openTime:'08:30', closeTime:'19:00', workDays:['Mon','Tue','Wed','Thu','Fri','Sat'], manager:'', taxRate:0, currency:'LKR', active:true },
  { name:'Nivithigala', address:'Nivithigala, Sri Lanka',          phone:'045 227 9396',  email:'nivithigala@anuratyres.lk', openTime:'08:30', closeTime:'19:00', workDays:['Mon','Tue','Wed','Thu','Fri','Sat'], manager:'', taxRate:0, currency:'LKR', active:true },
];
const ROLES = ['Super Admin','Admin','Manager','Cashier'] as const;
const MODULES = ['Dashboard','Bookings','Staff','Inventory','Customers','Jobs','Quotations','Invoices','Reports','Admin'] as const;

const DEFAULT_SYS: SysConfig = {
  appName: 'Anura Tyres (Pvt) Ltd', timezone: 'Asia/Colombo', dateFormat: 'DD/MM/YYYY',
  currency: 'LKR', invoicePrefix: 'INV', invoiceNextNum: 1001, defaultTaxRate: 0, logoUrl: '',
};

const DEFAULT_TEMPLATES: Omit<NotifTemplate,'id'>[] = [
  { key:'booking_confirm_sms',   label:'Booking Confirmation (SMS)',   channel:'sms',   body:'Hi {customer_name}, your {service} is booked at Anura Tyres {branch} on {date} at {time}. Booking ID: {booking_id}. Call {branch_phone} for help.', enabled:true  },
  { key:'booking_confirm_email', label:'Booking Confirmation (Email)', channel:'email', subject:'Booking Confirmed — {booking_id}', body:'Dear {customer_name},\n\nYour appointment has been confirmed.\n\nService: {service}\nBranch: {branch}\nDate: {date}\nTime: {time}\nBooking ID: {booking_id}\n\nPlease arrive 10 minutes early.\n\nRegards,\nAnura Tyres', enabled:true  },
  { key:'job_ready_sms',         label:'Job Ready (SMS)',              channel:'sms',   body:'Hi {customer_name}, your vehicle {vehicle_plate} is ready for pickup at Anura Tyres {branch}. Please collect before closing time. Call {branch_phone}.', enabled:true  },
  { key:'payment_receipt_sms',   label:'Payment Receipt (SMS)',        channel:'sms',   body:'Payment of Rs {amount} received for invoice {invoice_id}. Thank you for choosing Anura Tyres {branch}!', enabled:true  },
  { key:'late_alert_sms',        label:'Late Appointment Alert (SMS)', channel:'sms',   body:'Hi {customer_name}, your {service} appt at {time} hasn\'t started. Please arrive at Anura Tyres {branch} or call {branch_phone}.', enabled:true  },
  { key:'overdue_payment_sms',   label:'Overdue Payment Reminder',    channel:'sms',   body:'Dear {customer_name}, invoice {invoice_id} of Rs {amount} is overdue. Please settle at your earliest. Call {branch_phone}.', enabled:false },
];

const DYNAMIC_FIELDS = ['{customer_name}','{vehicle_plate}','{service}','{branch}','{branch_phone}','{date}','{time}','{booking_id}','{invoice_id}','{amount}'];

// ── Reusable UI ────────────────────────────────────────────────────────────────
const FL = ({ children }: { children: ReactNode }) => (
  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{children}</label>
);
const FI = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all ${p.className??''}`} />
);
const FS = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-all ${p.className??''}`} />
);
const FTA = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all resize-none ${p.className??''}`} />
);

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex-shrink-0 transition-all">
      {checked
        ? <ToggleRight className="w-8 h-8 text-[#FFD700]" />
        : <ToggleLeft  className="w-8 h-8 text-neutral-600" />
      }
    </button>
  );
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-6 ${className}`}>{children}</div>;
}

function SectionHead({ icon: Icon, title, sub, color = '#FFD700', action }: {
  icon: React.ElementType; title: string; sub?: string; color?: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:`${color}18`, color }}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">{title}</h3>
          {sub && <p className="text-neutral-500 text-xs">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success'|'error'|'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const cls = type==='error' ? 'bg-red-900 border-red-700 text-red-200' : type==='info' ? 'bg-blue-900 border-blue-700 text-blue-200' : 'bg-green-900 border-green-700 text-green-200';
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl flex items-center gap-3 max-w-sm ${cls}`}>
      {type==='error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. BRANCH SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function BranchSettings({ audit }: { audit: (a: string, d: string) => void }) {
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editItem,  setEditItem]  = useState<Branch | null>(null);
  const [delId,     setDelId]     = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, COL.branches));
      if (snap.empty) {
        // First time — seed the 4 default branches into Firestore
        const refs = await Promise.all(DEFAULT_BRANCHES.map(b => addDoc(collection(db, COL.branches), b)));
        setBranches(DEFAULT_BRANCHES.map((b, i) => ({ ...b, id: refs[i].id })));
      } else {
        setBranches(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Branch,'id'>) })));
      }
    } catch (err) {
      console.error('[BranchSettings]', err);
      // Fallback: show default branches without IDs so the user still sees data
      setBranches(DEFAULT_BRANCHES.map((b, i) => ({ ...b, id: `default-${i}` })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const blank = (): Branch => ({
    name:'', address:'', phone:'', email:'', openTime:'08:30', closeTime:'19:00',
    workDays: DAYS.filter(d=>d!=='Sun'), manager:'', taxRate: 0, currency:'LKR', active: true,
  });

  const save = async () => {
    if (!editItem) return;
    if (!editItem.name.trim()) return;
    setSaving(true);
    try {
      if (editItem.id) {
        await updateDoc(doc(db, COL.branches, editItem.id), { ...editItem });
        setBranches(p => p.map(b => b.id === editItem.id ? editItem : b));
        audit('UPDATE', `Updated branch "${editItem.name}"`);
      } else {
        const ref = await addDoc(collection(db, COL.branches), { ...editItem });
        setBranches(p => [...p, { ...editItem, id: ref.id }]);
        audit('CREATE', `Created branch "${editItem.name}"`);
      }
      setEditItem(null);
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    const b = branches.find(x => x.id === id);
    await deleteDoc(doc(db, COL.branches, id));
    setBranches(p => p.filter(x => x.id !== id));
    setDelId(null);
    audit('DELETE', `Deleted branch "${b?.name}"`);
  };

  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHead icon={Building2} title="Branch Settings" sub={`${branches.length} branches configured`}
          action={<button onClick={() => setEditItem(blank())} className="flex items-center gap-2 px-3 py-2 bg-[#FFD700] rounded-lg text-black text-xs font-bold hover:bg-[#FFD700]/90"><Plus className="w-3.5 h-3.5" /> Add Branch</button>} />

        {loading ? <div className="h-32 bg-neutral-800 rounded-xl animate-pulse" /> : branches.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-sm">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-neutral-700" />
            No branches configured. Add your first branch.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map(b => (
              <div key={b.id} className={`border rounded-xl p-4 space-y-2 transition-all ${b.active?'border-neutral-700 bg-neutral-800/30':'border-neutral-800 opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold text-sm">{b.name}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${b.active?'bg-emerald-500/15 text-emerald-400 border-emerald-500/30':'bg-neutral-700/30 text-neutral-500 border-neutral-700'}`}>
                        {b.active?'Active':'Inactive'}
                      </span>
                    </div>
                    {b.manager && <p className="text-neutral-500 text-xs mt-0.5">Manager: {b.manager}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditItem({...b})} className="p-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors"><Edit2 className="w-3.5 h-3.5 text-[#FFD700]" /></button>
                    <button onClick={() => setDelId(b.id!)} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-neutral-500">
                  {b.address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.address}</div>}
                  {b.phone   && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</div>}
                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.openTime}–{b.closeTime}</div>
                  <div className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{b.taxRate}% tax · {b.currency}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map(d => (
                    <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.workDays?.includes(d)?'bg-[#FFD700]/20 text-[#FFD700]':'bg-neutral-800 text-neutral-600'}`}>{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Branch Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
              <h2 className="text-base font-bold text-white">{editItem.id ? 'Edit Branch' : 'Add Branch'}</h2>
              <button onClick={() => setEditItem(null)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FL>Branch Name *</FL><FI value={editItem.name} onChange={e => setEditItem({...editItem,name:e.target.value})} placeholder="e.g. Pannipitiya" /></div>
                <div className="col-span-2"><FL>Address</FL><FI value={editItem.address} onChange={e => setEditItem({...editItem,address:e.target.value})} placeholder="Full address" /></div>
                <div><FL>Phone</FL><FI value={editItem.phone} onChange={e => setEditItem({...editItem,phone:e.target.value})} placeholder="077 XXX XXXX" /></div>
                <div><FL>Email</FL><FI type="email" value={editItem.email} onChange={e => setEditItem({...editItem,email:e.target.value})} placeholder="branch@tyres.lk" /></div>
                <div><FL>Open Time</FL><FI type="time" value={editItem.openTime} onChange={e => setEditItem({...editItem,openTime:e.target.value})} /></div>
                <div><FL>Close Time</FL><FI type="time" value={editItem.closeTime} onChange={e => setEditItem({...editItem,closeTime:e.target.value})} /></div>
                <div><FL>Manager Name</FL><FI value={editItem.manager} onChange={e => setEditItem({...editItem,manager:e.target.value})} placeholder="Staff name" /></div>
                <div><FL>Currency</FL><FS value={editItem.currency} onChange={e => setEditItem({...editItem,currency:e.target.value})}><option>LKR</option><option>USD</option></FS></div>
                <div><FL>Tax Rate (%)</FL><FI type="number" min={0} max={100} value={editItem.taxRate} onChange={e => setEditItem({...editItem,taxRate:Number(e.target.value)})} /></div>
                <div className="flex items-end gap-2"><div className="flex-1"><FL>Status</FL><FS value={editItem.active?'active':'inactive'} onChange={e => setEditItem({...editItem,active:e.target.value==='active'})}><option value="active">Active</option><option value="inactive">Inactive</option></FS></div></div>
              </div>
              <div>
                <FL>Working Days</FL>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(d=>(
                    <button key={d} type="button" onClick={() => setEditItem({...editItem, workDays: editItem.workDays?.includes(d) ? editItem.workDays.filter(x=>x!==d) : [...(editItem.workDays||[]),d]})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${editItem.workDays?.includes(d)?'bg-[#FFD700]/15 border-[#FFD700]/40 text-[#FFD700]':'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-neutral-800 flex-shrink-0">
              <button onClick={() => setEditItem(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !editItem.name.trim()} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Save Branch</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-5"><AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-sm text-neutral-300">Delete this branch? This cannot be undone.</p></div>
            <div className="flex gap-3">
              <button onClick={()=>setDelId(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={()=>del(delId)} className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROLE PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_PERMS: Record<string, string[]> = {
  'Super Admin': ['Dashboard','Bookings','Staff','Inventory','Customers','Jobs','Quotations','Invoices','Reports','Admin'],
  'Admin':       ['Dashboard','Bookings','Staff','Inventory','Customers','Jobs','Quotations','Invoices','Reports'],
  'Manager':     ['Dashboard','Bookings','Staff','Inventory','Customers','Jobs','Quotations','Invoices','Reports'],
  'Cashier':     ['Dashboard','Bookings','Inventory','Quotations','Invoices'],
};

function RolePermissions({ audit }: { audit: (a: string, d: string) => void }) {
  const [perms,   setPerms]   = useState<Record<string,string[]>>(DEFAULT_PERMS);
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    getDocs(collection(db, COL.perms))
      .then(snap => {
        if (!snap.empty) {
          const data: Record<string,string[]> = {};
          snap.docs.forEach(d => { data[d.id] = d.data().modules as string[]; });
          setPerms(prev => ({...prev, ...data}));
        }
      })
      .catch(err => console.error('[RolePermissions]', err))
      .finally(() => setLoaded(true));
  }, []);

  const toggle = (role: string, mod: string) => {
    if (role === 'Super Admin') return; // Super Admin always has all access
    setPerms(p => {
      const mods = p[role] || [];
      return { ...p, [role]: mods.includes(mod) ? mods.filter(m=>m!==mod) : [...mods,mod] };
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(Object.entries(perms).map(([role, modules]) =>
        setDoc(doc(db, COL.perms, role), { modules })
      ));
      setSaved(true);
      audit('UPDATE', 'Updated role permission matrix');
    } finally { setSaving(false); }
  };

  const reset = () => { setPerms(DEFAULT_PERMS); setSaved(false); };

  if (!loaded) return <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#FFD700]" /></div>;

  return (
    <SectionCard>
      <SectionHead icon={Shield} title="Role Permissions" sub="Toggle module access per role. Changes take effect on next login." color="#8B5CF6"
        action={
          <div className="flex items-center gap-2">
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:text-white transition-colors"><RotateCcw className="w-3 h-3" />Reset</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD700] rounded-lg text-black text-xs font-bold hover:bg-[#FFD700]/90 disabled:opacity-60">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-neutral-950 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-neutral-500 font-bold uppercase tracking-wider whitespace-nowrap">Module</th>
              {ROLES.map(role => (
                <th key={role} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                  <span className={role==='Super Admin'?'text-purple-400':role==='Admin'?'text-red-400':role==='Manager'?'text-blue-400':'text-green-400'}>{role}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {MODULES.map(mod => (
              <tr key={mod} className="hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-2.5 text-neutral-300 font-medium">{mod}</td>
                {ROLES.map(role => {
                  const has = (perms[role] || []).includes(mod);
                  const locked = role === 'Super Admin';
                  return (
                    <td key={role} className="px-4 py-2.5 text-center">
                      <button onClick={() => toggle(role, mod)} disabled={locked}
                        className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-all ${has ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-600 border border-neutral-700'} ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}`}>
                        {has ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-neutral-600 text-xs mt-3 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-500/60" />Super Admin always has full access. Permission changes are saved to Firestore and apply on next user login.</p>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════
const ACTION_COLORS: Record<string,string> = {
  CREATE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  UPDATE: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/20',
  EXPORT: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  IMPORT: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  LOGIN:  'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20',
};

function AuditLog() {
  const [logs,      setLogs]      = useState<AuditEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [modFilter, setModFilter] = useState('all');
  const [actFilter, setActFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, COL.audit), orderBy('timestamp','desc'), limit(200));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AuditEntry,'id'>) })));
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const csv = ['Timestamp,User,Action,Module,Description',
      ...filtered.map(l => `"${l.timestamp}","${l.user}","${l.action}","${l.module}","${l.description}"`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `AuditLog_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const modules = ['all', ...Array.from(new Set(logs.map(l => l.module)))];
  const actions  = ['all', ...Array.from(new Set(logs.map(l => l.action)))];

  const filtered = logs.filter(l => {
    const s = search.toLowerCase();
    return (!s || l.description.toLowerCase().includes(s) || l.user.toLowerCase().includes(s))
      && (modFilter === 'all' || l.module === modFilter)
      && (actFilter === 'all' || l.action === actFilter);
  });

  return (
    <SectionCard>
      <SectionHead icon={FileText} title="Audit Log" sub={`${filtered.length} events — read-only`} color="#3B82F6"
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /></button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs hover:text-white transition-colors"><Download className="w-3 h-3" />CSV</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events…"
            className="w-full pl-8 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]" />
        </div>
        <FS value={modFilter} onChange={e=>setModFilter(e.target.value)} className="w-36 text-xs py-2">
          {modules.map(m=><option key={m} value={m}>{m==='all'?'All Modules':m}</option>)}
        </FS>
        <FS value={actFilter} onChange={e=>setActFilter(e.target.value)} className="w-32 text-xs py-2">
          {actions.map(a=><option key={a} value={a}>{a==='all'?'All Actions':a}</option>)}
        </FS>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center gap-2 text-neutral-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFD700]" /> Loading events…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">No audit events yet. Actions you take in this admin panel will be recorded here.</div>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {filtered.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 bg-neutral-800/40 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors">
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${ACTION_COLORS[l.action] ?? 'text-neutral-400 bg-neutral-700/30 border-neutral-600'}`}>{l.action}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{l.description}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-neutral-500">
                  <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{l.user}</span>
                  <span className="flex items-center gap-1"><Package className="w-2.5 h-2.5" />{l.module}</span>
                </div>
              </div>
              <span className="text-[10px] text-neutral-600 flex-shrink-0 whitespace-nowrap">
                {l.timestamp ? new Date(l.timestamp).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SYSTEM SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function SystemSettings({ audit }: { audit: (a: string, d: string) => void }) {
  const [cfg,     setCfg]     = useState<SysConfig>(DEFAULT_SYS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    getDocs(collection(db, COL.sysconfig))
      .then(snap => { if (!snap.empty) setCfg(snap.docs[0].data() as SysConfig); })
      .catch(err => console.error('[SystemSettings]', err))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, COL.sysconfig, 'global'), cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      audit('UPDATE', 'Updated system configuration');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#FFD700]" /></div>;

  const set = (k: keyof SysConfig, v: any) => { setCfg(p => ({...p,[k]:v})); setSaved(false); };

  return (
    <SectionCard>
      <SectionHead icon={Settings} title="System Settings" sub="App-wide configuration" color="#10B981"
        action={
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-xl text-black text-xs font-bold hover:bg-[#FFD700]/90 disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Business */}
        <div className="space-y-3 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Business</p>
          <div><FL>Application Name</FL><FI value={cfg.appName} onChange={e=>set('appName',e.target.value)} placeholder="Anura Tyres (Pvt) Ltd" /></div>
          <div><FL>Logo URL</FL><FI value={cfg.logoUrl} onChange={e=>set('logoUrl',e.target.value)} placeholder="https://..." /></div>
        </div>

        {/* Locale */}
        <div className="space-y-3 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Locale & Time</p>
          <div><FL>Timezone</FL>
            <FS value={cfg.timezone} onChange={e=>set('timezone',e.target.value)}>
              <option value="Asia/Colombo">Asia/Colombo (UTC+5:30)</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
            </FS>
          </div>
          <div><FL>Date Format</FL>
            <FS value={cfg.dateFormat} onChange={e=>set('dateFormat',e.target.value)}>
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
            </FS>
          </div>
          <div><FL>Currency</FL>
            <FS value={cfg.currency} onChange={e=>set('currency',e.target.value)}>
              <option value="LKR">LKR — Sri Lankan Rupee</option>
              <option value="USD">USD — US Dollar</option>
            </FS>
          </div>
        </div>

        {/* Invoicing */}
        <div className="space-y-3 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Invoicing</p>
          <div><FL>Invoice Prefix</FL><FI value={cfg.invoicePrefix} onChange={e=>set('invoicePrefix',e.target.value)} placeholder="INV" /></div>
          <div><FL>Next Invoice Number</FL><FI type="number" min={1} value={cfg.invoiceNextNum} onChange={e=>set('invoiceNextNum',Number(e.target.value))} /></div>
          <div className="px-3 py-2 bg-neutral-900 rounded-lg text-xs text-neutral-400 font-mono">Preview: <span className="text-[#FFD700]">{cfg.invoicePrefix}-{new Date().getFullYear()}{String(new Date().getMonth()+1).padStart(2,'0')}-{String(cfg.invoiceNextNum).padStart(4,'0')}</span></div>
        </div>

        {/* Tax */}
        <div className="space-y-3 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tax / VAT</p>
          <div>
            <FL>Default Tax Rate (%)</FL>
            <div className="relative">
              <FI type="number" min={0} max={100} value={cfg.defaultTaxRate} onChange={e=>set('defaultTaxRate',Number(e.target.value))} className="pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">%</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">Applied by default on new invoices. Can be overridden per branch.</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════
function NotifTemplates({ audit }: { audit: (a: string, d: string) => void }) {
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<NotifTemplate | null>(null);
  const [preview,   setPreview]   = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    getDocs(collection(db, COL.templates))
      .then(snap => {
        if (snap.empty) {
          setTemplates(DEFAULT_TEMPLATES as NotifTemplate[]);
        } else {
          setTemplates(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NotifTemplate,'id'>) })));
        }
      })
      .catch(err => {
        console.error('[NotifTemplates]', err);
        setTemplates(DEFAULT_TEMPLATES as NotifTemplate[]); // show defaults even on error
      })
      .finally(() => setLoading(false));
  }, []);

  const updatePreview = (body: string) => {
    const p = body
      .replace(/{customer_name}/g, 'Kamal Perera')
      .replace(/{vehicle_plate}/g, 'WP CAB-1234')
      .replace(/{service}/g, 'Wheel Alignment')
      .replace(/{branch}/g, 'Pannipitiya')
      .replace(/{branch_phone}/g, '077 578 5785')
      .replace(/{date}/g, '25 Jun 2026')
      .replace(/{time}/g, '10:30 AM')
      .replace(/{booking_id}/g, 'AL-PAN-20260625-X7K4Q2')
      .replace(/{invoice_id}/g, 'INV-202606-1042')
      .replace(/{amount}/g, '2,500');
    setPreview(p);
  };

  const openEdit = (t: NotifTemplate) => { setEditing({...t}); updatePreview(t.body); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const docId = editing.id || editing.key;
      await setDoc(doc(db, COL.templates, docId), { ...editing, id: undefined });
      setTemplates(p => p.map(t => (t.id??t.key) === docId ? {...editing, id:docId} : t));
      setEditing(null);
      audit('UPDATE', `Updated notification template "${editing.label}"`);
    } finally { setSaving(false); }
  };

  const toggleEnabled = async (t: NotifTemplate) => {
    const docId = t.id || t.key;
    const updated = {...t, enabled: !t.enabled};
    await setDoc(doc(db, COL.templates, docId), { ...updated, id: undefined });
    setTemplates(p => p.map(x => (x.id??x.key) === docId ? updated : x));
    audit('UPDATE', `${updated.enabled?'Enabled':'Disabled'} template "${t.label}"`);
  };

  if (loading) return <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#FFD700]" /></div>;

  const channelBadge = (ch: string) => ch === 'sms' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : ch === 'email' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  return (
    <div className="space-y-4">
      {templates.map(t => (
        <SectionCard key={t.id ?? t.key}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Toggle checked={t.enabled} onChange={() => toggleEnabled(t)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">{t.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${channelBadge(t.channel)}`}>{t.channel.toUpperCase()}</span>
                  {!t.enabled && <span className="px-2 py-0.5 bg-neutral-700/30 text-neutral-500 text-[10px] font-bold rounded-full">Disabled</span>}
                </div>
                {t.subject && <p className="text-xs text-neutral-500 mt-0.5">Subject: {t.subject}</p>}
                <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{t.body}</p>
              </div>
            </div>
            <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 ml-2 flex-shrink-0 transition-colors">
              <Edit2 className="w-3.5 h-3.5 text-[#FFD700]" />
            </button>
          </div>
        </SectionCard>
      ))}

      {editing && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
              <h2 className="text-base font-bold text-white">Edit Template</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editing.channel !== 'sms' && (
                <div><FL>Email Subject</FL><FI value={editing.subject||''} onChange={e=>setEditing({...editing,subject:e.target.value})} placeholder="Subject line" /></div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <FL>Message Body</FL>
                  <span className="text-[10px] text-neutral-500">{editing.body.length} chars</span>
                </div>
                <FTA rows={6} value={editing.body}
                  onChange={e => { setEditing({...editing,body:e.target.value}); updatePreview(e.target.value); }}
                  placeholder="Template body…" />
              </div>
              {/* Dynamic fields */}
              <div>
                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Available Dynamic Fields</p>
                <div className="flex flex-wrap gap-1.5">
                  {DYNAMIC_FIELDS.map(f => (
                    <button key={f} onClick={() => { const b = editing.body + f; setEditing({...editing,body:b}); updatePreview(b); }}
                      className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-400 hover:text-[#FFD700] hover:border-[#FFD700]/40 transition-colors font-mono">
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {/* Preview */}
              {preview && (
                <div>
                  <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Preview (Sample Data)</p>
                  <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {preview}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-neutral-800 flex-shrink-0">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Save Template</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SERVICE CATALOG
// ═══════════════════════════════════════════════════════════════════════════════
function ServiceCatalog({ audit }: { audit: (a: string, d: string) => void }) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<ServiceItem | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [delKey,   setDelKey]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/staff?resource=service-prices');
      setServices(Array.isArray(data) ? data.map((s: any) => ({ ...s, category: s.category || 'General' })) : []);
    } catch (err) {
      console.error('[ServiceCatalog]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const blank = (): ServiceItem => ({ name:'', code:'', price:0, duration:30, category:'General' });

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      let updated: ServiceItem[];
      if (editing.id) {
        updated = services.map(s => s.id === editing.id ? editing : s);
      } else {
        updated = [...services, editing];
      }
      await apiFetch('/staff?resource=service-prices', { method:'PUT', body: JSON.stringify({ prices: updated }) });
      setServices(updated);
      audit('UPDATE', `Updated service "${editing.name}" in catalog`);
      setEditing(null);
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    const svc = services.find(s => s.id === id);
    const updated = services.filter(s => s.id !== id);
    await apiFetch('/staff?resource=service-prices', { method:'PUT', body: JSON.stringify({ prices: updated }) });
    setServices(updated);
    setDelKey(null);
    audit('DELETE', `Deleted service "${svc?.name}" from catalog`);
  };

  const categories = [...new Set(services.map(s => s.category || 'General'))];

  return (
    <SectionCard>
      <SectionHead icon={Wrench} title="Service Catalog" sub={`${services.length} services configured`} color="#F59E0B"
        action={<button onClick={() => setEditing(blank())} className="flex items-center gap-2 px-3 py-2 bg-[#FFD700] rounded-lg text-black text-xs font-bold hover:bg-[#FFD700]/90"><Plus className="w-3.5 h-3.5" />Add Service</button>} />

      {loading ? <div className="h-24 bg-neutral-800 rounded-xl animate-pulse" /> : (
        categories.map(cat => (
          <div key={cat} className="mb-5">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">{cat}</p>
            <div className="rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Service','Code','Price (Rs)','Duration',''].map(h=>(
                    <th key={h} className="px-4 py-2.5 text-left text-neutral-500 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {services.filter(s=>(s.category||'General')===cat).map(s=>(
                    <tr key={s.id??s.name} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-white font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 font-mono text-neutral-400">{s.code}</td>
                      <td className="px-4 py-2.5 text-[#FFD700] font-bold">Rs {s.price.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-neutral-400">{s.duration}m</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing({...s})} className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"><Edit2 className="w-3 h-3 text-[#FFD700]" /></button>
                          <button onClick={() => setDelKey(s.id??s.name)} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <h2 className="text-base font-bold text-white">{editing.id ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><FL>Service Name *</FL><FI value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="e.g. Wheel Alignment" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><FL>Code</FL><FI value={editing.code} onChange={e=>setEditing({...editing,code:e.target.value.toUpperCase()})} placeholder="AL" maxLength={4} /></div>
                <div><FL>Category</FL><FI value={editing.category||''} onChange={e=>setEditing({...editing,category:e.target.value})} placeholder="General" /></div>
                <div><FL>Price (Rs)</FL><FI type="number" min={0} value={editing.price} onChange={e=>setEditing({...editing,price:Number(e.target.value)})} /></div>
                <div><FL>Duration (mins)</FL><FI type="number" min={1} value={editing.duration} onChange={e=>setEditing({...editing,duration:Number(e.target.value)})} /></div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
                <button onClick={save} disabled={saving||!editing.name.trim()} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving?<><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving…</>:<><Check className="w-4 h-4" />Save</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {delKey && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5"><AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-sm text-neutral-300">Delete this service from the catalog?</p></div>
            <div className="flex gap-3">
              <button onClick={()=>setDelKey(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={()=>del(delKey)} className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════════════════════
function BackupRestore({ audit }: { audit: (a: string, d: string) => void }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    setExporting(true);
    try {
      // Collect all Firestore admin collections
      const results: Record<string, any[]> = {};
      for (const [key, colName] of Object.entries(COL)) {
        const snap = await getDocs(collection(db, colName));
        results[key] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      }
      // Also fetch service prices from backend
      try {
        results.servicePrices = await apiFetch('/staff?resource=service-prices');
      } catch {}

      const json = JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', data: results }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `AnuraTyres_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      audit('EXPORT', `Exported full system backup (${Object.keys(results).join(', ')})`);
    } finally { setExporting(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRestoreFile(ev.target?.result as string);
    reader.readAsText(file);
  };

  const doRestore = async () => {
    if (!restoreFile) return;
    setImporting(true);
    setImportStatus('Parsing backup file…');
    try {
      const parsed = JSON.parse(restoreFile);
      if (!parsed.data) throw new Error('Invalid backup format — missing "data" key');
      let restored = 0;
      for (const [key, colName] of Object.entries(COL)) {
        const docs: any[] = parsed.data[key] || [];
        if (!docs.length) continue;
        setImportStatus(`Restoring ${key} (${docs.length} records)…`);
        for (const d of docs) {
          const { _id, ...rest } = d;
          await setDoc(doc(db, colName, _id || Math.random().toString(36).slice(2)), rest);
          restored++;
        }
      }
      setImportStatus(`✓ Restore complete — ${restored} records written`);
      audit('IMPORT', `Restored backup from file (${restored} records)`);
      setRestoreFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setImportStatus(`✗ Error: ${e.message}`);
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-5">
      {/* Export */}
      <SectionCard>
        <SectionHead icon={Download} title="Export Backup" sub="Download all admin configuration as JSON" color="#10B981" />
        <div className="flex items-center justify-between p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <div>
            <p className="text-white text-sm font-semibold">Full Configuration Export</p>
            <p className="text-neutral-500 text-xs mt-0.5">Includes branches, templates, permissions, system settings, audit logs, service catalog</p>
          </div>
          <button onClick={exportBackup} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 rounded-xl text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap">
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Exporting…</> : <><Download className="w-4 h-4" />Export JSON</>}
          </button>
        </div>
      </SectionCard>

      {/* Restore */}
      <SectionCard>
        <SectionHead icon={Upload} title="Restore from Backup" sub="Upload a previously exported backup file" color="#F59E0B" />
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">Restoring will overwrite existing configuration data. This action cannot be undone. Make an export backup first.</p>
          </div>
          <div
            className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center cursor-pointer hover:border-[#FFD700]/40 hover:bg-[#FFD700]/5 transition-all"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-neutral-400 text-sm font-medium">Click to select backup file</p>
            <p className="text-neutral-600 text-xs mt-1">JSON format only</p>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </div>
          {restoreFile && (
            <div className="space-y-3">
              <div className="px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" /> File loaded — {(restoreFile.length / 1024).toFixed(1)} KB
              </div>
              <button onClick={doRestore} disabled={importing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 rounded-xl text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Restoring…</> : <><Upload className="w-4 h-4" />Confirm Restore</>}
              </button>
            </div>
          )}
          {importStatus && (
            <div className={`px-4 py-3 rounded-xl text-xs font-medium border ${importStatus.startsWith('✓')?'bg-emerald-500/10 border-emerald-500/30 text-emerald-400':importStatus.startsWith('✗')?'bg-red-500/10 border-red-500/30 text-red-400':'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
              {importStatus}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. HOLIDAY CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
function HolidayCalendar({ audit }: { audit: (a: string, d: string) => void }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState<Holiday>({ date:'', label:'', allDay:true });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, COL.holidays), orderBy('date','asc')))
      .then(snap => { setHolidays(snap.docs.map(d => ({ id:d.id, ...(d.data() as Omit<Holiday,'id'>) }))); })
      .catch(err => console.error('[HolidayCalendar]', err))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!form.date || !form.label.trim()) return;
    setSaving(true);
    const ref = await addDoc(collection(db, COL.holidays), { ...form });
    const newH: Holiday = { ...form, id: ref.id };
    setHolidays(p => [...p, newH].sort((a,b) => a.date.localeCompare(b.date)));
    setForm({ date:'', label:'', allDay:true });
    audit('CREATE', `Added holiday "${form.label}" on ${form.date}`);
    setSaving(false);
  };

  const remove = async (id: string) => {
    const h = holidays.find(x => x.id === id);
    await deleteDoc(doc(db, COL.holidays, id));
    setHolidays(p => p.filter(x => x.id !== id));
    audit('DELETE', `Removed holiday "${h?.label}" on ${h?.date}`);
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = holidays.filter(h => h.date >= today);
  const past     = holidays.filter(h => h.date < today);

  return (
    <SectionCard>
      <SectionHead icon={Calendar} title="Holiday & Closure Calendar" sub="Dates when branches are closed or have special hours" color="#8B5CF6" />

      {/* Add form */}
      <div className="flex items-end gap-3 mb-5 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
        <div className="flex-shrink-0"><FL>Date *</FL><FI type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} min={today} /></div>
        <div className="flex-1"><FL>Label *</FL><FI value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="e.g. Poya Day, Christmas" /></div>
        <button onClick={add} disabled={saving||!form.date||!form.label.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 disabled:opacity-60 whitespace-nowrap transition-colors">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {loading ? <div className="h-20 bg-neutral-800 rounded-xl animate-pulse" /> : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Upcoming</p>
              <div className="space-y-2">
                {upcoming.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-[#FFD700] font-mono text-xs">{new Date(h.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      <span className="text-white text-sm font-medium">{h.label}</span>
                    </div>
                    <button onClick={() => remove(h.id!)} className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Past</p>
              <div className="space-y-1.5">
                {past.slice(-5).reverse().map(h => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2 bg-neutral-800/30 border border-neutral-800 rounded-xl opacity-50">
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500 font-mono text-xs">{new Date(h.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      <span className="text-neutral-400 text-sm">{h.label}</span>
                    </div>
                    <button onClick={() => remove(h.id!)} className="p-1.5 rounded-lg text-neutral-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {holidays.length === 0 && (
            <div className="py-8 text-center text-neutral-500 text-sm">No holidays configured.</div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SECTIONS = [
  { key:'branches',   label:'Branch Settings',        icon:Building2,  color:'#FFD700'  },
  { key:'permissions',label:'Role Permissions',        icon:Shield,     color:'#8B5CF6'  },
  { key:'audit',      label:'Audit Log',               icon:FileText,   color:'#3B82F6'  },
  { key:'system',     label:'System Settings',         icon:Settings,   color:'#10B981'  },
  { key:'templates',  label:'Notification Templates',  icon:Bell,       color:'#F59E0B'  },
  { key:'catalog',    label:'Service Catalog',         icon:Wrench,     color:'#F59E0B'  },
  { key:'backup',     label:'Backup & Restore',        icon:Database,   color:'#EF4444'  },
  { key:'holidays',   label:'Holiday Calendar',        icon:Calendar,   color:'#8B5CF6'  },
];

export function AdminPage() {
  const session   = getSessionUser();
  const [active,  setActive]  = useState('branches');
  const [toast,   setToast]   = useState<{message:string;type:'success'|'error'|'info'}|null>(null);

  const log = useCallback((action: string, description: string) => {
    writeAudit(session?.username || 'unknown', action, active, description);
  }, [session, active]);

  const showToast = useCallback((msg: string, type: 'success'|'error'|'info' = 'success') => setToast({message:msg,type}), []);

  const renderSection = () => {
    switch(active) {
      case 'branches':    return <BranchSettings audit={log} />;
      case 'permissions': return <RolePermissions audit={log} />;
      case 'audit':       return <AuditLog />;
      case 'system':      return <SystemSettings audit={log} />;
      case 'templates':   return <NotifTemplates audit={log} />;
      case 'catalog':     return <ServiceCatalog audit={log} />;
      case 'backup':      return <BackupRestore audit={log} />;
      case 'holidays':    return <HolidayCalendar audit={log} />;
      default:            return null;
    }
  };

  return (
    <div className="flex gap-6 h-full min-h-[calc(100vh-200px)]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Left nav ── */}
      <div className="w-56 flex-shrink-0 space-y-1">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Administration</h2>
          <p className="text-neutral-500 text-xs mt-0.5">System configuration</p>
        </div>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setActive(s.key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active===s.key?'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20':'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
            <s.icon className={`w-4 h-4 flex-shrink-0 ${active===s.key?'text-black':''}`} style={active!==s.key?{color:s.color}:{}} />
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {renderSection()}
      </div>
    </div>
  );
}
