import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck, Clock, Wrench, CheckCircle2, RefreshCw, TrendingUp } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

interface TodayStats {
  total:      number;
  pending:    number;
  inProgress: number;
  completed:  number;
}

interface Stats {
  total:      number;
  pending:    number;
  inProgress: number;
  completed:  number;
  cancelled:  number;
  today:      TodayStats;
}

export interface StatsCardsProps {
  role?:   string;
  branch?: string;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between items-start mb-5">
        <div className="space-y-2.5">
          <div className="h-2.5 w-20 bg-neutral-800 rounded-full" />
          <div className="h-8 w-12 bg-neutral-800 rounded-lg" />
          <div className="h-2 w-28 bg-neutral-800 rounded-full" />
        </div>
        <div className="w-10 h-10 bg-neutral-800 rounded-xl" />
      </div>
      <div className="h-1 bg-neutral-800 rounded-full mb-3" />
      <div className="h-2.5 w-24 bg-neutral-800 rounded-full" />
    </div>
  );
}

// ─── Single stat card ──────────────────────────────────────────────────────────
interface CardProps {
  label:     string;
  value:     number;
  todayVal:  number;
  pct:       number;
  sub:       string;
  icon:      React.ElementType;
  accent:    string;
  barColor:  string;
  bgColor:   string;
}

function StatCard({ label, value, todayVal, pct, sub, icon: Icon, accent, barColor, bgColor }: CardProps) {
  return (
    <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-5 overflow-hidden group hover:border-neutral-700 transition-all duration-200">

      {/* Top row */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">
            {label}
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-white tabular-nums leading-none">
              {value.toLocaleString()}
            </span>
            {todayVal > 0 && (
              <span
                className="mb-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: `${accent}22`, color: accent }}
              >
                +{todayVal} today
              </span>
            )}
          </div>
        </div>
        <div
          className={`p-2.5 rounded-xl ${bgColor} transition-transform duration-200 group-hover:scale-110 flex-shrink-0`}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Sub label */}
      <p className="text-[11px] text-neutral-500">{sub}</p>

      {/* Ambient glow */}
      <div
        className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300 pointer-events-none"
        style={{ background: accent }}
      />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function StatsCards({ role, branch }: StatsCardsProps) {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(prev => prev);
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (branch && !['Super Admin', 'Admin'].includes(role || '')) {
        params.set('branch', branch);
      }
      const qs  = params.toString();
      const url = `${API_URL}/bookings/stats/summary${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
        setLastRefresh(new Date());
        setError(null);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, branch]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(true), 60_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="mb-8 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-between gap-4">
        <p className="text-red-400 text-sm">
          Could not load stats — <span className="text-neutral-500 font-mono text-xs">{error}</span>
        </p>
        <button
          onClick={() => fetchStats()}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const total = stats.total || 1; // avoid divide-by-zero

  const cards: CardProps[] = [
    {
      label:    'Total Bookings',
      value:    stats.total,
      todayVal: stats.today.total,
      pct:      100,
      sub:      `${stats.cancelled} cancelled all-time`,
      icon:     CalendarCheck,
      accent:   '#FFD700',
      barColor: 'bg-[#FFD700]',
      bgColor:  'bg-yellow-500/10',
    },
    {
      label:    'Pending',
      value:    stats.pending,
      todayVal: stats.today.pending,
      pct:      (stats.pending / total) * 100,
      sub:      `${Math.round((stats.pending / total) * 100)}% of all bookings`,
      icon:     Clock,
      accent:   '#F59E0B',
      barColor: 'bg-amber-400',
      bgColor:  'bg-amber-500/10',
    },
    {
      label:    'In Progress',
      value:    stats.inProgress,
      todayVal: stats.today.inProgress,
      pct:      (stats.inProgress / total) * 100,
      sub:      `${Math.round((stats.inProgress / total) * 100)}% currently active`,
      icon:     Wrench,
      accent:   '#3B82F6',
      barColor: 'bg-blue-400',
      bgColor:  'bg-blue-500/10',
    },
    {
      label:    'Completed',
      value:    stats.completed,
      todayVal: stats.today.completed,
      pct:      (stats.completed / total) * 100,
      sub:      `${Math.round((stats.completed / total) * 100)}% success rate`,
      icon:     CheckCircle2,
      accent:   '#10B981',
      barColor: 'bg-emerald-400',
      bgColor:  'bg-emerald-500/10',
    },
  ];

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => <StatCard key={i} {...card} />)}
      </div>

      {/* Live indicator + refresh */}
      <div className="flex items-center justify-between mt-3 px-1">
        {/* Today's summary bar */}
        <div className="flex items-center gap-3">
          <TrendingUp className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-[11px] text-neutral-600">
            Today —&nbsp;
            <span className="text-[#FFD700]">{stats.today.total} bookings</span>
            <span className="mx-1.5 text-neutral-700">·</span>
            <span className="text-amber-400">{stats.today.pending} pending</span>
            <span className="mx-1.5 text-neutral-700">·</span>
            <span className="text-blue-400">{stats.today.inProgress} active</span>
            <span className="mx-1.5 text-neutral-700">·</span>
            <span className="text-emerald-400">{stats.today.completed} done</span>
          </span>
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {lastRefresh && (
            <span className="text-[11px] text-neutral-600 hidden sm:inline">
              {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="text-neutral-600 hover:text-neutral-300 transition-colors disabled:opacity-40"
            title="Refresh stats"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
