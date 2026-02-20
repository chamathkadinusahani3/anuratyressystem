import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Search, Download, RefreshCw, Eye, Ban, CheckCircle,
  TrendingUp, AlertCircle, Loader2, ChevronDown, ChevronRight, X
} from 'lucide-react';
import {
  fetchAllCorporateCompanies,
  fetchAllEmployees,
  fetchCorporateWithEmployees,
  fetchCorporateStats,
  updateCompanyStatus,
  updateEmployeeStatus,
  exportCorporateDataCSV,
  exportEmployeeDataCSV,
  CorporateCompany,
  Employee,
  CorporateWithEmployees,
  CorporateStats
} from '../utils/mongodbService';

export function CorporateManagementPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CorporateWithEmployees[]>([]);
  const [stats, setStats] = useState<CorporateStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CorporateWithEmployees | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch companies with employees
      const companiesResponse = await fetchCorporateWithEmployees();
      if (companiesResponse.success && companiesResponse.data) {
        setCompanies(companiesResponse.data);
      } else {
        setError(companiesResponse.error || 'Failed to load companies');
      }

      // Fetch stats
      const statsResponse = await fetchCorporateStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (corporateCode: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(corporateCode)) {
      newExpanded.delete(corporateCode);
    } else {
      newExpanded.add(corporateCode);
    }
    setExpandedCompanies(newExpanded);
  };

  const handleStatusChange = async (
    id: string,
    type: 'company' | 'employee',
    newStatus: 'active' | 'inactive' | 'suspended'
  ) => {
    try {
      if (type === 'company') {
        const response = await updateCompanyStatus(id, newStatus as any);
        if (response.success) {
          loadData(); // Reload data
        }
      } else {
        const response = await updateEmployeeStatus(id, newStatus as any);
        if (response.success) {
          loadData(); // Reload data
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleExport = async (type: 'companies' | 'employees') => {
    setExporting(true);
    try {
      if (type === 'companies') {
        await exportCorporateDataCSV();
      } else {
        await exportEmployeeDataCSV();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.corporateCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filter === 'all' || company.status === filter;

    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'suspended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFD700] animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading corporate data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#FFD700] text-black font-bold rounded-lg hover:bg-[#FFD700]/90"
          >
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
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => handleExport('companies')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs text-neutral-500">Companies</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalCompanies}</div>
            <div className="text-xs text-green-400 mt-1">{stats.activeCompanies} active</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs text-neutral-500">Employees</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalEmployees}</div>
            <div className="text-xs text-green-400 mt-1">{stats.activeEmployees} active</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs text-neutral-500">Total Bookings</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalBookings}</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-neutral-500">Discount Given</span>
            </div>
            <div className="text-2xl font-bold text-[#FFD700]">
              Rs. {stats.totalDiscountGiven.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies, codes, or emails..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700]"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-[#FFD700] text-black'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <h3 className="font-bold text-white text-lg">
            Corporate Companies ({filteredCompanies.length})
          </h3>
        </div>

        <div className="divide-y divide-neutral-800">
          {filteredCompanies.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">
              No companies found matching your criteria
            </div>
          ) : (
            filteredCompanies.map((company) => {
              const isExpanded = expandedCompanies.has(company.corporateCode);

              return (
                <div key={company._id} className="hover:bg-neutral-800/40 transition-colors">
                  {/* Company Row */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={() => toggleCompany(company.corporateCode)}
                          className="text-neutral-500 hover:text-white transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>

                        <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-[#FFD700]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm">{company.companyName}</h4>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-neutral-500 font-mono">
                              {company.corporateCode}
                            </span>
                            <span className="text-xs text-neutral-500">{company.email}</span>
                            <span className="text-xs text-neutral-500">
                              {company.employeeCount || company.employees.length} employees
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(company.status)}`}>
                          {company.status}
                        </span>

                        <select
                          value={company.status}
                          onChange={(e) => handleStatusChange(company._id, 'company', e.target.value as any)}
                          className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>

                    {/* Expanded Employee List */}
                    {isExpanded && company.employees.length > 0 && (
                      <div className="mt-4 ml-14 space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-[#FFD700]" />
                          <span className="text-sm font-bold text-white">
                            Registered Employees ({company.employees.length})
                          </span>
                        </div>

                        <div className="bg-neutral-800 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-neutral-900 border-b border-neutral-700">
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Name</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Email</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Phone</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Discount ID</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Vehicle</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Status</th>
                                <th className="px-4 py-2 text-left font-medium text-neutral-400">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-700">
                              {company.employees.map((employee) => (
                                <tr key={employee._id} className="hover:bg-neutral-700/50">
                                  <td className="px-4 py-3 text-white">{employee.employeeName}</td>
                                  <td className="px-4 py-3 text-neutral-400">{employee.employeeEmail}</td>
                                  <td className="px-4 py-3 text-neutral-400">{employee.employeePhone}</td>
                                  <td className="px-4 py-3 font-mono text-xs text-[#FFD700]">
                                    {employee.employeeDiscountId}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-400">
                                    {employee.vehicleNo || '-'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(employee.status)}`}>
                                      {employee.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={employee.status}
                                      onChange={(e) => handleStatusChange(employee._id, 'employee', e.target.value as any)}
                                      className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700]"
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {isExpanded && company.employees.length === 0 && (
                      <div className="mt-4 ml-14 p-4 bg-neutral-800 rounded-lg text-center text-neutral-500 text-sm">
                        No employees registered yet for this company
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