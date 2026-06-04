import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, X, Download, Edit2, Trash2, Eye,
  User, Car, FileText, CheckCircle, Clock, XCircle,
  DollarSign, Printer, RefreshCw, Hash, Phone, Mail,
  MapPin, Calendar, Wrench, AlertTriangle, CreditCard,
  Banknote, ChevronDown, ChevronLeft, ChevronRight, Package,
  BarChart2,
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
type InvStatus    = 'Draft' | 'Issued' | 'Paid' | 'Void';
type PayStatus    = 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
type PayMethod    = 'Cash' | 'Card' | 'Bank Transfer' | 'Online' | 'Insurance' | 'Cheque';

interface InvoiceLine {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;
  total:       number;
}

interface PaymentRecord {
  amount:     number;
  method:     PayMethod;
  notes:      string;
  date:       string;
  recordedAt: string;
}

interface Invoice {
  id?:            string;
  invoiceNumber?: string;
  branch:         string;
  invoiceDate:    string;
  dueDate:        string;
  status:         InvStatus;
  // Job link
  jobId?:         string;
  jobRef?:        string;
  // Customer
  customer: {
    name:         string;
    phone:        string;
    email:        string;
    address:      string;
    vehiclePlate: string;
    vehicleMake:  string;
    vehicleModel: string;
  };
  // Charges
  lines:          InvoiceLine[];
  labourCharge:   number;
  partsTotal:     number;
  subtotal:       number;
  discountType:   'flat' | 'percent';
  discount:       number;
  discountAmt:    number;
  taxRate:        number;
  taxAmt:         number;
  total:          number;
  // Payment
  paymentStatus:  PayStatus;
  paymentMethod:  PayMethod;
  paidAmount:     number;
  balance:        number;
  paymentDate:    string;
  paymentNotes:   string;
  paymentHistory: PaymentRecord[];
  // Meta
  notes:          string;
  createdBy?:     string;
  createdAt?:     string;
  updatedAt?:     string;
}

interface LinkableJob {
  id:            string;
  service:       string;
  customerName:  string;
  customerPhone: string;
  vehiclePlate:  string;
  date:          string;
  workMins:      number;
  labourSugg:    number;
  partsSugg:     number;
  isInvoiced:    boolean;
  staffName:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BRANCHES    = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];
const PAY_METHODS: PayMethod[] = ['Cash', 'Card', 'Bank Transfer', 'Online', 'Insurance', 'Cheque'];

const BLANK_LINE = (): InvoiceLine => ({
  id: Math.random().toString(36).slice(2), description: '', quantity: 1, unitPrice: 0, total: 0,
});

function calcInvoice(inv: Invoice): Pick<Invoice, 'partsTotal' | 'subtotal' | 'discountAmt' | 'taxAmt' | 'total' | 'balance'> {
  const partsTotal  = inv.lines.reduce((a, l) => a + l.total, 0);
  const subtotal    = partsTotal + (inv.labourCharge || 0);
  const discountAmt = inv.discountType === 'percent'
    ? Math.round((subtotal * inv.discount) / 100)
    : (inv.discount || 0);
  const afterDisc   = subtotal - discountAmt;
  const taxAmt      = Math.round((afterDisc * (inv.taxRate || 0)) / 100);
  const total       = afterDisc + taxAmt;
  const balance     = Math.max(0, total - (inv.paidAmount || 0));
  return { partsTotal, subtotal, discountAmt, taxAmt, total, balance };
}

function blankInvoice(branch: string, createdBy: string): Invoice {
  const today = new Date().toISOString().split('T')[0];
  const due   = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().split('T')[0];
  return {
    branch, invoiceDate: today, dueDate: due, status: 'Issued',
    createdBy,
    customer: { name: '', phone: '', email: '', address: '', vehiclePlate: '', vehicleMake: '', vehicleModel: '' },
    lines: [BLANK_LINE()],
    labourCharge: 0, partsTotal: 0, subtotal: 0,
    discountType: 'flat', discount: 0, discountAmt: 0,
    taxRate: 0, taxAmt: 0, total: 0,
    paymentStatus: 'Unpaid', paymentMethod: 'Cash',
    paidAmount: 0, balance: 0, paymentDate: '', paymentNotes: '',
    paymentHistory: [],
    notes: '',
  };
}

// ── Status / payment helpers ───────────────────────────────────────────────────
const INV_STATUS: Record<InvStatus, { cls: string; icon: React.ReactNode }> = {
  Draft:  { cls: 'bg-neutral-700/60 text-neutral-300 border-neutral-600/40', icon: <FileText className="w-3 h-3" /> },
  Issued: { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',          icon: <Clock className="w-3 h-3" /> },
  Paid:   { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  Void:   { cls: 'bg-neutral-600/30 text-neutral-500 border-neutral-600/30', icon: <XCircle className="w-3 h-3" /> },
};

const PAY_STATUS: Record<PayStatus, { cls: string; icon: React.ReactNode }> = {
  Unpaid:  { cls: 'bg-red-500/15 text-red-400 border-red-500/30',           icon: <AlertTriangle className="w-3 h-3" /> },
  Partial: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',     icon: <BarChart2 className="w-3 h-3" /> },
  Paid:    { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',icon: <CheckCircle className="w-3 h-3" /> },
  Overdue: { cls: 'bg-red-600/20 text-red-300 border-red-600/40',           icon: <Clock className="w-3 h-3" /> },
};

function Badge({ status, type = 'inv' }: { status: string; type?: 'inv' | 'pay' }) {
  const map   = type === 'pay' ? PAY_STATUS : INV_STATUS;
  const entry = (map as any)[status] ?? INV_STATUS.Draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${entry.cls}`}>
      {entry.icon} {status}
    </span>
  );
}

// ── Reusable form inputs ──────────────────────────────────────────────────────
const FL = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{children}</label>
);
const FI = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all ${p.className ?? ''}`} />
);
const FS = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-all ${p.className ?? ''}`} />
);
const FT = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all resize-none ${p.className ?? ''}`} />
);

// ── PDF Generator ─────────────────────────────────────────────────────────────
function downloadPDF(inv: Invoice) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W      = doc.internal.pageSize.getWidth();
  const mg     = 15;
  let   y      = 15;

  const ln = () => { doc.setDrawColor(230,230,230); doc.setLineWidth(0.2); doc.line(mg, y, W-mg, y); y += 4; };
  const sp = (n=4) => { y += n; };

  // Header band
  doc.setFillColor(15,15,15); doc.rect(0,0,W,32,'F');
  doc.setFillColor(255,215,0); doc.rect(0,32,W,2,'F');
  doc.setTextColor(255,215,0); doc.setFontSize(22); doc.setFont('helvetica','bold');
  doc.text('ANURA TYRES', mg, 14);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
  doc.text('(Pvt) Ltd — Your Trusted Tyre Specialists', mg, 21);
  doc.text('278/2 High Level Rd, Pannipitiya  |  077 578 5785', mg, 27);

  doc.setFontSize(20); doc.setFont('helvetica','bold'); doc.setTextColor(255,215,0);
  doc.text('INVOICE', W-mg, 15, { align:'right' });
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(200,200,200);
  doc.text(inv.invoiceNumber || '', W-mg, 22, { align:'right' });
  doc.text(`Branch: ${inv.branch}`, W-mg, 27, { align:'right' });

  y = 42;
  const c2 = W/2 + 5;

  // Meta
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(100,100,100);
  ['Invoice Date','Due Date','Status','Payment'].forEach((lbl,i) => {
    const x = i < 2 ? mg + i*55 : c2 + (i-2)*55;
    doc.text(lbl, x, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30); doc.setFontSize(9);
    const v = [
      inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-GB') : '—',
      inv.dueDate     ? new Date(inv.dueDate).toLocaleDateString('en-GB')     : '—',
      inv.status, inv.paymentStatus,
    ];
    doc.text(v[i], x, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(100,100,100);
  });
  y += 14; ln();

  // Customer & Vehicle
  const savedY = y;
  const block = (header: string, rows: {l:string;v:string}[], cx=mg) => {
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(header, cx, y); y += 4;
    rows.filter(r=>r.v).forEach(r => {
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(100,100,100);
      doc.text(r.l+':', cx, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,30,30);
      doc.text(r.v, cx+25, y); y += 5;
    });
    y += 2;
  };

  block('BILL TO', [
    {l:'Name',    v:inv.customer.name    },
    {l:'Phone',   v:inv.customer.phone   },
    {l:'Email',   v:inv.customer.email   },
    {l:'Address', v:inv.customer.address },
  ]);
  const leftY = y; y = savedY;

  block('VEHICLE', [
    {l:'Plate',  v:inv.customer.vehiclePlate },
    {l:'Make',   v:inv.customer.vehicleMake  },
    {l:'Model',  v:inv.customer.vehicleModel },
  ], c2);
  if(inv.jobRef) block('JOB REF', [{l:'Ref', v:inv.jobRef}], c2);

  y = Math.max(leftY, y); sp(2); ln();

  // Items table
  doc.setFillColor(245,245,245); doc.rect(mg, y, W-2*mg, 7, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(60,60,60);
  const cols = [mg+2, mg+65, mg+95, mg+125, W-mg-22];
  ['DESCRIPTION','QTY','UNIT PRICE','TOTAL'].forEach((h,i) => {
    doc.text(h, i === 3 ? W-mg-2 : cols[i], y+4.5, { align: i===3?'right':undefined });
  });
  y += 10;

  inv.lines.filter(l=>l.description).forEach((line,idx) => {
    if(y>255){doc.addPage();y=20;}
    if(idx%2===1){doc.setFillColor(252,252,252);doc.rect(mg,y-1.5,W-2*mg,7,'F');}
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text(line.description, cols[0], y+4);
    doc.text(String(line.quantity), cols[1]+5, y+4);
    doc.text(`Rs ${line.unitPrice.toLocaleString()}`, cols[2], y+4);
    doc.text(`Rs ${line.total.toLocaleString()}`, W-mg-2, y+4, {align:'right'});
    y += 7;
  });

  // Labour row
  if(inv.labourCharge > 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text('Labour Charges', cols[0], y+4);
    doc.text('—', cols[1]+5, y+4);
    doc.text('—', cols[2], y+4);
    doc.text(`Rs ${inv.labourCharge.toLocaleString()}`, W-mg-2, y+4, {align:'right'});
    y += 7;
  }
  sp(3); ln();

  // Totals
  const tx = W-mg-60; const tv = W-mg-2;
  const tRow = (lbl:string, val:string, bold=false) => {
    doc.setFont('helvetica', bold?'bold':'normal');
    doc.setFontSize(bold?10:8.5);
    doc.setTextColor(bold?30:80, bold?30:80, bold?30:80);
    doc.text(lbl, tx, y, {align:'right'});
    doc.text(val, tv, y, {align:'right'});
    y += bold?7:5.5;
  };
  tRow('Parts Total', `Rs ${inv.partsTotal.toLocaleString()}`);
  tRow('Labour',      `Rs ${inv.labourCharge.toLocaleString()}`);
  tRow('Subtotal',    `Rs ${inv.subtotal.toLocaleString()}`);
  if(inv.discount>0)
    tRow(`Discount${inv.discountType==='percent'?` (${inv.discount}%)`:''}`, `−Rs ${inv.discountAmt.toLocaleString()}`);
  if(inv.taxRate>0)
    tRow(`VAT/Tax (${inv.taxRate}%)`, `Rs ${inv.taxAmt.toLocaleString()}`);
  doc.setDrawColor(255,215,0); doc.setLineWidth(0.4); doc.line(tx-10, y-1, tv, y-1);
  tRow('TOTAL', `Rs ${inv.total.toLocaleString()}`, true);

  if(inv.paidAmount > 0) {
    tRow('Paid', `−Rs ${inv.paidAmount.toLocaleString()}`);
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.2); doc.line(tx-10, y-1, tv, y-1);
    tRow('BALANCE DUE', `Rs ${inv.balance.toLocaleString()}`, true);
  }
  sp(4); ln();

  if(inv.notes){
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text('NOTES', mg, y); y+=4;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60,60,60);
    doc.text(doc.splitTextToSize(inv.notes, W-2*mg), mg, y); sp(10);
  }

  const fy = doc.internal.pageSize.getHeight()-14;
  doc.setDrawColor(255,215,0); doc.setLineWidth(0.3); doc.line(mg,fy-3,W-mg,fy-3);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(140,140,140);
  doc.text('Thank you for your business!  |  Payment due within 30 days.  |  E&OE.', W/2, fy+2, {align:'center'});
  doc.text('Anura Tyres (Pvt) Ltd  |  info@anuratyres.lk  |  www.anuratyres.lk', W/2, fy+7, {align:'center'});

  doc.save(`${inv.invoiceNumber||'Invoice'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function PaymentModal({ invoice, onClose, onSaved }: {
  invoice: Invoice; onClose: () => void; onSaved: (updated: Partial<Invoice>) => void;
}) {
  const [amount,  setAmount]  = useState(String(invoice.balance || invoice.total));
  const [method,  setMethod]  = useState<PayMethod>('Cash');
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      const result = await apiFetch(`/invoices/${invoice.id}/payment`, {
        method: 'PATCH',
        body:   JSON.stringify({ paidAmount: (invoice.paidAmount || 0) + amt, paymentMethod: method, paymentNotes: notes, paymentDate: date }),
      });
      onSaved({ paidAmount: (invoice.paidAmount || 0) + amt, paymentStatus: result.paymentStatus, balance: result.balance });
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const total   = invoice.total;
  const already = invoice.paidAmount || 0;
  const balance = invoice.balance ?? (total - already);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CreditCard className="w-4 h-4 text-emerald-400" /></div>
            <div>
              <h2 className="text-sm font-bold text-white">Record Payment</h2>
              <p className="text-xs text-neutral-500">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</p>}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              {label:'Invoice Total', val:`Rs ${total.toLocaleString()}`,   color:'text-white'},
              {label:'Already Paid',  val:`Rs ${already.toLocaleString()}`, color:'text-emerald-400'},
              {label:'Balance Due',   val:`Rs ${balance.toLocaleString()}`, color:'text-[#FFD700]'},
            ].map(c => (
              <div key={c.label} className="bg-neutral-800/50 rounded-xl p-2.5">
                <div className={`font-bold text-sm ${c.color}`}>{c.val}</div>
                <div className="text-neutral-600 text-[10px] mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          <div>
            <FL>Payment Amount (Rs) *</FL>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">Rs</span>
              <FI type="number" min={0} value={amount} onChange={e=>setAmount(e.target.value)} className="pl-9" placeholder="Enter amount" />
            </div>
            <div className="flex gap-2 mt-2">
              {[balance, balance/2, balance/4].filter(v=>v>0).map(v => (
                <button key={v} onClick={() => setAmount(String(Math.round(v)))}
                  className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
                  Rs {Math.round(v).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FL>Payment Method</FL>
            <div className="grid grid-cols-3 gap-2">
              {PAY_METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${method===m ? 'bg-[#FFD700]/10 border-[#FFD700]/40 text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Date</FL>
              <FI type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div>
              <FL>Notes</FL>
              <FI value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
            <button onClick={save} disabled={loading}
              className="flex-1 px-4 py-2.5 bg-emerald-600 rounded-xl text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><CheckCircle className="w-4 h-4" />Record Payment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const FORM_STEPS = ['Job & Customer', 'Charges', 'Payment & Notes'];

function InvoiceForm({ initial, onClose, onSaved }: {
  initial?: Invoice; onClose: () => void; onSaved: () => void;
}) {
  const session   = getSessionUser();
  const isEdit    = !!initial?.id;
  const [step,    setStep]    = useState(0);
  const [data,    setData]    = useState<Invoice>(() =>
    initial
      ? { paymentHistory: [], ...initial }
      : blankInvoice(session?.branch && session.branch !== 'All Branches' ? session.branch : BRANCHES[0], session?.name || '')
  );
  const [jobs,      setJobs]      = useState<LinkableJob[]>([]);
  const [loadJobs,  setLoadJobs]  = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [showJobs,  setShowJobs]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string,string>>({});
  const jobRef = useRef<HTMLDivElement>(null);

  // Recalc whenever amounts change
  const set = useCallback(<K extends keyof Invoice>(k: K, v: Invoice[K]) =>
    setData(d => { const next = {...d,[k]:v}; return {...next,...calcInvoice(next)}; }), []);

  const setCustomer = (k: keyof Invoice['customer'], v: string) =>
    set('customer', { ...data.customer, [k]: v });

  const setLine = (idx: number, patch: Partial<InvoiceLine>) =>
    set('lines', data.lines.map((l,i) => {
      if(i!==idx) return l;
      const u = {...l,...patch};
      u.total = Math.round(u.quantity*u.unitPrice);
      return u;
    }));

  const addLine    = () => set('lines', [...data.lines, BLANK_LINE()]);
  const removeLine = (idx:number) => set('lines', data.lines.filter((_,i)=>i!==idx));

  // Fetch linkable jobs when branch changes
  useEffect(() => {
    if (!data.branch) return;
    setLoadJobs(true);
    apiFetch(`/invoices?resource=jobs&branch=${encodeURIComponent(data.branch)}`)
      .then(d => setJobs(Array.isArray(d) ? d : []))
      .catch(() => setJobs([]))
      .finally(() => setLoadJobs(false));
  }, [data.branch]);

  // Auto-fill from selected job
  const selectJob = (job: LinkableJob) => {
    setData(d => {
      const next: Invoice = {
        ...d,
        jobId:        job.id,
        jobRef:       job.service,
        customer: {
          ...d.customer,
          name:         job.customerName  || d.customer.name,
          phone:        job.customerPhone || d.customer.phone,
          vehiclePlate: job.vehiclePlate  || d.customer.vehiclePlate,
        },
        labourCharge: job.labourSugg || d.labourCharge,
        lines:        job.partsSugg > 0
          ? [{ id: Math.random().toString(36).slice(2), description: job.service + ' — Parts', quantity:1, unitPrice: job.partsSugg, total: job.partsSugg }]
          : d.lines,
      };
      return { ...next, ...calcInvoice(next) };
    });
    setShowJobs(false);
    setJobSearch('');
  };

  const validate = (): boolean => {
    const e: Record<string,string> = {};
    if (!data.customer.name.trim()) e.name = 'Customer name required';
    if (!data.customer.phone.trim()) e.phone = 'Phone required';
    if (data.total <= 0) e.total = 'Total must be greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { setStep(0); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/invoices/${data.id}`, { method:'PUT', body:JSON.stringify(data) });
      } else {
        await apiFetch('/invoices', { method:'POST', body:JSON.stringify(data) });
      }
      onSaved(); onClose();
    } catch(e:any) {
      setErrors({_global: e.message});
    } finally { setSaving(false); }
  };

  const filteredJobs = jobs.filter(j =>
    !j.isInvoiced && (
      !jobSearch ||
      j.customerName.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.vehiclePlate.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.service.toLowerCase().includes(jobSearch.toLowerCase())
    )
  );

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-2xl shadow-2xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
            <p className="text-xs text-neutral-500">{FORM_STEPS[step]} · Step {step+1} of {FORM_STEPS.length}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>

        {/* Step bar */}
        <div className="flex px-6 py-3 border-b border-neutral-800 gap-1 flex-shrink-0">
          {FORM_STEPS.map((_,i)=>(
            <button key={i} onClick={()=>setStep(i)} className={`flex-1 h-1.5 rounded-full transition-colors ${i<=step?'bg-[#FFD700]':'bg-neutral-800'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errors._global && <p className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{errors._global}</p>}

          {/* ── Step 0: Job & Customer ── */}
          {step===0 && (
            <>
              {/* Branch + date */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FL>Branch</FL>
                  <FS value={data.branch} onChange={e=>set('branch',e.target.value)}>
                    {BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}
                  </FS>
                </div>
                <div>
                  <FL>Invoice Date</FL>
                  <FI type="date" value={data.invoiceDate} onChange={e=>set('invoiceDate',e.target.value)} />
                </div>
                <div>
                  <FL>Due Date</FL>
                  <FI type="date" value={data.dueDate} onChange={e=>set('dueDate',e.target.value)} />
                </div>
              </div>

              {/* Link to Job */}
              <div className="p-4 bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-xs font-bold text-[#FFD700] uppercase tracking-wider">Smart Auto-Fill from Job Order</span>
                  <span className="text-neutral-600 text-xs">(optional — auto-fills customer & charges)</span>
                </div>

                <div ref={jobRef} className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                      <FI
                        value={jobSearch}
                        onChange={e => { setJobSearch(e.target.value); setShowJobs(true); }}
                        onFocus={() => setShowJobs(true)}
                        placeholder="Search completed jobs by customer, plate, service…"
                        className="pl-9 text-xs"
                      />
                    </div>
                    {data.jobId && (
                      <button onClick={() => { set('jobId',undefined); set('jobRef',undefined); }} className="text-neutral-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {data.jobId && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" /> Linked to job: {data.jobRef}
                    </div>
                  )}

                  {showJobs && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                      {loadJobs ? (
                        <div className="p-4 text-center text-neutral-500 text-xs">Loading jobs…</div>
                      ) : filteredJobs.length === 0 ? (
                        <div className="p-4 text-center text-neutral-500 text-xs">No completed jobs found</div>
                      ) : (
                        filteredJobs.map(j => (
                          <button key={j.id} onClick={() => selectJob(j)}
                            className="w-full px-4 py-3 hover:bg-neutral-800 transition-colors text-left border-b border-neutral-800/50 last:border-0">
                            <div className="flex justify-between items-center">
                              <span className="text-white text-xs font-semibold">{j.customerName || 'Unknown'}</span>
                              <span className="text-[#FFD700] font-mono text-[10px]">{j.vehiclePlate}</span>
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-neutral-400 text-[10px]">{j.service}</span>
                              <span className="text-emerald-400 text-[10px]">Labour est. Rs {j.labourSugg.toLocaleString()}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Customer Information
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FL>Full Name *</FL>
                    <FI value={data.customer.name} onChange={e=>setCustomer('name',e.target.value)} placeholder="Customer name" />
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <FL>Phone *</FL>
                    <FI value={data.customer.phone} onChange={e=>setCustomer('phone',e.target.value)} placeholder="077 123 4567" />
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <FL>Email</FL>
                    <FI type="email" value={data.customer.email} onChange={e=>setCustomer('email',e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="col-span-2">
                    <FL>Address</FL>
                    <FI value={data.customer.address} onChange={e=>setCustomer('address',e.target.value)} placeholder="Customer address" />
                  </div>
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <Car className="w-3.5 h-3.5" /> Vehicle Information
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FL>Plate</FL>
                    <FI value={data.customer.vehiclePlate} onChange={e=>setCustomer('vehiclePlate',e.target.value.toUpperCase())} placeholder="WP CAB-1234" />
                  </div>
                  <div>
                    <FL>Make</FL>
                    <FI value={data.customer.vehicleMake} onChange={e=>setCustomer('vehicleMake',e.target.value)} placeholder="Toyota" />
                  </div>
                  <div>
                    <FL>Model</FL>
                    <FI value={data.customer.vehicleModel} onChange={e=>setCustomer('vehicleModel',e.target.value)} placeholder="Corolla" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step 1: Charges ── */}
          {step===1 && (
            <>
              {/* Parts / Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" /> Parts & Materials
                  </p>
                  <span className="text-[#FFD700] text-xs font-bold">Rs {data.partsTotal.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1">
                    {['Description','Qty','Unit Price (Rs)','Total',''].map((h,i)=>(
                      <span key={i} className={`text-[10px] font-bold text-neutral-500 uppercase tracking-wider ${i===0?'col-span-5':i===2?'col-span-2':i===3?'col-span-2 text-right':i===4?'col-span-1':'col-span-2'}`}>{h}</span>
                    ))}
                  </div>
                  {data.lines.map((line,idx)=>(
                    <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5"><FI value={line.description} onChange={e=>setLine(idx,{description:e.target.value})} placeholder="e.g. Brake pads front" /></div>
                      <div className="col-span-2"><FI type="number" min={1} value={line.quantity} onChange={e=>setLine(idx,{quantity:Number(e.target.value)})} /></div>
                      <div className="col-span-2"><FI type="number" min={0} value={line.unitPrice} onChange={e=>setLine(idx,{unitPrice:Number(e.target.value)})} /></div>
                      <div className="col-span-2 text-white text-xs font-medium text-right">{line.total.toLocaleString()}</div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={()=>removeLine(idx)} disabled={data.lines.length===1} className="p-1.5 text-neutral-600 hover:text-red-400 disabled:opacity-20 rounded-lg hover:bg-red-500/10 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addLine} className="w-full py-2.5 border border-dashed border-neutral-700 rounded-xl text-neutral-500 hover:text-white hover:border-neutral-500 text-sm transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add Part / Item
                  </button>
                </div>
              </div>

              {/* Labour */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
                <div>
                  <FL>Labour Charge (Rs)</FL>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">Rs</span>
                    <FI type="number" min={0} value={data.labourCharge} onChange={e=>set('labourCharge',Number(e.target.value))} className="pl-9" placeholder="0" />
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="px-3 py-2 bg-neutral-900 rounded-lg">
                    <div className="flex justify-between text-xs mb-1"><span className="text-neutral-500">Parts</span><span className="text-white">Rs {data.partsTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-neutral-500">Labour</span><span className="text-white">Rs {data.labourCharge.toLocaleString()}</span></div>
                    <div className="border-t border-neutral-700 mt-1.5 pt-1.5 flex justify-between text-xs font-bold"><span className="text-neutral-400">Subtotal</span><span className="text-[#FFD700]">Rs {data.subtotal.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              {/* Discount + Tax */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL>Discount</FL>
                  <div className="flex gap-2">
                    <FS value={data.discountType} onChange={e=>set('discountType',e.target.value as 'flat'|'percent')} className="w-20 flex-shrink-0">
                      <option value="flat">Rs</option>
                      <option value="percent">%</option>
                    </FS>
                    <FI type="number" min={0} value={data.discount} onChange={e=>set('discount',Number(e.target.value))} placeholder="0" />
                  </div>
                  {data.discountAmt > 0 && <p className="text-red-400 text-xs mt-1">−Rs {data.discountAmt.toLocaleString()}</p>}
                </div>
                <div>
                  <FL>VAT / Tax %</FL>
                  <FI type="number" min={0} max={100} value={data.taxRate} onChange={e=>set('taxRate',Number(e.target.value))} placeholder="0" />
                  {data.taxAmt > 0 && <p className="text-blue-400 text-xs mt-1">+Rs {data.taxAmt.toLocaleString()}</p>}
                </div>
              </div>

              {/* Total box */}
              <div className="p-4 bg-[#FFD700]/5 border border-[#FFD700]/30 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold">Invoice Total</span>
                  <span className="text-[#FFD700] font-black text-2xl">Rs {data.total.toLocaleString()}</span>
                </div>
                {errors.total && <p className="text-red-400 text-xs mt-1">{errors.total}</p>}
              </div>
            </>
          )}

          {/* ── Step 2: Payment & Notes ── */}
          {step===2 && (
            <>
              <div className="p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl space-y-4">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Payment (optional — can record later)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL>Amount Paid (Rs)</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">Rs</span>
                      <FI type="number" min={0} value={data.paidAmount} onChange={e=>set('paidAmount',Number(e.target.value))} className="pl-9" placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <FL>Payment Method</FL>
                    <FS value={data.paymentMethod} onChange={e=>set('paymentMethod',e.target.value as PayMethod)}>
                      {PAY_METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                    </FS>
                  </div>
                  <div>
                    <FL>Payment Date</FL>
                    <FI type="date" value={data.paymentDate} onChange={e=>set('paymentDate',e.target.value)} />
                  </div>
                  <div>
                    <FL>Payment Notes</FL>
                    <FI value={data.paymentNotes} onChange={e=>set('paymentNotes',e.target.value)} placeholder="Receipt #, etc." />
                  </div>
                </div>
                {data.paidAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Balance Due</span>
                    <span className={`font-bold ${data.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Rs {data.balance.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div>
                <FL>Invoice Status</FL>
                <FS value={data.status} onChange={e=>set('status',e.target.value as InvStatus)}>
                  {(['Draft','Issued','Paid','Void'] as InvStatus[]).map(s=><option key={s} value={s}>{s}</option>)}
                </FS>
              </div>

              <div>
                <FL>Notes / Terms</FL>
                <FT rows={4} value={data.notes} onChange={e=>set('notes',e.target.value)} placeholder="Additional notes, warranty info, terms…" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 flex-shrink-0">
          <button onClick={()=>setStep(s=>s-1)} disabled={step===0}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-xl text-neutral-300 text-sm disabled:opacity-30 hover:bg-neutral-800 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-neutral-700 rounded-xl text-neutral-400 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
            {step < FORM_STEPS.length-1
              ? <button onClick={()=>setStep(s=>s+1)} className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              : <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60">
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving…</>
                    : <><CheckCircle className="w-4 h-4" />{isEdit?'Update Invoice':'Create Invoice'}</>
                  }
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceDetail({ inv, onClose, onEdit, onStatusChange, onDelete, onPayment }: {
  inv:            Invoice;
  onClose:        () => void;
  onEdit:         () => void;
  onStatusChange: (s: InvStatus) => void;
  onDelete:       () => void;
  onPayment:      () => void;
}) {
  const [delConfirm, setDelConfirm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-end z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-neutral-900 border-l border-neutral-700 h-full w-full max-w-xl overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm px-6 py-4 border-b border-neutral-800 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold font-mono">{inv.invoiceNumber}</span>
              <Badge status={inv.status} type="inv" />
              <Badge status={inv.paymentStatus} type="pay" />
            </div>
            <p className="text-neutral-500 text-xs mt-0.5">{inv.branch} · {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPayment} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 rounded-lg text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
              <Banknote className="w-3.5 h-3.5" /> Pay
            </button>
            <button onClick={() => downloadPDF(inv)} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-xs hover:text-white transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Totals */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {label:'Parts',    val:`Rs ${inv.partsTotal.toLocaleString()}`,   color:'text-white'},
              {label:'Labour',   val:`Rs ${inv.labourCharge.toLocaleString()}`, color:'text-white'},
              {label:'Total',    val:`Rs ${inv.total.toLocaleString()}`,        color:'text-[#FFD700]'},
              {label:'Balance',  val:`Rs ${inv.balance.toLocaleString()}`,      color: inv.balance>0?'text-red-400':'text-emerald-400'},
            ].map(c=>(
              <div key={c.label} className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3 text-center">
                <div className={`font-bold text-sm ${c.color}`}>{c.val}</div>
                <div className="text-neutral-500 text-xs mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Status changer */}
          <div className="flex items-center gap-3 p-4 bg-neutral-800/60 border border-neutral-700 rounded-xl">
            <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider flex-shrink-0">Status</span>
            <div className="flex gap-2 flex-wrap">
              {(['Draft','Issued','Paid','Void'] as InvStatus[]).map(s=>(
                <button key={s} onClick={()=>onStatusChange(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${inv.status===s ? INV_STATUS[s].cls : 'bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Job ref */}
          {inv.jobRef && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-xl">
              <Wrench className="w-4 h-4 text-[#FFD700]" />
              <div>
                <p className="text-xs text-neutral-500">Linked Job Order</p>
                <p className="text-[#FFD700] text-sm font-semibold">{inv.jobRef}</p>
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Customer</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                {icon:<User className="w-3.5 h-3.5" />,  val:inv.customer.name},
                {icon:<Phone className="w-3.5 h-3.5" />, val:inv.customer.phone},
                {icon:<Mail className="w-3.5 h-3.5" />,  val:inv.customer.email},
                {icon:<MapPin className="w-3.5 h-3.5" />,val:inv.customer.address},
              ].filter(r=>r.val).map((r,i)=>(
                <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="text-neutral-600 flex-shrink-0">{r.icon}</span>{r.val}
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle */}
          {inv.customer.vehiclePlate && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Vehicle</h4>
              <div className="flex gap-3">
                {[{l:'Plate',v:inv.customer.vehiclePlate},{l:'Make',v:inv.customer.vehicleMake},{l:'Model',v:inv.customer.vehicleModel}].filter(r=>r.v).map(r=>(
                  <div key={r.l} className="px-3 py-2 bg-neutral-800/50 rounded-lg">
                    <div className="text-neutral-500 text-[10px]">{r.l}</div>
                    <div className="text-white text-xs font-medium">{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Charges</h4>
            <div className="rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Description','Qty','Unit','Total'].map(h=>(
                      <th key={h} className={`px-3 py-2 text-left text-neutral-500 font-bold uppercase tracking-wider ${h==='Total'?'text-right':''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {inv.lines.filter(l=>l.description).map(line=>(
                    <tr key={line.id} className="hover:bg-neutral-800/30">
                      <td className="px-3 py-2.5 text-white">{line.description}</td>
                      <td className="px-3 py-2.5 text-neutral-400">{line.quantity}</td>
                      <td className="px-3 py-2.5 text-neutral-400">Rs {line.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-white text-right font-medium">Rs {line.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {inv.labourCharge > 0 && (
                    <tr className="hover:bg-neutral-800/30">
                      <td className="px-3 py-2.5 text-neutral-400 italic">Labour Charges</td>
                      <td className="px-3 py-2.5 text-neutral-600">—</td>
                      <td className="px-3 py-2.5 text-neutral-600">—</td>
                      <td className="px-3 py-2.5 text-white text-right font-medium">Rs {inv.labourCharge.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals breakdown */}
            <div className="space-y-1.5 px-2">
              {[
                {l:'Subtotal',                                                v:`Rs ${inv.subtotal.toLocaleString()}`,    c:'text-neutral-300'},
                inv.discountAmt>0 ? {l:`Discount${inv.discountType==='percent'?` (${inv.discount}%)`:''}`, v:`−Rs ${inv.discountAmt.toLocaleString()}`, c:'text-red-400'} : null,
                inv.taxAmt>0     ? {l:`Tax (${inv.taxRate}%)`,              v:`Rs ${inv.taxAmt.toLocaleString()}`,      c:'text-blue-400'}    : null,
              ].filter(Boolean).map((r,i)=>(
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-neutral-500">{r!.l}</span>
                  <span className={r!.c}>{r!.v}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-neutral-700 pt-2 mt-2">
                <span className="text-white">Total</span>
                <span className="text-[#FFD700] text-base">Rs {inv.total.toLocaleString()}</span>
              </div>
              {inv.paidAmount>0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Paid ({inv.paymentMethod})</span>
                  <span className="text-emerald-400 font-medium">Rs {inv.paidAmount.toLocaleString()}</span>
                </div>
              )}
              {inv.balance>0 && (
                <div className="flex justify-between font-bold text-sm">
                  <span className="text-red-400">Balance Due</span>
                  <span className="text-red-400">Rs {inv.balance.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment history */}
          {inv.paymentHistory?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Payment History</h4>
              <div className="space-y-2">
                {inv.paymentHistory.map((p,i)=>(
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-white font-medium">Rs {p.amount.toLocaleString()}</span>
                      <span className="text-neutral-500">via {p.method}</span>
                    </div>
                    <span className="text-neutral-600">{p.date ? new Date(p.date).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due date */}
          {inv.dueDate && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Calendar className="w-3.5 h-3.5" />
              Due {new Date(inv.dueDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
            </div>
          )}

          {/* Notes */}
          {inv.notes && (
            <div className="p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-neutral-300 text-sm">{inv.notes}</p>
            </div>
          )}

          {/* Delete */}
          <div className="pt-4 border-t border-neutral-800">
            {delConfirm ? (
              <div className="flex items-center gap-3">
                <p className="text-red-400 text-sm flex-1">Delete this invoice permanently?</p>
                <button onClick={()=>setDelConfirm(false)} className="px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:bg-neutral-800">Cancel</button>
                <button onClick={onDelete} className="px-3 py-1.5 bg-red-600 rounded-lg text-white text-xs font-bold hover:bg-red-700">Delete</button>
              </div>
            ) : (
              <button onClick={()=>setDelConfirm(true)} className="flex items-center gap-2 text-red-400 text-xs hover:text-red-300 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete Invoice
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
export function InvoicePage() {
  const session    = getSessionUser();
  const userBranch = session?.branch && session.branch !== 'All Branches' ? session.branch : '';

  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState<InvStatus|'All'>('All');
  const [payFilter, setPayFilter] = useState<PayStatus|'All'>('All');
  const [branch,    setBranch]    = useState(userBranch);
  const [showForm,  setShowForm]  = useState(false);
  const [editInv,   setEditInv]   = useState<Invoice|undefined>();
  const [detailInv, setDetailInv] = useState<Invoice|null>(null);
  const [payInv,    setPayInv]    = useState<Invoice|null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (branch)             p.set('branch', branch);
      if (filter!=='All')     p.set('status', filter);
      if (payFilter!=='All')  p.set('paymentStatus', payFilter);
      if (search.trim().length>1) p.set('search', search.trim());
      const data = await apiFetch(`/invoices?${p}`);
      setInvoices(Array.isArray(data) ? data : []);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [branch, filter, payFilter, search]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const patchStatus = async (id:string, status:InvStatus) => {
    await apiFetch(`/invoices/${id}/status`, {method:'PATCH',body:JSON.stringify({status})});
    setInvoices(q=>q.map(x=>x.id===id?{...x,status}:x));
    if(detailInv?.id===id) setDetailInv(d=>d?{...d,status}:d);
  };

  const deleteInv = async (id:string) => {
    await apiFetch(`/invoices/${id}`,{method:'DELETE'});
    setInvoices(q=>q.filter(x=>x.id!==id));
    setDetailInv(null);
  };

  const updatePayment = (id:string, patch:Partial<Invoice>) => {
    setInvoices(q=>q.map(x=>x.id===id?{...x,...patch}:x));
    setDetailInv(d=>d&&d.id===id?{...d,...patch}:d);
  };

  const openEdit = (inv:Invoice) => { setEditInv(inv); setDetailInv(null); setShowForm(true); };
  const openNew  = ()             => { setEditInv(undefined); setShowForm(true); };

  const stats = {
    total:   invoices.length,
    unpaid:  invoices.filter(i=>i.paymentStatus==='Unpaid'||i.paymentStatus==='Partial').length,
    paid:    invoices.filter(i=>i.paymentStatus==='Paid').length,
    revenue: invoices.filter(i=>i.paymentStatus==='Paid').reduce((a,i)=>a+i.total,0),
    outstanding: invoices.reduce((a,i)=>a+i.balance,0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Invoice Management</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Create, track and manage repair invoices</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {label:'Total Invoices', value:stats.total,                                        color:'text-white',       icon:<FileText className="w-4 h-4" />},
          {label:'Unpaid / Partial',value:stats.unpaid,                                      color:'text-red-400',     icon:<AlertTriangle className="w-4 h-4" />},
          {label:'Paid',           value:stats.paid,                                         color:'text-emerald-400', icon:<CheckCircle className="w-4 h-4" />},
          {label:'Total Revenue',  value:`Rs ${(stats.revenue/1000).toFixed(1)}k`,          color:'text-[#FFD700]',  icon:<DollarSign className="w-4 h-4" />},
          {label:'Outstanding',    value:`Rs ${(stats.outstanding/1000).toFixed(1)}k`,       color:'text-amber-400',   icon:<BarChart2 className="w-4 h-4" />},
        ].map(s=>(
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className={`mb-2 ${s.color} opacity-60`}>{s.icon}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice #, customer, plate, job ref…"
            className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600" />
          {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Status filters */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          {(['All','Draft','Issued','Paid','Void'] as const).map(s=>(
            <button key={s} onClick={()=>setFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${filter===s?'bg-[#FFD700] text-black':'text-neutral-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Payment filter */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          {(['All','Unpaid','Partial','Paid','Overdue'] as const).map(s=>(
            <button key={s} onClick={()=>setPayFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${payFilter===s?'bg-[#FFD700] text-black':'text-neutral-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>

        {!userBranch && (
          <select value={branch} onChange={e=>setBranch(e.target.value)}
            className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700]">
            <option value="">All Branches</option>
            {BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <button onClick={fetch_} disabled={loading} className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span>⚠ {error}</span>
          <button onClick={fetch_} className="underline hover:no-underline text-xs">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
            <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
            Loading invoices…
          </div>
        ) : invoices.length===0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="w-12 h-12 text-neutral-700 mx-auto" />
            <p className="text-neutral-500 text-sm">No invoices found</p>
            <button onClick={openNew} className="text-[#FFD700] text-sm hover:underline">Create your first invoice →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Invoice #','Customer','Vehicle','Date','Status','Payment','Total','Balance','Actions'].map(h=>(
                    <th key={h} className={`px-3 py-3 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider whitespace-nowrap ${h==='Actions'?'text-right':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {invoices.map(inv=>(
                  <tr key={inv.id} onClick={()=>setDetailInv(inv)} className="hover:bg-neutral-800/40 transition-colors cursor-pointer">
                    <td className="px-3 py-3.5">
                      <div className="font-mono text-xs text-[#FFD700] font-bold">{inv.invoiceNumber}</div>
                      {inv.jobRef && <div className="text-neutral-600 text-[10px] mt-0.5 flex items-center gap-1"><Wrench className="w-2.5 h-2.5" />{inv.jobRef}</div>}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="text-white font-medium text-sm">{inv.customer.name||'—'}</div>
                      <div className="text-neutral-500 text-xs">{inv.customer.phone}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="text-white font-mono text-xs">{inv.customer.vehiclePlate||'—'}</div>
                      <div className="text-neutral-500 text-xs">{[inv.customer.vehicleMake,inv.customer.vehicleModel].filter(Boolean).join(' ')}</div>
                    </td>
                    <td className="px-3 py-3.5 text-neutral-500 text-xs whitespace-nowrap">
                      {inv.invoiceDate?new Date(inv.invoiceDate).toLocaleDateString('en-GB'):'—'}
                    </td>
                    <td className="px-3 py-3.5"><Badge status={inv.status} type="inv" /></td>
                    <td className="px-3 py-3.5"><Badge status={inv.paymentStatus} type="pay" /></td>
                    <td className="px-3 py-3.5 text-white font-bold whitespace-nowrap">Rs {inv.total.toLocaleString()}</td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className={inv.balance>0?'text-red-400 font-medium':'text-emerald-400'}>
                        Rs {inv.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3.5" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>{setPayInv(inv);}} title="Record Payment" className="p-1.5 rounded-lg text-neutral-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                          <Banknote className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={()=>setDetailInv(inv)} title="View" className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-neutral-700 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={()=>openEdit(inv)} title="Edit" className="p-1.5 rounded-lg text-neutral-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={()=>downloadPDF(inv)} title="Download PDF" className="p-1.5 rounded-lg text-neutral-600 hover:text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors">
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

      {/* Modals */}
      {showForm && (
        <InvoiceForm
          initial={editInv}
          onClose={()=>{setShowForm(false);setEditInv(undefined);}}
          onSaved={fetch_}
        />
      )}
      {detailInv && (
        <InvoiceDetail
          inv={detailInv}
          onClose={()=>setDetailInv(null)}
          onEdit={()=>openEdit(detailInv)}
          onStatusChange={s=>patchStatus(detailInv.id!,s)}
          onDelete={()=>deleteInv(detailInv.id!)}
          onPayment={()=>{setPayInv(detailInv);}}
        />
      )}
      {payInv && (
        <PaymentModal
          invoice={payInv}
          onClose={()=>setPayInv(null)}
          onSaved={patch=>{updatePayment(payInv.id!,patch);setPayInv(null);}}
        />
      )}
    </div>
  );
}
