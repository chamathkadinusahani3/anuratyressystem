import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, TrendingUp, DollarSign, Wrench, Package,
  Users, Download, RefreshCw, Calendar, ChevronDown,
  AlertTriangle, CheckCircle, Clock, Zap, Star,
  ArrowUpRight, ArrowDownRight, FileText, Printer,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { getSessionUser } from '../lib/auth';

// ── API ───────────────────────────────────────────────────────────────────────
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function apiFetch(path: string) {
  const res  = await fetch(`${API}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Overview {
  revenue: { total: number; parts: number; labour: number; discounts: number; outstanding: number; invoiceCount: number };
  jobs:    { total: number; completed: number; completionRate: number; avgJobRevenue: number };
}
interface TrendDay   { date: string; revenue: number; parts: number; labour: number; discounts: number; count: number }
interface TrendMonth { month: string; revenue: number; parts: number; labour: number; discounts: number; count: number }
interface ServiceStat { service: string; total: number; completed: number; avgMins: number; efficiencyPct: number | null }
interface TechStat    { staffId: string; name: string; total: number; completed: number; totalWorkMins: number; overtimeMins: number; pauseCount: number; avgJobMins: number; completionPct: number }
interface DailyJob    { date: string; total: number; completed: number; inProgress: number; paused: number }
interface InvCat      { category: string; items: number; value: number }
interface InvItem     { name: string; category: string; quantity: number; unitPrice: number; value: number; status: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

const RANGE_PRESETS = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year',    days: 365 },
];

function dateRange(days: number) {
  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
  return { from, to };
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtRs  = (n: number) => `Rs ${n.toLocaleString('en-LK')}`;
const fmtK   = (n: number) => n >= 1000 ? `Rs ${(n/1000).toFixed(1)}k` : fmtRs(n);
const fmtPct = (n: number) => `${n}%`;

// ── Colours ───────────────────────────────────────────────────────────────────
const PALETTE = ['#FFD700','#10B981','#3B82F6','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#84CC16'];

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Area / Line chart ─────────────────────────────────────────────────────────
function AreaChart({ data, xKey, series, height = 160 }: {
  data:   Record<string,any>[];
  xKey:   string;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-neutral-600 text-sm">No data</div>;

  const W   = 800;
  const H   = height;
  const px  = 60; const py = 20;
  const cW  = W - px; const cH = H - py * 2;

  const maxVal = Math.max(...data.flatMap(d => series.map(s => d[s.key] || 0)), 1);

  const xPos = (i: number) => px + (i / Math.max(data.length - 1, 1)) * cW;
  const yPos = (v: number) => py + cH - (v / maxVal) * cH;

  // X labels — show at most 8
  const step = Math.ceil(data.length / 8);
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = py + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={px} y1={y} x2={W} y2={y} stroke="#262626" strokeWidth="0.8" />
            <text x={px - 6} y={y + 4} fontSize="10" fill="#525252" textAnchor="end">
              {fmtK(maxVal * f)}
            </text>
          </g>
        );
      })}

      {/* Area + line for each series */}
      {series.map(s => {
        const pts = data.map((d, i) => [xPos(i), yPos(d[s.key] || 0)] as [number, number]);
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
        const areaD = `${pathD} L${pts[pts.length-1][0]},${H-py} L${px},${H-py} Z`;
        return (
          <g key={s.key}>
            <path d={areaD} fill={s.color} fillOpacity="0.08" />
            <path d={pathD} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {pts.map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="3" fill={s.color} />
            ))}
          </g>
        );
      })}

      {/* X axis labels */}
      {xLabels.map(d => {
        const i   = data.indexOf(d);
        const lbl = (d[xKey] as string).slice(5); // MM-DD or MM
        return <text key={i} x={xPos(i)} y={H - 4} fontSize="10" fill="#525252" textAnchor="middle">{lbl}</text>;
      })}

      {/* Legend */}
      {series.map((s, i) => (
        <g key={s.key} transform={`translate(${px + i * 120}, ${H - 4})`}>
          <rect x={-2} y={-8} width="10" height="3" rx="1" fill={s.color} />
          <text x={12} y={0} fontSize="10" fill="#737373">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBarChart({ data, valueKey, labelKey, color = '#FFD700', limit = 8 }: {
  data:     Record<string,any>[];
  valueKey: string;
  labelKey: string;
  color?:   string;
  limit?:   number;
}) {
  const rows = data.slice(0, limit);
  const max  = Math.max(...rows.map(d => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      {rows.map((d, i) => {
        const val = d[valueKey] || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 w-28 flex-shrink-0 truncate">{d[labelKey]}</span>
            <div className="flex-1 h-5 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
            <span className="text-xs text-neutral-300 w-14 text-right flex-shrink-0">{typeof val === 'number' && val > 1000 ? fmtK(val) : val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ slices, total, label }: {
  slices: { label: string; value: number; color: string }[];
  total:  number;
  label:  string;
}) {
  const R = 60; const cx = 80; const cy = 80;
  let angle = -90;
  const paths: JSX.Element[] = [];

  slices.forEach((s, i) => {
    const pct = total > 0 ? s.value / total : 0;
    const a1  = (angle * Math.PI) / 180;
    const a2  = ((angle + pct * 360) * Math.PI) / 180;
    const x1  = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1);
    const x2  = cx + R * Math.cos(a2); const y2 = cy + R * Math.sin(a2);
    const largeArc = pct > 0.5 ? 1 : 0;
    if (pct > 0.005) {
      paths.push(
        <path key={i}
          d={`M ${cx},${cy} L ${x1},${y1} A ${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`}
          fill={s.color} stroke="#0a0a0a" strokeWidth="1.5"
        />
      );
    }
    angle += pct * 360;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
        {paths}
        <circle cx={cx} cy={cy} r={R * 0.58} fill="#0a0a0a" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="white">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9"  fill="#737373">{label}</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {slices.slice(0, 7).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-neutral-400 flex-1 truncate">{s.label}</span>
            <span className="text-neutral-200 font-medium">{s.value}</span>
            <span className="text-neutral-600">{total > 0 ? `${Math.round(s.value/total*100)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, trend }: {
  label: string; value: string; sub?: string; color: string;
  icon:  React.ElementType; trend?: 'up'|'down'|null;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 relative overflow-hidden group hover:border-neutral-700 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-neutral-800 group-hover:scale-110 transition-transform" style={{ color }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {sub && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend === 'up'   && <ArrowUpRight   className="w-3 h-3 text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight  className="w-3 h-3 text-red-400" />}
          <span className="text-neutral-500">{sub}</span>
        </div>
      )}
      <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" style={{ background: color }} />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub, color = '#FFD700' }: { icon: React.ElementType; title: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-white font-bold text-sm">{title}</h3>
        {sub && <p className="text-neutral-500 text-xs">{sub}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function exportCSV(filename: string, headers: string[], rows: (string|number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

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

async function exportPDF(
  branch: string, fromDate: string, toDate: string,
  overview: Overview | null,
  services: ServiceStat[],
  technicians: TechStat[],
  daily: DailyJob[],
) {
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();
  const mg  = 15;
  let   y   = 15;

  const ln  = () => { doc.setDrawColor(230,230,230); doc.setLineWidth(0.2); doc.line(mg, y, W-mg, y); y += 5; };
  const sp  = (n=4) => { y += n; };
  const row = (lbl: string, val: string, bold=false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(bold ? 30 : 80, bold ? 30 : 80, bold ? 30 : 80);
    doc.text(lbl, mg, y); doc.text(val, W-mg, y, {align:'right'}); y += 5;
  };

  // Header
  doc.setFillColor(15,15,15); doc.rect(0,0,W,30,'F');
  doc.setFillColor(255,215,0); doc.rect(0,30,W,1.5,'F');
  if (logo) doc.addImage(logo, 'PNG', mg, 5, 18, 18);
  const tx = mg + (logo ? 20 : 0);
  doc.setTextColor(255,215,0); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('ANURA TYRES', tx, 13);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
  doc.text('Garage Reports & Analytics', tx, 20); doc.text('(Pvt) Ltd', tx, 26);
  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(255,215,0);
  doc.text('BUSINESS REPORT', W-mg, 15, {align:'right'});
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(200,200,200);
  doc.text(`Branch: ${branch || 'All'}`, W-mg, 21, {align:'right'});
  doc.text(`Period: ${fromDate} → ${toDate}`, W-mg, 26, {align:'right'});
  y = 40;

  // Revenue KPIs
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,215,0);
  doc.text('REVENUE SUMMARY', mg, y); y += 6;
  if (overview) {
    row('Total Revenue',  fmtRs(overview.revenue.total),   true);
    row('Parts Total',    fmtRs(overview.revenue.parts));
    row('Labour Income',  fmtRs(overview.revenue.labour));
    row('Discounts',     `−${fmtRs(overview.revenue.discounts)}`);
    row('Outstanding',    fmtRs(overview.revenue.outstanding));
    row('Invoice Count',  String(overview.revenue.invoiceCount));
  }
  sp(2); ln();

  // Job KPIs
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(59,130,246);
  doc.text('JOB STATISTICS', mg, y); y += 6;
  if (overview) {
    row('Total Jobs',          String(overview.jobs.total));
    row('Completed',           String(overview.jobs.completed));
    row('Completion Rate',     fmtPct(overview.jobs.completionRate));
    row('Avg Revenue / Invoice', fmtRs(overview.jobs.avgJobRevenue));
  }
  sp(2); ln();

  // Services table
  if (services.length > 0) {
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(16,185,129);
    doc.text('SERVICE BREAKDOWN', mg, y); y += 6;
    doc.setFillColor(245,245,245); doc.rect(mg, y, W-2*mg, 6, 'F');
    ['Service','Total','Done','Avg Mins','Efficiency'].forEach((h,i) => {
      const x = [mg+2, mg+65, mg+90, mg+115, mg+145];
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(60,60,60);
      doc.text(h, x[i], y+4);
    });
    y += 8;
    services.slice(0,12).forEach(s => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,30,30);
      doc.text(s.service.slice(0,30),   mg+2, y);
      doc.text(String(s.total),         mg+65, y);
      doc.text(String(s.completed),     mg+90, y);
      doc.text(`${s.avgMins}m`,          mg+115, y);
      doc.text(s.efficiencyPct != null ? `${s.efficiencyPct}%` : '—', mg+145, y);
      y += 5.5;
    });
    sp(2); ln();
  }

  // Technician table
  if (technicians.length > 0) {
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(245,158,11);
    doc.text('TECHNICIAN PERFORMANCE', mg, y); y += 6;
    doc.setFillColor(245,245,245); doc.rect(mg, y, W-2*mg, 6, 'F');
    ['Technician','Jobs','Done','Avg Min','OT Min','Rate'].forEach((h,i) => {
      const x = [mg+2, mg+60, mg+80, mg+105, mg+130, mg+155];
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(60,60,60);
      doc.text(h, x[i], y+4);
    });
    y += 8;
    technicians.slice(0,12).forEach((t,idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', idx===0?'bold':'normal'); doc.setFontSize(8); doc.setTextColor(30,30,30);
      doc.text(t.name.slice(0,22),   mg+2, y);
      doc.text(String(t.total),      mg+60, y);
      doc.text(String(t.completed),  mg+80, y);
      doc.text(`${t.avgJobMins}m`,    mg+105, y);
      doc.text(`${t.overtimeMins}m`,  mg+130, y);
      doc.text(`${t.completionPct}%`, mg+155, y);
      y += 5.5;
    });
    sp(2); ln();
  }

  // Footer
  const fy = doc.internal.pageSize.getHeight() - 12;
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(140,140,140);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')} · Anura Tyres (Pvt) Ltd`, W/2, fy, {align:'center'});

  doc.save(`AnuraTyres_Report_${fromDate}_${toDate}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function ReportsPage() {
  const session    = getSessionUser();
  const userBranch = session?.branch && session.branch !== 'All Branches' ? session.branch : '';

  const [branch,      setBranch]      = useState(userBranch);
  const [rangeIdx,    setRangeIdx]    = useState(1); // 30 days default
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');
  const [activeView,  setActiveView]  = useState<'revenue'|'jobs'|'inventory'>('revenue');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string|null>(null);

  const [overview,    setOverview]    = useState<Overview|null>(null);
  const [trendData,   setTrendData]   = useState<{daily:TrendDay[];monthly:TrendMonth[]}>({daily:[],monthly:[]});
  const [jobsData,    setJobsData]    = useState<{services:ServiceStat[];technicians:TechStat[];daily:DailyJob[]}>({services:[],technicians:[],daily:[]});
  const [invData,     setInvData]     = useState<{totalItems:number;totalValue:number;lowStock:number;outOfStock:number;categories:InvCat[];topItems:InvItem[]}|null>(null);

  const { from, to } = rangeIdx < 4 ? dateRange(RANGE_PRESETS[rangeIdx].days) : { from: customFrom, to: customTo };

  const buildQ = (type: string) => {
    const p = new URLSearchParams({ type });
    if (branch) p.set('branch', branch);
    if (from)   p.set('from', from);
    if (to)     p.set('to', to);
    return `/jobs?resource=reports&${p}`;
  };

  const fetchAll = useCallback(async () => {
    if (rangeIdx === 4 && (!customFrom || !customTo)) return;
    setLoading(true); setError(null);
    try {
      const [ov, tr, js, inv] = await Promise.all([
        apiFetch(buildQ('overview')),
        apiFetch(buildQ('revenue-trend')),
        apiFetch(buildQ('jobs-stats')),
        apiFetch(buildQ('inventory')),
      ]);
      setOverview(ov);
      setTrendData(tr);
      setJobsData(js);
      setInvData(inv);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branch, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const topTech    = jobsData.technicians[0];
  const periodLabel = rangeIdx < 4 ? RANGE_PRESETS[rangeIdx].label : `${from} → ${to}`;

  const serviceDonut = jobsData.services.slice(0, 7).map((s, i) => ({ label: s.service, value: s.total, color: PALETTE[i % PALETTE.length] }));
  const totalJobsDonut = jobsData.services.reduce((a, s) => a + s.total, 0);

  // ── Export handlers ───────────────────────────────────────────────────────
  const handleExportCSV = (which: 'revenue'|'jobs'|'technicians'|'inventory') => {
    if (which === 'revenue') {
      exportCSV(`Revenue_${from}_${to}`,
        ['Date','Revenue','Parts','Labour','Discounts','Invoice Count'],
        trendData.daily.map(d => [d.date, d.revenue, d.parts, d.labour, d.discounts, d.count])
      );
    } else if (which === 'jobs') {
      exportCSV(`Jobs_${from}_${to}`,
        ['Date','Total Jobs','Completed','In Progress','Paused'],
        jobsData.daily.map(d => [d.date, d.total, d.completed, d.inProgress, d.paused])
      );
    } else if (which === 'technicians') {
      exportCSV(`Technicians_${from}_${to}`,
        ['Name','Total Jobs','Completed','Avg Job Mins','Overtime Mins','Completion %','Pause Count'],
        jobsData.technicians.map(t => [t.name, t.total, t.completed, t.avgJobMins, t.overtimeMins, t.completionPct, t.pauseCount])
      );
    } else if (which === 'inventory' && invData) {
      exportCSV('Inventory_Snapshot',
        ['Name','Category','Quantity','Unit Price','Total Value','Status'],
        invData.topItems.map(i => [i.name, i.category, i.quantity, i.unitPrice, i.value, i.status])
      );
    }
  };

  const handleExportPDF = () =>
    exportPDF(branch || 'All', from, to, overview, jobsData.services, jobsData.technicians, jobsData.daily);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#FFD700]" /> Reports & Analytics
          </h2>
          <p className="text-neutral-500 text-sm mt-0.5">Business intelligence · {periodLabel} · {branch || 'All branches'}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch */}
          {!userBranch && (
            <select value={branch} onChange={e => setBranch(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700]">
              <option value="">All Branches</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Date range */}
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            {RANGE_PRESETS.map((r, i) => (
              <button key={i} onClick={() => setRangeIdx(i)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${rangeIdx===i?'bg-[#FFD700] text-black':'text-neutral-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
            <button onClick={() => setRangeIdx(4)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${rangeIdx===4?'bg-[#FFD700] text-black':'text-neutral-400 hover:text-white'}`}>
              Custom
            </button>
          </div>

          {rangeIdx === 4 && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFD700]" />
              <span className="text-neutral-600 text-xs">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFD700]" />
            </div>
          )}

          <button onClick={fetchAll} disabled={loading} className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} />
          </button>

          {/* Export buttons */}
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 text-xs font-medium hover:text-white hover:bg-neutral-700 transition-colors">
            <FileText className="w-3.5 h-3.5 text-red-400" /> PDF
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 text-xs font-medium hover:text-white hover:bg-neutral-700 transition-colors">
              <Download className="w-3.5 h-3.5 text-emerald-400" /> CSV <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-20 overflow-hidden invisible group-hover:visible">
              {[
                {label:'Revenue data',      key:'revenue'},
                {label:'Daily jobs',        key:'jobs'},
                {label:'Technician stats',  key:'technicians'},
                {label:'Inventory snapshot',key:'inventory'},
              ].map(opt => (
                <button key={opt.key} onClick={() => handleExportCSV(opt.key as any)}
                  className="w-full text-left px-4 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border-b border-neutral-800/50 last:border-0">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span>⚠ {error}</span>
          <button onClick={fetchAll} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* ── KPI Row ── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Revenue"    value={fmtK(overview.revenue.total)} sub={`${overview.revenue.invoiceCount} invoices`} color="#FFD700" icon={DollarSign} />
          <KpiCard label="Jobs Completed"   value={String(overview.jobs.completed)} sub={`of ${overview.jobs.total} total`}       color="#10B981" icon={CheckCircle} />
          <KpiCard label="Completion Rate"  value={fmtPct(overview.jobs.completionRate)} sub="jobs finished on time"              color="#3B82F6" icon={Zap} />
          <KpiCard label="Outstanding"      value={fmtK(overview.revenue.outstanding)} sub="awaiting payment"                     color="#F59E0B" icon={Clock} trend="down" />
        </div>
      )}

      {/* ── Section tabs ── */}
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
        {[
          {key:'revenue',  label:'Revenue',   icon:DollarSign},
          {key:'jobs',     label:'Jobs',      icon:Wrench},
          {key:'inventory',label:'Inventory', icon:Package},
        ].map(t=>(
          <button key={t.key} onClick={() => setActiveView(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeView===t.key?'bg-[#FFD700] text-black':'text-neutral-400 hover:text-white'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════ REVENUE TAB ════════════════════════════ */}
      {activeView === 'revenue' && (
        <div className="space-y-5">

          {/* Revenue breakdown cards */}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                {label:'Paid Revenue',  val:overview.revenue.total,    color:'text-[#FFD700]'},
                {label:'Parts Total',   val:overview.revenue.parts,    color:'text-blue-400'},
                {label:'Labour Income', val:overview.revenue.labour,   color:'text-emerald-400'},
                {label:'Discounts',     val:overview.revenue.discounts,color:'text-red-400'},
                {label:'Outstanding',   val:overview.revenue.outstanding,color:'text-amber-400'},
              ].map(c=>(
                <div key={c.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className={`text-lg font-bold ${c.color}`}>{fmtK(c.val)}</div>
                  <div className="text-neutral-500 text-xs mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Daily revenue trend */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <SectionHead icon={TrendingUp} title="Revenue Trend" sub="Paid invoices by day" color="#FFD700" />
              <button onClick={() => handleExportCSV('revenue')} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            {loading ? <div className="h-40 bg-neutral-800 rounded-xl animate-pulse" /> : (
              <AreaChart
                data={trendData.daily}
                xKey="date"
                series={[
                  { key: 'revenue',  label: 'Revenue', color: '#FFD700' },
                  { key: 'labour',   label: 'Labour',  color: '#10B981' },
                  { key: 'parts',    label: 'Parts',   color: '#3B82F6' },
                ]}
                height={180}
              />
            )}
          </div>

          {/* Monthly trend */}
          {trendData.monthly.length > 1 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <SectionHead icon={Calendar} title="Monthly Comparison" sub="Month-over-month revenue" color="#3B82F6" />
              <AreaChart
                data={trendData.monthly}
                xKey="month"
                series={[
                  { key:'revenue', label:'Revenue', color:'#FFD700' },
                  { key:'parts',   label:'Parts',   color:'#3B82F6' },
                ]}
                height={160}
              />
            </div>
          )}

          {/* Parts vs Labour pie */}
          {overview && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <SectionHead icon={BarChart2} title="Revenue Composition" sub="What drives income" color="#10B981" />
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <DonutChart
                  slices={[
                    { label: 'Labour',     value: overview.revenue.labour,   color: '#10B981' },
                    { label: 'Parts',      value: overview.revenue.parts,    color: '#3B82F6' },
                    { label: 'Discounts',  value: overview.revenue.discounts,color: '#EF4444' },
                  ]}
                  total={overview.revenue.labour + overview.revenue.parts}
                  label="Rs"
                />
                <div className="flex-1 space-y-3">
                  {[
                    { label: 'Labour Income', val: overview.revenue.labour,   pct: overview.revenue.total > 0 ? Math.round(overview.revenue.labour/overview.revenue.total*100) : 0, bar: 'bg-emerald-400' },
                    { label: 'Parts Income',  val: overview.revenue.parts,    pct: overview.revenue.total > 0 ? Math.round(overview.revenue.parts/overview.revenue.total*100)   : 0, bar: 'bg-blue-400'   },
                    { label: 'Discounts',     val: -overview.revenue.discounts,pct: 0, bar: 'bg-red-400' },
                  ].map(r => (
                    <div key={r.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400">{r.label}</span>
                        <span className="text-white font-medium">{fmtRs(Math.abs(r.val))} {r.pct>0?`(${r.pct}%)`:''}</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full"><div className={`h-full rounded-full ${r.bar}`} style={{width:`${r.pct}%`}} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════ JOBS TAB ════════════════════════════ */}
      {activeView === 'jobs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Service breakdown */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <SectionHead icon={Wrench} title="Service Type Breakdown" sub="Total jobs by service" color="#FFD700" />
              {loading ? <div className="h-40 bg-neutral-800 rounded-xl animate-pulse" /> : (
                <DonutChart slices={serviceDonut} total={totalJobsDonut} label="jobs" />
              )}
            </div>

            {/* Daily jobs chart */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <SectionHead icon={Calendar} title="Daily Job Volume" sub="Jobs per day" color="#3B82F6" />
                <button onClick={() => handleExportCSV('jobs')} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors">
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
              {loading ? <div className="h-40 bg-neutral-800 rounded-xl animate-pulse" /> : (
                <AreaChart
                  data={jobsData.daily}
                  xKey="date"
                  series={[
                    { key: 'completed',  label: 'Completed',  color: '#10B981' },
                    { key: 'inProgress', label: 'In Progress',color: '#3B82F6' },
                    { key: 'total',      label: 'Total',      color: '#FFD700' },
                  ]}
                  height={160}
                />
              )}
            </div>
          </div>

          {/* Service stats table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <SectionHead icon={Wrench} title="Service Performance" sub="Time & completion analysis" color="#FFD700" />
            </div>
            {loading ? (
              <div className="p-6"><div className="h-32 bg-neutral-800 rounded-xl animate-pulse" /></div>
            ) : jobsData.services.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-sm">No job data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-950 border-b border-neutral-800">
                      {['Service','Total','Completed','Completion %','Avg Time','Efficiency'].map(h=>(
                        <th key={h} className="px-4 py-2.5 text-left text-neutral-500 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {jobsData.services.map((s,i) => (
                      <tr key={s.service} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-white font-medium">{s.service}</td>
                        <td className="px-4 py-2.5 text-neutral-300">{s.total}</td>
                        <td className="px-4 py-2.5 text-emerald-400">{s.completed}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-neutral-800 rounded-full flex-shrink-0">
                              <div className="h-full rounded-full bg-emerald-400" style={{width:`${s.total>0?Math.round(s.completed/s.total*100):0}%`}} />
                            </div>
                            <span className="text-neutral-300">{s.total>0?Math.round(s.completed/s.total*100):0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-blue-400">{s.avgMins > 0 ? `${s.avgMins}m` : '—'}</td>
                        <td className="px-4 py-2.5">
                          {s.efficiencyPct != null
                            ? <span className={`font-bold ${s.efficiencyPct>=90?'text-emerald-400':s.efficiencyPct>=70?'text-amber-400':'text-red-400'}`}>{s.efficiencyPct}%</span>
                            : <span className="text-neutral-600">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Technician performance */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <SectionHead icon={Users} title="Technician Productivity" sub="Performance per mechanic" color="#F59E0B" />
              <button onClick={() => handleExportCSV('technicians')} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>

            {/* Best performer banner */}
            {!loading && topTech && (
              <div className="px-6 py-3 bg-[#FFD700]/5 border-b border-[#FFD700]/20 flex items-center gap-4">
                <Star className="w-5 h-5 text-[#FFD700]" />
                <div>
                  <span className="text-[#FFD700] font-bold text-sm">{topTech.name}</span>
                  <span className="text-neutral-400 text-xs ml-2">— Top Performer · {topTech.completed} jobs completed · {topTech.completionPct}% rate · Avg {topTech.avgJobMins}m/job</span>
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-6"><div className="h-32 bg-neutral-800 rounded-xl animate-pulse" /></div>
            ) : jobsData.technicians.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-sm">No technician data for this period</div>
            ) : (
              <>
                {/* Bar chart */}
                <div className="px-6 pt-5 pb-2">
                  <HBarChart data={jobsData.technicians} valueKey="completed" labelKey="name" />
                </div>

                {/* Table */}
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-neutral-950 border-b border-neutral-800">
                        {['#','Technician','Total','Done','Rate','Avg Time','OT Mins','Pauses'].map(h=>(
                          <th key={h} className="px-4 py-2.5 text-left text-neutral-500 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {jobsData.technicians.map((t,i)=>(
                        <tr key={t.staffId} className={`hover:bg-neutral-800/30 transition-colors ${i===0?'bg-[#FFD700]/3':''}`}>
                          <td className="px-4 py-2.5 text-neutral-500 font-bold">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                          <td className="px-4 py-2.5 text-white font-medium">{t.name}</td>
                          <td className="px-4 py-2.5 text-neutral-300">{t.total}</td>
                          <td className="px-4 py-2.5 text-emerald-400 font-semibold">{t.completed}</td>
                          <td className="px-4 py-2.5">
                            <span className={`font-bold ${t.completionPct>=90?'text-emerald-400':t.completionPct>=70?'text-amber-400':'text-red-400'}`}>
                              {t.completionPct}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-blue-400">{t.avgJobMins > 0 ? `${t.avgJobMins}m` : '—'}</td>
                          <td className="px-4 py-2.5">
                            {t.overtimeMins > 0
                              ? <span className="text-amber-400">{t.overtimeMins}m</span>
                              : <span className="text-neutral-600">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500">{t.pauseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════ INVENTORY TAB ════════════════════════════ */}
      {activeView === 'inventory' && (
        <div className="space-y-5">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({length:4}).map((_,i) => <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 animate-pulse h-24" />)}
            </div>
          ) : invData ? (
            <>
              {/* Stock KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {label:'Total Items',    val:String(invData.totalItems),     color:'text-white',        icon:Package},
                  {label:'Stock Value',    val:fmtK(invData.totalValue),       color:'text-[#FFD700]',   icon:DollarSign},
                  {label:'Low Stock',      val:String(invData.lowStock),       color:'text-amber-400',    icon:AlertTriangle},
                  {label:'Out of Stock',   val:String(invData.outOfStock),     color:'text-red-400',      icon:AlertTriangle},
                ].map(c=>(
                  <div key={c.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <div className={`mb-2 ${c.color} opacity-60`}><c.icon className="w-5 h-5" /></div>
                    <div className={`text-xl font-bold ${c.color}`}>{c.val}</div>
                    <div className="text-neutral-500 text-xs mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <SectionHead icon={Package} title="Category Breakdown" sub="Stock value by category" color="#3B82F6" />
                  <HBarChart data={invData.categories} valueKey="value" labelKey="category" />
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <SectionHead icon={BarChart2} title="Category Distribution" sub="Items per category" color="#FFD700" />
                  <DonutChart
                    slices={invData.categories.map((c,i) => ({ label: c.category, value: c.items, color: PALETTE[i % PALETTE.length] }))}
                    total={invData.totalItems}
                    label="items"
                  />
                </div>
              </div>

              {/* Top items table */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                  <SectionHead icon={Package} title="Top Items by Value" sub="Highest value inventory" color="#FFD700" />
                  <button onClick={() => handleExportCSV('inventory')} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-neutral-950 border-b border-neutral-800">
                        {['Item','Category','Qty','Unit Price','Total Value','Status'].map(h=>(
                          <th key={h} className="px-4 py-2.5 text-left text-neutral-500 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {invData.topItems.map((item,i)=>(
                        <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-white font-medium">{item.name}</td>
                          <td className="px-4 py-2.5 text-neutral-400">{item.category}</td>
                          <td className="px-4 py-2.5 text-neutral-300">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-neutral-300">{fmtRs(item.unitPrice)}</td>
                          <td className="px-4 py-2.5 text-[#FFD700] font-bold">{fmtK(item.value)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.status === 'Out of Stock' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : item.status === 'Low Stock' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}>{item.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {invData.topItems.length === 0 && (
                  <div className="py-12 text-center text-neutral-500 text-sm">No inventory data found</div>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-neutral-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-neutral-700" />
              <p>No inventory data available</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
