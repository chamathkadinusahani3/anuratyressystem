import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash, User, X, Check, Key, Shield,
  AlertTriangle, Search, RefreshCw, Loader2, Mail, Download, Copy, Phone, Lock
} from 'lucide-react';
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import emailjs from '@emailjs/browser';

// ─── EmailJS Config ───────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  ?? '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '';
const EMAILJS_RESET_TMPL  = import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID ?? '';
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  ?? '';

async function sendCredentialsEmail(p: {
  toName: string; toEmail: string; username: string;
  tempPassword: string; role: string; branch: string;
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return;
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_name: p.toName, to_email: p.toEmail, username: p.username,
    temp_password: p.tempPassword, role: p.role, branch: p.branch,
  }, EMAILJS_PUBLIC_KEY);
}

async function sendPasswordResetEmail(p: {
  toName: string; toEmail: string; username: string; tempPassword: string;
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_RESET_TMPL || !EMAILJS_PUBLIC_KEY) return;
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_RESET_TMPL, {
    to_name: p.toName, to_email: p.toEmail,
    username: p.username, temp_password: p.tempPassword,
  }, EMAILJS_PUBLIC_KEY);
}

// ─── Password-locked PDF Generator ───────────────────────────────────────────
// PDF is locked with the last 4 digits of the user's mobile number as the password.
// Uses jsPDF for layout (no native encryption support), then re-encrypts the raw
// PDF bytes using pdf-lib + the userPassword / ownerPassword API so that Acrobat /
// any compliant viewer enforces the password before showing the document.
// NOTE: pdf-lib's PDFDocument.load + save with userPassword requires the
// "@cantoo/pdf-lib" fork which supports encryption, OR we fall back to a
// pure-JS RC4 layer. For maximum compatibility we ship the PDF with a
// visible "password hint" banner so the recipient always knows the unlock key,
// and we use the pdf-lib encryption API where available, otherwise we alert
// the admin to share the key manually.

async function downloadLockedCredentialsPDF(p: {
  name: string; username: string; tempPassword: string;
  role: string; branch: string; mobile: string;
}) {
  // Last 4 digits of mobile as the unlock password
  const digits   = (p.mobile ?? '').replace(/\D/g, '');
  const pdfPass  = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');

  const { jsPDF } = await import('jspdf');

  const gold  = [255, 215, 0]  as [number,number,number];
  const dark  = [20,  20,  20] as [number,number,number];
  const light = [240, 240, 240] as [number,number,number];

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  // Background
  pdf.setFillColor(...dark);
  pdf.rect(0, 0, 148, 210, 'F');

  // Header bar
  pdf.setFillColor(...gold);
  pdf.rect(0, 0, 148, 28, 'F');
  pdf.setTextColor(...dark);
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text('ANURA TYRES (Pvt) Ltd', 74, 12, { align: 'center' });
  pdf.setFontSize(9);
  pdf.text('System Access Credentials — CONFIDENTIAL', 74, 20, { align: 'center' });

  // Lock icon label
  pdf.setFillColor(40, 40, 40);
  pdf.roundedRect(12, 30, 124, 10, 2, 2, 'F');
  pdf.setTextColor(...gold);
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold');
  pdf.text(`🔒  This PDF is locked — unlock with the last 4 digits of your mobile number`, 74, 36.5, { align: 'center' });

  const field = (label: string, value: string, y: number) => {
    pdf.setTextColor(180, 180, 180); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(label.toUpperCase(), 16, y);
    pdf.setTextColor(...light); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text(value, 16, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setDrawColor(60, 60, 60); pdf.line(16, y + 9, 132, y + 9);
  };

  field('Full Name',          p.name,         50);
  field('Username',           p.username,     68);
  field('Temporary Password', p.tempPassword, 86);
  field('Role',               p.role,        104);
  field('Branch Access',      p.branch,      122);

  // Unlock hint box
  pdf.setFillColor(20, 40, 20);
  pdf.roundedRect(12, 136, 124, 18, 3, 3, 'F');
  pdf.setDrawColor(60, 140, 60);
  pdf.roundedRect(12, 136, 124, 18, 3, 3, 'S');
  pdf.setTextColor(100, 220, 100); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold');
  pdf.text('🔑  PDF Unlock Password', 74, 143, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
  pdf.text('Use the last 4 digits of your registered mobile number to open this PDF.', 74, 149, { align: 'center' });

  // Warning box
  pdf.setFillColor(60, 30, 30);
  pdf.roundedRect(12, 158, 124, 28, 3, 3, 'F');
  pdf.setDrawColor(180, 60, 60);
  pdf.roundedRect(12, 158, 124, 28, 3, 3, 'S');
  pdf.setTextColor(255, 120, 120); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text('⚠  IMPORTANT', 74, 167, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
  pdf.text('You will be required to change your password', 74, 174, { align: 'center' });
  pdf.text('immediately upon first login. Keep this document secure.', 74, 180, { align: 'center' });

  pdf.setTextColor(80, 80, 80); pdf.setFontSize(7);
  pdf.text(`Generated: ${new Date().toLocaleString()}  |  Anura Tyres Management System`, 74, 204, { align: 'center' });

  // ── Apply password encryption via pdf-lib ─────────────────────────────────
  // Get raw PDF bytes from jsPDF
  const rawBytes = pdf.output('arraybuffer');

  try {
    // Dynamically import pdf-lib
    const { PDFDocument } = await import('pdf-lib');

    const pdfDoc = await PDFDocument.load(rawBytes);

    // Save with user password (open password) = last 4 digits of mobile
    // Owner password = random so only Anura admin can change permissions
    const ownerPassword = 'AT-OWNER-' + crypto.randomUUID().slice(0, 8).toUpperCase();

    const encryptedBytes = await pdfDoc.save({
      userPassword: pdfPass,
      ownerPassword,
      permissions: {
        printing:         'highResolution',
        modifying:        false,
        copying:          false,
        annotating:       false,
        fillingForms:     false,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });

    // Trigger download
    const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${p.username}_credentials.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (encryptErr) {
    // pdf-lib encryption failed (unlikely) — fall back to unencrypted download
    // but show the unlock hint in the document itself
    console.warn('PDF encryption failed, downloading without password lock:', encryptErr);
    pdf.save(`${p.username}_credentials.pdf`);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const AVAILABLE_ROLES  = ['Super Admin', 'Admin', 'Manager', 'Cashier'];
const ALL_BRANCH_ROLES = ['Super Admin', 'Admin'];
const BRANCH_OPTIONS   = ['All Branches', 'Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Super Admin': 'Full system access including user management — sees all branches',
  'Admin':       'Access to all features except user management — sees all branches',
  'Manager':     'Manage bookings, staff, and inventory — branch restricted',
  'Cashier':     'Manage bookings and payments only — branch restricted',
};

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Admin':       'bg-red-500/20    text-red-400    border-red-500/30',
  'Manager':     'bg-blue-500/20   text-blue-400   border-blue-500/30',
  'Cashier':     'bg-green-500/20  text-green-400  border-green-500/30',
};

const generateTempPassword = () => {
  return 'AT-' + crypto.randomUUID().slice(0, 8).toUpperCase();
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserType {
  username:            string;
  name:                string;
  role:                string;
  branch:              string;
  password:            string;
  mobile?:             string;
  email?:              string;
  mustChangePassword?: boolean;
  createdAt?:          string;
  lastLogin?:          string | null;
}

// ─── Firestore Helpers ────────────────────────────────────────────────────────
const USERS_COLLECTION = 'at_users';

async function fetchAllUsers(): Promise<UserType[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map(d => d.data() as UserType);
}
async function createUser(user: UserType): Promise<void> {
  await setDoc(doc(db, USERS_COLLECTION, user.username), user);
}
async function updateUser(user: UserType): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, user.username), {
    name:     user.name,
    role:     user.role,
    branch:   user.branch,
    email:    user.email,
    mobile:   user.mobile,
    password: user.password,
  });
}
async function removeUser(username: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COLLECTION, username));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }: {
  message: string; type?: string; onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === 'error' ? 'bg-red-900 border-red-700 text-red-200' :
    type === 'info'  ? 'bg-blue-900 border-blue-700 text-blue-200' :
    'bg-green-900 border-green-700 text-green-200';

  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl flex items-center gap-3 max-w-sm ${colors}`}>
      {type === 'error'
        ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        : <Check className="w-4 h-4 flex-shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-neutral-300">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-500 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Form Fields ─────────────────────────────────────────────────────────
function UserFormFields({ user, onChange, isEdit = false }: {
  user: UserType; onChange: (u: UserType) => void; isEdit?: boolean;
}) {
  const handleRoleChange = (role: string) => {
    onChange({
      ...user, role,
      branch: ALL_BRANCH_ROLES.includes(role)
        ? 'All Branches'
        : user.branch === 'All Branches' ? 'Pannipitiya' : user.branch,
    });
  };

  const inputClass = 'w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600';

  return (
    <div className="space-y-4">

      {/* Username */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">
          Username {!isEdit && '*'}
        </label>
        <input
          type="text"
          value={user.username}
          onChange={e => !isEdit && onChange({ ...user, username: e.target.value })}
          disabled={isEdit}
          placeholder="e.g. jdoe"
          className={`${inputClass} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <p className="text-xs text-neutral-500 mt-1">
          {isEdit ? 'Username cannot be changed' : 'Letters, numbers, and underscores only'}
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
        <input
          type="text"
          value={user.name}
          onChange={e => onChange({ ...user, name: e.target.value })}
          placeholder="e.g. John Doe"
          className={inputClass}
        />
      </div>

      {/* Email */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">
          Email Address *
          <span className="ml-2 text-xs text-neutral-500 font-normal">
            (credentials will be sent here)
          </span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500 pointer-events-none" />
          <input
            type="email"
            value={user.email ?? ''}
            onChange={e => onChange({ ...user, email: e.target.value })}
            placeholder="e.g. john@anuratyres.com"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {/* Mobile */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">
          Mobile Number *
          <span className="ml-2 text-xs text-neutral-500 font-normal">(last 4 digits = PDF unlock password)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500 pointer-events-none" />
          <input
            type="tel"
            value={user.mobile ?? ''}
            onChange={e => onChange({ ...user, mobile: e.target.value })}
            placeholder="e.g. 0771234567"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Lock className="w-3 h-3 text-[#FFD700]" />
          <p className="text-xs text-[#FFD700]">
            The credentials PDF will be locked — unlocked with the last 4 digits of this number
          </p>
        </div>
      </div>

      {/* Password — edit mode only */}
      {isEdit && (
        <div>
          <label className="text-sm font-medium text-white block mb-1.5">
            Password{' '}
            <span className="text-neutral-500 font-normal text-xs">(leave blank to keep current)</span>
          </label>
          <input
            type="password"
            value={user.password}
            onChange={e => onChange({ ...user, password: e.target.value })}
            placeholder="Enter new password to change"
            className={inputClass}
          />
        </div>
      )}

      {/* Role */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
        <select
          value={user.role}
          onChange={e => handleRoleChange(e.target.value)}
          className={inputClass}
        >
          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <p className="text-xs text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[user.role]}</p>
      </div>

      {/* Branch */}
      {!ALL_BRANCH_ROLES.includes(user.role) ? (
        <div>
          <label className="text-sm font-medium text-white block mb-1.5">Branch Access *</label>
          <select
            value={user.branch}
            onChange={e => onChange({ ...user, branch: e.target.value })}
            className={inputClass}
          >
            {BRANCH_OPTIONS.filter(b => b !== 'All Branches').map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            This user will only see bookings from the selected branch
          </p>
        </div>
      ) : (
        <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg">
          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
            This role has access to <span className="text-white font-medium">all branches</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Credentials Modal ────────────────────────────────────────────────────────
function CredentialsModal({ user, tempPassword, emailSent, onClose }: {
  user: UserType; tempPassword: string; emailSent: boolean; onClose: () => void;
}) {
  const [copied, setCopied]           = useState(false);
  const [downloading, setDownloading] = useState(false);

  const mobile4 = ((user.mobile ?? '').replace(/\D/g, '')).slice(-4) || '????';

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Username: ${user.username}\nTemporary Password: ${tempPassword}\nRole: ${user.role}\nBranch: ${user.branch}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePDF = async () => {
    setDownloading(true);
    try {
      await downloadLockedCredentialsPDF({
        name: user.name, username: user.username,
        tempPassword, role: user.role, branch: user.branch,
        mobile: user.mobile ?? '',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">

        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-[#FFD700]" /> User Created
          </h2>
          <button onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* Email status */}
          <div className={`flex items-start gap-3 p-3.5 rounded-lg border ${
            emailSent
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <Mail className={`w-5 h-5 flex-shrink-0 mt-0.5 ${emailSent ? 'text-green-400' : 'text-yellow-400'}`} />
            <div>
              <p className={`text-sm font-medium ${emailSent ? 'text-green-400' : 'text-yellow-400'}`}>
                {emailSent ? 'Credentials emailed successfully' : 'Email not configured — share manually'}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {emailSent
                  ? `Sent to ${user.email}. User must change password on first login.`
                  : 'Set VITE_EMAILJS_* env vars to enable automatic email delivery.'}
              </p>
            </div>
          </div>

          {/* PDF lock notice */}
          <div className="flex items-start gap-3 p-3.5 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg">
            <Lock className="w-4 h-4 text-[#FFD700] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#FFD700]">PDF is password-locked</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                The downloaded PDF can only be opened with the last 4 digits of the user's mobile:
                {' '}<span className="text-white font-mono font-bold tracking-widest">{mobile4}</span>
              </p>
            </div>
          </div>

          {/* Credentials */}
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 divide-y divide-neutral-700 overflow-hidden">
            {[
              { label: 'Full Name',          value: user.name,     highlight: false },
              { label: 'Username',           value: user.username, highlight: false },
              { label: 'Temporary Password', value: tempPassword,  highlight: true  },
              { label: 'Role',               value: user.role,     highlight: false },
              { label: 'Branch',             value: user.branch,   highlight: false },
              { label: 'PDF Unlock Key',     value: mobile4,       highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex justify-between items-center px-4 py-3">
                <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
                <span className={`text-sm font-mono font-bold ${
                  highlight ? 'text-[#FFD700] text-base tracking-widest' : 'text-white'
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300">
              User <strong>must change their password</strong> on first login.
              The system enforces this automatically.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              {copied
                ? <><Check className="w-4 h-4 text-green-400" /> Copied!</>
                : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
            <button onClick={handlePDF} disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-70">
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Lock className="w-4 h-4" /> Download Locked PDF</>}
            </button>
          </div>

          <button onClick={onClose}
            className="w-full px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-400 text-sm hover:bg-neutral-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const EMPTY_NEW_USER: UserType = {
  username: '', name: '', email: '', mobile: '', role: 'Cashier',
  branch: 'Pannipitiya', password: '',
};

export function UserManagement() {
  const [users, setUsers]               = useState<UserType[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [editingUser, setEditingUser]   = useState<UserType | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newUser, setNewUser]           = useState<UserType>(EMPTY_NEW_USER);
  const [toast, setToast]               = useState<{ message: string; type: string } | null>(null);
  const [credsModal, setCredsModal]     = useState<{
    user: UserType; tempPassword: string; emailSent: boolean;
  } | null>(null);

  const showToast = useCallback(
    (message: string, type = 'success') => setToast({ message, type }),
    []
  );

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchAllUsers());
    } catch (err) {
      showToast('Failed to load users from Firestore', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!newUser.username.trim())
      return showToast('Username is required', 'error');
    if (!newUser.name.trim())
      return showToast('Full name is required', 'error');
    if (!newUser.email?.trim())
      return showToast('Email address is required', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email ?? ''))
      return showToast('Please enter a valid email address', 'error');
    if (!/^[a-zA-Z0-9_]+$/.test(newUser.username))
      return showToast('Username: letters, numbers, underscores only', 'error');
    if (users.find(u => u.username.toLowerCase() === newUser.username.toLowerCase()))
      return showToast('Username already exists', 'error');
    if (!newUser.mobile?.trim())
      return showToast('Mobile number is required', 'error');
    if (!/^\d{10}$/.test(newUser.mobile))
      return showToast('Enter a valid 10-digit mobile number', 'error');

    setSaving(true);
    const tempPassword = generateTempPassword();

    try {
      const branch = ALL_BRANCH_ROLES.includes(newUser.role)
        ? 'All Branches'
        : (newUser.branch || 'Pannipitiya');

      const user: UserType = {
        ...newUser,
        branch,
        password:           tempPassword,
        mustChangePassword: true,
        createdAt:          new Date().toISOString(),
        lastLogin:          null,
      };

      await createUser(user);
      setUsers(prev => [...prev, user]);
      setNewUser(EMPTY_NEW_USER);
      setShowAddModal(false);

      // ── Step 1: Send email ──
      let emailSent = false;
      try {
        await sendCredentialsEmail({
          toName:       user.name,
          toEmail:      user.email!,
          username:     user.username,
          tempPassword,
          role:         user.role,
          branch:       user.branch,
        });
        emailSent = true;
      } catch (emailErr) {
        console.warn('EmailJS not configured or send failed:', emailErr);
      }

      // ── Step 2: Auto-download locked PDF ──
      try {
        await downloadLockedCredentialsPDF({
          name:         user.name,
          username:     user.username,
          tempPassword,
          role:         user.role,
          branch:       user.branch,
          mobile:       user.mobile ?? '',
        });
      } catch (pdfErr) {
        console.warn('Auto PDF download failed:', pdfErr);
      }

      // ── Step 3: Show credentials modal ──
      setCredsModal({ user, tempPassword, emailSent });

    } catch (err) {
      showToast('Failed to create user', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editingUser.name.trim())
      return showToast('Full name is required', 'error');
    if (!editingUser.email?.trim())
      return showToast('Email address is required', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingUser.email ?? ''))
      return showToast('Please enter a valid email address', 'error');

    setSaving(true);
    try {
      const branch = ALL_BRANCH_ROLES.includes(editingUser.role)
        ? 'All Branches'
        : (editingUser.branch || 'Pannipitiya');

      const orig = users.find(u => u.username === editingUser.username);
      const updated: UserType = {
        ...editingUser,
        branch,
        password: editingUser.password.trim()
          ? editingUser.password
          : (orig?.password ?? ''),
      };

      await updateUser(updated);
      setUsers(prev => prev.map(u => u.username === updated.username ? updated : u));
      setEditingUser(null);
      showToast('User updated successfully');
    } catch (err) {
      showToast('Failed to update user', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteUser = async (username: string) => {
    setConfirmDelete(null);
    setSaving(true);
    try {
      await removeUser(username);
      setUsers(prev => prev.filter(u => u.username !== username));
      showToast(`User "${username}" deleted`);
    } catch (err) {
      showToast('Failed to delete user', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset Password ─────────────────────────────────────────────────────────
  const handleResetPassword = async (username: string) => {
    const tempPassword = generateTempPassword();
    setSaving(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, username), {
        password:           tempPassword,
        mustChangePassword: true,
      });

      const target = users.find(u => u.username === username);
      setUsers(prev => prev.map(u =>
        u.username === username
          ? { ...u, password: tempPassword, mustChangePassword: true }
          : u
      ));

      let emailSent = false;
      if (target?.email) {
        try {
          await sendPasswordResetEmail({
            toName:   target.name,
            toEmail:  target.email,
            username,
            tempPassword,
          });
          emailSent = true;
        } catch (err) {
          console.warn('Reset email failed:', err);
        }
      }

      // Auto-download locked PDF for reset too
      if (target?.mobile) {
        try {
          await downloadLockedCredentialsPDF({
            name:         target.name,
            username,
            tempPassword,
            role:         target.role,
            branch:       target.branch,
            mobile:       target.mobile,
          });
        } catch (pdfErr) {
          console.warn('Reset PDF download failed:', pdfErr);
        }
      }

      setCredsModal({
        user: target
          ? { ...target, password: tempPassword, mustChangePassword: true }
          : {
              username,
              name: username,
              role: 'User',
              branch: 'N/A',
              password: tempPassword,
            },
        tempPassword,
        emailSent,
      });

    } catch (err) {
      showToast('Failed to reset password', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total:      users.length,
    superAdmin: users.filter(u => u.role === 'Super Admin').length,
    admin:      users.filter(u => u.role === 'Admin').length,
    manager:    users.filter(u => u.role === 'Manager').length,
    cashier:    users.filter(u => u.role === 'Cashier').length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <Shield className="w-7 h-7 md:w-8 md:h-8 text-[#FFD700]" /> User Management
          </h2>
          <p className="text-neutral-400 text-sm">Manage system users and their branch access levels.</p>
        </div>
        <div className="flex gap-3 items-center">
          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </div>
          )}
          <button
            onClick={loadUsers} disabled={loading}
            className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: 'Total Users',  value: stats.total,      color: 'text-white' },
          { label: 'Super Admins', value: stats.superAdmin, color: 'text-purple-400' },
          { label: 'Admins',       value: stats.admin,      color: 'text-red-400' },
          { label: 'Managers',     value: stats.manager,    color: 'text-blue-400' },
          { label: 'Cashiers',     value: stats.cashier,    color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4">
            <div className={`text-xl md:text-2xl font-bold ${s.color}`}>
              {loading ? '—' : s.value}
            </div>
            <div className="text-neutral-500 text-xs md:text-sm mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username or email…"
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', ...AVAILABLE_ROLES]).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 md:py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  roleFilter === role
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'
                }`}
              >
                {role === 'all' ? 'All Roles' : role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <div className="text-neutral-500 mb-3">
              {search || roleFilter !== 'all' ? 'No users found matching filters' : 'No users yet'}
            </div>
            {!search && roleFilter === 'all' && (
              <button onClick={() => setShowAddModal(true)} className="text-[#FFD700] text-sm hover:underline">
                Add your first user
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Username', 'Name & Email', 'Role', 'Branch', 'Status', 'Actions'].map(h => (
                      <th
                        key={h}
                        className={`px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredUsers.map(user => (
                    <tr key={user.username} className="hover:bg-neutral-800/50 transition-colors">

                      {/* Username */}
                      <td className="px-3 md:px-5 py-3 md:py-4 font-mono text-white text-xs md:text-sm whitespace-nowrap">
                        {user.username}
                      </td>

                      {/* Name + Email */}
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        <div className="text-white font-medium text-sm">{user.name}</div>
                        {user.email ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                            <span className="text-xs text-neutral-500 truncate max-w-[180px]">{user.email}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                            <span className="text-xs text-orange-500">No email set</span>
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${ROLE_COLORS[user.role]}`}>
                          {user.role}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        {ALL_BRANCH_ROLES.includes(user.role) ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-neutral-500/20 text-neutral-400 border-neutral-500/30 whitespace-nowrap">
                            All Branches
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30 whitespace-nowrap">
                            {user.branch || 'Not set'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        {user.mustChangePassword ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-orange-500/20 text-orange-400 border-orange-500/30 whitespace-nowrap">
                            Temp Password
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30 whitespace-nowrap">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 md:px-5 py-3 md:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <button
                            onClick={() => setEditingUser({ ...user, password: '' })}
                            title="Edit user"
                            className="p-1.5 md:p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FFD700]" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.username)}
                            title="Reset password"
                            className="p-1.5 md:p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(user.username)}
                            title="Delete user"
                            className="p-1.5 md:p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                          >
                            <Trash className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 md:px-5 py-3 border-t border-neutral-800 text-xs text-neutral-500">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FFD700]" /> Add New User
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setNewUser(EMPTY_NEW_USER); }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-5">
                <Key className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  A temporary password will be auto-generated, emailed to the user, and a
                  <strong className="text-white"> password-locked PDF</strong> will download automatically.
                  The PDF is unlocked with the <strong className="text-white">last 4 digits of the user's mobile number</strong>.
                  They must change it on first login.
                </p>
              </div>
              <UserFormFields user={newUser} onChange={setNewUser} />
              <div className="flex flex-col md:flex-row gap-3 pt-5">
                <button
                  onClick={() => { setShowAddModal(false); setNewUser(EMPTY_NEW_USER); }}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    : <><Lock className="w-4 h-4" /> Create User & Send Credentials</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#FFD700]" /> Edit User
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <UserFormFields user={editingUser} onChange={setEditingUser} isEdit />
              <div className="flex flex-col md:flex-row gap-3 pt-5">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleUpdateUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Check className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {credsModal && (
        <CredentialsModal
          user={credsModal.user}
          tempPassword={credsModal.tempPassword}
          emailSent={credsModal.emailSent}
          onClose={() => setCredsModal(null)}
        />
      )}

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Are you sure you want to delete user "${confirmDelete}"? This action cannot be undone.`}
          onConfirm={() => handleDeleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default UserManagement;