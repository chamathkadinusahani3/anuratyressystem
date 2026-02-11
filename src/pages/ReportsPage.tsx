import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';

const monthlyData = [
  { name: 'Jan', revenue: 4000, bookings: 240 },
  { name: 'Feb', revenue: 3000, bookings: 139 },
  { name: 'Mar', revenue: 2000, bookings: 980 },
  { name: 'Apr', revenue: 2780, bookings: 390 },
  { name: 'May', revenue: 1890, bookings: 480 },
  { name: 'Jun', revenue: 2390, bookings: 380 },
  { name: 'Jul', revenue: 3490, bookings: 430 },
];

const serviceData = [
  { name: 'Tyre Change', value: 400 },
  { name: 'Wheel Align', value: 300 },
  { name: 'Full Service', value: 300 },
  { name: 'Repairs', value: 200 },
];

const COLORS = ['#FFD700', '#FF4444', '#3B82F6', '#10B981'];

export function ReportsPage() {
  const [period, setPeriod] = useState('30d');

  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalBookings = monthlyData.reduce((s, m) => s + m.bookings, 0);
  const avgRevenue = Math.round(totalRevenue / monthlyData.length);

  const handleExportPDF = () => {
    const totalServices = serviceData.reduce((s, d) => s + d.value, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Anura Tyres - Analytics Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
          .header { text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 3px solid #FFD700; }
          .header h1 { font-size: 28px; font-weight: 800; color: #000; letter-spacing: -0.5px; }
          .header .subtitle { font-size: 14px; color: #666; margin-top: 6px; }
          .header .date { font-size: 12px; color: #999; margin-top: 4px; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
          .stat { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 16px; text-align: center; }
          .stat h3 { font-size: 24px; font-weight: 800; color: #000; }
          .stat p { font-size: 12px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          h2 { font-size: 16px; font-weight: 700; color: #000; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #FFD700; }
          .section { margin-bottom: 32px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead tr { background: #FFD700; }
          th { padding: 10px 12px; text-align: left; font-weight: 700; color: #000; }
          td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
          tr:nth-child(even) td { background: #fafafa; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #d1fae5; color: #065f46; }
          .badge-yellow { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #bbb; font-size: 11px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚗 Anura Tyres Pvt Ltd</h1>
          <div class="subtitle">Analytics & Performance Report</div>
          <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <div class="stats">
          <div class="stat"><h3>$${totalRevenue.toLocaleString()}</h3><p>Total Revenue</p></div>
          <div class="stat"><h3>${totalBookings.toLocaleString()}</h3><p>Total Bookings</p></div>
          <div class="stat"><h3>$${avgRevenue.toLocaleString()}</h3><p>Avg Monthly Revenue</p></div>
        </div>

        <div class="section">
          <h2>Monthly Revenue & Bookings</h2>
          <table>
            <thead><tr><th>Month</th><th>Revenue</th><th>Bookings</th><th>Avg per Booking</th></tr></thead>
            <tbody>
              ${monthlyData.map(m => `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>$${m.revenue.toLocaleString()}</td>
                  <td>${m.bookings}</td>
                  <td>$${(m.revenue / m.bookings).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr style="background:#fffbeb">
                <td><strong>TOTAL</strong></td>
                <td><strong>$${totalRevenue.toLocaleString()}</strong></td>
                <td><strong>${totalBookings}</strong></td>
                <td><strong>$${(totalRevenue / totalBookings).toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Service Distribution</h2>
          <table>
            <thead><tr><th>Service</th><th>Count</th><th>Share</th></tr></thead>
            <tbody>
              ${serviceData.map(s => `
                <tr>
                  <td>${s.name}</td>
                  <td>${s.value}</td>
                  <td>${((s.value / totalServices) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Anura Tyres Pvt Ltd — Confidential Report — For Internal Use Only</p>
          <p style="margin-top:4px">Printed from Anura Tyres Management System</p>
        </div>

        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Analytics & Reports</h2>
          <p className="text-neutral-400 text-sm">Performance metrics and business insights.</p>
        </div>
        <div className="flex gap-3 items-center">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last Quarter</option>
          </select>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-[#FFD700]' },
          { label: 'Total Bookings', value: totalBookings, color: 'text-white' },
          { label: 'Avg Monthly Revenue', value: `$${avgRevenue.toLocaleString()}`, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Revenue Overview</CardTitle></CardHeader>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="name" stroke="#525252" tick={{ fill: '#737373', fontSize: 12 }} />
                <YAxis stroke="#525252" tick={{ fill: '#737373', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', color: '#fff', borderRadius: '8px' }} />
                <Bar dataKey="revenue" fill="#FFD700" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Popular Services</CardTitle></CardHeader>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                  {serviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', color: '#fff', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ color: '#a3a3a3', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Booking Trends</CardTitle></CardHeader>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="name" stroke="#525252" tick={{ fill: '#737373', fontSize: 12 }} />
                <YAxis stroke="#525252" tick={{ fill: '#737373', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', color: '#fff', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="bookings" stroke="#FF4444" strokeWidth={2} dot={{ fill: '#FF4444', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}