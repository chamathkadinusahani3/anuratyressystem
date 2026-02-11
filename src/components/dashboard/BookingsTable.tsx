import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  PlayCircle,
  RefreshCw
} from 'lucide-react';
import { dashboardAPI, DashboardBooking } from '../../services/api';

type BookingStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

export function BookingsTable() {
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch bookings on component mount and when filters change
  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: any = {};
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const data = await dashboardAPI.getBookings(filters);
      setBookings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case 'Pending':
        return 'pending';
      case 'In Progress':
        return 'progress';
      case 'Completed':
        return 'completed';
      case 'Cancelled':
        return 'cancelled';
      default:
        return 'default';
    }
  };

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    try {
      await dashboardAPI.updateBookingStatus(id, newStatus);
      
      // Update local state
      setBookings(
        bookings.map((b) =>
          b.id === id
            ? {
                ...b,
                status: newStatus
              }
            : b
        )
      );
    } catch (err: any) {
      alert('Failed to update booking status: ' + err.message);
      console.error('Error updating status:', err);
    }
  };

  // Client-side search filter
  const filteredBookings = bookings.filter(
    (b) =>
      b.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.vehicle && b.vehicle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Card className="h-full flex flex-col" noPadding>
      <div className="p-6 border-b border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <CardTitle>Bookings Overview</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBookings}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Search by customer, ID, or vehicle..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'Pending', label: 'Pending' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Cancelled', label: 'Cancelled' }
            ]}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border-b border-red-500/20">
          <p className="text-red-500 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-brand-yellow animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredBookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-neutral-400 mb-2">No bookings found</p>
          <Button variant="primary" size="sm" onClick={fetchBookings}>
            Refresh
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filteredBookings.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900 border-b border-neutral-800">
                <tr>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Booking ID</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Date</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Customer</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Vehicle</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Service</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700]">Status</th>
                  <th className="px-6 py-4 font-bold text-[#FFD700] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-neutral-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {booking.id}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">{booking.date}</td>
                    <td className="px-6 py-4 text-white">{booking.customer}</td>
                    <td className="px-6 py-4 text-neutral-400">
                      {booking.vehicle}
                    </td>
                    <td className="px-6 py-4 text-white">{booking.service}</td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusVariant(booking.status)}>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            handleStatusChange(booking.id, 'In Progress')
                          }
                          className="p-1 text-neutral-400 hover:text-[#FFD700] transition-colors"
                          title="Start"
                          disabled={booking.status === 'In Progress'}
                        >
                          <PlayCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(booking.id, 'Completed')
                          }
                          className="p-1 text-neutral-400 hover:text-green-500 transition-colors"
                          title="Complete"
                          disabled={booking.status === 'Completed'}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(booking.id, 'Cancelled')
                          }
                          className="p-1 text-neutral-400 hover:text-[#FF0000] transition-colors"
                          title="Cancel"
                          disabled={booking.status === 'Cancelled'}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-500">
            <span>Showing {filteredBookings.length} results</span>
          </div>
        </>
      )}
    </Card>
  );
}