import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, X, Download, Edit2, Trash2, Eye,
  Car, User, Shield, FileText, Image as ImageIcon,
  ChevronRight, ChevronLeft, AlertTriangle, CheckCircle,
  Clock, XCircle, DollarSign, Upload, RefreshCw,
  Hash, Phone, Mail, MapPin, Calendar, Wrench, Package,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { getSessionUser } from '../lib/auth';

// ── API ───────────────────────────────────────────────────────────────────────
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res  = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type QStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Invoiced';

interface RepairItem {
  id:          string;
  type:        'Part' | 'Labour' | 'Other';
  description: string;
  quantity:    number;
  unitPrice:   number;
  total:       number;
}

interface QImage {
  id:      string;
  dataUrl: string;
  name:    string;
}

interface Quotation {
  id?:          string;
  quoteNumber?: string;
  branch:       string;
  status:       QStatus;
  validUntil:   string;
  createdAt?:   string;
  updatedAt?:   string;
  createdBy?:   string;
  customer: { name: string; phone: string; email: string; address: string; };
  vehicle:  { make: string; model: string; year: string; plate: string; color: string; mileage: string; vin: string; };
  insurance:{ hasInsurance: boolean; company: string; policyNumber: string; claimNumber: string; assessorName: string; assessorPhone: string; };
  damageDescription: string;
  items:       RepairItem[];
  images:      QImage[];
  subtotal:    number;
  discountType:'flat' | 'percent';
  discount:    number;
  discountAmt: number;
  taxRate:     number;
  taxAmt:      number;
  total:       number;
  notes:       string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

const BLANK_ITEM  = (): RepairItem => ({ id: Math.random().toString(36).slice(2), type: 'Part', description: '', quantity: 1, unitPrice: 0, total: 0 });
const BLANK_QUOTE = (branch = BRANCHES[0], createdBy = ''): Quotation => ({
  branch, status: 'Draft', validUntil: '',
  createdBy,
  customer:  { name: '', phone: '', email: '', address: '' },
  vehicle:   { make: '', model: '', year: '', plate: '', color: '', mileage: '', vin: '' },
  insurance: { hasInsurance: false, company: '', policyNumber: '', claimNumber: '', assessorName: '', assessorPhone: '' },
  damageDescription: '',
  items: [BLANK_ITEM()],
  images: [],
  subtotal: 0, discountType: 'flat', discount: 0, discountAmt: 0, taxRate: 0, taxAmt: 0, total: 0,
  notes: '',
});

function calcTotals(q: Quotation): Pick<Quotation, 'subtotal' | 'discountAmt' | 'taxAmt' | 'total'> {
  const subtotal    = q.items.reduce((a, i) => a + i.total, 0);
  const discountAmt = q.discountType === 'percent' ? Math.round((subtotal * q.discount) / 100) : q.discount;
  const taxAmt      = Math.round(((subtotal - discountAmt) * q.taxRate) / 100);
  const total       = subtotal - discountAmt + taxAmt;
  return { subtotal, discountAmt, taxAmt, total };
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<QStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  Draft:    { label: 'Draft',    cls: 'bg-neutral-700/60 text-neutral-300 border-neutral-600/40', icon: <FileText className="w-3 h-3" /> },
  Pending:  { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       icon: <Clock className="w-3 h-3" /> },
  Approved: { label: 'Approved',cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  Rejected: { label: 'Rejected',cls: 'bg-red-500/15 text-red-400 border-red-500/30',             icon: <XCircle className="w-3 h-3" /> },
  Invoiced: { label: 'Invoiced',cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',          icon: <DollarSign className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: QStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.Draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Reusable field ─────────────────────────────────────────────────────────────
const FLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{children}</label>
);
const FInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all ${props.className ?? ''}`} />
);
const FSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-all ${props.className ?? ''}`} />
);
const FTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all resize-none ${props.className ?? ''}`} />
);

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-5 border-b border-neutral-800">
      <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700]">{icon}</div>
      <div>
        <h3 className="text-white font-bold text-sm">{title}</h3>
        {sub && <p className="text-neutral-500 text-xs">{sub}</p>}
      </div>
    </div>
  );
}

// ── Image compressor ──────────────────────────────────────────────────────────
function compressImage(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio  = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('canvas error'); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── PDF generator ─────────────────────────────────────────────────────────────
function loadLogo(): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
        else resolve('');
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = '/logo.png';
  });
}

async function downloadPDF(q: Quotation) {
  const logo     = await loadLogo();
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W        = doc.internal.pageSize.getWidth();
  const margin   = 15;
  let   y        = 15;

  const line  = () => { doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.2); doc.line(margin, y, W - margin, y); y += 4; };
  const gap   = (n = 5) => { y += n; };

  // ── Header band
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(255, 215, 0);
  doc.rect(0, 32, W, 2, 'F');
  if (logo) doc.addImage(logo, 'PNG', margin, 6, 20, 20);
  const tx = margin + (logo ? 22 : 0);

  doc.setTextColor(255, 215, 0);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('ANURA TYRES', tx, 14);
  doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('(Pvt) Ltd — Your Trusted Tyre Specialists', tx, 21);
  doc.text('278/2 High Level Rd, Pannipitiya  |  077 578 5785', tx, 27);

  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 215, 0);
  doc.text('QUOTATION', W - margin, 15, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(q.quoteNumber || '', W - margin, 22, { align: 'right' });
  doc.text(`Branch: ${q.branch}`, W - margin, 27, { align: 'right' });

  y = 42;

  // ── Meta row
  doc.setTextColor(100, 100, 100); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  ['Status', 'Date', 'Valid Until'].forEach((label, i) => {
    doc.text(label, margin + i * 55, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30); doc.setFontSize(9);
    const vals = [q.status, q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB') : '—', q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-GB') : '—'];
    doc.text(vals[i], margin + i * 55, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100); doc.setFontSize(8);
  });
  y += 14; line();

  // ── Customer / Vehicle
  const col2 = (W - 2 * margin) / 2 + margin;

  const block = (header: string, rows: { label: string; val: string }[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(header, margin, y); y += 4;
    rows.filter(r => r.val).forEach(r => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(r.label + ':', margin, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(r.val, margin + 28, y);
      y += 5;
    });
    y += 2;
  };

  const savedY = y;
  block('CUSTOMER', [
    { label: 'Name',    val: q.customer.name    },
    { label: 'Phone',   val: q.customer.phone   },
    { label: 'Email',   val: q.customer.email   },
    { label: 'Address', val: q.customer.address },
  ]);
  const leftBottom = y;

  y = savedY;
  const blockRight = (header: string, rows: { label: string; val: string }[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(header, col2, y); y += 4;
    rows.filter(r => r.val).forEach(r => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(r.label + ':', col2, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(r.val, col2 + 22, y);
      y += 5;
    });
    y += 2;
  };
  blockRight('VEHICLE', [
    { label: 'Plate',   val: q.vehicle.plate  },
    { label: 'Make',    val: q.vehicle.make   },
    { label: 'Model',   val: `${q.vehicle.model} ${q.vehicle.year}` },
    { label: 'Colour',  val: q.vehicle.color  },
    { label: 'Mileage', val: q.vehicle.mileage ? `${q.vehicle.mileage} km` : '' },
  ]);
  const rightBottom = y;
  y = Math.max(leftBottom, rightBottom); gap(2); line();

  // ── Insurance (if applicable)
  if (q.insurance.hasInsurance) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('INSURANCE', margin, y); y += 4;
    const ins = [
      { label: 'Company',  val: q.insurance.company      },
      { label: 'Policy #', val: q.insurance.policyNumber },
      { label: 'Claim #',  val: q.insurance.claimNumber  },
      { label: 'Assessor', val: q.insurance.assessorName },
    ].filter(r => r.val);
    ins.forEach((r, idx) => {
      const cx = margin + (idx % 2) * 95;
      if (idx % 2 === 0 && idx > 0) y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(r.label + ':', cx, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(r.val, cx + 22, y);
    });
    y += 8; line();
  }

  // ── Damage description
  if (q.damageDescription) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('DAMAGE DESCRIPTION', margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(q.damageDescription, W - 2 * margin);
    doc.text(lines, margin, y); y += lines.length * 4.5 + 4; line();
  }

  // ── Items table
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, W - 2 * margin, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
  const cols = [margin + 2, margin + 60, margin + 95, margin + 115, margin + 140];
  ['DESCRIPTION', 'TYPE', 'QTY', 'UNIT PRICE', 'TOTAL'].forEach((h, i) => {
    doc.text(h, cols[i], y + 4.5);
  });
  y += 10;

  q.items.forEach((item, idx) => {
    if (y > 260) { doc.addPage(); y = 20; }
    if (idx % 2 === 1) { doc.setFillColor(252, 252, 252); doc.rect(margin, y - 1.5, W - 2 * margin, 7, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
    doc.text(item.description || '—',          cols[0], y + 4);
    doc.text(item.type,                         cols[1], y + 4);
    doc.text(String(item.quantity),             cols[2], y + 4);
    doc.text(`Rs ${item.unitPrice.toLocaleString()}`, cols[3], y + 4);
    doc.text(`Rs ${item.total.toLocaleString()}`,      cols[4], y + 4);
    y += 7;
  });
  gap(3); line();

  // ── Totals
  const totX = W - margin - 55;
  const totV = W - margin - 5;
  const totRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8.5);
    doc.setTextColor(bold ? 30 : 80, bold ? 30 : 80, bold ? 30 : 80);
    doc.text(label, totX, y, { align: 'right' });
    doc.text(val,   totV, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  };
  totRow('Subtotal',          `Rs ${q.subtotal.toLocaleString()}`);
  if (q.discount > 0)
    totRow(`Discount${q.discountType === 'percent' ? ` (${q.discount}%)` : ''}`, `-Rs ${q.discountAmt.toLocaleString()}`);
  if (q.taxRate > 0)
    totRow(`Tax (${q.taxRate}%)`, `Rs ${q.taxAmt.toLocaleString()}`);
  gap(3);
  doc.setDrawColor(255, 215, 0); doc.setLineWidth(0.5);
  doc.line(totX - 30, y, W - margin, y);
  y += 4;
  totRow('TOTAL', `Rs ${q.total.toLocaleString()}`, true);
  gap(4); line();

  // ── Notes
  if (q.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('NOTES', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    const nl = doc.splitTextToSize(q.notes, W - 2 * margin);
    doc.text(nl, margin, y); y += nl.length * 4.5 + 4; line();
  }

  // ── Footer
  const fy = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(255, 215, 0); doc.setLineWidth(0.3);
  doc.line(margin, fy - 3, W - margin, fy - 3);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
  doc.text('This quotation is valid for 30 days from the date of issue. Prices subject to change. E&OE.', W / 2, fy + 2, { align: 'center' });
  doc.text('Anura Tyres (Pvt) Ltd  |  info@anuratyres.lk  |  www.anuratyres.lk', W / 2, fy + 7, { align: 'center' });

  doc.save(`${q.quoteNumber || 'Quotation'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM MODAL (Create / Edit)
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS = ['Customer & Vehicle', 'Insurance', 'Damage & Photos', 'Repair Items', 'Summary'];

function QuotationForm({ initial, onClose, onSaved }: {
  initial?: Quotation;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const session   = getSessionUser();
  const isEdit    = !!initial?.id;
  const [step,    setStep]    = useState(0);
  const [data,    setData]    = useState<Quotation>(() =>
    initial ? { ...initial, items: initial.items?.length ? initial.items : [BLANK_ITEM()] }
            : BLANK_QUOTE(session?.branch && session.branch !== 'All Branches' ? session.branch : BRANCHES[0], session?.name || '')
  );
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const fileRef   = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Quotation>(k: K, v: Quotation[K]) =>
    setData(d => {
      const next = { ...d, [k]: v };
      return { ...next, ...calcTotals(next) };
    });

  const setCustomer  = (k: keyof Quotation['customer'],  v: string) => set('customer',  { ...data.customer,  [k]: v });
  const setVehicle   = (k: keyof Quotation['vehicle'],   v: string) => set('vehicle',   { ...data.vehicle,   [k]: v });
  const setInsurance = (k: keyof Quotation['insurance'], v: any)    => set('insurance', { ...data.insurance, [k]: v });

  const setItem = (idx: number, patch: Partial<RepairItem>) =>
    set('items', data.items.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, ...patch };
      updated.total = Math.round(updated.quantity * updated.unitPrice);
      return updated;
    }));

  const addItem    = () => set('items', [...data.items, BLANK_ITEM()]);
  const removeItem = (idx: number) => set('items', data.items.filter((_, i) => i !== idx));

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const compressed = await Promise.all(
      Array.from(files).slice(0, 5).map(async f => ({
        id:      Math.random().toString(36).slice(2),
        dataUrl: await compressImage(f),
        name:    f.name,
      }))
    );
    set('images', [...data.images, ...compressed]);
  };

  const removeImage = (id: string) =>
    set('images', data.images.filter(img => img.id !== id));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!data.customer.name.trim())  e.custName  = 'Customer name is required';
    if (!data.customer.phone.trim()) e.custPhone = 'Phone is required';
    if (!data.vehicle.plate.trim())  e.plate     = 'Vehicle plate is required';
    if (data.items.every(i => !i.description.trim())) e.items = 'At least one repair item is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { setStep(0); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/quotations/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await apiFetch('/quotations', { method: 'POST', body: JSON.stringify(data) });
      }
      onSaved(); onClose();
    } catch (e: any) {
      setErrors({ _global: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-2xl shadow-2xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h2>
            <p className="text-xs text-neutral-500">{STEPS[step]} · Step {step + 1} of {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 border-b border-neutral-800 gap-1 flex-shrink-0">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-[#FFD700]' : 'bg-neutral-800'}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errors._global && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{errors._global}</div>
          )}

          {/* ── Step 0: Customer & Vehicle ── */}
          {step === 0 && (
            <>
              <SectionHead icon={<User className="w-4 h-4" />} title="Customer Information" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FLabel>Full Name *</FLabel>
                  <FInput value={data.customer.name} onChange={e => setCustomer('name', e.target.value.toUpperCase())} placeholder="E.G. KAMAL PERERA" />
                  {errors.custName && <p className="text-red-400 text-xs mt-1">{errors.custName}</p>}
                </div>
                <div>
                  <FLabel>Phone *</FLabel>
                  <FInput value={data.customer.phone} onChange={e => setCustomer('phone', e.target.value.toUpperCase())} placeholder="077 123 4567" />
                  {errors.custPhone && <p className="text-red-400 text-xs mt-1">{errors.custPhone}</p>}
                </div>
                <div>
                  <FLabel>Email</FLabel>
                  <FInput type="email" value={data.customer.email} onChange={e => setCustomer('email', e.target.value)} placeholder="kamal@example.com" />
                </div>
                <div className="col-span-2">
                  <FLabel>Address</FLabel>
                  <FInput value={data.customer.address} onChange={e => setCustomer('address', e.target.value.toUpperCase())} placeholder="NO. 12, MAIN STREET, COLOMBO" />
                </div>
              </div>

              <SectionHead icon={<Car className="w-4 h-4" />} title="Vehicle Information" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FLabel>Plate Number *</FLabel>
                  <FInput value={data.vehicle.plate} onChange={e => setVehicle('plate', e.target.value.toUpperCase())} placeholder="WP CAB-1234" />
                  {errors.plate && <p className="text-red-400 text-xs mt-1">{errors.plate}</p>}
                </div>
                <div>
                  <FLabel>Colour</FLabel>
                  <FInput value={data.vehicle.color} onChange={e => setVehicle('color', e.target.value.toUpperCase())} placeholder="SILVER" />
                </div>
                <div>
                  <FLabel>Make</FLabel>
                  <FInput value={data.vehicle.make} onChange={e => setVehicle('make', e.target.value.toUpperCase())} placeholder="TOYOTA" />
                </div>
                <div>
                  <FLabel>Model</FLabel>
                  <FInput value={data.vehicle.model} onChange={e => setVehicle('model', e.target.value.toUpperCase())} placeholder="COROLLA" />
                </div>
                <div>
                  <FLabel>Year</FLabel>
                  <FInput value={data.vehicle.year} onChange={e => setVehicle('year', e.target.value)} placeholder="2019" />
                </div>
                <div>
                  <FLabel>Mileage (km)</FLabel>
                  <FInput value={data.vehicle.mileage} onChange={e => setVehicle('mileage', e.target.value)} placeholder="45000" />
                </div>
                <div className="col-span-2">
                  <FLabel>VIN / Chassis No.</FLabel>
                  <FInput value={data.vehicle.vin} onChange={e => setVehicle('vin', e.target.value.toUpperCase())} placeholder="OPTIONAL" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <FLabel>Branch</FLabel>
                  <FSelect value={data.branch} onChange={e => set('branch', e.target.value)}>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </FSelect>
                </div>
                <div>
                  <FLabel>Valid Until</FLabel>
                  <FInput type="date" value={data.validUntil} onChange={e => set('validUntil', e.target.value)}
                    min={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
            </>
          )}

          {/* ── Step 1: Insurance ── */}
          {step === 1 && (
            <>
              <SectionHead icon={<Shield className="w-4 h-4" />} title="Insurance Details" sub="Leave blank if customer is paying directly" />

              <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl hover:border-neutral-600 transition-colors">
                <input type="checkbox" checked={data.insurance.hasInsurance}
                  onChange={e => setInsurance('hasInsurance', e.target.checked)}
                  className="w-4 h-4 accent-[#FFD700]" />
                <div>
                  <p className="text-white text-sm font-semibold">Insurance Claim</p>
                  <p className="text-neutral-500 text-xs">This repair is covered by insurance</p>
                </div>
              </label>

              {data.insurance.hasInsurance && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                  <div className="col-span-2">
                    <FLabel>Insurance Company *</FLabel>
                    <FInput value={data.insurance.company} onChange={e => setInsurance('company', e.target.value.toUpperCase())} placeholder="E.G. CEYLINCO GENERAL INSURANCE" />
                  </div>
                  <div>
                    <FLabel>Policy Number</FLabel>
                    <FInput value={data.insurance.policyNumber} onChange={e => setInsurance('policyNumber', e.target.value.toUpperCase())} placeholder="POL-XXXXXXXX" />
                  </div>
                  <div>
                    <FLabel>Claim Number</FLabel>
                    <FInput value={data.insurance.claimNumber} onChange={e => setInsurance('claimNumber', e.target.value.toUpperCase())} placeholder="CLM-XXXXXXXX" />
                  </div>
                  <div>
                    <FLabel>Assessor Name</FLabel>
                    <FInput value={data.insurance.assessorName} onChange={e => setInsurance('assessorName', e.target.value.toUpperCase())} placeholder="ASSESSOR'S FULL NAME" />
                  </div>
                  <div>
                    <FLabel>Assessor Phone</FLabel>
                    <FInput value={data.insurance.assessorPhone} onChange={e => setInsurance('assessorPhone', e.target.value.toUpperCase())} placeholder="077 XXX XXXX" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Damage & Photos ── */}
          {step === 2 && (
            <>
              <SectionHead icon={<AlertTriangle className="w-4 h-4" />} title="Damage Description" />
              <div>
                <FLabel>Describe the damage *</FLabel>
                <FTextarea
                  rows={5}
                  value={data.damageDescription}
                  onChange={e => set('damageDescription', e.target.value)}
                  placeholder="Describe the nature and extent of damage. Include which parts are affected, severity, and any other relevant details..."
                />
              </div>

              <SectionHead icon={<ImageIcon className="w-4 h-4" />} title="Damage Photos" sub={`${data.images.length} uploaded (max 8)`} />

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center cursor-pointer hover:border-[#FFD700]/50 hover:bg-[#FFD700]/5 transition-all"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); addImages(e.dataTransfer.files); }}
              >
                <Upload className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-400 text-sm font-medium">Click to upload or drag & drop</p>
                <p className="text-neutral-600 text-xs mt-1">JPG, PNG — max 5 images at once, auto-compressed to 800px</p>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addImages(e.target.files)} />
              </div>

              {data.images.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {data.images.map(img => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-neutral-700 aspect-square">
                      <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Repair Items ── */}
          {step === 3 && (
            <>
              <SectionHead icon={<Wrench className="w-4 h-4" />} title="Repair Items" sub="Add parts and labour charges" />
              {errors.items && <p className="text-red-400 text-xs mb-2">{errors.items}</p>}

              <div className="space-y-2">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 px-1">
                  {['Type', 'Description', 'Qty', 'Unit Price (Rs)', 'Total', ''].map((h, i) => (
                    <span key={i} className={`text-[10px] font-bold text-neutral-500 uppercase tracking-wider ${i === 1 ? 'col-span-4' : i === 3 ? 'col-span-2' : i === 5 ? 'col-span-1' : 'col-span-2'}`}>
                      {h}
                    </span>
                  ))}
                </div>

                {data.items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <FSelect value={item.type} onChange={e => setItem(idx, { type: e.target.value as RepairItem['type'] })}>
                        <option>Part</option>
                        <option>Labour</option>
                        <option>Other</option>
                      </FSelect>
                    </div>
                    <div className="col-span-4">
                      <FInput value={item.description} onChange={e => setItem(idx, { description: e.target.value.toUpperCase() })} placeholder="E.G. FRONT BRAKE PADS" />
                    </div>
                    <div className="col-span-2">
                      <FInput type="number" min={1} value={item.quantity} onChange={e => setItem(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <FInput type="number" min={0} value={item.unitPrice} onChange={e => setItem(idx, { unitPrice: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-1 text-white text-xs font-medium text-right">
                      {item.total.toLocaleString()}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeItem(idx)} disabled={data.items.length === 1}
                        className="p-1.5 text-neutral-600 hover:text-red-400 disabled:opacity-20 transition-colors rounded-lg hover:bg-red-500/10">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={addItem}
                  className="w-full py-2.5 border border-dashed border-neutral-700 rounded-xl text-neutral-500 hover:text-white hover:border-neutral-500 text-sm transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Summary ── */}
          {step === 4 && (
            <>
              <SectionHead icon={<DollarSign className="w-4 h-4" />} title="Pricing Summary" />

              <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Subtotal</span>
                  <span className="text-white font-medium">Rs {data.subtotal.toLocaleString()}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400 text-sm w-20 flex-shrink-0">Discount</span>
                  <div className="flex flex-1 gap-2">
                    <FSelect className="w-24 flex-shrink-0" value={data.discountType}
                      onChange={e => set('discountType', e.target.value as 'flat' | 'percent')}>
                      <option value="flat">Rs</option>
                      <option value="percent">%</option>
                    </FSelect>
                    <FInput type="number" min={0} value={data.discount} onChange={e => set('discount', Number(e.target.value))} placeholder="0" />
                  </div>
                  {data.discountAmt > 0 && <span className="text-red-400 text-sm whitespace-nowrap">−Rs {data.discountAmt.toLocaleString()}</span>}
                </div>

                {/* Tax */}
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400 text-sm w-20 flex-shrink-0">Tax %</span>
                  <FInput type="number" min={0} max={100} value={data.taxRate} onChange={e => set('taxRate', Number(e.target.value))} placeholder="0" className="flex-1" />
                  {data.taxAmt > 0 && <span className="text-blue-400 text-sm whitespace-nowrap">+Rs {data.taxAmt.toLocaleString()}</span>}
                </div>

                <div className="border-t border-neutral-700 pt-3 flex justify-between">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-[#FFD700] font-bold text-xl">Rs {data.total.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <FLabel>Notes / Terms</FLabel>
                <FTextarea rows={4} value={data.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Any additional notes, terms, or conditions for this quotation..." />
              </div>

              <div>
                <FLabel>Status</FLabel>
                <FSelect value={data.status} onChange={e => set('status', e.target.value as QStatus)}>
                  {(['Draft', 'Pending', 'Approved', 'Rejected', 'Invoiced'] as QStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </FSelect>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 flex-shrink-0">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-xl text-neutral-300 text-sm disabled:opacity-30 hover:bg-neutral-800 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-neutral-700 rounded-xl text-neutral-400 text-sm hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</>
                  : <><CheckCircle className="w-4 h-4" /> {isEdit ? 'Update Quotation' : 'Create Quotation'}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function QuotationDetail({ q, onClose, onEdit, onStatusChange, onDelete }: {
  q:              Quotation;
  onClose:        () => void;
  onEdit:         () => void;
  onStatusChange: (s: QStatus) => void;
  onDelete:       () => void;
}) {
  const [delConfirm, setDelConfirm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-end z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-neutral-900 border-l border-neutral-700 h-full w-full max-w-xl overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm px-6 py-4 border-b border-neutral-800 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold font-mono">{q.quoteNumber}</span>
              <StatusBadge status={q.status} />
            </div>
            <p className="text-neutral-500 text-xs mt-0.5">{q.branch} · {q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadPDF(q)} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs hover:text-white transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status changer */}
          <div className="flex items-center gap-3 p-4 bg-neutral-800/60 border border-neutral-700 rounded-xl">
            <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Status</span>
            <div className="flex gap-2 flex-wrap flex-1">
              {(['Draft', 'Pending', 'Approved', 'Rejected', 'Invoiced'] as QStatus[]).map(s => (
                <button key={s} onClick={() => onStatusChange(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${q.status === s ? STATUS_MAP[s].cls : 'bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Totals highlight */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Subtotal',   val: `Rs ${q.subtotal.toLocaleString()}`,    color: 'text-white' },
              { label: 'Discount',   val: q.discountAmt > 0 ? `−Rs ${q.discountAmt.toLocaleString()}` : '—', color: 'text-red-400' },
              { label: 'Total',      val: `Rs ${q.total.toLocaleString()}`,        color: 'text-[#FFD700]' },
            ].map(c => (
              <div key={c.label} className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3 text-center">
                <div className={`font-bold text-base ${c.color}`}>{c.val}</div>
                <div className="text-neutral-500 text-xs mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Customer */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Customer</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <User className="w-3.5 h-3.5" />,  val: q.customer.name    },
                { icon: <Phone className="w-3.5 h-3.5" />, val: q.customer.phone   },
                { icon: <Mail className="w-3.5 h-3.5" />,  val: q.customer.email   },
                { icon: <MapPin className="w-3.5 h-3.5" />,val: q.customer.address },
              ].filter(r => r.val).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="text-neutral-600 flex-shrink-0">{r.icon}</span> {r.val}
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Vehicle</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Plate',   val: q.vehicle.plate   },
                { label: 'Make',    val: q.vehicle.make    },
                { label: 'Model',   val: q.vehicle.model   },
                { label: 'Year',    val: q.vehicle.year    },
                { label: 'Colour',  val: q.vehicle.color   },
                { label: 'Mileage', val: q.vehicle.mileage ? `${q.vehicle.mileage} km` : '' },
              ].filter(r => r.val).map(r => (
                <div key={r.label} className="flex justify-between px-3 py-2 bg-neutral-800/50 rounded-lg">
                  <span className="text-neutral-500 text-xs">{r.label}</span>
                  <span className="text-white text-xs font-medium">{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insurance */}
          {q.insurance.hasInsurance && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Insurance Claim</span>
              </div>
              {[
                { label: 'Company',  val: q.insurance.company      },
                { label: 'Policy #', val: q.insurance.policyNumber },
                { label: 'Claim #',  val: q.insurance.claimNumber  },
                { label: 'Assessor', val: q.insurance.assessorName },
              ].filter(r => r.val).map(r => (
                <div key={r.label} className="flex justify-between text-xs">
                  <span className="text-neutral-500">{r.label}</span>
                  <span className="text-white font-mono">{r.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Damage description */}
          {q.damageDescription && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Damage Description</h4>
              <p className="text-neutral-300 text-sm leading-relaxed bg-neutral-800/50 rounded-xl p-3">{q.damageDescription}</p>
            </div>
          )}

          {/* Damage images */}
          {q.images?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Damage Photos ({q.images.length})</h4>
              <div className="grid grid-cols-3 gap-2">
                {q.images.map(img => (
                  <img key={img.id} src={img.dataUrl} alt={img.name}
                    className="rounded-xl border border-neutral-700 aspect-square object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* Repair items */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Repair Items</h4>
            <div className="rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Description', 'Type', 'Qty', 'Unit', 'Total'].map(h => (
                      <th key={h} className={`px-3 py-2 text-left text-neutral-500 font-bold uppercase tracking-wider ${h === 'Total' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {q.items.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-800/30">
                      <td className="px-3 py-2.5 text-white">{item.description || '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-400">{item.type}</td>
                      <td className="px-3 py-2.5 text-neutral-400">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-neutral-400">Rs {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-white text-right font-medium">Rs {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {q.notes && (
            <div className="p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-neutral-300 text-sm">{q.notes}</p>
            </div>
          )}

          {/* Validity */}
          {q.validUntil && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Calendar className="w-3.5 h-3.5" />
              Valid until {new Date(q.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          )}

          {/* Delete */}
          <div className="pt-4 border-t border-neutral-800">
            {delConfirm ? (
              <div className="flex items-center gap-3">
                <p className="text-red-400 text-sm flex-1">Delete this quotation permanently?</p>
                <button onClick={() => setDelConfirm(false)} className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:bg-neutral-800">Cancel</button>
                <button onClick={onDelete} className="px-3 py-1.5 bg-red-600 rounded-lg text-white text-xs font-bold hover:bg-red-700">Delete</button>
              </div>
            ) : (
              <button onClick={() => setDelConfirm(true)}
                className="flex items-center gap-2 text-red-400 text-xs hover:text-red-300 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete Quotation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function QuotationPage() {
  const session = getSessionUser();
  const userBranch = session?.branch && session.branch !== 'All Branches' ? session.branch : '';

  const [quotes,   setQuotes]   = useState<Quotation[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<QStatus | 'All'>('All');
  const [branch,   setBranch]   = useState(userBranch);
  const [showForm, setShowForm] = useState(false);
  const [editQ,    setEditQ]    = useState<Quotation | undefined>(undefined);
  const [detailQ,  setDetailQ]  = useState<Quotation | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (branch) params.set('branch', branch);
      if (filter !== 'All') params.set('status', filter);
      if (search.trim().length > 1) params.set('search', search.trim());
      const data = await apiFetch(`/quotations?${params}`);
      setQuotes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branch, filter, search]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const patchStatus = async (id: string, status: QStatus) => {
    await apiFetch(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setQuotes(q => q.map(x => x.id === id ? { ...x, status } : x));
    if (detailQ?.id === id) setDetailQ(d => d ? { ...d, status } : d);
  };

  const deleteQuote = async (id: string) => {
    await apiFetch(`/quotations/${id}`, { method: 'DELETE' });
    setQuotes(q => q.filter(x => x.id !== id));
    setDetailQ(null);
  };

  const openEdit = (q: Quotation) => { setEditQ(q); setDetailQ(null); setShowForm(true); };
  const openNew  = ()             => { setEditQ(undefined); setShowForm(true); };

  // Stats
  const stats = {
    total:    quotes.length,
    pending:  quotes.filter(q => q.status === 'Pending').length,
    approved: quotes.filter(q => q.status === 'Approved').length,
    value:    quotes.filter(q => q.status !== 'Rejected').reduce((a, q) => a + q.total, 0),
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Quotations</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Create and manage repair quotations</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
          <Plus className="w-4 h-4" /> New Quotation
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Quotes',    value: stats.total,                                   color: 'text-white',        icon: <FileText className="w-5 h-5" /> },
          { label: 'Pending',         value: stats.pending,                                 color: 'text-amber-400',    icon: <Clock className="w-5 h-5" /> },
          { label: 'Approved',        value: stats.approved,                                color: 'text-emerald-400',  icon: <CheckCircle className="w-5 h-5" /> },
          { label: 'Quoted Value',    value: `Rs ${(stats.value / 1000).toFixed(0)}k`,      color: 'text-[#FFD700]',   icon: <DollarSign className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className={`mb-2 ${s.color} opacity-60`}>{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by quote #, customer, plate…"
            className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          {(['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Invoiced'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${filter === s ? 'bg-[#FFD700] text-black' : 'text-neutral-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Branch */}
        {!userBranch && (
          <select value={branch} onChange={e => setBranch(e.target.value)}
            className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700]">
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <button onClick={fetch_} disabled={loading} className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span>⚠ {error}</span>
          <button onClick={fetch_} className="underline hover:no-underline text-xs">Retry</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
            <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
            Loading quotations…
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="w-12 h-12 text-neutral-700 mx-auto" />
            <p className="text-neutral-500 text-sm">No quotations found</p>
            <button onClick={openNew} className="text-[#FFD700] text-sm hover:underline">Create your first quotation →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Quote #', 'Customer', 'Vehicle', 'Branch', 'Date', 'Status', 'Total', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {quotes.map(q => (
                  <tr key={q.id} onClick={() => setDetailQ(q)}
                    className="hover:bg-neutral-800/40 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs text-[#FFD700] font-bold">{q.quoteNumber}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-white font-medium">{q.customer.name || '—'}</div>
                      <div className="text-neutral-500 text-xs">{q.customer.phone}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-white font-mono text-xs">{q.vehicle.plate || '—'}</div>
                      <div className="text-neutral-500 text-xs">{[q.vehicle.make, q.vehicle.model].filter(Boolean).join(' ')}</div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400 text-xs whitespace-nowrap">{q.branch}</td>
                    <td className="px-4 py-3.5 text-neutral-500 text-xs whitespace-nowrap">
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3.5">
                      <span className="text-white font-bold">Rs {q.total.toLocaleString()}</span>
                      {q.insurance.hasInsurance && <span className="ml-1.5 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">INS</span>}
                    </td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailQ(q)} title="View" className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-neutral-700 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(q)} title="Edit" className="p-1.5 rounded-lg text-neutral-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => downloadPDF(q)} title="Download PDF" className="p-1.5 rounded-lg text-neutral-600 hover:text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <QuotationForm
          initial={editQ}
          onClose={() => { setShowForm(false); setEditQ(undefined); }}
          onSaved={fetch_}
        />
      )}
      {detailQ && (
        <QuotationDetail
          q={detailQ}
          onClose={() => setDetailQ(null)}
          onEdit={() => openEdit(detailQ)}
          onStatusChange={s => patchStatus(detailQ.id!, s)}
          onDelete={() => deleteQuote(detailQ.id!)}
        />
      )}
    </div>
  );
}
