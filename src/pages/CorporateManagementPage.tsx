// src/pages/CorporateManagementPage.tsx  (admin dashboard)
import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Users, Search, Download, RefreshCw,
  TrendingUp, AlertCircle, Loader2, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import {
  fetchCorporateWithEmployees,
  fetchCorporateStats,
  updateCompanyStatus,
  updateEmployeeStatus,
  exportCorporateDataCSV,
  exportEmployeeDataCSV,
  CorporateWithEmployees,
  CorporateStats,
} from '../utils/mongodbService';

// ─── CSV helper for company-wise export ──────────────────────────────────────
function downloadCSV(filename: string, rows: string[][]): void {
  const csv  = rows.map(r =>
    r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCompanyEmployeesCSV(company: CorporateWithEmployees): void {
  if (company.employees.length === 0) {
    alert(`No employees registered for ${company.companyName}`);
    return;
  }
  const header = ['Name','Email','Phone','Discount ID','Department','Vehicle No','Employee ID','Status','Registered Date'];
  const rows = (company.employees as any[]).map(e => [
    e.employeeName, e.employeeEmail, e.employeePhone,
    e.employeeDiscountId, e.department ?? '', e.vehicleNo ?? '',
    e.employeeId ?? '', e.status,
    new Date(e.registeredDate).toLocaleDateString(),
  ]);
  const safeName = company.companyName.replace(/[^a-z0-9]/gi, '_');
  downloadCSV(`${safeName}_employees_${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows]);
}

// ─── Export Dropdown ──────────────────────────────────────────────────────────
function ExportDropdown({
  companies, onExportAll, exporting,
}: {
  companies: CorporateWithEmployees[];
  onExportAll: (type: 'companies' | 'employees') => void;
  exporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalEmployees = companies.reduce((s, c) => s + (c.employees as any[]).length, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {exporting ? 'Exporting…' : 'Export'}
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Export as CSV</span>
            <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* All data */}
          <div className="p-2">
            <p className="text-xs text-neutral-500 px-2 pb-1 font-medium">All Data</p>
            <button
              onClick={() => { onExportAll('companies'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-neutral-700 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[#FFD700]" />
              </div>
              <div>
                <div className="text-sm font-medium">All Companies</div>
                <div className="text-xs text-neutral-500">{companies.length} companies</div>
              </div>
            </button>
            <button
              onClick={() => { onExportAll('employees'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-neutral-700 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-[#FFD700]" />
              </div>
              <div>
                <div className="text-sm font-medium">All Employees</div>
                <div className="text-xs text-neutral-500">{totalEmployees} employees across all companies</div>
              </div>
            </button>
          </div>

          {/* Company-wise */}
          {companies.length > 0 && (
            <div className="border-t border-neutral-700 p-2">
              <p className="text-xs text-neutral-500 px-2 pb-1 font-medium">By Company</p>
              <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                {companies.map(company => (
                  <button
                    key={company._id}
                    onClick={() => { exportCompanyEmployeesCSV(company); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-white hover:bg-neutral-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3 h-3 text-neutral-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{company.companyName}</div>
                        <div className="text-xs text-neutral-500 font-mono">{company.corporateCode}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
                      (company.employees as any[]).length > 0
                        ? 'bg-[#FFD700]/20 text-[#FFD700]'
                        : 'bg-neutral-700 text-neutral-500'
                    }`}>
                      {(company.employees as any[]).length} emp
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CorporateManagementPage() {
  const [loading, setLoading]                     = useState(true);
  const [companies, setCompanies]                 = useState<CorporateWithEmployees[]>([]);
  const [stats, setStats]                         = useState<CorporateStats | null>(null);
  const [searchQuery, setSearchQuery]             = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [filter, setFilter]                       = useState<'all' | 'active' | 'inactive'>('all');
  const [exporting, setExporting]                 = useState(false);
  const [error, setError]                         = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [companiesRes, statsRes] = await Promise.all([
        fetchCorporateWithEmployees(),
        fetchCorporateStats(),
      ]);
      if (companiesRes.success && companiesRes.data) {
        setCompanies(companiesRes.data as CorporateWithEmployees[]);
      } else {
        setError(companiesRes.error || 'Failed to load companies');
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data as CorporateStats);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (corporateCode: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      next.has(corporateCode) ? next.delete(corporateCode) : next.add(corporateCode);
      return next;
    });
  };

  const handleStatusChange = async (id: string, type: 'company' | 'employee', newStatus: string) => {
    try {
      const res = type === 'company'
        ? await updateCompanyStatus(id, newStatus as any)
        : await updateEmployeeStatus(id, newStatus as any);
      if (res.success) loadData();
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleExportAll = async (type: 'companies' | 'employees') => {
    setExporting(true);
    try {
      type === 'companies' ? await exportCorporateDataCSV() : await exportEmployeeDataCSV();
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.corporateCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'active':    return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive':  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'suspended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:          return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFD700] animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading corporate data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
          <p className="text-neutral-400 mb-2">{error}</p>
          <p className="text-neutral-600 text-sm mb-6">
            Make sure the backend is deployed and <code className="text-[#FFD700]">VITE_API_URL</code> is set correctly.
          </p>
          <button onClick={loadData} className="px-6 py-2 bg-[#FFD700] text-black font-bold rounded-lg hover:bg-[#FFD700]/90">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Corporate Management</h2>
          <p className="text-neutral-400 text-sm">Manage corporate partners and employee discounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <ExportDropdown companies={companies} onExportAll={handleExportAll} exporting={exporting} />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Building2 className="w-4 h-4 text-[#FFD700]" />, label: 'Companies',      value: stats.totalCompanies,  sub: `${stats.activeCompanies} active` },
            { icon: <Users className="w-4 h-4 text-[#FFD700]" />,     label: 'Employees',      value: stats.totalEmployees,  sub: `${stats.activeEmployees} active` },
            { icon: <TrendingUp className="w-4 h-4 text-[#FFD700]" />, label: 'Total Bookings', value: stats.totalBookings,   sub: 'all time' },
            { icon: null, label: 'Discount Given', value: `Rs. ${stats.totalDiscountGiven.toLocaleString()}`, sub: 'total', gold: true },
          ].map((card: any) => (
            <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              {card.icon
                ? <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs text-neutral-500">{card.label}</span></div>
                : <div className="mb-2"><span className="text-xs text-neutral-500">{card.label}</span></div>
              }
              <div className={`text-2xl font-bold ${card.gold ? 'text-[#FFD700]' : 'text-white'}`}>{card.value}</div>
              <div className="text-xs text-green-400 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search companies, codes, or emails…"
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700]" />
        </div>
        <div className="flex gap-2">
          {(['all','active','inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${filter === f ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Companies list */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">Corporate Companies ({filteredCompanies.length})</h3>
          {filteredCompanies.length === 0 && companies.length > 0 && (
            <span className="text-xs text-neutral-500">No results for current filter</span>
          )}
        </div>

        <div className="divide-y divide-neutral-800">
          {companies.length === 0 ? (
            <div className="p-16 text-center">
              <Building2 className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500 font-medium">No corporate companies registered yet</p>
              <p className="text-neutral-600 text-sm mt-1">Companies will appear here once they register via the customer website</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">No companies match your search</div>
          ) : (
            filteredCompanies.map(company => {
              const isExpanded = expandedCompanies.has(company.corporateCode);
              const empList    = company.employees as any[];
              return (
                <div key={company._id} className="hover:bg-neutral-800/40 transition-colors">
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4">

                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button onClick={() => toggleCompany(company.corporateCode)}
                          className="text-neutral-500 hover:text-white transition-colors flex-shrink-0">
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-[#FFD700]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{company.companyName}</h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                            <span className="text-xs text-[#FFD700] font-mono">{company.corporateCode}</span>
                            <span className="text-xs text-neutral-500 truncate">{company.email}</span>
                            <span className="text-xs text-neutral-500">{company.phone}</span>
                            <span className="text-xs text-neutral-500">
                              {empList.length} employee{empList.length !== 1 ? 's' : ''}
                            </span>
                            {company.registeredDate && (
                              <span className="text-xs text-neutral-600">
                                Joined {new Date(company.registeredDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Quick per-company export icon */}
                        <button
                          onClick={() => exportCompanyEmployeesCSV(company)}
                          title={`Export ${company.companyName} employees`}
                          className="p-1.5 text-neutral-600 hover:text-[#FFD700] hover:bg-neutral-700 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor(company.status)}`}>
                          {company.status}
                        </span>
                        <select value={company.status}
                          onChange={e => handleStatusChange(company._id, 'company', e.target.value)}
                          className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>

                    {/* Expanded employee table */}
                    {isExpanded && (
                      <div className="mt-4 ml-14">
                        {empList.length === 0 ? (
                          <div className="p-4 bg-neutral-800 rounded-lg text-center text-neutral-500 text-sm">
                            No employees registered yet for this company
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#FFD700]" />
                                <span className="text-sm font-bold text-white">
                                  Registered Employees ({empList.length})
                                </span>
                              </div>
                              <button
                                onClick={() => exportCompanyEmployeesCSV(company)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 hover:border-[#FFD700]/50 transition-colors"
                              >
                                <Download className="w-3 h-3" /> Export this list
                              </button>
                            </div>
                            <div className="bg-neutral-800 rounded-lg overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-neutral-900 border-b border-neutral-700">
                                    {['Name','Email','Phone','Discount ID','Vehicle','Status','Action'].map(h => (
                                      <th key={h} className="px-4 py-2 text-left font-medium text-neutral-400 whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-700">
                                  {empList.map((emp: any) => (
                                    <tr key={emp._id} className="hover:bg-neutral-700/50">
                                      <td className="px-4 py-3 text-white whitespace-nowrap">{emp.employeeName}</td>
                                      <td className="px-4 py-3 text-neutral-400 text-xs">{emp.employeeEmail}</td>
                                      <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{emp.employeePhone}</td>
                                      <td className="px-4 py-3 font-mono text-xs text-[#FFD700] whitespace-nowrap">{emp.employeeDiscountId}</td>
                                      <td className="px-4 py-3 text-neutral-400">{emp.vehicleNo || '—'}</td>
                                      <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(emp.status)}`}>
                                          {emp.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <select value={emp.status}
                                          onChange={e => handleStatusChange(emp._id, 'employee', e.target.value)}
                                          className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700]">
                                          <option value="active">Active</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}