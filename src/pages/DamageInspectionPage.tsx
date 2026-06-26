// DamageInspectionPage.tsx — Damage Inspection & Customer Approval Module
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, AlertTriangle, Camera, Upload, Play, Trash2, Plus, X,
  CheckCircle, Clock, Send, FileText, Download, Eye, Link2, Wrench,
  Car, User, DollarSign, Shield, RefreshCw, Phone, Check,
  AlertCircle, Info, ZoomIn, Copy, MessageSquare,
  Image as ImageIcon, Video as VideoIcon,
  ChevronDown, ChevronUp, Printer, Activity, Search, Loader2,
} from 'lucide-react';
import { getSessionUser } from '../lib/auth';
import { jsPDF } from 'jspdf';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Severity       = 'Low' | 'Medium' | 'High' | 'Critical';
type ApprovalStatus = 'not_sent' | 'sent' | 'viewed' | 'approved' | 'rejected';
type JobStatus      = 'Pending' | 'Assigned' | 'In Progress' | 'Paused' | 'Completed' | 'Waiting';

interface JobSummary {
  jobNumber: string; customerName: string; vehicleReg: string;
  vehicleMake: string; vehicleModel: string; currentService: string;
  originalCost: number; status: JobStatus; technician: string; branch: string; createdAt: string;
}
interface DamageReport {
  id: string; title: string; category: string; severity: Severity;
  description: string; recommendedRepair: string; additionalCost: number;
  createdAt: string; createdBy: string;
}
interface MediaFile {
  id: string; type: 'image' | 'video'; url: string; name: string;
  size: number; duration?: number; uploadedAt: string; uploadedBy: string;
}
interface QuotationItem {
  id: string; item: string; qty: number; unitPrice: number; labourCost: number;
}
interface TimelineEvent {
  id: string; label: string; detail?: string; user: string;
  timestamp: string; status: 'done' | 'active' | 'pending'; color: string;
}
interface AuditEntry {
  id: string; user: string; action: string; date: string; time: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const DAMAGE_CATEGORIES = [
  'Brake System', 'Suspension', 'Tyres & Wheels', 'Engine', 'Transmission',
  'Electrical', 'Body & Chassis', 'Exhaust System', 'Fuel System', 'AC System', 'Other',
];

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; dot: string }> = {
  Low:      { color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  dot: 'bg-green-400' },
  Medium:   { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
  High:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  Critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-400' },
};

const APPROVAL_STEPS: { key: ApprovalStatus; label: string; icon: React.ElementType }[] = [
  { key: 'not_sent', label: 'Not Sent', icon: Clock },
  { key: 'sent',     label: 'Sent',     icon: Send },
  { key: 'viewed',   label: 'Viewed',   icon: Eye },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
  { key: 'rejected', label: 'Rejected', icon: X },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtCurrency(n: number) { return `Rs. ${n.toLocaleString()}`; }
function fmtTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTimeOnly(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function mapJobStatus(raw: string): JobStatus {
  const m: Record<string, JobStatus> = {
    unassigned: 'Pending', pending: 'Pending',
    assigned: 'Assigned',
    in_progress: 'In Progress', paused: 'Paused', on_hold: 'Paused',
    done: 'Completed', waiting: 'Waiting',
  };
  return m[raw?.toLowerCase()] || 'Pending';
}

function buildInitialTimeline(techName: string, createdAt: string): TimelineEvent[] {
  const n = new Date().toISOString();
  return [
    { id: uid(), label: 'Vehicle Received',    user: 'System',  timestamp: createdAt || n, status: 'done',    color: 'bg-green-500' },
    { id: uid(), label: 'Inspection Started',  user: techName || 'Technician', timestamp: n, status: 'active', color: 'bg-[#FFD700]' },
    { id: uid(), label: 'Damage Found',        user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Media Uploaded',      user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Quotation Generated', user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Approval Sent',       user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Customer Viewed',     user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Customer Decision',   user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
    { id: uid(), label: 'Repair Continued',    user: '', timestamp: '', status: 'pending', color: 'bg-neutral-700' },
  ];
}

// Compress an image file to JPEG base64 (max 800px wide, 55% quality ~30–80 KB)
async function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const img    = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const ratio   = Math.min(1, 800 / img.width);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.55));
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(''); };
    img.src = blobUrl;
  });
}

// Compress a video using canvas + MediaRecorder → 640px max, 400 kbps → base64 data URL
async function compressVideo(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const video   = document.createElement('video');
    video.src        = blobUrl;
    video.muted      = true;   // required for autoplay; audio re-attached from captureStream
    video.playsInline = true;
    video.preload    = 'metadata';

    video.onloadedmetadata = () => {
      const MAX   = 640;
      const scale = Math.min(MAX / video.videoWidth, MAX / video.videoHeight, 1);
      const w     = Math.round(video.videoWidth  * scale);
      const h     = Math.round(video.videoHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(15);

      // Attach audio tracks when supported (Chrome / Edge)
      if (typeof (video as any).captureStream === 'function') {
        const vs = (video as any).captureStream() as MediaStream;
        vs.getAudioTracks().forEach((t: MediaStreamTrack) => stream.addTrack(t));
      }

      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
      const rec  = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 400_000 });
      const chunks: Blob[] = [];

      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        URL.revokeObjectURL(blobUrl);
        const blob   = new Blob(chunks, { type: mime.split(';')[0] });
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(blob);
      };

      let rafId: number;
      const draw = () => {
        ctx.drawImage(video, 0, 0, w, h);
        if (video.duration > 0)
          onProgress(Math.min((video.currentTime / video.duration) * 100, 99));
        rafId = requestAnimationFrame(draw);
      };

      video.onended = () => { cancelAnimationFrame(rafId); rec.stop(); };
      video.onerror = e => { cancelAnimationFrame(rafId); URL.revokeObjectURL(blobUrl); reject(e); };

      rec.start(100);
      draw();
      video.play().catch(err => { URL.revokeObjectURL(blobUrl); reject(err); });
    };

    video.onerror = e => { URL.revokeObjectURL(blobUrl); reject(e); };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    'Pending':     'bg-neutral-700 text-neutral-300 border-neutral-600',
    'Assigned':    'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Paused':      'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Completed':   'bg-green-500/20 text-green-400 border-green-500/30',
    'Waiting':     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${map[status]}`}>
      {status}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, action, collapsed, onToggle }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
  action?: React.ReactNode; collapsed?: boolean; onToggle?: () => void;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div
        className={`px-5 py-4 border-b border-neutral-800 flex items-center justify-between ${onToggle ? 'cursor-pointer select-none hover:bg-neutral-800/50 transition-colors' : ''}`}
        onClick={onToggle}
      >
        <h3 className="flex items-center gap-2.5 text-sm font-bold text-white uppercase tracking-wide">
          <Icon className="w-4 h-4 text-[#FFD700]" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
          {onToggle && (collapsed ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronUp className="w-4 h-4 text-neutral-500" />)}
        </div>
      </div>
      {!collapsed && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAMAGE REPORT FORM (add / edit)
// ─────────────────────────────────────────────────────────────────────────────
const emptyReport = (): Omit<DamageReport, 'id' | 'createdAt' | 'createdBy'> => ({
  title: '', category: DAMAGE_CATEGORIES[0], severity: 'Medium',
  description: '', recommendedRepair: '', additionalCost: 0,
});

function DamageReportForm({
  initial, onSave, onCancel,
}: { initial?: Partial<DamageReport>; onSave: (d: ReturnType<typeof emptyReport>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...emptyReport(), ...initial });
  const upd = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Damage Title *</label>
          <input value={form.title} onChange={e => upd('title', e.target.value)}
            placeholder="e.g. Excessive brake disc wear"
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Category *</label>
          <select value={form.category} onChange={e => upd('category', e.target.value)} className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1">
            {DAMAGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Severity Level *</label>
          <select value={form.severity} onChange={e => upd('severity', e.target.value as Severity)} className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1">
            {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Description</label>
          <textarea rows={3} value={form.description} onChange={e => upd('description', e.target.value)}
            placeholder="Describe the damage in detail…"
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1 resize-none" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Recommended Repair</label>
          <textarea rows={2} value={form.recommendedRepair} onChange={e => upd('recommendedRepair', e.target.value)}
            placeholder="What action is recommended?"
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1 resize-none" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Additional Cost (Rs.)</label>
          <input type="number" min="0" value={form.additionalCost} onChange={e => upd('additionalCost', Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors mt-1" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors px-4 py-2 text-sm">Cancel</button>
        <button onClick={() => { if (form.title) onSave(form); }} disabled={!form.title}
          className="bg-[#FFD700] text-black font-bold rounded-lg hover:bg-[#FFD700]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm">
          Save Damage Report
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER APPROVAL PREVIEW MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CustomerPreviewModal({
  job, damageReports, mediaFiles, techNotes, originalCost, additionalTotal, onClose,
  onApprove, onReject,
}: {
  job: JobSummary; damageReports: DamageReport[]; mediaFiles: MediaFile[];
  techNotes: string; originalCost: number; additionalTotal: number;
  onClose: () => void; onApprove?: () => void; onReject?: () => void;
}) {
  const newTotal = originalCost + additionalTotal;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700] flex items-center justify-center">
              <Wrench className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Anura Tyres — Service Update</p>
              <p className="text-neutral-400 text-[11px]">Customer Approval Required</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Additional Work Required</p>
            <p>During the inspection of your vehicle, our technician discovered issues that require additional repairs. Please review the details below and approve or reject the additional work.</p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Vehicle</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Registration', job.vehicleReg],
                ['Make & Model', `${job.vehicleMake} ${job.vehicleModel}`.trim() || '—'],
                ['Service', job.currentService],
                ['Branch', job.branch],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[11px] text-gray-500">{l}</p>
                  <p className="text-sm font-semibold text-gray-900">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {damageReports.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Damage Findings ({damageReports.length})</p>
              <div className="space-y-3">
                {damageReports.map(r => (
                  <div key={r.id} className={`p-3 rounded-lg border ${SEVERITY_CONFIG[r.severity].border.replace('/30', '/50')} ${SEVERITY_CONFIG[r.severity].bg.replace('/10', '/5')}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                      <SeverityBadge severity={r.severity} />
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{r.description}</p>
                    <p className="text-xs text-gray-700"><span className="font-medium">Recommendation:</span> {r.recommendedRepair}</p>
                    {r.additionalCost > 0 && <p className="text-sm font-bold text-gray-900 mt-2">{fmtCurrency(r.additionalCost)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mediaFiles.filter(f => f.type === 'image' && f.url).length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Evidence Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.filter(f => f.type === 'image' && f.url).map(f => (
                  <div key={f.id} className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square">
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {mediaFiles.filter(f => f.type === 'video' && f.url).length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Evidence Videos ({mediaFiles.filter(f => f.type === 'video' && f.url).length})
              </p>
              <div className="space-y-3">
                {mediaFiles.filter(f => f.type === 'video' && f.url).map(f => (
                  <div key={f.id} className="bg-gray-100 rounded-lg overflow-hidden">
                    <video
                      src={f.url}
                      controls
                      preload="metadata"
                      className="w-full max-h-64 object-contain bg-black rounded-t-lg"
                    />
                    <div className="px-3 py-2 flex items-center gap-2">
                      <Play className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <p className="text-xs text-gray-600 truncate">{f.name}</p>
                      {f.duration !== undefined && (
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{fmtDuration(f.duration)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {techNotes && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Technician Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{techNotes}</p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cost Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Original Estimate</span><span>{fmtCurrency(originalCost)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Additional Repairs</span><span className="text-orange-600 font-medium">+ {fmtCurrency(additionalTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>New Total</span><span>{fmtCurrency(newTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={onReject}
              className="py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
              <X className="w-4 h-4" /> Reject
            </button>
            <button className="py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <Phone className="w-4 h-4" /> Callback
            </button>
            <button onClick={onApprove}
              className="py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function DamageInspectionPage({ onBack, jobId: initJobId }: { onBack?: () => void; jobId?: string }) {
  const sessionUser = getSessionUser() as any;
  const currentUser = sessionUser?.name || sessionUser?.username || 'Staff';
  const userBranch  = sessionUser?.branch || '';
  const isAllBranches = userBranch === 'All Branches' || userBranch === 'all' || !userBranch;

  // ── Job selector state ──────────────────────────────────────────────────────
  const [selectedJobId, setSelectedJobId]   = useState<string | null>(initJobId || null);
  const [jobs,          setJobs]             = useState<any[]>([]);
  const [jobsLoading,   setJobsLoading]      = useState(false);
  const [jobSearch,     setJobSearch]        = useState('');
  const [selectorBranch, setSelectorBranch] = useState(isAllBranches ? 'Pannipitiya' : userBranch);
  const [selectorDate,   setSelectorDate]   = useState(() => new Date().toISOString().split('T')[0]);

  // ── Inspection state ────────────────────────────────────────────────────────
  const [inspectionId,   setInspectionId]    = useState<string | null>(null);
  const [loading,        setLoading]         = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [dataReady,      setDataReady]       = useState(false);

  // Core data
  const [job,             setJob]            = useState<JobSummary | null>(null);
  const [damageReports,   setDamage]         = useState<DamageReport[]>([]);
  const [mediaFiles,      setMedia]          = useState<MediaFile[]>([]);
  const [techNotes,       setNotes]          = useState('');
  const [quotationItems,  setQuote]          = useState<QuotationItem[]>([
    { id: uid(), item: '', qty: 1, unitPrice: 0, labourCost: 0 },
  ]);
  const [approvalStatus,     setApproval]   = useState<ApprovalStatus>('not_sent');
  const [approvalTimestamps, setTs]          = useState<Partial<Record<ApprovalStatus, string>>>({});
  const [timeline,           setTimeline]   = useState<TimelineEvent[]>([]);
  const [auditTrail,         setAudit]      = useState<AuditEntry[]>([]);

  // UI state
  const [showAddDamage,  setShowAddDamage]   = useState(false);
  const [editingDamage,  setEditingDamage]   = useState<DamageReport | null>(null);
  const [showPreview,    setShowPreview]     = useState(false);
  const [dragging,       setDragging]       = useState(false);
  const [lightboxMedia,  setLightbox]       = useState<MediaFile | null>(null);
  const [compressing,    setCompressing]    = useState<{ name: string; pct: number } | null>(null);
  const [copiedLink,     setCopied]         = useState(false);
  const [sendingApproval, setSending]       = useState(false);
  const [auditOpen,      setAuditOpen]      = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────
  const additionalFromReports = damageReports.reduce((s, r) => s + r.additionalCost, 0);
  const quoteAdditional = quotationItems.reduce((s, i) => s + i.qty * i.unitPrice + i.labourCost, 0);
  const additionalTotal = quoteAdditional || additionalFromReports;
  const grandTotal      = (job?.originalCost || 0) + additionalTotal;
  const approvalLink    = inspectionId
    ? `https://anuratyres.lk/#/approve/${inspectionId}`
    : `https://anuratyres.lk/#/approve/pending`;

  // ── Fetch jobs for selector ─────────────────────────────────────────────────
  useEffect(() => {
    if (selectedJobId) return;
    if (!selectorBranch || !selectorDate) return;
    setJobsLoading(true);
    fetch(`${API_URL}/jobs?branch=${encodeURIComponent(selectorBranch)}&date=${selectorDate}`)
      .then(r => r.json())
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, [selectorBranch, selectorDate, selectedJobId]);

  // ── Load / create inspection when job selected ─────────────────────────────
  useEffect(() => {
    if (!selectedJobId) return;
    const rawJob = jobs.find(j => (j._id?.toString() || j.id) === selectedJobId);

    const buildSummary = (j: any): JobSummary => ({
      jobNumber:      j.bookingRef || `JOB-${j._id?.toString().slice(-6).toUpperCase()}`,
      customerName:   j.customerName || 'Unknown Customer',
      vehicleReg:     j.vehiclePlate || '',
      vehicleMake:    '',
      vehicleModel:   '',
      currentService: j.service || '',
      originalCost:   0,
      status:         mapJobStatus(j.status),
      technician:     j.staffName || j.staffId || '',
      branch:         j.branch || '',
      createdAt:      j.createdAt || new Date().toISOString(),
    });

    if (rawJob) setJob(buildSummary(rawJob));

    setLoading(true);
    setDataReady(false);
    fetch(`${API_URL}/crm?resource=inspections&jobId=${encodeURIComponent(selectedJobId)}`)
      .then(r => r.json())
      .then(async data => {
        if (data?.id) {
          // Existing inspection — hydrate all state
          setInspectionId(data.id);
          if (data.jobSummary?.jobNumber) setJob(s => ({ ...s!, ...data.jobSummary }));
          if (data.damageReports?.length)  setDamage(data.damageReports);
          if (data.techNotes)              setNotes(data.techNotes);
          if (data.quotationItems?.length) setQuote(data.quotationItems);
          if (data.approvalStatus)         setApproval(data.approvalStatus);
          if (data.approvalTimestamps)     setTs(data.approvalTimestamps);
          if (data.timeline?.length)       setTimeline(data.timeline);
          if (data.auditTrail?.length)     setAudit(data.auditTrail);
          if (data.mediaFiles?.length) {
            setMedia(data.mediaFiles.map((m: any) => ({ ...m, url: m.data || m.url || '' })));
          }
        } else {
          // New inspection — POST to create it
          const summary = rawJob ? buildSummary(rawJob) : null;
          const initTimeline = buildInitialTimeline(summary?.technician || '', summary?.createdAt || '');
          const initAudit: AuditEntry[] = [{
            id: uid(), user: currentUser, action: 'Inspection record created',
            date: fmtDate(new Date().toISOString()), time: fmtTimeOnly(new Date().toISOString()),
          }];
          const resp = await fetch(`${API_URL}/crm?resource=inspections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: selectedJobId, jobSummary: summary || {} }),
          });
          const created = await resp.json();
          setInspectionId(created.id);
          setTimeline(initTimeline);
          setAudit(initAudit);
          setQuote([{ id: uid(), item: '', qty: 1, unitPrice: 0, labourCost: 0 }]);
        }
      })
      .catch(err => console.error('[inspection] load failed', err))
      .finally(() => { setLoading(false); setDataReady(true); });
  }, [selectedJobId]);

  // ── Autosave (2 s debounce after any data change) ──────────────────────────
  useEffect(() => {
    if (!inspectionId || !dataReady) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      const mediaToSave = mediaFiles.map(m => ({
        id: m.id, type: m.type, name: m.name, size: m.size,
        duration: m.duration, uploadedAt: m.uploadedAt, uploadedBy: m.uploadedBy,
        // Only persist base64 images; skip blob URLs (they don't survive reload)
        data: m.url.startsWith('data:') ? m.url : undefined,
      }));
      try {
        await fetch(`${API_URL}/crm?resource=inspections&id=${inspectionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobSummary: job,
            damageReports, techNotes, quotationItems,
            approvalStatus, approvalTimestamps,
            timeline, auditTrail,
            mediaFiles: mediaToSave,
          }),
        });
      } catch { /* silent — next autosave will retry */ }
      finally { setSaving(false); }
    }, 2000);
  }, [inspectionId, dataReady, damageReports, techNotes, quotationItems,
      approvalStatus, approvalTimestamps, timeline, auditTrail, mediaFiles]);

  // ── Audit logger ────────────────────────────────────────────────────────────
  const logAudit = useCallback((action: string) => {
    const now = new Date();
    setAudit(a => [{ id: uid(), user: currentUser, action, date: fmtDate(now.toISOString()), time: fmtTimeOnly(now.toISOString()) }, ...a]);
  }, [currentUser]);

  const advanceTimeline = useCallback((labelFragment: string) => {
    setTimeline(t => t.map(e => {
      if (e.status === 'pending' && e.label.toLowerCase().includes(labelFragment.toLowerCase())) {
        return { ...e, status: 'done', user: currentUser, timestamp: new Date().toISOString(), color: 'bg-green-500' };
      }
      return e;
    }));
  }, [currentUser]);

  // ── Damage handlers ─────────────────────────────────────────────────────────
  const addDamageReport = (data: ReturnType<typeof emptyReport>) => {
    const report: DamageReport = { ...data, id: uid(), createdAt: new Date().toISOString(), createdBy: currentUser };
    setDamage(d => [...d, report]);
    setShowAddDamage(false);
    logAudit(`Added damage report: "${data.title}"`);
    advanceTimeline('Damage Found');
  };

  const updateDamageReport = (id: string, data: ReturnType<typeof emptyReport>) => {
    setDamage(d => d.map(r => r.id === id ? { ...r, ...data } : r));
    setEditingDamage(null);
    logAudit(`Updated damage report: "${data.title}"`);
  };

  const deleteDamageReport = (id: string) => {
    const r = damageReports.find(x => x.id === id);
    setDamage(d => d.filter(x => x.id !== id));
    logAudit(`Deleted damage report: "${r?.title}"`);
  };

  // ── Media handlers — images compressed to base64 for persistence ─────────────
  const processFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    logAudit(`Uploaded ${arr.length} media file(s)`);
    advanceTimeline('Media Uploaded');
    for (const file of arr) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) continue;

      if (isImage) {
        const compressed = await compressImage(file);
        const mf: MediaFile = {
          id: uid(), type: 'image', url: compressed,
          name: file.name, size: file.size,
          uploadedAt: new Date().toISOString(), uploadedBy: currentUser,
        };
        setMedia(m => [...m, mf]);
      } else {
        // Video: compress to 640px/400kbps via canvas+MediaRecorder, then store as base64
        const id = uid();
        const needsCompress = file.size > 3 * 1024 * 1024; // compress anything > 3 MB
        try {
          let dataUrl: string;
          if (needsCompress) {
            setCompressing({ name: file.name, pct: 0 });
            dataUrl = await compressVideo(file, pct =>
              setCompressing({ name: file.name, pct: Math.round(pct) })
            );
            setCompressing(null);
          } else {
            dataUrl = await new Promise<string>((res, rej) => {
              const reader = new FileReader();
              reader.onload  = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
          }
          const mf: MediaFile = {
            id, type: 'video', url: dataUrl,
            name: file.name, size: file.size,
            uploadedAt: new Date().toISOString(), uploadedBy: currentUser,
          };
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.src = dataUrl;
          vid.onloadedmetadata = () => {
            setMedia(m => m.map(x => x.id === id ? { ...x, duration: Math.round(vid.duration) } : x));
          };
          setMedia(m => [...m, mf]);
        } catch {
          setCompressing(null);
        }
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const deleteMedia = (id: string) => {
    setMedia(m => m.filter(x => x.id !== id));
    logAudit('Deleted media file');
  };

  // ── Quotation handlers ───────────────────────────────────────────────────────
  const addQuoteRow    = () => setQuote(q => [...q, { id: uid(), item: '', qty: 1, unitPrice: 0, labourCost: 0 }]);
  const updateQuoteRow = (id: string, field: keyof QuotationItem, value: any) =>
    setQuote(q => q.map(r => r.id === id ? { ...r, [field]: value } : r));
  const deleteQuoteRow = (id: string) => setQuote(q => q.filter(r => r.id !== id));

  // ── Approval handlers ────────────────────────────────────────────────────────
  const sendApproval = async (channel: 'link' | 'whatsapp') => {
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    const ts = new Date().toISOString();
    setApproval('sent');
    setTs(t => ({ ...t, sent: ts }));
    advanceTimeline('Approval Sent');
    logAudit(`Approval request sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'link'}`);
    if (channel === 'whatsapp') {
      const msg = encodeURIComponent(`Hi ${job?.customerName}, we found additional issues on your vehicle ${job?.vehicleReg}. Please review and approve: ${approvalLink}`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
  };

  const simulateCustomerView = () => {
    if (approvalStatus === 'sent') {
      const ts = new Date().toISOString();
      setApproval('viewed');
      setTs(t => ({ ...t, viewed: ts }));
      advanceTimeline('Customer Viewed');
      logAudit('Simulated: Customer viewed approval page');
    }
  };

  const handleCustomerDecision = (decision: 'approved' | 'rejected') => {
    const ts = new Date().toISOString();
    setApproval(decision);
    setTs(t => ({ ...t, [decision]: ts }));
    setShowPreview(false);
    advanceTimeline(`Customer ${decision.charAt(0).toUpperCase() + decision.slice(1)}`);
    if (decision === 'approved') {
      advanceTimeline('Repair Continued');
      // Auto-update job status to in_progress
      if (selectedJobId) {
        fetch(`${API_URL}/jobs?id=${selectedJobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_status', status: 'in_progress' }),
        }).catch(err => console.error('[job status auto-update]', err));
      }
    }
    logAudit(`Customer ${decision} the additional repairs`);
  };

  // ── PDF Report Generator ─────────────────────────────────────────────────────
  const generatePDF = useCallback(() => {
    // Compute safeJob locally so this callback doesn't depend on the render-time const
    const safeJob: JobSummary = job || {
      jobNumber: '—', customerName: '—', vehicleReg: '—', vehicleMake: '', vehicleModel: '',
      currentService: '—', originalCost: 0, status: 'Pending' as JobStatus, technician: '—',
      branch: '—', createdAt: new Date().toISOString(),
    };
    const additionalFromReports = damageReports.reduce((s, r) => s + r.additionalCost, 0);
    const quoteAdditional = quotationItems.reduce((s, i) => s + i.qty * i.unitPrice + i.labourCost, 0);
    const grandTotal = (safeJob.originalCost || 0) + (quoteAdditional || additionalFromReports);

    const doc  = new jsPDF('p', 'mm', 'a4');
    const PW   = doc.internal.pageSize.getWidth();   // 210
    const PH   = doc.internal.pageSize.getHeight();  // 297
    const ML   = 15;
    const CW   = PW - ML * 2; // 180
    let y      = 0;

    const newPage = () => { doc.addPage(); y = 20; };
    const check  = (need: number) => { if (y + need > PH - 18) newPage(); };

    const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number,number,number] = [30,30,30]) => {
      doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(...color);
    };

    // ── Header bar ──────────────────────────────────────────────────────────────
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, PW, 20, 'F');
    setFont(14, 'bold', [255, 215, 0]);
    doc.text('ANURA TYRES PVT LTD', ML, 11);
    setFont(7, 'normal', [160, 160, 160]);
    doc.text('Damage Inspection Report  ·  Confidential', ML, 16.5);
    setFont(7, 'normal', [160, 160, 160]);
    doc.text(fmtTime(new Date().toISOString()), PW - ML, 13, { align: 'right' });
    y = 30;

    // ── Report title ────────────────────────────────────────────────────────────
    setFont(15, 'bold', [15, 15, 15]);
    doc.text('DAMAGE INSPECTION REPORT', ML, y); y += 6;
    setFont(8, 'normal', [100, 100, 100]);
    doc.text(`Job ${safeJob.jobNumber}  ·  ${safeJob.branch}  ·  ${fmtDate(safeJob.createdAt)}`, ML, y); y += 5;
    doc.setDrawColor(220, 220, 220); doc.line(ML, y, PW - ML, y); y += 8;

    // ── Job info grid ───────────────────────────────────────────────────────────
    setFont(7, 'bold', [80, 80, 80]);
    doc.text('VEHICLE & JOB INFORMATION', ML, y); y += 5;
    const jobFields: [string, string][] = [
      ['Customer',    safeJob.customerName],
      ['Vehicle Reg', safeJob.vehicleReg],
      ['Branch',      safeJob.branch],
      ['Service',     safeJob.currentService],
      ['Technician',  safeJob.technician || '—'],
      ['Original Est',fmtCurrency(safeJob.originalCost)],
    ];
    const colW = CW / 3;
    jobFields.forEach(([label, value], i) => {
      const cx = ML + (i % 3) * colW;
      const cy = y + Math.floor(i / 3) * 12;
      setFont(7, 'normal', [120, 120, 120]); doc.text(label.toUpperCase(), cx, cy);
      setFont(8.5, 'bold', [20, 20, 20]);    doc.text(value || '—', cx, cy + 5);
    });
    y += (Math.ceil(jobFields.length / 3)) * 12 + 5;
    doc.setDrawColor(220, 220, 220); doc.line(ML, y, PW - ML, y); y += 8;

    // ── Damage reports ──────────────────────────────────────────────────────────
    if (damageReports.length > 0) {
      check(14);
      setFont(7, 'bold', [80, 80, 80]);
      doc.text(`DAMAGE REPORTS (${damageReports.length})`, ML, y); y += 5;

      const sevColor: Record<Severity, [number,number,number]> = {
        Low:      [74, 222, 128],
        Medium:   [250, 204, 21],
        High:     [251, 146, 60],
        Critical: [248, 113, 113],
      };

      damageReports.forEach(r => {
        const descH = r.description  ? 5  : 0;
        const recH  = r.recommendedRepair ? 5 : 0;
        const cardH = 22 + descH + recH;
        check(cardH + 4);

        doc.setFillColor(248, 248, 248); doc.rect(ML, y, CW, cardH, 'F');
        const [sr, sg, sb] = sevColor[r.severity];
        doc.setFillColor(sr, sg, sb);   doc.rect(ML, y, 3, cardH, 'F');

        let cy = y + 7;
        setFont(9, 'bold', [20, 20, 20]);   doc.text(r.title, ML + 6, cy);
        setFont(7, 'bold', [sr, sg, sb]);   doc.text(r.severity.toUpperCase(), PW - ML, cy, { align: 'right' });
        cy += 5;
        setFont(7, 'normal', [100, 100, 100]); doc.text(r.category, ML + 6, cy); cy += 5;

        if (r.description) {
          setFont(7.5, 'normal', [60, 60, 60]);
          const lines = doc.splitTextToSize(r.description, CW - 14);
          doc.text(lines[0], ML + 6, cy); cy += 5;
        }
        if (r.recommendedRepair) {
          setFont(7.5, 'bold', [70, 70, 70]); doc.text('Rec: ', ML + 6, cy);
          setFont(7.5, 'normal', [70, 70, 70]);
          doc.text(r.recommendedRepair.substring(0, 70), ML + 17, cy);
        }
        if (r.additionalCost > 0) {
          setFont(8.5, 'bold', [20, 20, 20]);
          doc.text(fmtCurrency(r.additionalCost), PW - ML, y + cardH - 5, { align: 'right' });
        }
        y += cardH + 3;
      });

      // Total additional
      doc.setFillColor(255, 248, 210); doc.rect(ML, y, CW, 10, 'F');
      doc.setDrawColor(255, 215, 0);   doc.rect(ML, y, CW, 10, 'S');
      setFont(8, 'normal', [80, 80, 80]);  doc.text('Total Additional Cost:', ML + 4, y + 6.5);
      setFont(8, 'bold', [20, 20, 20]);    doc.text(fmtCurrency(additionalFromReports), PW - ML, y + 6.5, { align: 'right' });
      y += 15;
    }

    // ── Quotation table ─────────────────────────────────────────────────────────
    const validQ = quotationItems.filter(i => i.item);
    if (validQ.length > 0) {
      check(14 + validQ.length * 7 + 14);
      setFont(7, 'bold', [80, 80, 80]); doc.text('ADDITIONAL QUOTATION', ML, y); y += 5;

      // Header row
      doc.setFillColor(25, 25, 25); doc.rect(ML, y, CW, 7, 'F');
      setFont(6.5, 'bold', [255, 255, 255]);
      const qH = [
        { label: 'Description', x: ML + 2,   align: 'left'  as const },
        { label: 'Qty',         x: ML + 98,   align: 'right' as const },
        { label: 'Unit Price',  x: ML + 120,  align: 'right' as const },
        { label: 'Labour',      x: ML + 145,  align: 'right' as const },
        { label: 'Total',       x: PW - ML,   align: 'right' as const },
      ];
      qH.forEach(h => doc.text(h.label, h.x, y + 4.5, { align: h.align }));
      y += 7;

      validQ.forEach((row, idx) => {
        const rowTot = row.qty * row.unitPrice + row.labourCost;
        if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(ML, y, CW, 7, 'F'); }
        setFont(7.5, 'normal', [30, 30, 30]);
        doc.text(row.item.substring(0, 45), ML + 2, y + 4.5);
        doc.text(String(row.qty), ML + 98, y + 4.5, { align: 'right' });
        setFont(7.5, 'normal', [30, 30, 30]);
        doc.text(row.unitPrice.toLocaleString(), ML + 120, y + 4.5, { align: 'right' });
        doc.text(row.labourCost.toLocaleString(), ML + 145, y + 4.5, { align: 'right' });
        setFont(7.5, 'bold', [20, 20, 20]);
        doc.text(rowTot.toLocaleString(), PW - ML, y + 4.5, { align: 'right' });
        y += 7;
      });
      y += 5;
    }

    // ── Cost summary ────────────────────────────────────────────────────────────
    check(32);
    setFont(7, 'bold', [80, 80, 80]); doc.text('COST SUMMARY', ML, y); y += 5;
    doc.setFillColor(248, 248, 248); doc.rect(ML, y, CW, 28, 'F');

    const costRows: [string, string][] = [
      ['Original Estimate', fmtCurrency(safeJob.originalCost)],
      ['Additional (Parts)', fmtCurrency(quotationItems.reduce((s, i) => s + i.qty * i.unitPrice, 0))],
      ['Additional (Labour)', fmtCurrency(quotationItems.reduce((s, i) => s + i.labourCost, 0))],
    ];
    costRows.forEach(([label, value], i) => {
      setFont(8, 'normal', [80, 80, 80]);  doc.text(label, ML + 4, y + 7 + i * 7);
      setFont(8, 'normal', [30, 30, 30]);  doc.text(value, PW - ML, y + 7 + i * 7, { align: 'right' });
    });
    y += 28;
    doc.setFillColor(255, 215, 0); doc.rect(ML, y, CW, 10, 'F');
    setFont(9, 'bold', [0, 0, 0]);
    doc.text('GRAND TOTAL', ML + 4, y + 7);
    doc.text(fmtCurrency(grandTotal), PW - ML, y + 7, { align: 'right' });
    y += 16;

    // ── Technician notes ────────────────────────────────────────────────────────
    if (techNotes.trim()) {
      check(18);
      doc.setDrawColor(220, 220, 220); doc.line(ML, y, PW - ML, y); y += 6;
      setFont(7, 'bold', [80, 80, 80]); doc.text('TECHNICIAN NOTES', ML, y); y += 5;
      setFont(8, 'normal', [50, 50, 50]);
      const noteLines = doc.splitTextToSize(techNotes, CW);
      noteLines.forEach((line: string) => { check(5); doc.text(line, ML, y); y += 5; });
      y += 3;
    }

    // ── Evidence photos ─────────────────────────────────────────────────────────
    const imgs = mediaFiles.filter(f => f.type === 'image' && f.url?.startsWith('data:'));
    if (imgs.length > 0) {
      check(22);
      doc.setDrawColor(220, 220, 220); doc.line(ML, y, PW - ML, y); y += 6;
      setFont(7, 'bold', [80, 80, 80]); doc.text(`EVIDENCE PHOTOS (${imgs.length})`, ML, y); y += 5;
      const PW3 = (CW - 6) / 3;
      const PH3 = PW3 * 0.72;
      imgs.slice(0, 9).forEach((f, i) => {
        const col = i % 3; const row = Math.floor(i / 3);
        if (col === 0 && row > 0) check(PH3 + 4);
        const px = ML + col * (PW3 + 3); const py = y + row * (PH3 + 4);
        try { doc.addImage(f.url, f.url.includes('/png') ? 'PNG' : 'JPEG', px, py, PW3, PH3); } catch { /* skip */ }
      });
      y += Math.ceil(Math.min(imgs.length, 9) / 3) * (PH3 + 4) + 6;
    }

    // ── Approval status ─────────────────────────────────────────────────────────
    check(22);
    doc.setDrawColor(220, 220, 220); doc.line(ML, y, PW - ML, y); y += 6;
    setFont(7, 'bold', [80, 80, 80]); doc.text('CUSTOMER APPROVAL STATUS', ML, y); y += 5;
    const statusLabel = APPROVAL_STEPS.find(s => s.key === approvalStatus)?.label || approvalStatus;
    const statusClr: Record<ApprovalStatus, [number,number,number]> = {
      not_sent: [120,120,120], sent: [59,130,246], viewed: [245,158,11],
      approved: [34,197,94],  rejected: [239,68,68],
    };
    const [ar, ag, ab] = statusClr[approvalStatus];
    doc.setFillColor(ar, ag, ab); doc.rect(ML, y, 3, 9, 'F');
    doc.setFillColor(248, 248, 248); doc.rect(ML + 3, y, CW - 3, 9, 'F');
    setFont(8, 'bold', [ar, ag, ab]); doc.text(statusLabel.toUpperCase(), ML + 7, y + 6);
    if (approvalTimestamps[approvalStatus]) {
      setFont(7, 'normal', [120, 120, 120]);
      doc.text(fmtTime(approvalTimestamps[approvalStatus]!), PW - ML, y + 6, { align: 'right' });
    }
    y += 9;

    // ── Footer ───────────────────────────────────────────────────────────────────
    doc.setFillColor(10, 10, 10);
    doc.rect(0, PH - 12, PW, 12, 'F');
    setFont(6.5, 'normal', [120, 120, 120]);
    doc.text(`Inspection ID: ${inspectionId || '—'}`, ML, PH - 5);
    doc.text('ANURA TYRES PVT LTD — Confidential', PW / 2, PH - 5, { align: 'center' });
    setFont(6.5, 'normal', [120, 120, 120]);
    doc.text(`Generated: ${fmtTime(new Date().toISOString())}`, PW - ML, PH - 5, { align: 'right' });

    doc.save(`AnuraTyres_Inspection_${safeJob.jobNumber || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`);
  }, [job, damageReports, quotationItems, techNotes, mediaFiles, approvalStatus,
      approvalTimestamps, inspectionId, additionalFromReports, grandTotal]);

  const copyLink = () => {
    navigator.clipboard.writeText(approvalLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (quoteAdditional > 0 && dataReady) advanceTimeline('Quotation Generated');
  }, [quoteAdditional]);

  const approvalStepIndex = APPROVAL_STEPS.findIndex(s => s.key === approvalStatus);

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB SELECTOR SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (!selectedJobId) {
    const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];
    const filtered = jobs.filter(j => {
      if (!jobSearch) return true;
      const q = jobSearch.toLowerCase();
      return (
        j.vehiclePlate?.toLowerCase().includes(q) ||
        j.customerName?.toLowerCase().includes(q) ||
        j.service?.toLowerCase().includes(q) ||
        j.bookingRef?.toLowerCase().includes(q)
      );
    });

    const statusColor: Record<string, string> = {
      unassigned:  'bg-neutral-700 text-neutral-300 border-neutral-600',
      assigned:    'bg-purple-500/20 text-purple-400 border-purple-500/30',
      in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      paused:      'bg-orange-500/20 text-orange-400 border-orange-500/30',
      done:        'bg-green-500/20 text-green-400 border-green-500/30',
      waiting:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };

    return (
      <div className="min-h-screen p-6">
  
        {/* Header */}
        <div className="mb-6">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-sm font-medium transition-colors group mb-4">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Jobs
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-white">Damage Inspection</h1>
              <p className="text-neutral-500 text-sm mt-1">Select a job to start or continue a damage inspection</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {isAllBranches && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Branch</label>
                <select value={selectorBranch} onChange={e => setSelectorBranch(e.target.value)} className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors">
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            <div className={isAllBranches ? '' : 'sm:col-span-1'}>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Date</label>
              <input type="date" value={selectorDate} onChange={e => setSelectorDate(e.target.value)} className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
            <div className={isAllBranches ? '' : 'sm:col-span-2'}>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <input
                  value={jobSearch} onChange={e => setJobSearch(e.target.value)}
                  placeholder="Vehicle, customer, service…"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors pl-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Jobs grid */}
        {jobsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Car className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-400 font-semibold">No jobs found</p>
            <p className="text-neutral-600 text-sm mt-1">Try a different date or branch</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(j => {
              const jid   = j._id?.toString() || j.id;
              const sCol  = statusColor[j.status] || 'bg-neutral-700 text-neutral-300 border-neutral-600';
              const label = j.status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <div key={jid}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-[#FFD700]/30 transition-colors group cursor-pointer"
                  onClick={() => setSelectedJobId(jid)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-[#FFD700]/10 flex items-center justify-center flex-shrink-0">
                        <Car className="w-4 h-4 text-[#FFD700]" />
                      </div>
                      <div>
                        <p className="text-white font-black font-mono text-sm">{j.vehiclePlate || '—'}</p>
                        <p className="text-neutral-500 text-xs">{j.branch}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sCol}`}>{label}</span>
                  </div>

                  <p className="text-neutral-300 text-sm font-semibold mb-0.5">{j.customerName || '—'}</p>
                  <p className="text-[#FFD700]/70 text-xs font-medium mb-3">{j.service}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                      <User className="w-3 h-3" />
                      <span>{j.staffName || 'Unassigned'}</span>
                    </div>
                    <button
                      className="flex items-center gap-1 text-xs font-bold text-[#FFD700] group-hover:gap-2 transition-all"
                      onClick={e => { e.stopPropagation(); setSelectedJobId(jid); }}
                    >
                      Inspect <ChevronLeft className="w-3 h-3 rotate-180" />
                    </button>
                  </div>

                  {j.timeSlot && (
                    <p className="text-[10px] text-neutral-700 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {j.timeSlot}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">Loading inspection record…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INSPECTION VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const safeJob: JobSummary = job || {
    jobNumber: '—', customerName: '—', vehicleReg: '—',
    vehicleMake: '', vehicleModel: '', currentService: '—',
    originalCost: 0, status: 'Pending', technician: '—',
    branch: '—', createdAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-0 min-h-screen">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedJobId(null)}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-sm font-medium transition-colors group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Jobs
            </button>
            <span className="text-neutral-700">/</span>
            <span className="text-neutral-400 text-sm font-mono">{safeJob.jobNumber}</span>
            <span className="text-neutral-700">/</span>
            <span className="text-[#FFD700] text-sm font-semibold">Damage Inspection</span>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            )}
            <JobStatusBadge status={safeJob.status} />
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-neutral-700 text-neutral-300 rounded-lg hover:border-[#FFD700]/40 hover:text-white transition-colors">
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button onClick={generatePDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-neutral-700 text-neutral-300 rounded-lg hover:border-[#FFD700]/40 hover:text-[#FFD700] transition-colors">
              <Printer className="w-3.5 h-3.5" /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────────── */}
      <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* ── SECTION 1: Job Summary ─────────────────────────────────────── */}
          <SectionCard title="Job Summary" icon={Wrench}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Job Number',   value: safeJob.jobNumber,     icon: FileText,  mono: true },
                { label: 'Customer',     value: safeJob.customerName,  icon: User },
                { label: 'Vehicle Reg',  value: safeJob.vehicleReg,    icon: Car,       mono: true },
                { label: 'Branch',       value: safeJob.branch,        icon: Car },
              ].map(({ label, value, icon: Icon, mono }) => (
                <div key={label} className="bg-neutral-800/60 rounded-xl p-3.5 border border-neutral-700/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3.5 h-3.5 text-neutral-500" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
                  </div>
                  <p className={`text-white text-sm font-bold ${mono ? 'font-mono' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
              {[
                { label: 'Current Service',   value: safeJob.currentService,       wide: true },
                { label: 'Original Estimate', value: fmtCurrency(safeJob.originalCost), highlight: true },
                { label: 'Technician',        value: safeJob.technician || '—' },
                { label: 'Started',           value: fmtTime(safeJob.createdAt) },
              ].map(({ label, value, wide, highlight }) => (
                <div key={label} className={`bg-neutral-800/60 rounded-xl p-3.5 border ${highlight ? 'border-[#FFD700]/30 bg-[#FFD700]/5' : 'border-neutral-700/50'} ${wide ? 'md:col-span-2' : ''}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">{label}</p>
                  <p className={`text-sm font-bold ${highlight ? 'text-[#FFD700]' : 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── SECTION 2: Damage Reports ─────────────────────────────────── */}
          <SectionCard
            title={`Damage Reports${damageReports.length > 0 ? ` (${damageReports.length})` : ''}`}
            icon={AlertTriangle}
            action={
              !showAddDamage && !editingDamage && (
                <button onClick={() => setShowAddDamage(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD700] text-black text-xs font-bold rounded-lg hover:bg-[#FFD700]/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Report
                </button>
              )
            }
          >
            <div className="space-y-3">
              {showAddDamage && (
                <DamageReportForm onSave={addDamageReport} onCancel={() => setShowAddDamage(false)} />
              )}

              {damageReports.length === 0 && !showAddDamage && (
                <div className="py-10 text-center">
                  <AlertTriangle className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm font-medium">No damage reports yet</p>
                  <p className="text-neutral-600 text-xs mt-1">Click "Add Report" to document a fault found during inspection.</p>
                </div>
              )}

              {damageReports.map(r => (
                <div key={r.id}>
                  {editingDamage?.id === r.id ? (
                    <DamageReportForm
                      initial={r}
                      onSave={(d) => updateDamageReport(r.id, d)}
                      onCancel={() => setEditingDamage(null)}
                    />
                  ) : (
                    <div className={`bg-neutral-800/50 border rounded-xl p-4 ${SEVERITY_CONFIG[r.severity].border}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-white font-semibold text-sm">{r.title}</p>
                            <SeverityBadge severity={r.severity} />
                          </div>
                          <p className="text-[11px] text-[#FFD700]/70 font-medium mb-2">{r.category}</p>
                          {r.description && <p className="text-neutral-400 text-xs mb-1.5">{r.description}</p>}
                          {r.recommendedRepair && (
                            <p className="text-xs text-neutral-400">
                              <span className="text-neutral-300 font-medium">Recommendation:</span> {r.recommendedRepair}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditingDamage(r)}
                            className="p-1.5 text-neutral-500 hover:text-[#FFD700] rounded-lg hover:bg-[#FFD700]/10 transition-colors">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteDamageReport(r.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700/50">
                        <div className="flex items-center gap-3 text-[11px] text-neutral-600">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.createdBy}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(r.createdAt)}</span>
                        </div>
                        {r.additionalCost > 0 && (
                          <span className="text-sm font-black text-white">{fmtCurrency(r.additionalCost)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {damageReports.length > 0 && (
                <div className={`flex justify-end px-4 py-3 rounded-xl border ${additionalFromReports > 0 ? 'bg-[#FFD700]/5 border-[#FFD700]/20' : 'bg-neutral-800/40 border-neutral-700/40'}`}>
                  <div className="text-right">
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Total Additional Cost</p>
                    <p className="text-xl font-black text-[#FFD700]">{fmtCurrency(additionalFromReports)}</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION 3: Media Evidence ─────────────────────────────────── */}
          <SectionCard
            title={`Media Evidence${mediaFiles.length > 0 ? ` (${mediaFiles.length})` : ''}`}
            icon={Camera}
            action={
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD700] text-black text-xs font-bold rounded-lg hover:bg-[#FFD700]/90 transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            }
          >
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
              className="hidden" onChange={e => e.target.files && processFiles(e.target.files)} />

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                dragging ? 'border-[#FFD700] bg-[#FFD700]/5' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/40'}`}
            >
              <div className="flex items-center justify-center gap-4 mb-3">
                <ImageIcon className={`w-6 h-6 ${dragging ? 'text-[#FFD700]' : 'text-neutral-600'}`} />
                <VideoIcon className={`w-6 h-6 ${dragging ? 'text-[#FFD700]' : 'text-neutral-600'}`} />
                <Camera   className={`w-6 h-6 ${dragging ? 'text-[#FFD700]' : 'text-neutral-600'}`} />
              </div>
              <p className={`text-sm font-medium ${dragging ? 'text-[#FFD700]' : 'text-neutral-400'}`}>
                {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-neutral-600 mt-1">Images &amp; videos compressed and saved · Any size supported</p>
            </div>

            {/* Compression progress banner */}
            {compressing && (
              <div className="mb-3 px-4 py-3 rounded-xl bg-[#FFD700]/8 border border-[#FFD700]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#FFD700]">Compressing "{compressing.name}"…</span>
                  <span className="text-xs text-neutral-500 font-mono">{compressing.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FFD700] transition-all duration-300"
                    style={{ width: `${compressing.pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-neutral-600 mt-1.5">Please wait — video plays in real-time during compression</p>
              </div>
            )}

            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {mediaFiles.map(f => (
                  <div key={f.id} className="relative group rounded-lg overflow-hidden bg-neutral-800 aspect-square">
                    {f.type === 'image' && f.url ? (
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800">
                        <Play className="w-7 h-7 text-[#FFD700]" />
                        {f.duration !== undefined && (
                          <span className="text-[10px] text-neutral-400 mt-1">{fmtDuration(f.duration)}</span>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <button onClick={() => setLightbox(f)}
                        className="p-1.5 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMedia(f.id)}
                        className="p-1.5 bg-red-500/40 rounded-lg text-white hover:bg-red-500/60 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="absolute top-1 left-1">
                      {f.type === 'video'
                        ? <span className="text-[9px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded font-bold">VID</span>
                        : <span className="text-[9px] bg-[#FFD700]/80 text-black px-1.5 py-0.5 rounded font-bold">IMG</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mediaFiles.length === 0 && (
              <p className="text-center text-xs text-neutral-600 py-2">No media uploaded yet.</p>
            )}
          </SectionCard>

          {/* ── SECTION 4: Technician Findings ────────────────────────────── */}
          <SectionCard title="Technician Findings" icon={MessageSquare}>
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">Detailed inspection notes. Use clear, professional language for the customer-facing report.</p>
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-t-lg border-b-0">
                {[{ label: 'B', style: 'font-bold', title: 'Bold' }, { label: 'I', style: 'italic', title: 'Italic' }, { label: 'U', style: 'underline', title: 'Underline' }].map(b => (
                  <button key={b.label} title={b.title}
                    className={`w-7 h-7 text-xs ${b.style} text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors`}>
                    {b.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-neutral-700 mx-1" />
                <span className="text-[10px] text-neutral-600 ml-1">{techNotes.length} chars</span>
              </div>
              <textarea
                rows={6}
                value={techNotes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. During inspection we discovered excessive wear on the front brake discs…"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-b-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 resize-none transition-colors leading-relaxed"
              />
            </div>
          </SectionCard>

          {/* ── SECTION 5: Quotation Builder ──────────────────────────────── */}
          <SectionCard title="Additional Quotation" icon={DollarSign}>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      {['Item / Part', 'Qty', 'Unit Price (Rs.)', 'Labour (Rs.)', 'Total (Rs.)', ''].map(h => (
                        <th key={h} className="text-left pb-2.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 px-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotationItems.map((row) => {
                      const rowTotal = row.qty * row.unitPrice + row.labourCost;
                      return (
                        <tr key={row.id} className="border-b border-neutral-800/60 group">
                          <td className="py-2 px-1">
                            <input value={row.item} onChange={e => updateQuoteRow(row.id, 'item', e.target.value)}
                              placeholder="e.g. Front brake disc pair"
                              className="w-full bg-transparent border-b border-transparent focus:border-[#FFD700] text-white text-sm focus:outline-none px-0 py-1 placeholder:text-neutral-700 min-w-[160px]" />
                          </td>
                          <td className="py-2 px-1 w-16">
                            <input type="number" min="1" value={row.qty} onChange={e => updateQuoteRow(row.id, 'qty', Number(e.target.value))}
                              className="w-full bg-transparent border-b border-transparent focus:border-[#FFD700] text-white text-sm focus:outline-none px-0 py-1 text-center" />
                          </td>
                          <td className="py-2 px-1 w-28">
                            <input type="number" min="0" value={row.unitPrice} onChange={e => updateQuoteRow(row.id, 'unitPrice', Number(e.target.value))}
                              className="w-full bg-transparent border-b border-transparent focus:border-[#FFD700] text-white text-sm focus:outline-none px-0 py-1 text-right" />
                          </td>
                          <td className="py-2 px-1 w-28">
                            <input type="number" min="0" value={row.labourCost} onChange={e => updateQuoteRow(row.id, 'labourCost', Number(e.target.value))}
                              className="w-full bg-transparent border-b border-transparent focus:border-[#FFD700] text-white text-sm focus:outline-none px-0 py-1 text-right" />
                          </td>
                          <td className="py-2 px-1 w-28 text-right">
                            <span className={`font-semibold text-sm ${rowTotal > 0 ? 'text-white' : 'text-neutral-700'}`}>
                              {rowTotal > 0 ? rowTotal.toLocaleString() : '—'}
                            </span>
                          </td>
                          <td className="py-2 px-1 w-8">
                            <button onClick={() => deleteQuoteRow(row.id)}
                              className="p-1 text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={addQuoteRow}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors py-1">
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>

              <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden mt-2">
                <div className="px-4 py-2 bg-neutral-800/80">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Cost Summary</p>
                </div>
                <div className="px-4 pb-4 space-y-2.5">
                  {[
                    { label: 'Original Estimate',    value: safeJob.originalCost,   color: 'text-white' },
                    { label: 'Additional Parts',     value: quotationItems.reduce((s,i) => s + i.qty*i.unitPrice, 0), color: 'text-orange-400' },
                    { label: 'Additional Labour',    value: quotationItems.reduce((s,i) => s + i.labourCost, 0),      color: 'text-orange-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-sm border-b border-neutral-700/40 pb-2">
                      <span className="text-neutral-400">{label}</span>
                      <span className={`font-semibold ${color}`}>{fmtCurrency(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-white font-bold">Updated Grand Total</span>
                    <span className="text-xl font-black text-[#FFD700]">{fmtCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── SECTION 6: Approval Status ────────────────────────────────── */}
          <SectionCard title="Customer Approval Status" icon={Shield}>
            <div className="space-y-5">
              <div className="relative">
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-neutral-700 z-0" />
                <div className="relative z-10 flex justify-between">
                  {APPROVAL_STEPS.filter(s => s.key !== 'rejected' || approvalStatus === 'rejected').map((step, i) => {
                    const done   = i < approvalStepIndex || approvalStatus === step.key;
                    const active = approvalStatus === step.key;
                    const Icon   = step.icon;
                    const isRej  = step.key === 'rejected';
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          active && isRej ? 'border-red-500 bg-red-500/20' :
                          active         ? 'border-[#FFD700] bg-[#FFD700]/20' :
                          done           ? 'border-green-500 bg-green-500' :
                                           'border-neutral-700 bg-neutral-800'
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${
                            active && isRej ? 'text-red-400' :
                            active          ? 'text-[#FFD700]' :
                            done            ? 'text-white' : 'text-neutral-600'}`} />
                        </div>
                        <p className={`text-[10px] font-bold text-center leading-tight ${
                          active && isRej ? 'text-red-400' :
                          active          ? 'text-[#FFD700]' :
                          done            ? 'text-green-400' : 'text-neutral-600'}`}>
                          {step.label}
                        </p>
                        {approvalTimestamps[step.key] && (
                          <p className="text-[9px] text-neutral-600 text-center leading-tight">
                            {fmtTime(approvalTimestamps[step.key]!)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {approvalStatus === 'approved' && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-400 font-bold text-sm">Customer Approved</p>
                    <p className="text-green-400/70 text-xs">Proceed with additional repairs. {approvalTimestamps.approved && fmtTime(approvalTimestamps.approved)}</p>
                  </div>
                </div>
              )}
              {approvalStatus === 'rejected' && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-400 font-bold text-sm">Customer Rejected</p>
                    <p className="text-red-400/70 text-xs">Do not proceed with additional repairs. Contact customer for guidance.</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION 7: Approval Actions ───────────────────────────────── */}
          <SectionCard title="Customer Approval Actions" icon={Send}>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Secure Approval Link</p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg">
                    <Link2 className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <span className="text-neutral-400 text-xs truncate font-mono">{approvalLink}</span>
                  </div>
                  <button onClick={copyLink}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                      copiedLink ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'}`}>
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => sendApproval('link')} disabled={sendingApproval}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-[#FFD700] text-black font-bold text-sm rounded-xl hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {sendingApproval ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Approval Request
                </button>
                <button onClick={() => sendApproval('whatsapp')} disabled={sendingApproval}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                  <MessageSquare className="w-4 h-4" />
                  Send via WhatsApp
                </button>
                <button onClick={() => { if (approvalStatus === 'sent' || approvalStatus === 'viewed') sendApproval('link'); }}
                  disabled={approvalStatus === 'not_sent' || approvalStatus === 'approved' || approvalStatus === 'rejected'}
                  className="flex items-center justify-center gap-2 py-3 px-4 border border-neutral-700 text-neutral-300 font-bold text-sm rounded-xl hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <RefreshCw className="w-4 h-4" />
                  Resend Request
                </button>
                <button className="flex items-center justify-center gap-2 py-3 px-4 border border-neutral-700 text-neutral-300 font-bold text-sm rounded-xl hover:border-neutral-500 hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                  Generate PDF
                </button>
              </div>

              {approvalStatus === 'sent' && (
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-blue-400 text-xs font-semibold">Approval request sent. Waiting for customer.</p>
                  </div>
                  <button onClick={simulateCustomerView}
                    className="text-[11px] text-blue-400/70 hover:text-blue-400 border border-blue-500/30 px-2 py-1 rounded-lg font-medium transition-colors flex-shrink-0">
                    Simulate View
                  </button>
                </div>
              )}

              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Customer Approval Preview</p>
                <button onClick={() => setShowPreview(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-700 text-neutral-400 text-sm font-medium rounded-xl hover:border-[#FFD700]/40 hover:text-[#FFD700] transition-colors">
                  <Eye className="w-4 h-4" />
                  Open Customer View Preview
                </button>
              </div>
            </div>
          </SectionCard>

        </div>
        {/* ══ END LEFT COLUMN ══════════════════════════════════════════════════ */}

        {/* ══ RIGHT COLUMN — Timeline + Audit ══════════════════════════════════ */}
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden xl:sticky xl:top-[73px]">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="flex items-center gap-2.5 text-sm font-bold text-white uppercase tracking-wide">
                <Activity className="w-4 h-4 text-[#FFD700]" />
                Activity Timeline
              </h3>
            </div>
            <div className="p-4">
              <div className="relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-neutral-700" />
                <div className="space-y-4">
                  {timeline.map((event) => (
                    <div key={event.id} className="relative flex gap-4 pl-9">
                      <div className={`absolute left-0 top-0.5 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                        event.status === 'done'    ? `${event.color} border-transparent` :
                        event.status === 'active'  ? 'bg-neutral-900 border-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.3)]' :
                                                    'bg-neutral-800 border-neutral-700'}`}>
                        {event.status === 'done'   && <Check    className="w-3.5 h-3.5 text-white" />}
                        {event.status === 'active' && <Activity className="w-3 h-3 text-[#FFD700] animate-pulse" />}
                        {event.status === 'pending' && <CircleDot className="w-2.5 h-2.5 text-neutral-600" />}
                      </div>
                      <div className={`min-w-0 pb-1 ${event.status === 'pending' ? 'opacity-40' : ''}`}>
                        <p className={`text-sm font-semibold ${
                          event.status === 'active' ? 'text-[#FFD700]' :
                          event.status === 'done'   ? 'text-white' : 'text-neutral-500'}`}>
                          {event.label}
                        </p>
                        {event.status !== 'pending' && (
                          <>
                            {event.user     && <p className="text-[11px] text-neutral-500">{event.user}</p>}
                            {event.timestamp && <p className="text-[11px] text-neutral-600">{fmtTime(event.timestamp)}</p>}
                          </>
                        )}
                        {event.status === 'active' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#FFD700]/70 font-bold uppercase tracking-wider mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <p className="text-neutral-600 text-xs text-center py-4">No timeline events yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Audit Trail ─────────────────────────────────────────────── */}
            <div className="border-t border-neutral-800">
              <button
                onClick={() => setAuditOpen(!auditOpen)}
                className="w-full px-5 py-3 flex items-center justify-between text-sm font-bold text-neutral-400 hover:text-white transition-colors hover:bg-neutral-800/50"
              >
                <span className="flex items-center gap-2.5 uppercase tracking-wide text-xs">
                  <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
                  Audit Trail ({auditTrail.length})
                </span>
                {auditOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {auditOpen && (
                <div className="px-4 pb-4">
                  <div className="space-y-0 overflow-hidden rounded-lg border border-neutral-700/60">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 bg-neutral-800/80 border-b border-neutral-700/60">
                      {['Action / User', 'Date', 'Time'].map(h => (
                        <p key={h} className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{h}</p>
                      ))}
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-neutral-800/60">
                      {auditTrail.map(entry => (
                        <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2.5 hover:bg-neutral-800/30 transition-colors">
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate">{entry.action}</p>
                            <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                              <User className="w-2.5 h-2.5" />{entry.user}
                            </p>
                          </div>
                          <p className="text-[10px] text-neutral-500 whitespace-nowrap self-center">{entry.date}</p>
                          <p className="text-[10px] text-neutral-600 whitespace-nowrap self-center font-mono">{entry.time}</p>
                        </div>
                      ))}
                      {auditTrail.length === 0 && (
                        <p className="text-neutral-600 text-xs text-center py-4 px-3">No audit entries yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* ══ END RIGHT COLUMN ══════════════════════════════════════════════════ */}

      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────────── */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2 z-10">
            <X className="w-6 h-6" />
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-4xl max-h-[90vh] flex items-center justify-center p-4">
            {lightboxMedia.type === 'image' ? (
              <img src={lightboxMedia.url} alt={lightboxMedia.name} className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            ) : (
              <video src={lightboxMedia.url} controls className="max-w-full max-h-[85vh] rounded-xl" />
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full">
            <p className="text-white text-sm">{lightboxMedia.name} · {(lightboxMedia.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
      )}

      {/* ── CUSTOMER PREVIEW MODAL ───────────────────────────────────────────── */}
      {showPreview && (
        <CustomerPreviewModal
          job={safeJob}
          damageReports={damageReports}
          mediaFiles={mediaFiles}
          techNotes={techNotes}
          originalCost={safeJob.originalCost}
          additionalTotal={additionalTotal}
          onClose={() => setShowPreview(false)}
          onApprove={() => handleCustomerDecision('approved')}
          onReject={() => handleCustomerDecision('rejected')}
        />
      )}
    </div>
  );
}

// Inline tiny icon for timeline pending dots
function CircleDot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
