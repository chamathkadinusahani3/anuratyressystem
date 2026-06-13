import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Search, Plus, AlertTriangle, Package, TrendingUp, RefreshCw, Edit2, Trash2,
  ArrowDown, Download, Upload, History, Loader2, ChevronLeft, ChevronRight, ImageIcon,
} from 'lucide-react';
import { getSessionUser } from '../lib/auth';
import { inventoryAPI } from '../services/inventoryApi';
import { CsvImportModal } from '../components/inventory/CsvImportModal';
import { ImportHistoryPanel } from '../components/inventory/ImportHistoryPanel';
import { ImageUploader } from '../components/inventory/ImageUploader';
import type { InventoryItem, InventoryStats, StockStatus } from '../types/inventory';
import type { StockStatusFilter } from '../services/inventoryApi';

const CATEGORIES = ['Tyres', 'Lubricants', 'Spare Parts', 'Tools', 'Accessories'];
const STOCK_STATUSES: StockStatus[] = ['In Stock', 'Low Stock', 'Out of Stock'];

const inputCls = 'w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors';
const labelCls = 'text-sm font-medium text-white block mb-1.5';

function statusBadgeClass(status: string) {
  if (status === 'In Stock') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Low Stock') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT ITEM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ItemModal({ item, onClose, onSave }: {
  item?: InventoryItem | null;
  onClose: () => void;
  onSave: (payload: any, id?: string) => Promise<void>;
}) {
  const isEdit = !!item;
  const [activeTab, setActiveTab] = useState<'details' | 'images'>('details');
  const [form, setForm] = useState({
    sku: item?.sku ?? '',
    name: item?.name ?? '',
    brand: item?.brand ?? '',
    category: item?.category ?? 'Tyres',
    quantity: item ? String(item.quantity) : '',
    buyPrice: item ? String(item.buyPrice) : '',
    sellPrice: item ? String(item.sellPrice) : '',
    minimumStock: item ? String(item.minimumStock) : '',
    barcode: item?.barcode ?? '',
    location: item?.location ?? '',
    tyreSize: item?.tyre?.size ?? '',
    width: item?.tyre?.width != null ? String(item.tyre.width) : '',
    profile: item?.tyre?.profile != null ? String(item.tyre.profile) : '',
    rimSize: item?.tyre?.rimSize != null ? String(item.tyre.rimSize) : '',
    loadIndex: item?.tyre?.loadIndex ?? '',
    speedRating: item?.tyre?.speedRating ?? '',
    season: item?.tyre?.season ?? '',
    pattern: item?.tyre?.pattern ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim()) return setError('SKU is required');
    if (!form.name.trim()) return setError('Item name is required');
    for (const [field, label] of [['quantity', 'Quantity'], ['buyPrice', 'Buy price'], ['sellPrice', 'Sell price'], ['minimumStock', 'Minimum stock']] as const) {
      const v = form[field];
      if (v !== '' && isNaN(Number(v))) return setError(`${label} must be a number`);
    }

    setError('');
    setSaving(true);
    try {
      await onSave({
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category,
        quantity: form.quantity === '' ? 0 : parseInt(form.quantity, 10),
        buyPrice: form.buyPrice === '' ? 0 : parseFloat(form.buyPrice),
        sellPrice: form.sellPrice === '' ? 0 : parseFloat(form.sellPrice),
        minimumStock: form.minimumStock === '' ? 0 : parseInt(form.minimumStock, 10),
        barcode: form.barcode.trim(),
        location: form.location.trim(),
        tyre: {
          size: form.tyreSize.trim(),
          width: form.width === '' ? null : parseInt(form.width, 10),
          profile: form.profile === '' ? null : parseInt(form.profile, 10),
          rimSize: form.rimSize === '' ? null : parseInt(form.rimSize, 10),
          loadIndex: form.loadIndex.trim(),
          speedRating: form.speedRating.trim(),
          season: form.season.trim(),
          pattern: form.pattern.trim(),
        },
      }, item?.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save this item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-2xl shadow-2xl my-8">
        <div className="border-b border-neutral-700 px-6 pt-4 pb-0 sticky top-0 bg-neutral-900 rounded-t-xl z-10">
          <div className="flex justify-between items-center pb-4">
            <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Item' : 'Add New Item'}</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
          </div>
          {isEdit && (
            <div className="flex gap-1">
              {(['details', 'images'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize
                    ${activeTab === tab ? 'border-[#FFD700] text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
                >
                  {tab === 'images' && <ImageIcon className="w-3.5 h-3.5" />}
                  {tab === 'images' ? `Images${item.images?.length ? ` (${item.images.length})` : ''}` : 'Details'}
                </button>
              ))}
            </div>
          )}
        </div>
        {activeTab === 'details' && <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          {isEdit && item?.source === 'csv_import' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-xs">
              This item was created by a CSV import. Editing it here only changes this record — it won't affect the original import.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SKU *</label>
              <input value={form.sku} onChange={set('sku')} placeholder="e.g. MICH-205-55-16" className={`${inputCls} uppercase placeholder:normal-case`} />
            </div>
            <div>
              <label className={labelCls}>Item Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Michelin Primacy 4 (205/55R16)" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Brand</label>
              <input value={form.brand} onChange={set('brand')} placeholder="e.g. Michelin" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min="0" value={form.quantity} onChange={set('quantity')} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Minimum Stock</label>
              <input type="number" min="0" value={form.minimumStock} onChange={set('minimumStock')} placeholder="10" className={inputCls} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={set('location')} placeholder="e.g. Warehouse A" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Buy Price</label>
              <input type="number" step="0.01" min="0" value={form.buyPrice} onChange={set('buyPrice')} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sell Price</label>
              <input type="number" step="0.01" min="0" value={form.sellPrice} onChange={set('sellPrice')} placeholder="0.00" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Barcode</label>
            <input value={form.barcode} onChange={set('barcode')} placeholder="e.g. 8901234567890" className={inputCls} />
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-white mb-3">Tyre Details <span className="text-neutral-500 font-normal">(optional)</span></h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelCls}>Size</label>
                <input value={form.tyreSize} onChange={set('tyreSize')} placeholder="205/55R16" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Width</label>
                <input type="number" min="0" value={form.width} onChange={set('width')} placeholder="205" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Profile</label>
                <input type="number" min="0" value={form.profile} onChange={set('profile')} placeholder="55" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Rim Size</label>
                <input type="number" min="0" value={form.rimSize} onChange={set('rimSize')} placeholder="16" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Load Index</label>
                <input value={form.loadIndex} onChange={set('loadIndex')} placeholder="91" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Speed Rating</label>
                <input value={form.speedRating} onChange={set('speedRating')} placeholder="V" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Season</label>
                <input value={form.season} onChange={set('season')} placeholder="All-Season" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pattern</label>
                <input value={form.pattern} onChange={set('pattern')} placeholder="Primacy 4" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>}
        {activeTab === 'images' && isEdit && item && (
          <div className="p-6">
            <ImageUploader productId={item.id} productName={item.name} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESTOCK MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function RestockModal({ item, onClose, onRestock }: {
  item: InventoryItem;
  onClose: () => void;
  onRestock: (id: string, qty: number, reason: string) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(qty, 10);
    if (!n || n <= 0) return setError('Enter a quantity greater than zero');
    setError('');
    setSaving(true);
    try {
      await onRestock(item.id, n, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to restock this item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Restock Item</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          <div className="p-3 bg-neutral-800 rounded-lg">
            <div className="text-sm text-white font-medium">{item.name}</div>
            <div className="text-xs text-neutral-500 mt-1">
              SKU {item.sku} · Current stock: <span className={item.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}>{item.quantity}</span> / Min: {item.minimumStock}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Quantity to Add *</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 20" autoFocus className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Reason <span className="text-neutral-500 font-normal">(optional)</span></label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New shipment from supplier" className={inputCls} />
          </div>
          {qty && parseInt(qty, 10) > 0 && (
            <div className="text-xs text-neutral-400 bg-neutral-800 px-3 py-2 rounded-lg">
              New stock level: <span className="text-green-400 font-medium">{item.quantity + parseInt(qty, 10)}</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Restock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN INVENTORY PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function InventoryPage() {
  const session = getSessionUser();
  const role = session?.role || 'Cashier';
  const canWrite = ['Super Admin', 'Admin', 'Manager'].includes(role);
  const canImport = ['Super Admin', 'Admin'].includes(role);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>({ totalItems: 0, totalStockValue: 0, stockAlerts: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const load = useCallback(async (page: number) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await inventoryAPI.list({
        search: search.trim() || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        stockStatus: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: pagination.limit,
      });
      setItems(data.items);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, statusFilter, pagination.limit]);

  // Re-fetch (debounced for free-text search) whenever filters change.
  useEffect(() => {
    const handle = setTimeout(() => load(1), search ? 350 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, statusFilter]);

  const refresh = () => load(pagination.page);

  const handleSaveItem = async (payload: any, id?: string) => {
    setActionError('');
    if (id) {
      await inventoryAPI.update(id, payload);
      await load(pagination.page);
    } else {
      await inventoryAPI.create(payload);
      await load(1);
    }
  };

  const handleRestock = async (id: string, qty: number, reason: string) => {
    setActionError('');
    await inventoryAPI.restock(id, qty, reason || undefined);
    await load(pagination.page);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    setActionError('');
    try {
      await inventoryAPI.remove(deleteConfirm.id);
      setDeleteConfirm(null);
      const isLastItemOnPage = items.length === 1 && pagination.page > 1;
      await load(isLastItemOnPage ? pagination.page - 1 : pagination.page);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete this item.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setActionError('');
    try {
      await inventoryAPI.exportCsv({
        search: search.trim() || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to export inventory to CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setActionError('');
    try {
      await inventoryAPI.downloadTemplate();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to download the CSV template.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Inventory Management</h2>
          <p className="text-neutral-400 text-sm">Track stock levels, tyres, and equipment.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={refresh} disabled={isLoading} title="Refresh"
            className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />} Export CSV
          </button>
          {canImport && (
            <>
              <button onClick={handleDownloadTemplate} disabled={isDownloadingTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
                {isDownloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Template
              </button>
              <button onClick={() => setShowImportHistory(true)}
                className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
                <History className="w-4 h-4" /> Import History
              </button>
              <button onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-[#FFD700]/40 rounded-lg text-[#FFD700] text-sm font-bold hover:bg-[#FFD700]/10 transition-colors">
                <Upload className="w-4 h-4" /> Import CSV
              </button>
            </>
          )}
          {canWrite && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-neutral-800 rounded-lg"><Package className="w-6 h-6 text-[#FFD700]" /></div>
          <div><div className="text-2xl font-bold text-white">{stats.totalItems}</div><div className="text-sm text-neutral-400">Total Items</div></div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-red-900/20 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
          <div><div className="text-2xl font-bold text-white">{stats.stockAlerts}</div><div className="text-sm text-neutral-400">Stock Alerts</div></div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-neutral-800 rounded-lg"><TrendingUp className="w-6 h-6 text-green-400" /></div>
          <div><div className="text-2xl font-bold text-white">${stats.totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div className="text-sm text-neutral-400">Stock Value</div></div>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by SKU, name, brand, or barcode..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StockStatusFilter)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            <option value="all">All Stock Status</option>
            {STOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loadError ? (
          <div className="py-16 text-center">
            <p className="text-red-400 text-sm mb-3">{loadError}</p>
            <button onClick={refresh} className="px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Try again</button>
          </div>
        ) : isLoading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" /> Loading inventory…
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">No items found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Item', 'Category', 'Stock Level', 'Pricing', 'Status', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3.5 font-bold text-[#FFD700] text-left ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{item.name}</div>
                      <div className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>{item.sku}</span>
                        {item.brand && <span>· {item.brand}</span>}
                        {item.tyre?.size && <span>· {item.tyre.size}</span>}
                        {item.source === 'csv_import' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">CSV</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-400 text-sm">{item.category}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${item.quantity === 0 ? 'text-red-400' : item.quantity <= item.minimumStock ? 'text-yellow-400' : 'text-white'}`}>
                          {item.quantity}
                        </span>
                        <span className="text-neutral-600 text-xs">/ min {item.minimumStock}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-neutral-800 rounded-full mt-1.5">
                        <div className={`h-full rounded-full transition-all ${item.quantity === 0 ? 'bg-red-500' : item.quantity <= item.minimumStock ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${item.quantity === 0 ? 0 : Math.min((item.quantity / Math.max(item.minimumStock * 2, 1)) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="text-white font-medium">${item.sellPrice.toFixed(2)}</div>
                      <div className="text-xs text-neutral-500">cost ${item.buyPrice.toFixed(2)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(item.stockStatus)}`}>{item.stockStatus}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canWrite && (
                          <button onClick={() => setRestockItem(item)} title="Restock"
                            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-[#FFD700]/20 hover:text-[#FFD700] border border-neutral-700 rounded text-neutral-400 text-xs font-medium transition-colors">
                            Restock
                          </button>
                        )}
                        {canWrite && (
                          <button onClick={() => setEditItem(item)} title="Edit"
                            className="p-1.5 rounded text-neutral-500 hover:text-blue-400 hover:bg-neutral-800 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canWrite && (
                          <button onClick={() => setDeleteConfirm(item)} title="Delete"
                            className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loadError && (
          <div className="px-5 py-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              {items.length === 0 ? 'No items' : `Showing ${(pagination.page - 1) * pagination.limit + 1}–${(pagination.page - 1) * pagination.limit + items.length} of ${pagination.total} items`}
            </span>
            {pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-neutral-500">Page {pagination.page} of {pagination.pages}</span>
                <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.pages || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-300 text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete "{deleteConfirm.name}"?</h3>
            <p className="text-neutral-400 text-sm mb-5">SKU {deleteConfirm.sku} · This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <ItemModal onClose={() => setShowAddModal(false)} onSave={handleSaveItem} />}
      {editItem && <ItemModal item={editItem} onClose={() => setEditItem(null)} onSave={handleSaveItem} />}
      {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onRestock={handleRestock} />}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => load(pagination.page)}
        />
      )}
      {showImportHistory && (
        <ImportHistoryPanel
          onClose={() => setShowImportHistory(false)}
          onRolledBack={() => load(pagination.page)}
        />
      )}
    </div>
  );
}
