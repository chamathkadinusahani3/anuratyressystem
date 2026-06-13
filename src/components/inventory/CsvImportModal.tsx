import React, { useCallback, useRef, useState } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, Download, Loader2, CheckCircle2,
  AlertTriangle, XCircle, ArrowLeft, RotateCcw, ChevronRight,
} from 'lucide-react';
import { inventoryAPI, inventoryImportAPI } from '../../services/inventoryApi';
import {
  IMPORT_MODE_INFO,
  type ImportJob,
  type ImportMode,
  type ImportPreviewRow,
  type ImportRowError,
} from '../../types/inventory';

type WizardStep = 'select' | 'preview' | 'importing' | 'done';

interface CsvImportModalProps {
  onClose: () => void;
  /** Called once an import finishes committing (success or partial) so the parent can refresh its list. */
  onImported: () => void;
}

const MODE_ORDER: ImportMode[] = ['add_stock', 'replace_stock', 'full_sync'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function rowErrorsText(errors: ImportRowError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Mode selection + drag & drop upload
// ═══════════════════════════════════════════════════════════════════════════════
function SelectStep({
  mode, setMode, onFile, isUploading, error, onDownloadTemplate, templateDownloading,
}: {
  mode: ImportMode;
  setMode: (m: ImportMode) => void;
  onFile: (file: File) => void;
  isUploading: boolean;
  error: string;
  onDownloadTemplate: () => void;
  templateDownloading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode selection */}
      <div>
        <label className="text-sm font-semibold text-white block mb-2.5">1. Choose an import mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODE_ORDER.map((m) => {
            const info = IMPORT_MODE_INFO[m];
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  active
                    ? 'bg-[#FFD700]/10 border-[#FFD700] ring-1 ring-[#FFD700]/40'
                    : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-sm font-bold ${active ? 'text-[#FFD700]' : 'text-white'}`}>{info.label}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#FFD700]' : 'border-neutral-600'}`}>
                    {active && <span className="w-2 h-2 rounded-full bg-[#FFD700]" />}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{info.description}</p>
              </button>
            );
          })}
        </div>
        {mode === 'full_sync' && (
          <div className="mt-2.5 flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Full Sync deactivates and zeroes out any item in the database whose SKU is not present in the file. A backup snapshot is taken automatically so you can roll back.</span>
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div>
        <label className="text-sm font-semibold text-white block mb-2.5">2. Upload your CSV file</label>
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
          onDrop={handleDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragActive ? 'border-[#FFD700] bg-[#FFD700]/5' : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800/50'
          } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
          {isUploading ? (
            <>
              <Loader2 className="w-9 h-9 text-[#FFD700] mx-auto mb-3 animate-spin" />
              <p className="text-white font-medium text-sm">Parsing &amp; validating your file…</p>
              <p className="text-neutral-500 text-xs mt-1">This can take a moment for large files.</p>
            </>
          ) : (
            <>
              <UploadCloud className="w-9 h-9 text-neutral-500 mx-auto mb-3" />
              <p className="text-white font-medium text-sm">Drag &amp; drop your CSV here, or click to browse</p>
              <p className="text-neutral-500 text-xs mt-1">.csv files only · up to 50,000 rows</p>
            </>
          )}
        </div>
      </div>

      {/* Template download */}
      <div className="flex items-center justify-between gap-3 bg-neutral-800/60 border border-neutral-700 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-800 rounded-lg"><FileSpreadsheet className="w-4 h-4 text-[#FFD700]" /></div>
          <div>
            <div className="text-sm text-white font-medium">Not sure about the format?</div>
            <div className="text-xs text-neutral-500">Download a ready-to-fill CSV template with sample rows.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDownloadTemplate}
          disabled={templateDownloading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
        >
          {templateDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Template
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Preview / validation
// ═══════════════════════════════════════════════════════════════════════════════
function StatCard({ label, value, tone }: { label: string; value: number | string; tone: 'neutral' | 'green' | 'yellow' | 'red' | 'blue' }) {
  const toneClass: Record<string, string> = {
    neutral: 'text-white',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3">
      <div className={`text-xl font-bold ${toneClass[tone]}`}>{value}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

function ActionTag({ action }: { action: ImportPreviewRow['action'] }) {
  if (action === 'create') return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">Create</span>;
  if (action === 'update') return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">Update</span>;
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-700 text-neutral-400 border border-neutral-600">Skip</span>;
}

function PreviewStep({
  job, preview, errorRows, previewTruncated, onBack, onConfirm, isStarting, downloadingFailedRows, onDownloadFailedRows,
}: {
  job: ImportJob;
  preview: ImportPreviewRow[];
  errorRows: { rowNumber: number; sku: string; name: string; errors: ImportRowError[] }[];
  previewTruncated: boolean;
  onBack: () => void;
  onConfirm: () => void;
  isStarting: boolean;
  downloadingFailedRows: boolean;
  onDownloadFailedRows: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'errors' | 'duplicates'>('all');
  const toCreate = preview.filter((r) => r.valid && r.action === 'create').length;
  const toUpdate = preview.filter((r) => r.valid && r.action === 'update').length;

  const rowsForTab = tab === 'errors' ? preview.filter((r) => !r.valid)
    : tab === 'duplicates' ? preview.filter((r) => r.isDuplicateInFile)
    : preview;

  return (
    <div className="p-6 space-y-5">
      {job.missingColumns.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <span className="font-semibold">Missing required columns:</span> {job.missingColumns.join(', ')}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Validation summary</h3>
          <span className="text-xs text-neutral-500">
            Mode: <span className="text-[#FFD700] font-medium">{IMPORT_MODE_INFO[job.mode].label}</span> · File: <span className="text-neutral-300">{job.filename}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <StatCard label="Total Rows" value={job.totalRows} tone="neutral" />
          <StatCard label="Valid" value={job.validRows} tone="green" />
          <StatCard label="Invalid" value={job.invalidRows} tone="red" />
          <StatCard label="To Create" value={toCreate} tone="blue" />
          <StatCard label="To Update" value={toUpdate} tone="yellow" />
          <StatCard label="Duplicate SKUs" value={job.duplicateSkus.length} tone="red" />
        </div>
      </div>

      {job.duplicateSkus.length > 0 && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <span className="font-semibold">Duplicate SKUs found within the file</span> (only the last occurrence of each will be used):{' '}
          <span className="text-yellow-300">{job.duplicateSkus.slice(0, 12).join(', ')}{job.duplicateSkus.length > 12 ? `, +${job.duplicateSkus.length - 12} more` : ''}</span>
        </div>
      )}

      {job.invalidRows > 0 && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><span className="font-semibold">{job.invalidRows}</span> row(s) failed validation and will be skipped during import.</span>
          </div>
          <button
            type="button"
            onClick={onDownloadFailedRows}
            disabled={downloadingFailedRows}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-red-500/40 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {downloadingFailedRows ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download failed rows
          </button>
        </div>
      )}

      {/* Row preview table */}
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 bg-neutral-900 border-b border-neutral-800">
          {([
            ['all', `All (${preview.length})`],
            ['errors', `Errors (${preview.filter((r) => !r.valid).length})`],
            ['duplicates', `Duplicates (${preview.filter((r) => r.isDuplicateInFile).length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === key ? 'border-[#FFD700] text-[#FFD700]' : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-950">
              <tr className="border-b border-neutral-800">
                {['Row', 'SKU', 'Name', 'Qty', 'Action', 'Issues'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-[#FFD700]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {rowsForTab.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500 text-sm">Nothing to show in this view</td></tr>
              ) : rowsForTab.map((r) => (
                <tr key={r.rowNumber} className={`${!r.valid ? 'bg-red-500/5' : r.isDuplicateInFile ? 'bg-yellow-500/5' : ''}`}>
                  <td className="px-4 py-2.5 text-neutral-500 text-xs">{r.rowNumber}</td>
                  <td className="px-4 py-2.5 text-white font-medium text-xs">{r.sku || <span className="text-neutral-600 italic">missing</span>}</td>
                  <td className="px-4 py-2.5 text-neutral-300 text-xs max-w-[14rem] truncate">{r.name || <span className="text-neutral-600 italic">missing</span>}</td>
                  <td className="px-4 py-2.5 text-neutral-300 text-xs">{r.quantity}</td>
                  <td className="px-4 py-2.5"><ActionTag action={r.action} /></td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.errors.length > 0 ? <span className="text-red-400">{rowErrorsText(r.errors)}</span> : r.isDuplicateInFile ? <span className="text-yellow-400">Duplicate SKU in file</span> : <span className="text-neutral-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {previewTruncated && (
          <div className="px-4 py-2 bg-neutral-900 border-t border-neutral-800 text-xs text-neutral-500">
            Showing the first {preview.length} of {job.totalRows} rows. All rows will be processed on import.
          </div>
        )}
      </div>

      {errorRows.length > 0 && (
        <details className="text-xs text-neutral-400">
          <summary className="cursor-pointer text-neutral-300 hover:text-white select-none">View detailed validation errors ({errorRows.length})</summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
            {errorRows.map((r) => (
              <li key={r.rowNumber} className="px-3 py-1.5 bg-neutral-800/60 rounded-lg">
                <span className="text-white font-medium">Row {r.rowNumber}</span>{r.sku ? ` · SKU ${r.sku}` : ''}{r.name ? ` · ${r.name}` : ''} — <span className="text-red-400">{rowErrorsText(r.errors)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isStarting || job.validRows === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50"
        >
          {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {job.validRows === 0 ? 'No valid rows to import' : `Confirm & Import ${job.validRows} row(s)`}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Progress
// ═══════════════════════════════════════════════════════════════════════════════
function ImportingStep({ job }: { job: ImportJob }) {
  const pct = Math.min(100, Math.max(0, job.progressPercent ?? 0));
  return (
    <div className="p-6 space-y-6">
      <div className="text-center py-4">
        <Loader2 className="w-10 h-10 text-[#FFD700] mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-bold text-white">Importing your inventory…</h3>
        <p className="text-neutral-500 text-sm mt-1">Please keep this window open until the import finishes.</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
          <span>{job.processedCount} / {job.validRows} rows processed</span>
          <span className="text-[#FFD700] font-semibold">{pct}%</span>
        </div>
        <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-[#FFD700] rounded-full transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard label="Created" value={job.createdCount} tone="blue" />
        <StatCard label="Updated" value={job.updatedCount} tone="yellow" />
        <StatCard label="Skipped" value={job.skippedCount} tone="neutral" />
        <StatCard label="Failed" value={job.failedCount} tone="red" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Done / results
// ═══════════════════════════════════════════════════════════════════════════════
function DoneStep({
  job, onClose, onRollback, isRollingBack, rollbackDone,
}: {
  job: ImportJob;
  onClose: () => void;
  onRollback: () => void;
  isRollingBack: boolean;
  rollbackDone: boolean;
}) {
  const success = job.status === 'completed';
  const partial = job.status === 'completed_with_errors';
  const failed = job.status === 'failed';
  const canRollback = job.backupTaken && ['completed', 'completed_with_errors'].includes(job.status) && !rollbackDone;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center py-2">
        {success && <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />}
        {partial && <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />}
        {failed && <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />}
        <h3 className="text-lg font-bold text-white">
          {success && 'Import completed successfully'}
          {partial && 'Import completed with some errors'}
          {failed && 'Import failed'}
        </h3>
        <p className="text-neutral-500 text-sm mt-1">
          {job.filename} · {IMPORT_MODE_INFO[job.mode].label} mode
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard label="Created" value={job.createdCount} tone="blue" />
        <StatCard label="Updated" value={job.updatedCount} tone="yellow" />
        <StatCard label="Skipped" value={job.skippedCount} tone="neutral" />
        <StatCard label="Failed" value={job.failedCount} tone="red" />
      </div>

      {job.mode === 'full_sync' && job.syncRemovedSkus.length > 0 && (
        <div className="text-xs text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5">
          <span className="text-white font-medium">{job.syncRemovedSkus.length} item(s)</span> not present in the file were deactivated and zeroed out:{' '}
          <span className="text-neutral-300">{job.syncRemovedSkus.slice(0, 10).join(', ')}{job.syncRemovedSkus.length > 10 ? `, +${job.syncRemovedSkus.length - 10} more` : ''}</span>
        </div>
      )}

      {rollbackDone && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          This import has been rolled back — affected items were restored to their pre-import state.
        </div>
      )}

      {canRollback && (
        <div className="flex items-start gap-3 bg-neutral-800/60 border border-neutral-700 rounded-lg px-4 py-3">
          <RotateCcw className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm text-white font-medium">Made a mistake?</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              You can roll back this import — items it created will be removed and items it changed will be restored to their previous values, with a full audit trail.
            </div>
          </div>
          <button
            type="button"
            onClick={onRollback}
            disabled={isRollingBack}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-red-500/40 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isRollingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Roll back import
          </button>
        </div>
      )}

      <button type="button" onClick={onClose} className="w-full px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
        Done
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
export function CsvImportModal({ onClose, onImported }: CsvImportModalProps) {
  const [step, setStep] = useState<WizardStep>('select');
  const [mode, setMode] = useState<ImportMode>('add_stock');
  const [error, setError] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    job: ImportJob;
    preview: ImportPreviewRow[];
    errorRows: { rowNumber: number; sku: string; name: string; errors: ImportRowError[] }[];
    previewTruncated: boolean;
  } | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);

  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackDone, setRollbackDone] = useState(false);

  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [downloadingFailedRows, setDownloadingFailedRows] = useState(false);

  const importedNotified = useRef(false);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file.');
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      setError(`File is too large (${formatBytes(file.size)}). Maximum size is 60 MB — split it into smaller files.`);
      return;
    }
    setIsUploading(true);
    try {
      const result = await inventoryImportAPI.upload(file, mode);
      setUploadResult(result);
      setStep('preview');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse the CSV file. Please check the format and try again.');
    } finally {
      setIsUploading(false);
    }
  }, [mode]);

  const handleDownloadTemplate = useCallback(async () => {
    setTemplateDownloading(true);
    try {
      await inventoryAPI.downloadTemplate();
    } catch (err: any) {
      setError(err?.message || 'Failed to download the template.');
    } finally {
      setTemplateDownloading(false);
    }
  }, []);

  const handleDownloadFailedRows = useCallback(async () => {
    if (!uploadResult) return;
    setDownloadingFailedRows(true);
    try {
      await inventoryImportAPI.downloadFailedRows(uploadResult.job.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to download failed rows.');
    } finally {
      setDownloadingFailedRows(false);
    }
  }, [uploadResult]);

  const handleConfirm = useCallback(async () => {
    if (!uploadResult) return;
    setIsStarting(true);
    setError('');
    setActiveJob(uploadResult.job);
    setStep('importing');
    try {
      const finalJob = await inventoryImportAPI.runToCompletion(uploadResult.job.id, (job) => setActiveJob(job));
      setActiveJob(finalJob);
      setStep('done');
      if (!importedNotified.current) {
        importedNotified.current = true;
        onImported();
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong while importing. You can check Import History for the latest status.');
      // Fall back to whatever the last known status was — surface it via the Done screen.
      try {
        const job = await inventoryImportAPI.status(uploadResult.job.id);
        setActiveJob(job);
        setStep('done');
        if (!importedNotified.current) {
          importedNotified.current = true;
          onImported();
        }
      } catch {
        setStep('preview');
      }
    } finally {
      setIsStarting(false);
    }
  }, [uploadResult, onImported]);

  const handleRollback = useCallback(async () => {
    if (!activeJob) return;
    setIsRollingBack(true);
    setError('');
    try {
      const result = await inventoryImportAPI.rollback(activeJob.id);
      setActiveJob(result.job);
      setRollbackDone(true);
      onImported();
    } catch (err: any) {
      setError(err?.message || 'Failed to roll back this import.');
    } finally {
      setIsRollingBack(false);
    }
  }, [activeJob, onImported]);

  const titleByStep: Record<WizardStep, string> = {
    select: 'Import Inventory from CSV',
    preview: 'Review Before Importing',
    importing: 'Importing…',
    done: 'Import Complete',
  };

  const allowClose = step !== 'importing';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-3xl shadow-2xl my-8">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">{titleByStep[step]}</h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              {(['select', 'preview', 'importing', 'done'] as WizardStep[]).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <span className="w-4 h-px bg-neutral-700" />}
                  <span className={`w-2 h-2 rounded-full ${step === s ? 'bg-[#FFD700]' : (['select', 'preview', 'importing', 'done'].indexOf(step) > i) ? 'bg-green-500' : 'bg-neutral-700'}`} />
                </React.Fragment>
              ))}
            </div>
          </div>
          {allowClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {step === 'select' && (
          <SelectStep
            mode={mode}
            setMode={setMode}
            onFile={handleFile}
            isUploading={isUploading}
            error={error}
            onDownloadTemplate={handleDownloadTemplate}
            templateDownloading={templateDownloading}
          />
        )}

        {step === 'preview' && uploadResult && (
          <PreviewStep
            job={uploadResult.job}
            preview={uploadResult.preview}
            errorRows={uploadResult.errorRows}
            previewTruncated={uploadResult.previewTruncated}
            onBack={() => { setUploadResult(null); setStep('select'); }}
            onConfirm={handleConfirm}
            isStarting={isStarting}
            downloadingFailedRows={downloadingFailedRows}
            onDownloadFailedRows={handleDownloadFailedRows}
          />
        )}

        {step === 'importing' && activeJob && <ImportingStep job={activeJob} />}

        {step === 'done' && activeJob && (
          <DoneStep
            job={activeJob}
            onClose={onClose}
            onRollback={handleRollback}
            isRollingBack={isRollingBack}
            rollbackDone={rollbackDone}
          />
        )}
      </div>
    </div>
  );
}
