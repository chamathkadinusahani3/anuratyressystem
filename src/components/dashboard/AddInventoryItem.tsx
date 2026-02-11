import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddInventoryItemProps {
  onClose: () => void;
  onSuccess: (item: any) => void;
}

export function AddInventoryItem({ onClose, onSuccess }: AddInventoryItemProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    stock: '',
    minStock: '',
    price: '',
    supplier: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate ID
      const id = `INV-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      const newItem = {
        id,
        name: formData.name,
        category: formData.category,
        stock: parseInt(formData.stock),
        minStock: parseInt(formData.minStock),
        price: `$${formData.price}`,
        status: parseInt(formData.stock) === 0 ? 'Out of Stock' : 
                parseInt(formData.stock) <= parseInt(formData.minStock) ? 'Low Stock' : 'In Stock',
        supplier: formData.supplier,
        description: formData.description
      };

      // Call success callback
      onSuccess(newItem);
      onClose();
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Add Inventory Item</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Basic Information</h3>
            <div className="space-y-4">
              <Input
                label="Item Name *"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Michelin Primacy 4 (205/55R16)"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="">Select Category</option>
                    <option value="Tyres">Tyres</option>
                    <option value="Lubricants">Lubricants</option>
                    <option value="Spare Parts">Spare Parts</option>
                    <option value="Tools">Tools</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>

                <Input
                  label="Unit Price ($) *"
                  required
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the item"
              />
            </div>
          </div>

          {/* Stock Information */}
          <div className="border-t border-neutral-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Stock Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Current Stock *"
                required
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0"
              />

              <Input
                label="Minimum Stock Level *"
                required
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="10"
              />
            </div>
          </div>

          {/* Supplier Information */}
          <div className="border-t border-neutral-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Supplier Information</h3>
            <Input
              label="Supplier Name"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="e.g., ABC Auto Parts Ltd."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}