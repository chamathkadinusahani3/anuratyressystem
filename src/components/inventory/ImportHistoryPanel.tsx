import React, { useCallback, useEffect, useState } from 'react';
import {
  X, History, RotateCcw, Download, Loader2, CheckCircle2, AlertTriangle,
  XCircle, Clock, RefreshCw, ChevronLeft, ChevronRight, FileSpreadsheet,
} from 'lucide-react';
import { inventoryImportAPI } from '../../services/inventoryApi';
import { IMPORT_MODE_INFO, type ImportJob, type ImportStatus } from '../../types/inventory';

interface ImportHistoryPanelProps {
  onClose: () => void;
  /** Called after a rollback succeeds so the parent can refresh its inventory list. */
  onRolledBack: () => void;
}

const STATUS_META: Record<ImportStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending_review: { label: 'Pending Review', icon: Clock, className: 'bg-neutral-700 text-neutral-300 border-neutral-600' },
  processing: { label: 'Processing', icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  completed_with_errors: { label: 'Completed (with errors)', icon: AlertTriangle, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  rolled_back: { label: 'Rolled Back', icon: RotateCcw, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

function StatusBadge({ status }: { status: ImportStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending_review;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.className}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {meta.label}
    </span>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Confirm rollback dialog
// ═══════════════════════════════════════════════════════════════════════════════
function ConfirmRollbackDialog({ job, onCancel, onConfirm, isWorking }: {
  job: ImportJob;
  onCancel: () => void;
  onConfirm: () => void;
  isWorking: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg"><RotateCcw className="w-5 h-5 text-red-400" /></div>
          <h3 className="text-lg font-bold text-white">Roll back this import?</h3>
        </div>
        <p className="text-neutral-400 text-sm mb-2">
          <span className="text-white font-medium">{job.filename}</span> ({IMPORT_MODE_INFO[job.mode].label}, {formatDateTime(job.completedAt)})
        </p>
        <p className="text-neutral-400 text-sm mb-5">
          Items this import created will be deleted, and items it modified will be restored to their values from before the import. A rollback entry will be added to the stock movement history for full traceability. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isWorking} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isWorking} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Roll back
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Job detail row (expandable)
// ═══════════════════════════════════════════════════════════════════════════════
function JobRow({ job, onRequestRollback, onDownloadFailedRows, downloadingId }: {
  job: ImportJob;
  onRequestRollback: (job: ImportJob) => void;
  onDownloadFailedRows: (job: ImportJob) => void;
  downloadingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const canRollback = job.backupTaken && ['completed', 'completed_with_errors'].includes(job.status);
  const canDownloadFailed = job.failedCount > 0 || job.invalidRows > 0;

  return (
    <div className="border border-neutral-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 bg-neutral-900 hover:bg-neutral-800/60 transition-colors text-left"
      >
        <div className="p-2 bg-neutral-800 rounded-lg shrink-0"><FileSpreadsheet className="w-4 h-4 text-[#FFD700]" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{job.filename}</span>
            <span className="text-xs text-neutral-500">· {IMPORT_MODE_INFO[job.mode].label}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {formatDateTime(job.createdAt)} · by {job.performedBy?.username || 'unknown'} ({job.performedBy?.role || '—'})
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right text-xs text-neutral-400 hidden md:block">
            <div><span className="text-green-400 font-medium">{job.createdCount}</span> created · <span className="text-yellow-400 font-medium">{job.updatedCount}</span> updated</div>
            <div><span className="text-neutral-300 font-medium">{job.skippedCount}</span> skipped · <span className="text-red-400 font-medium">{job.failedCount}</span> failed</div>
          </div>
          <StatusBadge status={job.status} />
          <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 border-t border-neutral-800 bg-neutral-950/50 space-y-4">
          {(job.status === 'processing' || job.status === 'pending_review') && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                <span>{job.processedCount} / {job.validRows} rows processed</span>
                <span className="text-[#FFD700] font-semibold">{job.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] rounded-full transition-all" style={{ width: `${job.progressPercent}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
            {[
              ['Total Rows', job.totalRows, 'text-white'],
              ['Valid', job.validRows, 'text-green-400'],
              ['Invalid', job.invalidRows, 'text-red-400'],
              ['Created', job.createdCount, 'text-blue-400'],
              ['Updated', job.updatedCount, 'text-yellow-400'],
              ['Skipped', job.skippedCount, 'text-neutral-300'],
              ['Failed', job.failedCount, 'text-red-400'],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-2.5">
                <div className={`text-base font-bold ${cls}`}>{value as number}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs text-neutral-400">
            <div><span className="text-neutral-500">Started:</span> {formatDateTime(job.startedAt)}</div>
            <div><span className="text-neutral-500">Completed:</span> {formatDateTime(job.completedAt)}</div>
            <div><span className="text-neutral-500">Backup taken:</span> {job.backupTaken ? <span className="text-green-400">Yes</span> : <span className="text-neutral-500">No</span>}</div>
          </div>

          {job.duplicateSkus.length > 0 && (
            <div className="text-xs text-neutral-400">
              <span className="text-yellow-400 font-medium">{job.duplicateSkus.length} duplicate SKU(s)</span> in file: {job.duplicateSkus.slice(0, 8).join(', ')}{job.duplicateSkus.length > 8 ? `, +${job.duplicateSkus.length - 8} more` : ''}
            </div>
          )}

          {job.mode === 'full_sync' && job.syncRemovedSkus.length > 0 && (
            <div className="text-xs text-neutral-400">
              <span className="text-purple-400 font-medium">{job.syncRemovedSkus.length} item(s)</span> deactivated by full sync: {job.syncRemovedSkus.slice(0, 8).join(', ')}{job.syncRemovedSkus.length > 8 ? `, +${job.syncRemovedSkus.length - 8} more` : ''}
            </div>
          )}

          {job.status === 'rolled_back' && (
            <div className="flex items-center gap-2 text-sm text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2.5">
              <RotateCcw className="w-4 h-4 shrink-0" />
              Rolled back on {formatDateTime(job.rolledBackAt)} — items affected by this import were restored to their pre-import state.
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 pt-1">
            {canDownloadFailed && (
              <button
                type="button"
                onClick={() => onDownloadFailedRows(job)}
                disabled={downloadingId === job.id}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
              >
                {downloadingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download failed rows
              </button>
            )}
            {canRollback && (
              <button
                type="button"
                onClick={() => onRequestRollback(job)}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-500/40 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/10 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Roll back this import
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_FILTERS: { value: ImportStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'completed_with_errors', label: 'Completed (with errors)' },
  { value: 'failed', label: 'Failed' },
  { value: 'rolled_back', label: 'Rolled Back' },
];

export function ImportHistoryPanel({ onClose, onRolledBack }: ImportHistoryPanelProps) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState<ImportStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [rollbackTarget, setRollbackTarget] = useState<ImportJob | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await inventoryImportAPI.history({ page, limit: pagination.limit, status: statusFilter });
      setJobs(data.imports);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err?.message || 'Failed to load import history.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit, statusFilter]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const handleDownloadFailedRows = useCallback(async (job: ImportJob) => {
    setDownloadingId(job.id);
    try {
      await inventoryImportAPI.downloadFailedRows(job.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to download failed rows.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handleConfirmRollback = useCallback(async () => {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    setError('');
    try {
      const result = await inventoryImportAPI.rollback(rollbackTarget.id);
      setJobs((prev) => prev.map((j) => (j.id === result.job.id ? result.job : j)));
      setRollbackTarget(null);
      onRolledBack();
    } catch (err: any) {
      setError(err?.message || 'Failed to roll back this import.');
    } finally {
      setIsRollingBack(false);
    }
  }, [rollbackTarget, onRolledBack]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-4xl shadow-2xl my-8">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 rounded-lg"><History className="w-5 h-5 text-[#FFD700]" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Import History</h2>
              <p className="text-neutral-500 text-xs mt-0.5">Activity log for every CSV inventory import — review results and roll back if needed.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ImportStatus | '')}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
            >
              {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => load(pagination.page)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading import history…
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <History className="w-10 h-10 mx-auto mb-3 text-neutral-700" />
              No imports found{statusFilter ? ' for this status' : ' yet'}.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[28rem] overflow-y-auto pr-1">
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onRequestRollback={setRollbackTarget}
                  onDownloadFailedRows={handleDownloadFailedRows}
                  downloadingId={downloadingId}
                />
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-neutral-500">Page {pagination.page} of {pagination.pages} · {pagination.total} import(s)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => load(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => load(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rollbackTarget && (
        <ConfirmRollbackDialog
          job={rollbackTarget}
          onCancel={() => setRollbackTarget(null)}
          onConfirm={handleConfirmRollback}
          isWorking={isRollingBack}
        />
      )}
    </div>
  );
}
