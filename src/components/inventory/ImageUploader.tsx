import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Star, Trash2, Upload, X, AlertCircle, ImageIcon, GripVertical } from 'lucide-react';
import { inventoryImageAPI } from '../../services/inventoryApi';
import type { ProductImage } from '../../types/inventory';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

interface Props {
  productId: string;
  productName?: string;
}

export function ImageUploader({ productId, productName }: Props) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [error, setError] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setImages(await inventoryImageAPI.list(productId));
    } catch {
      setError('Could not load images');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG, or WebP images are allowed';
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Image must be smaller than ${MAX_SIZE_MB} MB`;
    return null;
  }

  function selectFile(file: File) {
    setError('');
    const err = validateFile(file);
    if (err) { setError(err); return; }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function cancelPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview('');
  }

  async function uploadPending() {
    if (!pendingFile) return;
    setError('');
    setUploading(true);
    try {
      const sig = await inventoryImageAPI.sign(productId);
      if (!sig.success || sig.notConfigured) {
        setNotConfigured(true);
        setError(sig.message || 'Cloudinary not configured');
        return;
      }

      const form = new FormData();
      form.append('file', pendingFile);
      form.append('api_key', sig.apiKey);
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: form },
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message || `Cloudinary error ${uploadRes.status}`);
      }

      const data = await uploadRes.json() as { secure_url: string; public_id: string };
      const saved = await inventoryImageAPI.saveImage(productId, {
        url: data.secure_url,
        publicId: data.public_id,
        alt: pendingFile.name.replace(/\.[^.]+$/, ''),
      });

      setImages((prev) => [...prev, saved]);
      cancelPending();
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function doDelete(imageId: string) {
    setDeleteConfirm(null);
    try {
      await inventoryImageAPI.deleteImage(productId, imageId);
      setImages((prev) => {
        const next = prev.filter((img) => img.id !== imageId);
        if (next.length > 0 && !next.some((img) => img.featured)) {
          next[0] = { ...next[0], featured: true };
        }
        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    }
  }

  async function setFeatured(imageId: string) {
    try {
      await inventoryImageAPI.setFeatured(productId, imageId);
      setImages((prev) => prev.map((img) => ({ ...img, featured: img.id === imageId })));
    } catch (err: any) {
      setError(err?.message || 'Failed to update featured image');
    }
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────────
  function onDragStart(id: string) { setDraggedId(id); }

  function onDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setImages((prev) => {
      const from = prev.findIndex((img) => img.id === draggedId);
      const to   = prev.findIndex((img) => img.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
  }

  async function onDragEnd() {
    setDraggedId(null);
    try {
      await inventoryImageAPI.reorder(
        productId,
        images.map((img) => ({ id: img.id, sortOrder: img.sortOrder })),
      );
    } catch {
      // Re-load to fix inconsistencies
      load();
    }
  }

  // ── Drop zone ────────────────────────────────────────────────────────────
  function onDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error / not-configured notice */}
      {notConfigured && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm space-y-1">
          <p className="font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Cloudinary not configured</p>
          <p className="text-amber-300/70 text-xs">Add these to your Vercel environment variables, then redeploy:</p>
          <ul className="list-disc list-inside text-amber-300/70 text-xs font-mono space-y-0.5">
            <li>CLOUDINARY_CLOUD_NAME</li>
            <li>CLOUDINARY_API_KEY</li>
            <li>CLOUDINARY_API_SECRET</li>
          </ul>
          <p className="text-amber-300/60 text-xs mt-1">Free tier at cloudinary.com — 25 GB storage.</p>
        </div>
      )}
      {error && !notConfigured && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Upload zone */}
      {!pendingFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropZoneDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
            ${dragOver ? 'border-[#FFD700] bg-[#FFD700]/5' : 'border-neutral-700 hover:border-neutral-500'}`}
        >
          <Upload className="w-8 h-8 text-neutral-400" />
          <p className="text-neutral-300 text-sm font-medium">Drop image here or click to browse</p>
          <p className="text-neutral-600 text-xs">JPG, PNG, WebP — max {MAX_SIZE_MB} MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); e.target.value = ''; }}
          />
        </div>
      ) : (
        /* Pending upload preview */
        <div className="border border-neutral-700 rounded-xl overflow-hidden">
          <div className="relative bg-neutral-800">
            <img src={pendingPreview} alt="preview" className="w-full max-h-56 object-contain" />
            <button
              type="button"
              onClick={cancelPending}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-1 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 flex items-center justify-between gap-3">
            <p className="text-neutral-400 text-xs truncate">{pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)} KB)</p>
            <button
              type="button"
              onClick={uploadPending}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Image gallery */}
      {images.length === 0 ? (
        <div className="py-8 flex flex-col items-center gap-2 text-neutral-600">
          <ImageIcon className="w-10 h-10" />
          <p className="text-sm">No images yet — upload one above</p>
          {productName && <p className="text-xs text-neutral-700">{productName}</p>}
        </div>
      ) : (
        <>
          <p className="text-neutral-500 text-xs">
            {images.length} image{images.length !== 1 ? 's' : ''} — drag to reorder, click ★ to set featured
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => onDragStart(img.id)}
                onDragOver={(e) => onDragOver(e, img.id)}
                onDragEnd={onDragEnd}
                className={`relative group rounded-xl overflow-hidden border transition-all cursor-grab active:cursor-grabbing
                  ${draggedId === img.id ? 'opacity-40' : ''}
                  ${img.featured ? 'border-[#FFD700]/60' : 'border-neutral-700'}`}
              >
                {/* Fixed-ratio container — enforces uniform tile height regardless of source image dimensions */}
                <div className="w-full aspect-[4/3] bg-neutral-800 flex items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.alt || 'product image'}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </div>

                {/* Featured badge */}
                {img.featured && (
                  <div className="absolute top-2 left-2 bg-[#FFD700] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Featured
                  </div>
                )}

                {/* Drag handle */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-white/70" />
                </div>

                {/* Action overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!img.featured && (
                    <button
                      type="button"
                      onClick={() => setFeatured(img.id)}
                      title="Set as featured"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FFD700]/20 hover:bg-[#FFD700]/40 text-[#FFD700] text-xs font-medium rounded-lg transition-colors border border-[#FFD700]/30"
                    >
                      <Star className="w-3 h-3" /> Feature
                    </button>
                  )}
                  {deleteConfirm === img.id ? (
                    <button
                      type="button"
                      onClick={() => doDelete(img.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(img.id)}
                      title="Delete"
                      className="flex items-center justify-center p-1.5 bg-white/10 hover:bg-red-600/40 text-white/70 hover:text-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cancel delete confirm on outside click */}
      {deleteConfirm && (
        <button
          type="button"
          className="sr-only"
          onClick={() => setDeleteConfirm(null)}
          onBlur={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
