/**
 * MongoDB Service for Corporate & Employee Data
 * Handles API calls to serverless MongoDB backend
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-api-endpoint.com/api';

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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CORPORATE COMPANIES API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all corporate companies from MongoDB
 */
export async function fetchAllCorporateCompanies(): Promise<ApiResponse<CorporateCompany[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/companies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication token if required
        // 'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.companies || data
    };
  } catch (error: any) {
    console.error('Error fetching corporate companies:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch corporate companies'
    };
  }
}

/**
 * Fetch single corporate company by ID
 */
export async function fetchCorporateCompanyById(id: string): Promise<ApiResponse<CorporateCompany>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/companies/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.company || data
    };
  } catch (error: any) {
    console.error('Error fetching corporate company:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch corporate company'
    };
  }
}

/**
 * Search corporate companies by name or code
 */
export async function searchCorporateCompanies(query: string): Promise<ApiResponse<CorporateCompany[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/companies/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.companies || data
    };
  } catch (error: any) {
    console.error('Error searching corporate companies:', error);
    return {
      success: false,
      error: error.message || 'Failed to search corporate companies'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEES API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all employees from MongoDB
 */
export async function fetchAllEmployees(): Promise<ApiResponse<Employee[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.employees || data
    };
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch employees'
    };
  }
}

/**
 * Fetch employees by corporate code
 */
export async function fetchEmployeesByCompany(corporateCode: string): Promise<ApiResponse<Employee[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees?corporateCode=${corporateCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.employees || data
    };
  } catch (error: any) {
    console.error('Error fetching employees by company:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch employees'
    };
  }
}

/**
 * Fetch single employee by ID
 */
export async function fetchEmployeeById(id: string): Promise<ApiResponse<Employee>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.employee || data
    };
  } catch (error: any) {
    console.error('Error fetching employee:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch employee'
    };
  }
}

/**
 * Search employees by name, email, or discount ID
 */
export async function searchEmployees(query: string): Promise<ApiResponse<Employee[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.employees || data
    };
  } catch (error: any) {
    console.error('Error searching employees:', error);
    return {
      success: false,
      error: error.message || 'Failed to search employees'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMBINED DATA API
// ═══════════════════════════════════════════════════════════════════

export interface CorporateWithEmployees extends CorporateCompany {
  employees: Employee[];
  employeeCount: number;
}

/**
 * Fetch all corporate companies with their employees
 */
export async function fetchCorporateWithEmployees(): Promise<ApiResponse<CorporateWithEmployees[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/complete`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.companies || data
    };
  } catch (error: any) {
    console.error('Error fetching corporate data with employees:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch corporate data'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// STATISTICS API
// ═══════════════════════════════════════════════════════════════════

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

/**
 * Fetch corporate statistics
 */
export async function fetchCorporateStats(): Promise<ApiResponse<CorporateStats>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.stats || data
    };
  } catch (error: any) {
    console.error('Error fetching corporate stats:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch corporate statistics'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE STATUS API
// ═══════════════════════════════════════════════════════════════════

/**
 * Update corporate company status
 */
export async function updateCompanyStatus(
  id: string, 
  status: 'active' | 'inactive' | 'suspended'
): Promise<ApiResponse<CorporateCompany>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/companies/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.company || data,
      message: 'Status updated successfully'
    };
  } catch (error: any) {
    console.error('Error updating company status:', error);
    return {
      success: false,
      error: error.message || 'Failed to update company status'
    };
  }
}

/**
 * Update employee status
 */
export async function updateEmployeeStatus(
  id: string, 
  status: 'active' | 'inactive'
): Promise<ApiResponse<Employee>> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.employee || data,
      message: 'Status updated successfully'
    };
  } catch (error: any) {
    console.error('Error updating employee status:', error);
    return {
      success: false,
      error: error.message || 'Failed to update employee status'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT DATA API
// ═══════════════════════════════════════════════════════════════════

/**
 * Export corporate data as CSV
 */
export async function exportCorporateDataCSV(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/export/csv`, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/csv',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting corporate data:', error);
    throw error;
  }
}

/**
 * Export employee data as CSV
 */
export async function exportEmployeeDataCSV(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/corporate/employees/export/csv`, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/csv',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting employee data:', error);
    throw error;
  }
}

export default {
  // Companies
  fetchAllCorporateCompanies,
  fetchCorporateCompanyById,
  searchCorporateCompanies,
  
  // Employees
  fetchAllEmployees,
  fetchEmployeesByCompany,
  fetchEmployeeById,
  searchEmployees,
  
  // Combined
  fetchCorporateWithEmployees,
  
  // Stats
  fetchCorporateStats,
  
  // Updates
  updateCompanyStatus,
  updateEmployeeStatus,
  
  // Export
  exportCorporateDataCSV,
  exportEmployeeDataCSV
};