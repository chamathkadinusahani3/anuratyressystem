import React, { useState, useRef, useEffect } from 'react';
import {
  User, Lock, Bell, Building2, Monitor, Shield,
  Save, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2,
  MapPin, Phone, Mail, Globe, ChevronRight, Trash2,
  Moon, Sun, Volume2, VolumeX, RefreshCw, Upload,
  LogOut, Camera, Check, X
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ message, type, onDone }: {
  message: string; type: 'success' | 'error'; onDone: () => void;
}) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl
      ${type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/30
        ${checked ? 'bg-[#FFD700]' : 'bg-neutral-700'}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform duration-200
        ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, loading = false, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string;
  danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9998] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4
          ${danger ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
          <AlertCircle className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-yellow-400'}`} />
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-neutral-400 text-sm text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2
              ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#FFD700] hover:bg-[#FFD700]/90 text-black'}`}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h3 className="text-white font-bold">{title}</h3>
        {description && <p className="text-neutral-500 text-sm mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3">
      <div className="md:w-52 flex-shrink-0 pt-2.5">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <p className="text-xs text-neutral-600 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = 'text', icon, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; icon?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">{icon}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-neutral-800 border border-neutral-700
          rounded-lg text-white text-sm placeholder:text-neutral-600
          focus:outline-none focus:border-[#FFD700] transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} />
    </div>
  );
}

function SaveBtn({ onClick, loading, label = 'Save Changes', icon }: {
  onClick: () => void; loading: boolean; label?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-end pt-2 border-t border-neutral-800 mt-2">
      <button onClick={onClick} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#FFD700] text-black text-sm font-bold rounded-lg
          hover:bg-[#FFD700]/90 active:scale-95 transition-all disabled:opacity-60">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>{icon ?? <Save className="w-4 h-4" />} {label}</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileSettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [form, setForm] = useState({
    name: 'Admin User', email: 'admin@anuratyres.lk',
    phone: '077-1234567', role: 'Manager', bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#FFD700');
  const [showColors, setShowColors] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const COLORS = ['#FFD700', '#FF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6'];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())         e.name  = 'Name is required';
    if (!form.email.includes('@'))  e.email = 'Enter a valid email';
    if (!form.phone.trim())        e.phone = 'Phone is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return onToast('Please fix the errors above', 'error');
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      const stored = localStorage.getItem('at_user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem('at_user', JSON.stringify({ ...u, name: form.name, role: form.role }));
      }
    } catch {}
    setSaving(false);
    onToast('Profile updated successfully ✓');
  };

  return (
    <div className="space-y-6">
      <Section title="Profile Picture">
        <div className="flex items-center gap-5">
          {/* Avatar with color picker */}
          <div className="relative">
            <button onClick={() => setShowColors(v => !v)}
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-black text-3xl font-black
                group transition-transform hover:scale-105"
              style={{ backgroundColor: avatarColor }}>
              {form.name.charAt(0).toUpperCase() || 'A'}
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            {showColors && (
              <div className="absolute top-full mt-2 left-0 bg-neutral-800 border border-neutral-700 rounded-xl p-3 z-10 shadow-2xl">
                <p className="text-xs text-neutral-500 mb-2 font-medium">Pick colour</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => { setAvatarColor(c); setShowColors(false); onToast('Avatar colour updated'); }}
                      className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform
                        ${avatarColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onToast(`"${f.name}" selected (upload not wired in demo)`);
                e.target.value = '';
              }} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700
                rounded-lg text-neutral-300 text-xs hover:bg-neutral-700 hover:text-white transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload Photo
            </button>
            <button onClick={() => setShowColors(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700
                rounded-lg text-neutral-300 text-xs hover:bg-neutral-700 hover:text-white transition-colors">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: avatarColor }} />
              Change Colour
            </button>
            <p className="text-xs text-neutral-600">JPG or PNG up to 2 MB</p>
          </div>
        </div>
      </Section>

      <Section title="Personal Information">
        <Field label="Full Name">
          <TInput value={form.name} onChange={v => { setForm({ ...form, name: v }); setErrors({ ...errors, name: '' }); }}
            placeholder="Your full name" icon={<User className="w-4 h-4" />} />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </Field>
        <Field label="Email Address">
          <TInput value={form.email} onChange={v => { setForm({ ...form, email: v }); setErrors({ ...errors, email: '' }); }}
            type="email" placeholder="you@anuratyres.lk" icon={<Mail className="w-4 h-4" />} />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </Field>
        <Field label="Phone">
          <TInput value={form.phone} onChange={v => { setForm({ ...form, phone: v }); setErrors({ ...errors, phone: '' }); }}
            placeholder="077-0000000" icon={<Phone className="w-4 h-4" />} />
          {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
        </Field>
        <Field label="Role">
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              focus:outline-none focus:border-[#FFD700] transition-colors">
            {['Manager', 'Service Advisor', 'Lead Mechanic', 'Mechanic', 'Admin'].map(r =>
              <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Bio" hint="Optional short description">
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell us a bit about yourself…" rows={3}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-colors resize-none" />
        </Field>
        <SaveBtn onClick={save} loading={saving} />
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PASSWORD & SECURITY
// ═══════════════════════════════════════════════════════════════════════════════
function SecuritySettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [form, setForm]   = useState({ current: '', newPass: '', confirm: '' });
  const [show, setShow]   = useState({ current: false, newPass: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([
    { id: 1, device: 'Chrome on Windows',     location: 'Colombo, LK',     time: 'Now — Current session', current: true  },
    { id: 2, device: 'Safari on iPhone 14',   location: 'Pannipitiya, LK', time: '2 hours ago',           current: false },
    { id: 3, device: 'Firefox on MacBook Pro', location: 'Maharagama, LK', time: 'Yesterday, 6:45 PM',    current: false },
  ]);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const calcStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8)           s++;
    if (/[A-Z]/.test(p))        s++;
    if (/[0-9]/.test(p))        s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const s = calcStrength(form.newPass);
  const strengthMeta = [null,
    { label: 'Weak',   bar: 'bg-red-500',    text: 'text-red-400'    },
    { label: 'Fair',   bar: 'bg-yellow-500',  text: 'text-yellow-400' },
    { label: 'Good',   bar: 'bg-blue-500',    text: 'text-blue-400'   },
    { label: 'Strong', bar: 'bg-green-500',   text: 'text-green-400'  },
  ];

  const save = async () => {
    if (!form.current)            return onToast('Enter your current password', 'error');
    if (form.newPass.length < 8)  return onToast('Password must be at least 8 characters', 'error');
    if (form.newPass !== form.confirm) return onToast('Passwords do not match', 'error');
    if (s < 2)                   return onToast('Choose a stronger password', 'error');
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setSaving(false);
    setForm({ current: '', newPass: '', confirm: '' });
    onToast('Password changed successfully ✓');
  };

  const revokeSession = async (id: number) => {
    setRevokingId(id);
    await new Promise(r => setTimeout(r, 700));
    setSessions(prev => prev.filter(s => s.id !== id));
    setRevokingId(null);
    onToast('Session revoked');
  };

  const PwField = ({ label, field }: { label: string; field: keyof typeof form }) => (
    <Field label={label}>
      <div className="relative">
        <input type={show[field] ? 'text' : 'password'} value={form[field]}
          onChange={e => setForm({ ...form, [field]: e.target.value })}
          placeholder="••••••••"
          className="w-full pl-3 pr-10 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
            focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600" />
        <button type="button"
          onClick={() => setShow(p => ({ ...p, [field]: !p[field] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
          {show[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </Field>
  );

  return (
    <div className="space-y-6">
      <Section title="Change Password">
        <PwField label="Current Password" field="current" />
        <PwField label="New Password"     field="newPass" />

        {/* Live strength meter */}
        {form.newPass && (
          <Field label="">
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
                    ${i <= s && strengthMeta[s] ? strengthMeta[s]!.bar : 'bg-neutral-700'}`} />
                ))}
              </div>
              {s > 0 && <p className={`text-xs font-semibold ${strengthMeta[s]!.text}`}>{strengthMeta[s]!.label}</p>}
              <div className="space-y-1">
                {[
                  { ok: form.newPass.length >= 8,              label: 'At least 8 characters'   },
                  { ok: /[A-Z]/.test(form.newPass),            label: 'One uppercase letter'     },
                  { ok: /[0-9]/.test(form.newPass),            label: 'One number'               },
                  { ok: /[^A-Za-z0-9]/.test(form.newPass),    label: 'One special character'    },
                ].map(r => (
                  <p key={r.label} className={`text-xs ${r.ok ? 'text-green-400' : 'text-neutral-600'}`}>
                    {r.ok ? '✓' : '○'} {r.label}
                  </p>
                ))}
              </div>
            </div>
          </Field>
        )}

        <PwField label="Confirm Password" field="confirm" />

        {/* Match indicator */}
        {form.confirm && (
          <Field label="">
            <p className={`text-xs font-medium ${form.newPass === form.confirm ? 'text-green-400' : 'text-red-400'}`}>
              {form.newPass === form.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
            </p>
          </Field>
        )}
        <SaveBtn onClick={save} loading={saving} label="Update Password" icon={<Lock className="w-4 h-4" />} />
      </Section>

      <Section title="Active Sessions" description="Devices currently signed in to your account.">
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="flex items-center justify-between p-3.5 bg-neutral-800 border border-neutral-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{session.device}</p>
                  <p className="text-xs text-neutral-500">{session.location} · {session.time}</p>
                </div>
              </div>
              {session.current
                ? <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full font-medium">Current</span>
                : <button onClick={() => revokeSession(session.id)} disabled={revokingId === session.id}
                    className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg
                      hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    {revokingId === session.id
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Revoking…</>
                      : <><LogOut className="w-3 h-3" /> Revoke</>}
                  </button>}
            </div>
          ))}
          {sessions.filter(s => !s.current).length === 0 && (
            <p className="text-xs text-neutral-500 text-center py-2">No other active sessions.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationSettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [prefs, setPrefs] = useState({
    newBooking: true, bookingUpdates: true, lowStock: true,
    staffAlerts: false, dailySummary: true, weeklyReport: false,
    sound: true, email: true, browserPush: false,
  });
  const [saving, setSaving] = useState(false);
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    onToast('Notification preferences saved ✓');
  };

  const Row = ({ label, desc, field }: { label: string; desc: string; field: keyof typeof prefs }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
      </div>
      <Toggle checked={prefs[field]} onChange={() => toggle(field)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Section title="Booking Alerts">
        <Row label="New Booking"     desc="When a customer creates a new booking"          field="newBooking"     />
        <div className="border-t border-neutral-800" />
        <Row label="Booking Updates" desc="Status changes, edits, and cancellations"       field="bookingUpdates" />
      </Section>
      <Section title="Operational Alerts">
        <Row label="Low Stock Warnings" desc="When inventory drops below minimum level"    field="lowStock"       />
        <div className="border-t border-neutral-800" />
        <Row label="Staff Alerts"       desc="Staff availability and assignment changes"   field="staffAlerts"    />
      </Section>
      <Section title="Scheduled Reports">
        <Row label="Daily Summary" desc="End-of-day bookings and revenue summary"          field="dailySummary"   />
        <div className="border-t border-neutral-800" />
        <Row label="Weekly Report" desc="Sent every Monday morning at 8:00 AM"            field="weeklyReport"   />
      </Section>
      <Section title="Delivery Channels">
        {/* Sound */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            {prefs.sound ? <Volume2 className="w-5 h-5 text-[#FFD700]" /> : <VolumeX className="w-5 h-5 text-neutral-500" />}
            <div>
              <p className="text-sm font-medium text-white">Sound Alerts</p>
              <p className="text-xs text-neutral-500">Play a chime for important notifications</p>
            </div>
          </div>
          <Toggle checked={prefs.sound} onChange={() => toggle('sound')} />
        </div>
        <div className="border-t border-neutral-800" />
        {/* Email */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-sm font-medium text-white">Email Notifications</p>
              <p className="text-xs text-neutral-500">Send alerts to your registered email</p>
            </div>
          </div>
          <Toggle checked={prefs.email} onChange={() => toggle('email')} />
        </div>
        <div className="border-t border-neutral-800" />
        {/* Browser push */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-sm font-medium text-white">Browser Push</p>
              <p className="text-xs text-neutral-500">Desktop notifications from your browser</p>
            </div>
          </div>
          <Toggle checked={prefs.browserPush} onChange={v => {
            if (v && 'Notification' in window) {
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') { setPrefs(p => ({ ...p, browserPush: true })); onToast('Browser notifications enabled'); }
                else onToast('Browser denied permission', 'error');
              });
            } else {
              setPrefs(p => ({ ...p, browserPush: false }));
            }
          }} />
        </div>
      </Section>
      <SaveBtn onClick={save} loading={saving} label="Save Preferences" icon={<Bell className="w-4 h-4" />} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. BUSINESS
// ═══════════════════════════════════════════════════════════════════════════════
function BusinessSettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [form, setForm] = useState({
    name: 'Anura Tyres Pvt Ltd', tagline: 'Your Trusted Tyre Specialists',
    email: 'info@anuratyres.lk', phone: '011-2851234',
    website: 'www.anuratyres.lk', address: '123 High Level Road, Pannipitiya',
    openTime: '08:30', closeTime: '19:00', currency: 'LKR', timezone: 'Asia/Colombo',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim())        return onToast('Business name is required', 'error');
    if (!form.email.includes('@')) return onToast('Enter a valid email', 'error');
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    onToast('Business settings saved ✓');
  };

  return (
    <div className="space-y-6">
      <Section title="Business Information">
        <Field label="Business Name">
          <TInput value={form.name} onChange={v => setForm({ ...form, name: v })} icon={<Building2 className="w-4 h-4" />} />
        </Field>
        <Field label="Tagline">
          <TInput value={form.tagline} onChange={v => setForm({ ...form, tagline: v })} placeholder="Your tagline" />
        </Field>
        <Field label="Email">
          <TInput value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" icon={<Mail className="w-4 h-4" />} />
        </Field>
        <Field label="Phone">
          <TInput value={form.phone} onChange={v => setForm({ ...form, phone: v })} icon={<Phone className="w-4 h-4" />} />
        </Field>
        <Field label="Website">
          <TInput value={form.website} onChange={v => setForm({ ...form, website: v })} icon={<Globe className="w-4 h-4" />} />
        </Field>
        <Field label="Address">
          <TInput value={form.address} onChange={v => setForm({ ...form, address: v })} icon={<MapPin className="w-4 h-4" />} />
        </Field>
      </Section>

      <Section title="Operating Hours">
        <Field label="Opens At">
          <input type="time" value={form.openTime} onChange={e => setForm({ ...form, openTime: e.target.value })}
            className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              focus:outline-none focus:border-[#FFD700] transition-colors" />
        </Field>
        <Field label="Closes At">
          <input type="time" value={form.closeTime} onChange={e => setForm({ ...form, closeTime: e.target.value })}
            className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              focus:outline-none focus:border-[#FFD700] transition-colors" />
        </Field>
      </Section>

      <Section title="Locale">
        <Field label="Currency">
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              focus:outline-none focus:border-[#FFD700] transition-colors">
            {[['LKR','Sri Lankan Rupee'],['USD','US Dollar'],['EUR','Euro'],['GBP','British Pound'],['AUD','Australian Dollar']]
              .map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
          </select>
        </Field>
        <Field label="Timezone">
          <select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm
              focus:outline-none focus:border-[#FFD700] transition-colors">
            {['Asia/Colombo','Asia/Kolkata','Asia/Dubai','Europe/London','America/New_York']
              .map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </Section>
      <SaveBtn onClick={save} loading={saving} icon={<Building2 className="w-4 h-4" />} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. APPEARANCE
// ═══════════════════════════════════════════════════════════════════════════════
function AppearanceSettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [theme,      setTheme]      = useState<'dark'|'light'|'system'>('dark');
  const [accent,     setAccent]     = useState('#FFD700');
  const [compact,    setCompact]    = useState(false);
  const [animations, setAnimations] = useState(true);
  const [fontSize,   setFontSize]   = useState<'sm'|'md'|'lg'>('md');
  const [saving,     setSaving]     = useState(false);
  const ACCENTS = ['#FFD700','#FF4444','#3B82F6','#10B981','#8B5CF6','#F97316','#EC4899','#14B8A6'];

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    onToast('Appearance settings applied ✓');
  };

  return (
    <div className="space-y-6">
      <Section title="Theme">
        <Field label="Colour Mode">
          <div className="flex gap-2 flex-wrap">
            {([
              { id: 'dark',   label: 'Dark',   icon: <Moon    className="w-4 h-4" /> },
              { id: 'light',  label: 'Light',  icon: <Sun     className="w-4 h-4" /> },
              { id: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
            ] as const).map(t => (
              <button key={t.id} onClick={() => { setTheme(t.id); onToast(`Theme: ${t.label}`); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all
                  ${theme === t.id
                    ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'}`}>
                {t.icon} {t.label}
                {theme === t.id && <Check className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Accent Colour" hint="Buttons, borders, highlights">
          <div className="flex items-center gap-2.5 flex-wrap">
            {ACCENTS.map(c => (
              <button key={c} onClick={() => { setAccent(c); onToast('Accent colour updated'); }}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center
                  ${accent === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}>
                {accent === c && <Check className="w-3.5 h-3.5 text-black" />}
              </button>
            ))}
            <div className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-xs text-neutral-400 font-mono">{accent}</span>
            </div>
          </div>
        </Field>
      </Section>

      <Section title="Layout & Motion">
        <Field label="Font Size">
          <div className="flex gap-2">
            {(['sm','md','lg'] as const).map(sz => (
              <button key={sz} onClick={() => { setFontSize(sz); onToast(`Font size: ${sz === 'sm' ? 'Small' : sz === 'md' ? 'Medium' : 'Large'}`); }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
                  ${fontSize === sz
                    ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                {sz === 'sm' ? 'Small' : sz === 'md' ? 'Medium' : 'Large'}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-white">Compact Mode</p>
            <p className="text-xs text-neutral-500">Reduce padding for higher content density</p>
          </div>
          <Toggle checked={compact} onChange={v => { setCompact(v); onToast(v ? 'Compact mode enabled' : 'Compact mode disabled'); }} />
        </div>
        <div className="border-t border-neutral-800" />
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-white">Animations</p>
            <p className="text-xs text-neutral-500">Page transitions and hover effects</p>
          </div>
          <Toggle checked={animations} onChange={v => { setAnimations(v); onToast(v ? 'Animations on' : 'Animations off'); }} />
        </div>
      </Section>

      <SaveBtn onClick={save} loading={saving} label="Apply Changes" icon={<Monitor className="w-4 h-4" />} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function SystemSettings({ onToast }: { onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [clearingCache, setClearingCache] = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetting,     setResetting]     = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const clearCache = async () => {
    setClearingCache(true);
    await new Promise(r => setTimeout(r, 1000));
    setClearingCache(false);
    onToast('Cache cleared — 12.4 MB freed ✓');
  };

  const exportData = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 1000));
    const csv = 'id,customer,service,date,status\nBK-0001,Sample Customer,Wheel Alignment,2024-01-15,Completed\nBK-0002,Nimal Perera,Tyre Change,2024-01-16,Pending';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `anura-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    onToast('Data exported — check your downloads ✓');
  };

  const resetSettings = async () => {
    setResetting(true);
    await new Promise(r => setTimeout(r, 1200));
    setResetting(false);
    setConfirmReset(false);
    onToast('Settings reset to defaults ✓');
  };

  const deleteAll = async () => {
    setDeleting(true);
    await new Promise(r => setTimeout(r, 1200));
    setDeleting(false);
    setConfirmDelete(false);
    onToast('All booking records deleted');
  };

  return (
    <div className="space-y-6">
      <Section title="System Information">
        {[
          { label: 'System Version',  value: 'v2.1.0' },
          { label: 'Database',        value: '● Connected',  cls: 'text-green-400' },
          { label: 'Environment',     value: 'Production' },
          { label: 'Last Backup',     value: 'Today, 03:00 AM' },
          { label: 'API Status',      value: '● Operational', cls: 'text-green-400' },
          { label: 'Storage Used',    value: '128 MB / 512 MB' },
        ].map(r => (
          <div key={r.label} className="flex justify-between items-center py-1">
            <span className="text-sm text-neutral-400">{r.label}</span>
            <span className={`text-sm font-medium ${r.cls ?? 'text-white'}`}>{r.value}</span>
          </div>
        ))}
      </Section>

      <Section title="Maintenance">
        {/* Clear cache */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-white">Clear Cache</p>
            <p className="text-xs text-neutral-500">Remove temporary files (~12 MB)</p>
          </div>
          <button onClick={clearCache} disabled={clearingCache}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg
              text-neutral-300 text-xs font-medium hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-50">
            {clearingCache ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Clearing…</> : <><RefreshCw className="w-3.5 h-3.5" /> Clear Cache</>}
          </button>
        </div>
        <div className="border-t border-neutral-800" />
        {/* Export */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-white">Export All Data</p>
            <p className="text-xs text-neutral-500">Download all records as CSV</p>
          </div>
          <button onClick={exportData} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg
              text-neutral-300 text-xs font-medium hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-50">
            {exporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : 'Export CSV'}
          </button>
        </div>
      </Section>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/20">
          <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Danger Zone
          </h3>
          <p className="text-neutral-600 text-xs mt-0.5">These actions are permanent and cannot be undone.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Reset All Settings</p>
              <p className="text-xs text-neutral-500">Restore every setting to factory defaults</p>
            </div>
            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg
                text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          <div className="border-t border-red-500/10" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Delete All Bookings</p>
              <p className="text-xs text-neutral-500">Permanently remove every booking record</p>
            </div>
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg
                text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </button>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmModal title="Reset All Settings?" danger
          message="This restores every setting to factory defaults. Your bookings and data won't be affected."
          confirmLabel="Yes, Reset" loading={resetting}
          onConfirm={resetSettings} onCancel={() => setConfirmReset(false)} />
      )}
      {confirmDelete && (
        <ConfirmModal title="Delete All Bookings?" danger
          message="This permanently removes every booking record from the database. There is no undo."
          confirmLabel="Yes, Delete All" loading={deleting}
          onConfirm={deleteAll} onCancel={() => setConfirmDelete(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function SettingsPage() {
  const [active, setActive] = useState('profile');
  const [toast,  setToast]  = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const sections = [
    { id: 'profile',       label: 'Profile',             icon: <User      className="w-4 h-4" /> },
    { id: 'security',      label: 'Password & Security', icon: <Lock      className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications',       icon: <Bell      className="w-4 h-4" /> },
    { id: 'business',      label: 'Business',            icon: <Building2 className="w-4 h-4" /> },
    { id: 'appearance',    label: 'Appearance',          icon: <Monitor   className="w-4 h-4" /> },
    { id: 'system',        label: 'System',              icon: <Shield    className="w-4 h-4" /> },
  ];

  const renderSection = () => {
    switch (active) {
      case 'profile':       return <ProfileSettings      onToast={showToast} />;
      case 'security':      return <SecuritySettings     onToast={showToast} />;
      case 'notifications': return <NotificationSettings onToast={showToast} />;
      case 'business':      return <BusinessSettings     onToast={showToast} />;
      case 'appearance':    return <AppearanceSettings   onToast={showToast} />;
      case 'system':        return <SystemSettings       onToast={showToast} />;
      default:              return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-white mb-1">Settings</h2>
        <p className="text-neutral-400 text-sm">Manage your account, business, and system preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Nav */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden sticky top-24">
            {sections.map((s, i) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors
                  ${i > 0 ? 'border-t border-neutral-800/60' : ''}
                  ${active === s.id
                    ? 'bg-[#FFD700]/10 text-[#FFD700]'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
                <span className={active === s.id ? 'text-[#FFD700]' : 'text-neutral-500'}>{s.icon}</span>
                <span className="flex-1 text-left">{s.label}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${active === s.id ? 'text-[#FFD700]' : 'text-neutral-700 opacity-50'}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">{renderSection()}</div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}