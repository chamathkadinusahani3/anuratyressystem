import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

// UPDATE THIS IMPORT PATH based on where your types are located:
// Option 1: If types are in src/types/index.ts
// import { BRANCHES, SERVICE_CATEGORIES, SERVICES } from '../../types';

// Option 2: If types are in src/types.ts
// import { BRANCHES, SERVICE_CATEGORIES, SERVICES } from '../../types';

// Option 3: If you need to define them here (temporary solution)
// For now, I'll import from a types file - you may need to adjust the path

// TEMPORARY: Define types here if import doesn't work
const BRANCHES = [
  {
    id: '1',
    name: 'Pannipitiya Branch',
    address: '123 Main Street, Pannipitiya',
    phone: '011-1234567',
    hasFullService: true
  },
  {
    id: '2',
    name: 'Maharagama Branch',
    address: '456 Galle Road, Maharagama',
    phone: '011-2345678',
    hasFullService: false
  },
  {
    id: '3',
    name: 'Nugegoda Branch',
    address: '789 High Level Road, Nugegoda',
    phone: '011-3456789',
    hasFullService: false
  }
];

const SERVICE_CATEGORIES = [
  { id: 'Anura Tyres', label: 'Anura Tyres', description: 'Tyre services' },
  { id: 'Mechanix', label: 'Mechanix', description: 'Mechanical services' },
  { id: 'Truck & Bus', label: 'Truck & Bus', description: 'Heavy vehicle services' }
];

const SERVICES = [
  // Anura Tyres Services
  { id: '1', name: 'Wheel Alignment', category: 'Anura Tyres' },
  { id: '2', name: 'Wheel Balancing', category: 'Anura Tyres' },
  { id: '3', name: 'Tyre Change', category: 'Anura Tyres' },
  { id: '4', name: 'Tyre Repair', category: 'Anura Tyres' },
  { id: '5', name: 'Nitrogen Filling', category: 'Anura Tyres' },
  
  // Mechanix Services
  { id: '6', name: 'Full Service', category: 'Mechanix' },
  { id: '7', name: 'Oil Change', category: 'Mechanix' },
  { id: '8', name: 'Battery Check', category: 'Mechanix' },
  { id: '9', name: 'Brake Service', category: 'Mechanix' },
  { id: '10', name: 'AC Service', category: 'Mechanix' },
  
  // Truck & Bus Services
  { id: '11', name: 'Heavy Vehicle Alignment', category: 'Truck & Bus' },
  { id: '12', name: 'Truck Tyre Change', category: 'Truck & Bus' },
  { id: '13', name: 'Bus Maintenance', category: 'Truck & Bus' },
];

interface ManualBookingFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualBookingForm({ onClose, onSuccess }: ManualBookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    branchId: '',
    category: '',
    serviceIds: [] as string[],
    date: '',
    timeSlot: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    vehicleNo: ''
  });

  const selectedBranch = BRANCHES.find(b => b.id === formData.branchId);
  
  // Filter categories based on branch
  const availableCategories = selectedBranch?.hasFullService 
    ? SERVICE_CATEGORIES 
    : SERVICE_CATEGORIES.filter(c => c.id === 'Anura Tyres');

  // Filter services based on category
  const availableServices = SERVICES.filter(s => s.category === formData.category);

  // Time slots
  const timeSlots = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Find selected branch
      const branch = BRANCHES.find(b => b.id === formData.branchId);
      if (!branch) throw new Error('Branch not found');

      // Find selected services
      const services = SERVICES.filter(s => formData.serviceIds.includes(s.id));
      if (services.length === 0) throw new Error('No services selected');

      // Create booking payload
      const bookingData = {
        branch: {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          phone: branch.phone
        },
        category: formData.category,
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category
        })),
        date: new Date(formData.date),
        timeSlot: formData.timeSlot,
        customer: {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          vehicleNo: formData.vehicleNo
        }
      };

      // Call API to create booking
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create booking');
      }

      // Success!
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Create Manual Booking</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Branch *
            </label>
            <select
              required
              value={formData.branchId}
              onChange={(e) => setFormData({ ...formData, branchId: e.target.value, category: '', serviceIds: [] })}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
            >
              <option value="">Select Branch</option>
              {BRANCHES.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          {formData.branchId && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Service Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value, serviceIds: [] })}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
              >
                <option value="">Select Category</option>
                {availableCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Services Selection */}
          {formData.category && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Services * (Select at least one)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableServices.map(service => (
                  <label
                    key={service.id}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                      ${formData.serviceIds.includes(service.id)
                        ? 'bg-[#FFD700]/10 border-[#FFD700] text-white'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{service.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Date *
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Time Slot *
              </label>
              <select
                required
                value={formData.timeSlot}
                onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
              >
                <option value="">Select Time</option>
                {timeSlots.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Information */}
          <div className="border-t border-neutral-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Customer Information</h3>
            
            <div className="space-y-4">
              <Input
                label="Customer Name *"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="John Doe"
              />

              <Input
                label="Phone Number *"
                required
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                placeholder="077 123 4567"
              />

              <Input
                label="Email Address *"
                required
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                placeholder="john@example.com"
              />

              <Input
                label="Vehicle Number (Optional)"
                value={formData.vehicleNo}
                onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                placeholder="CAB-1234"
              />
            </div>
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
              disabled={loading || formData.serviceIds.length === 0}
            >
              {loading ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 