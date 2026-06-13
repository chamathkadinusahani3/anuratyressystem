// ─── Shared Inventory + CSV Import types ─────────────────────────────────────

export interface ProductImage {
  id: string;
  url: string;
  publicId: string;
  featured: boolean;
  sortOrder: number;
  alt: string;
  uploadedAt?: string;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type ItemStatus = 'active' | 'inactive';

export interface TyreDetails {
  size: string;
  width: number | null;
  profile: number | null;
  rimSize: number | null;
  loadIndex: string;
  speedRating: string;
  season: string;
  pattern: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  minimumStock: number;
  tyre: TyreDetails;
  barcode: string;
  location: string;
  status: ItemStatus;
  stockStatus: StockStatus;
  source: 'manual' | 'csv_import';
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  totalItems: number;
  totalStockValue: number;
  stockAlerts: number;
}

export interface StockMovement {
  id: string;
  itemId: string | null;
  sku: string;
  name: string;
  type:
    | 'initial_stock'
    | 'import_add'
    | 'import_replace'
    | 'import_sync'
    | 'import_sync_remove'
    | 'manual_restock'
    | 'manual_adjustment'
    | 'rollback';
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  reason: string;
  source: 'manual' | 'csv_import' | 'system';
  importJobId: string | null;
  performedBy: { username: string; role: string };
  createdAt: string;
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

export type ImportMode = 'add_stock' | 'replace_stock' | 'full_sync';

export const IMPORT_MODE_INFO: Record<ImportMode, { label: string; description: string }> = {
  add_stock: {
    label: 'Add Stock',
    description: 'Adds the uploaded quantity on top of each item’s existing stock.',
  },
  replace_stock: {
    label: 'Replace Stock',
    description: 'Overwrites each item’s current stock with the quantity in the file.',
  },
  full_sync: {
    label: 'Full Sync',
    description: 'Mirrors the database exactly to the CSV — items missing from the file are deactivated and zeroed out.',
  },
};

export type ImportStatus =
  | 'pending_review'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'rolled_back';

export interface ImportRowError {
  field: string;
  message: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  sku: string;
  name: string;
  quantity: number;
  action: 'create' | 'update' | 'skip';
  valid: boolean;
  errors: ImportRowError[];
  isDuplicateInFile: boolean;
}

export interface ImportJob {
  id: string;
  filename: string;
  mode: ImportMode;
  status: ImportStatus;
  columns: string[];
  missingColumns: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateSkus: string[];
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  progressPercent: number;
  syncRemovedSkus: string[];
  backupTaken: boolean;
  startedAt: string | null;
  completedAt: string | null;
  rolledBackAt: string | null;
  performedBy: { username: string; role: string };
  createdAt: string;
  updatedAt: string;
}

export interface ImportUploadResponse {
  success: boolean;
  message: string;
  job: ImportJob;
  preview: ImportPreviewRow[];
  errorRows: { rowNumber: number; sku: string; name: string; errors: ImportRowError[] }[];
  previewTruncated: boolean;
  maxRows: number;
}
