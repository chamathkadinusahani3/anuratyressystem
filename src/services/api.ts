// src/services/api.ts (for Dashboard)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface DashboardBooking {
  id: string;
  date: string;
  customer: string;
  vehicle: string;
  service: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  amount: string;
  email?: string;
  phone?: string;
  branch?: string;
  timeSlot?: string;
  fullData?: any;
}

export interface BookingStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export const dashboardAPI = {
  // Get all bookings
  async getBookings(filters?: {
    status?: string;
    search?: string;
  }): Promise<DashboardBooking[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.status) {
        params.append('status', filters.status);
      }
      
      if (filters?.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`${API_BASE_URL}/bookings?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch bookings');
      }

      return data.bookings || [];
    } catch (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }
  },

  // Update booking status
  async updateBookingStatus(
    bookingId: string,
    status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update booking status');
      }

      return data.success;
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  },

  // Get booking statistics
  async getStats(): Promise<BookingStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/stats/summary`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch statistics');
      }

      return data.stats;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  },

  // Delete booking
  async deleteBooking(bookingId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete booking');
      }

      return data.success;
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  }
};