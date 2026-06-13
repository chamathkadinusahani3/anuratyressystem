// src/services/inventoryApi.ts
// Client for the /api/inventory* endpoints — CRUD, export/template, stock
// movements, and the CSV import workflow (upload → preview → commit → rollback).

import { getSessionUser, canSeeAllBranches, type UserRole } from '../lib/auth';
import type {
  ImportJob,
  ImportMode,
  ImportPreviewRow,
  ImportRowError,
  ImportStatus,
  InventoryItem,
  InventoryStats,
  ProductImage,
  StockMovement,
} from '../types/inventory';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const session = getSessionUser();
  return {
    'X-User-Role': session?.role || 'Cashier',
    'X-User-Branch': canSeeAllBranches((session?.role as UserRole) || 'Cashier') ? '' : (session?.branch || ''),
    'X-User-Name': session?.username || session?.name || 'unknown',
    ...extra,
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON (shouldn't happen for json endpoints) */ }
  if (!res.ok) {
    throw new Error(data.message || `Request failed (HTTP ${res.status})`);
  }
  return data as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  return parseResponse<T>(res);
}

async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(res);
}

async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Download failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Types for list responses ────────────────────────────────────────────────

export interface InventoryListResponse {
  success: boolean;
  items: InventoryItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
  stats: InventoryStats;
}

export interface InventoryListFilters {
  search?: string;
  category?: string;
  status?: 'active' | 'inactive' | 'all';
  stockStatus?: StockStatusFilter;
  page?: number;
  limit?: number;
}

export type StockStatusFilter = 'all' | 'In Stock' | 'Low Stock' | 'Out of Stock';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

// ─── Inventory CRUD ───────────────────────────────────────────────────────────

export const inventoryAPI = {
  async list(filters: InventoryListFilters = {}): Promise<InventoryListResponse> {
    const qs = buildQuery({
      search: filters.search,
      category: filters.category,
      status: filters.status,
      stockStatus: filters.stockStatus,
      page: filters.page,
      limit: filters.limit,
    });
    return getJson<InventoryListResponse>(`/inventory${qs}`);
  },

  async create(payload: Partial<InventoryItem> & { sku: string; name: string }): Promise<InventoryItem> {
    const data = await sendJson<{ item: InventoryItem }>('/inventory', 'POST', payload);
    return data.item;
  },

  async update(id: string, payload: Partial<InventoryItem> & { adjustmentReason?: string }): Promise<InventoryItem> {
    const data = await sendJson<{ item: InventoryItem }>(`/inventory/${id}`, 'PUT', payload);
    return data.item;
  },

  async remove(id: string): Promise<void> {
    await sendJson<{ success: boolean }>(`/inventory/${id}`, 'DELETE');
  },

  async restock(id: string, quantity: number, reason?: string): Promise<InventoryItem> {
    const data = await sendJson<{ item: InventoryItem }>(`/inventory/${id}/restock`, 'POST', { quantity, reason });
    return data.item;
  },

  async movements(params: { sku?: string; itemId?: string; page?: number; limit?: number } = {}): Promise<{
    movements: StockMovement[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return getJson(`/inventory/movements${qs}`);
  },

  async exportCsv(filters: { search?: string; category?: string; status?: string } = {}): Promise<void> {
    const qs = buildQuery(filters as Record<string, string | undefined>);
    await downloadFile(`/inventory/export${qs}`, `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`);
  },

  async downloadTemplate(): Promise<void> {
    await downloadFile('/inventory/template', 'inventory-import-template.csv');
  },
};

// ─── CSV Import workflow ─────────────────────────────────────────────────────

export interface ImportUploadResult {
  job: ImportJob;
  preview: ImportPreviewRow[];
  errorRows: { rowNumber: number; sku: string; name: string; errors: ImportRowError[] }[];
  previewTruncated: boolean;
  message: string;
}

export interface ImportProcessResult {
  done: boolean;
  processed: number;
  job: ImportJob;
}

export const inventoryImportAPI = {
  /** Step 1 — upload + validate. Nothing is written to inventory yet. */
  async upload(file: File, mode: ImportMode): Promise<ImportUploadResult> {
    const csv = await file.text();
    const data = await sendJson<ImportUploadResult>('/inventory/import', 'POST', {
      filename: file.name,
      mode,
      csv,
    });
    return data;
  },

  /** Step 2 — commit one batch. Call in a loop until `done` is true to drive a progress bar. */
  async processBatch(jobId: string): Promise<ImportProcessResult> {
    return sendJson<ImportProcessResult>(`/inventory/import/${jobId}?action=process`, 'POST');
  },

  /** Runs processBatch() in a loop, reporting progress after every batch. Returns the final job. */
  async runToCompletion(jobId: string, onProgress?: (job: ImportJob) => void): Promise<ImportJob> {
    // Safety cap so a stuck job can't loop forever in the browser.
    const MAX_ITERATIONS = 5000;
    let job: ImportJob | null = null;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const result = await this.processBatch(jobId);
      job = result.job;
      onProgress?.(job);
      if (result.done) return job;
    }
    throw new Error('Import is taking longer than expected — refresh to check its status.');
  },

  async status(jobId: string): Promise<ImportJob> {
    const data = await sendJson<{ job: ImportJob }>(`/inventory/import/${jobId}`, 'GET');
    return data.job;
  },

  async rows(jobId: string, params: { page?: number; limit?: number; filter?: 'all' | 'valid' | 'invalid' | 'duplicates' | 'create' | 'update' } = {}) {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return getJson<{ rows: ImportPreviewRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
      `/inventory/import/${jobId}?action=rows${qs ? '&' + qs.slice(1) : ''}`
    );
  },

  async downloadFailedRows(jobId: string): Promise<void> {
    await downloadFile(`/inventory/import/${jobId}?action=failed-rows`, `import-${jobId}-failed-rows.csv`);
  },

  async rollback(jobId: string): Promise<{ restoredCount: number; deletedCount: number; job: ImportJob }> {
    return sendJson(`/inventory/import/${jobId}?action=rollback`, 'POST');
  },

  async history(params: { page?: number; limit?: number; status?: ImportStatus | '' } = {}): Promise<{
    imports: ImportJob[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return getJson(`/inventory/import${qs}`);
  },
};

// ─── Product image API ────────────────────────────────────────────────────────

export interface CloudinarySignResult {
  success: boolean;
  notConfigured?: boolean;
  message?: string;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export const inventoryImageAPI = {
  async list(productId: string): Promise<ProductImage[]> {
    const data = await getJson<{ images: ProductImage[] }>(`/inventory/${productId}/images`);
    return data.images;
  },

  async sign(productId: string): Promise<CloudinarySignResult> {
    const res = await fetch(`${API_URL}/inventory/${productId}/images/sign`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return parseResponse<CloudinarySignResult>(res);
  },

  async saveImage(
    productId: string,
    payload: { url: string; publicId: string; alt?: string },
  ): Promise<ProductImage> {
    const data = await sendJson<{ image: ProductImage }>(`/inventory/${productId}/images`, 'POST', payload);
    return data.image;
  },

  async deleteImage(productId: string, imageId: string): Promise<void> {
    await sendJson<{ success: boolean }>(`/inventory/${productId}/images/${imageId}`, 'DELETE');
  },

  async setFeatured(productId: string, imageId: string): Promise<void> {
    await sendJson<{ success: boolean }>(`/inventory/${productId}/images/${imageId}/featured`, 'PATCH');
  },

  async reorder(productId: string, order: { id: string; sortOrder: number }[]): Promise<void> {
    await sendJson<{ success: boolean }>(`/inventory/${productId}/images/reorder`, 'PATCH', { order });
  },
};

export default { inventoryAPI, inventoryImportAPI, inventoryImageAPI };
