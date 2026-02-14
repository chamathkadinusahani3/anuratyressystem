// Configuration
const BACKEND_URL = 'https://anuratyres-backend-emm1774.vercel.app';

class BookingClient {
  constructor(baseURL = BACKEND_URL) {
    this.baseURL = baseURL;
  }

  // Helper method for API calls
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // For CORS
    };

    const config = { ...defaultOptions, ...options };
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  // Health Check
  async health() {
    return this.request('/api/health');
  }

  // Bookings CRUD
  async getBookings(status = 'all', search = '', limit = 50) {
    let endpoint = `/api/bookings?limit=${limit}`;
    if (status !== 'all') endpoint += `&status=${status}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    return this.request(endpoint);
  }

  async getBooking(bookingId) {
    return this.request(`/api/bookings/${bookingId}`);
  }

  async createBooking(bookingData) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: bookingData,
    });
  }

  async updateBookingStatus(bookingId, status) {
    return this.request(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      body: { status },
    });
  }

  async deleteBooking(bookingId) {
    return this.request(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
    });
  }

  // Statistics
  async getStats() {
    return this.request('/api/bookings/stats/summary');
  }
}

// Export instance
export const bookingClient = new BookingClient();
export default BookingClient;