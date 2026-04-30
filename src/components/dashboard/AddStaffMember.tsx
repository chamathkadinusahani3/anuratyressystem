import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddStaffMemberProps {
  onClose: () => void;
  onSuccess: (staff: any) => void;
}

export function AddStaffMember({ onClose, onSuccess }: AddStaffMemberProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    contact: '',
    email: '',
    address: '',
    emergencyContact: '',
    bay: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newStaff = {
        id: Date.now(),
        name: formData.name,
        role: formData.role,
        status: 'Available',
        contact: formData.contact,
        email: formData.email,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        bay: formData.bay || '-'
      };

      onSuccess(newStaff);
      onClose();
    } catch (error) {
      console.error('Failed to add staff:', error);
      alert('Failed to add staff member. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Add Staff Member</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Personal Information</h3>
            <div className="space-y-4">
              <Input
                label="Full Name *"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="">Select Role</option>
                    <option value="Lead Mechanic">Lead Mechanic</option>
                    <option value="Mechanic">Mechanic</option>
                    <option value="Junior Mechanic">Junior Mechanic</option>
                    <option value="Tyre Technician">Tyre Technician</option>
                    <option value="Service Advisor">Service Advisor</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                <Input
                  label="Contact Number *"
                  required
                  type="tel"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="077-1234567"
                />
              </div>

              <Input
                label="Email Address *"
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />

              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Street address, city"
              />
            </div>
          </div>

          {/* Work Information */}
          <div className="border-t border-neutral-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Work Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Assigned Bay (Optional)
                </label>
                <select
                  value={formData.bay}
                  onChange={(e) => setFormData({ ...formData, bay: e.target.value })}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
                >
                  <option value="">Not Assigned</option>
                  <option value="Bay 1">Bay 1</option>
                  <option value="Bay 2">Bay 2</option>
                  <option value="Bay 3">Bay 3</option>
                  <option value="Bay 4">Bay 4</option>
                </select>
              </div>

              <Input
                label="Emergency Contact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                placeholder="077-9876543"
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
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Staff Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}