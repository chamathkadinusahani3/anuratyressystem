/**
 * MongoDB Service for Corporate & Employee Data
 * Handles API calls to serverless MongoDB backend
 */

// ✅ FIX 1: Was using VITE_API_BASE_URL (wrong name) → now uses VITE_API_URL
// ✅ FIX 2: Was falling back to 'https://your-api-endpoint.com/api' (placeholder) → real URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api').replace(/\/$/, '');

export interface CorporateCompany {
  _id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  businessType: string;
  taxId: string;
  address: string;
  employees: string;
  corporateCode: string;
  discount: number;
  status: 'active' | 'inactive' | 'suspended';
  registeredDate: string;
  bookingCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  _id: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone: string;
  corporateCode: string;
  companyName: string;
  vehicleNo?: string;
  department?: string;
  employeeId?: string;
  employeeDiscountId: string;
  discount: number;
  status: 'active' | 'inactive';
  registeredDate: string;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CorporateWithEmployees extends CorporateCompany {
  employees: Employee[];
  employeeCount: number;
}

export interface CorporateStats {
  totalCompanies: number;
  activeCompanies: number;
  totalEmployees: number;
  activeEmployees: number;
  totalBookings: number;
  totalDiscountGiven: number;
  topCompanies: Array<{
    companyName: string;
    employeeCount: number;
    bookingCount: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ─── Generic fetch helper ─────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res  = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.message || `HTTP ${res.status}` };
    return { success: true, data: json };
  } catch (err: any) {
    console.error(`[mongodbService] ${path}:`, err);
    return { success: false, error: err.message || 'Network error' };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORPORATE COMPANIES
// ═══════════════════════════════════════════════════════════════════

export async function fetchAllCorporateCompanies(): Promise<ApiResponse<CorporateCompany[]>> {
  const res = await apiFetch<any>('/corporate/companies');
  if (res.success && res.data) return { success: true, data: res.data.companies ?? res.data };
  return { success: false, error: res.error };
}

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════

export async function fetchAllEmployees(corporateCode?: string): Promise<ApiResponse<Employee[]>> {
  const qs  = corporateCode ? `?corporateCode=${encodeURIComponent(corporateCode)}` : '';
  const res = await apiFetch<any>(`/corporate/employees${qs}`);
  if (res.success && res.data) return { success: true, data: res.data.employees ?? res.data };
  return { success: false, error: res.error };
}

export async function fetchEmployeesByCompany(corporateCode: string): Promise<ApiResponse<Employee[]>> {
  return fetchAllEmployees(corporateCode);
}

// ═══════════════════════════════════════════════════════════════════
// COMBINED (companies + their employees in one call)
// ═══════════════════════════════════════════════════════════════════

export async function fetchCorporateWithEmployees(): Promise<ApiResponse<CorporateWithEmployees[]>> {
  const res = await apiFetch<any>('/corporate/complete');
  if (res.success && res.data) return { success: true, data: res.data.companies ?? res.data };
  return { success: false, error: res.error };
}

// ═══════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════

export async function fetchCorporateStats(): Promise<ApiResponse<CorporateStats>> {
  const res = await apiFetch<any>('/corporate/stats');
  if (res.success && res.data) return { success: true, data: res.data.stats ?? res.data };
  return { success: false, error: res.error };
}

// ═══════════════════════════════════════════════════════════════════
// STATUS UPDATES
// ✅ FIX 3: Old code called /corporate/companies/${id}/status (split-file pattern)
//           New consolidated corporate.js expects PATCH /corporate/company-status
//           with { id, status } in the request body
// ═══════════════════════════════════════════════════════════════════

export async function updateCompanyStatus(
  id: string,
  status: 'active' | 'inactive' | 'suspended'
): Promise<ApiResponse<CorporateCompany>> {
  return apiFetch('/corporate/company-status', {
    method: 'PATCH',
    body:   JSON.stringify({ id, status }),
  });
}

export async function updateEmployeeStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<ApiResponse<Employee>> {
  return apiFetch('/corporate/employee-status', {
    method: 'PATCH',
    body:   JSON.stringify({ id, status }),
  });
}

// ═══════════════════════════════════════════════════════════════════
// CSV EXPORT (generated client-side — no extra backend endpoints needed)
// ═══════════════════════════════════════════════════════════════════

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

export async function exportCorporateDataCSV(): Promise<void> {
  const result = await fetchAllCorporateCompanies();
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch companies');
  const header = ['Company Name','Contact Person','Email','Phone','Business Type','Corporate Code','Status','Registered Date','Booking Count'];
  const rows   = result.data.map(c => [
    c.companyName, c.contactPerson, c.email, c.phone, c.businessType,
    c.corporateCode, c.status, new Date(c.registeredDate).toLocaleDateString(), String(c.bookingCount),
  ]);
  downloadCSV(`anura_tyres_companies_${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows]);
}

export async function exportEmployeeDataCSV(): Promise<void> {
  const result = await fetchAllEmployees();
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch employees');
  const header = ['Name','Email','Phone','Company','Corporate Code','Discount ID','Department','Vehicle No','Status','Registered Date'];
  const rows   = result.data.map(e => [
    e.employeeName, e.employeeEmail, e.employeePhone, e.companyName,
    e.corporateCode, e.employeeDiscountId, e.department ?? '', e.vehicleNo ?? '',
    e.status, new Date(e.registeredDate).toLocaleDateString(),
  ]);
  downloadCSV(`anura_tyres_employees_${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows]);
}

export default {
  fetchAllCorporateCompanies,
  fetchAllEmployees,
  fetchEmployeesByCompany,
  fetchCorporateWithEmployees,
  fetchCorporateStats,
  updateCompanyStatus,
  updateEmployeeStatus,
  exportCorporateDataCSV,
  exportEmployeeDataCSV,
};