import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { dashboardAPI, DashboardBooking } from '../../services/api';

interface CalendarViewProps {
  onClose: () => void;
}

export function CalendarView({ onClose }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await dashboardAPI.getBookings({});
      setBookings(data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getBookingsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.date === dateStr);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-500/20 text-yellow-500';
      case 'In Progress': return 'bg-blue-500/20 text-blue-500';
      case 'Completed': return 'bg-green-500/20 text-green-500';
      case 'Cancelled': return 'bg-red-500/20 text-red-500';
      default: return 'bg-neutral-500/20 text-neutral-500';
    }
  };

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate.getDate()) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Calendar View</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-xl font-bold text-white">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-neutral-400 uppercase py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {padding.map((i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {days.map((day) => {
                    const dayBookings = getBookingsForDate(day);
                    const isSelected = selectedDate?.getDate() === day &&
                      selectedDate?.getMonth() === currentDate.getMonth();
                    const isToday = new Date().getDate() === day &&
                      new Date().getMonth() === currentDate.getMonth() &&
                      new Date().getFullYear() === currentDate.getFullYear();

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                        className={`
                          min-h-[80px] p-2 rounded-lg border transition-all
                          ${isSelected ? 'bg-[#FFD700]/10 border-[#FFD700]' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'}
                          ${isToday ? 'ring-2 ring-[#FFD700]/50' : ''}
                        `}
                      >
                        <div className="text-left">
                          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-[#FFD700]' : 'text-white'}`}>
                            {day}
                          </div>
                          {dayBookings.length > 0 && (
                            <div className="space-y-1">
                              {dayBookings.slice(0, 2).map((booking, idx) => (
                                <div
                                  key={idx}
                                  className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(booking.status)}`}
                                >
                                  {booking.timeSlot || booking.customer.substring(0, 10)}
                                </div>
                              ))}
                              {dayBookings.length > 2 && (
                                <div className="text-xs text-neutral-500">
                                  +{dayBookings.length - 2} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Day Details */}
            <div className="lg:col-span-1">
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 sticky top-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'Select a date'}
                </h3>

                {selectedDate && (
                  <div className="space-y-3">
                    {selectedDayBookings.length === 0 ? (
                      <p className="text-neutral-400 text-sm">No bookings for this day</p>
                    ) : (
                      selectedDayBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="p-3 bg-neutral-900 rounded-lg border border-neutral-700"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-medium text-white text-sm">
                              {booking.timeSlot || 'No time'}
                            </div>
                            <Badge variant={
                              booking.status === 'Pending' ? 'pending' :
                              booking.status === 'In Progress' ? 'progress' :
                              booking.status === 'Completed' ? 'completed' : 'cancelled'
                            }>
                              {booking.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-neutral-400">
                            {booking.customer}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            {booking.service}
                          </div>
                          <div className="text-xs text-neutral-600 mt-1">
                            {booking.id}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}