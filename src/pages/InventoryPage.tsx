import React, { useState } from 'react';
import { X, Search, Plus, AlertTriangle, Package, TrendingUp, RefreshCw, Edit2, Trash2, ArrowDown } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  supplier: string;
  description: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

// ─── Initial Data ─────────────────────────────────────────────────────────────
const initialData: InventoryItem[] = [
  { id: 'INV-001', name: 'Michelin Primacy 4 (205/55R16)', category: 'Tyres', stock: 4, minStock: 10, price: 120, supplier: 'Michelin Lanka', description: '', status: 'Low Stock' },
  { id: 'INV-002', name: 'Castrol Edge 5W-30 (4L)', category: 'Lubricants', stock: 25, minStock: 15, price: 45, supplier: 'Castrol SL', description: '', status: 'In Stock' },
  { id: 'INV-003', name: 'Brembo Brake Pads (Front)', category: 'Spare Parts', stock: 12, minStock: 8, price: 85, supplier: 'Auto Parts Co.', description: '', status: 'In Stock' },
  { id: 'INV-004', name: 'Dunlop SP Sport (195/65R15)', category: 'Tyres', stock: 0, minStock: 10, price: 95, supplier: 'Dunlop Lanka', description: '', status: 'Out of Stock' },
  { id: 'INV-005', name: 'Oil Filter (Toyota)', category: 'Spare Parts', stock: 50, minStock: 20, price: 12, supplier: 'Toyota Lanka', description: '', status: 'In Stock' },
  { id: 'INV-006', name: 'Wiper Blades (22")', category: 'Spare Parts', stock: 8, minStock: 10, price: 15, supplier: 'Auto Parts Co.', description: '', status: 'Low Stock' },
];

function getStatus(stock: number, minStock: number): InventoryItem['status'] {
  if (stock === 0) return 'Out of Stock';
  if (stock <= minStock) return 'Low Stock';
  return 'In Stock';
}

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
  onSave: (data: Omit<InventoryItem, 'id' | 'status'> & { id?: string }) => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category ?? '',
    stock: String(item?.stock ?? ''),
    minStock: String(item?.minStock ?? ''),
    price: String(item?.price ?? ''),
    supplier: item?.supplier ?? '',
    description: item?.description ?? '',
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (!form.category) return setError('Category is required');
    if (form.stock === '' || isNaN(Number(form.stock))) return setError('Valid stock is required');
    if (form.minStock === '' || isNaN(Number(form.minStock))) return setError('Valid minimum stock is required');
    if (!form.price || isNaN(Number(form.price))) return setError('Valid price is required');
    setError('');
    onSave({
      id: item?.id,
      name: form.name.trim(),
      category: form.category,
      stock: parseInt(form.stock),
      minStock: parseInt(form.minStock),
      price: parseFloat(form.price),
      supplier: form.supplier.trim(),
      description: form.description.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Item' : 'Add New Item'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Item Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Michelin Primacy 4 (205/55R16)"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Category *</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                <option value="">Select...</option>
                {['Tyres', 'Lubricants', 'Spare Parts', 'Tools', 'Accessories'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Unit Price ($) *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Current Stock *</label>
              <input type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="0"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Minimum Stock *</label>
              <input type="number" min="0" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} placeholder="10"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Supplier</label>
            <input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} placeholder="e.g. Michelin Lanka"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              {isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
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
  onRestock: (id: string, qty: number) => void;
}) {
  const [qty, setQty] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(qty);
    if (!n || n <= 0) return;
    onRestock(item.id, n);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Restock Item</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="p-3 bg-neutral-800 rounded-lg">
            <div className="text-sm text-white font-medium">{item.name}</div>
            <div className="text-xs text-neutral-500 mt-1">Current stock: <span className={item.stock === 0 ? 'text-red-400' : 'text-yellow-400'}>{item.stock}</span> / Min: {item.minStock}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Quantity to Add *</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 20" autoFocus
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          {qty && parseInt(qty) > 0 && (
            <div className="text-xs text-neutral-400 bg-neutral-800 px-3 py-2 rounded-lg">
              New stock level: <span className="text-green-400 font-medium">{item.stock + parseInt(qty)}</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">Restock</button>
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
  const [items, setItems] = useState<InventoryItem[]>(initialData);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSaveItem = (data: any) => {
    const status = getStatus(data.stock, data.minStock);
    if (data.id) {
      setItems(prev => prev.map(i => i.id === data.id ? { ...data, status } : i));
    } else {
      const newId = `INV-${String(items.length + 1).padStart(3, '0')}`;
      setItems(prev => [{ ...data, id: newId, status }, ...prev]);
    }
  };

  const handleRestock = (id: string, qty: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newStock = i.stock + qty;
      return { ...i, stock: newStock, status: getStatus(newStock, i.minStock) };
    }));
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleteConfirm(null);
  };

  const handleExport = () => {
    const headers = ['ID', 'Name', 'Category', 'Stock', 'Min Stock', 'Price ($)', 'Supplier', 'Status'];
    const rows = filtered.map(i => [i.id, `"${i.name}"`, i.category, i.stock, i.minStock, i.price, `"${i.supplier}"`, i.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const totalValue = items.reduce((sum, i) => sum + i.price * i.stock, 0);
  const alertCount = items.filter(i => i.status !== 'In Stock').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Inventory Management</h2>
          <p className="text-neutral-400 text-sm">Track stock levels, tyres, and equipment.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
            <ArrowDown className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-neutral-800 rounded-lg"><Package className="w-6 h-6 text-[#FFD700]" /></div>
          <div><div className="text-2xl font-bold text-white">{items.length}</div><div className="text-sm text-neutral-400">Total Items</div></div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-red-900/20 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
          <div><div className="text-2xl font-bold text-white">{alertCount}</div><div className="text-sm text-neutral-400">Stock Alerts</div></div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-neutral-800 rounded-lg"><TrendingUp className="w-6 h-6 text-green-400" /></div>
          <div><div className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</div><div className="text-sm text-neutral-400">Stock Value</div></div>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            <option value="all">All Categories</option>
            {['Tyres', 'Lubricants', 'Spare Parts', 'Tools', 'Accessories'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            <option value="all">All Status</option>
            {['In Stock', 'Low Stock', 'Out of Stock'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">No items found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Item Name', 'Category', 'Stock Level', 'Unit Price', 'Status', 'Actions'].map(h => (
                    <th key={h} className={`px-5 py-3.5 font-bold text-[#FFD700] text-left ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{item.name}</div>
                      <div className="text-xs text-neutral-500">{item.id}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-400 text-sm">{item.category}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${item.stock === 0 ? 'text-red-400' : item.stock <= item.minStock ? 'text-yellow-400' : 'text-white'}`}>
                          {item.stock}
                        </span>
                        <span className="text-neutral-600 text-xs">/ min {item.minStock}</span>
                      </div>
                      <div className="w-24 h-1.5 bg-neutral-800 rounded-full mt-1.5">
                        <div className={`h-full rounded-full transition-all ${item.stock === 0 ? 'bg-red-500 w-0' : item.stock <= item.minStock ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((item.stock / (item.minStock * 2)) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white font-medium">${item.price.toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(item.status)}`}>{item.status}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setRestockItem(item)} title="Restock"
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-[#FFD700]/20 hover:text-[#FFD700] border border-neutral-700 rounded text-neutral-400 text-xs font-medium transition-colors">
                          Restock
                        </button>
                        <button onClick={() => setEditItem(item)} title="Edit"
                          className="p-1.5 rounded text-neutral-500 hover:text-blue-400 hover:bg-neutral-800 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)} title="Delete"
                          className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-neutral-800 text-xs text-neutral-500">
          Showing {filtered.length} of {items.length} items
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Item?</h3>
            <p className="text-neutral-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <ItemModal onClose={() => setShowAddModal(false)} onSave={handleSaveItem} />}
      {editItem && <ItemModal item={editItem} onClose={() => setEditItem(null)} onSave={handleSaveItem} />}
      {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onRestock={handleRestock} />}
    </div>
  );
}