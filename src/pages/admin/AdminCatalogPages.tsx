import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../layouts/AdminLayout';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/notifications/toastSlice';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { CloudinaryImageField } from '../../components/admin/CloudinaryImageField';
import { ResilientImage } from '../../components/ui/ResilientImage';
import type { BrandItem, CategoryItem, ProductItem } from '../../types/commerce';
import { useSeoMeta } from '../../lib/useSeoMeta';

function slugify(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ATTRIBUTE_PRESETS: Record<ProductItem['attributeGroup'], string[]> = {
  general: ['Material', 'Origin', 'Weight'],
  electronics: ['Processor', 'RAM / Storage', 'Display', 'Battery', 'Warranty'],
  beauty: ['Skin Type', 'Ingredients', 'Net Volume', 'Expiry Window'],
  books: ['Author', 'Publisher', 'Language', 'Edition', 'ISBN'],
  home: ['Dimensions', 'Capacity / Wattage', 'Material', 'Warranty'],
};

interface ProductFormState {
  id?: string;
  name: string;
  nameBn: string;
  slug: string;
  sku: string;
  categoryId: string;
  subCategoryId: string;
  brandId: string;
  attributeGroup: ProductItem['attributeGroup'];
  attributes: Record<string, string>;
  shortDescription: string;
  description: string;
  basePrice: string;
  salePrice: string;
  flashSalePrice: string;
  flashSaleStartsAt: string;
  flashSaleEndsAt: string;
  stockOnHand: string;
  lowStockThreshold: string;
  warrantyInfo: string;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  isNewArrival: boolean;
  isPremiumCollection: boolean;
  bilingualKeywordsText: string;
  imageUrl: string;
  imagePublicId: string;
  hasVariants: boolean;
  variants: Array<{
    sku: string;
    title: string;
    price: string;
    salePrice: string;
    stockOnHand: string;
    lowStockThreshold: string;
  }>;
}

const emptyProductForm = (defaultCatId = ''): ProductFormState => ({
  name: '',
  nameBn: '',
  slug: '',
  sku: '',
  categoryId: defaultCatId,
  subCategoryId: '',
  brandId: '',
  attributeGroup: 'general',
  attributes: {},
  shortDescription: '',
  description: '',
  basePrice: '',
  salePrice: '',
  flashSalePrice: '',
  flashSaleStartsAt: '',
  flashSaleEndsAt: '',
  stockOnHand: '10',
  lowStockThreshold: '5',
  warrantyInfo: '',
  status: 'published',
  isFeatured: false,
  isNewArrival: false,
  isPremiumCollection: false,
  bilingualKeywordsText: '',
  imageUrl: '',
  imagePublicId: '',
  hasVariants: false,
  variants: [],
});

export function AdminProductsPage() {
  useSeoMeta({ title: 'Admin Products | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(() => emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<ProductItem | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [csvResult, setCsvResult] = useState<{ importedCount: number; errors: Array<{ row: number; sku: string; error: string }> } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (statusFilter) qs.set('status', statusFilter);
      qs.set('page', String(page));
      qs.set('limit', '25');

      const [prodRes, catRes, brandRes] = await Promise.all([
        apiRequest<{
          ok: true;
          products: ProductItem[];
          pagination?: { page: number; limit: number; total: number; totalPages: number };
        }>(`/api/admin/products?${qs.toString()}`),
        apiRequest<{ ok: true; categories: CategoryItem[] }>('/api/admin/categories'),
        apiRequest<{ ok: true; brands: BrandItem[] }>('/api/admin/brands'),
      ]);
      setProducts(Array.isArray(prodRes.products) ? prodRes.products : []);
      if (prodRes.pagination) setPagination(prodRes.pagination);
      setCategories(Array.isArray(catRes.categories) ? catRes.categories : []);
      setBrands(Array.isArray(brandRes.brands) ? brandRes.brands : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load products.';
      setLoadError(msg);
      dispatch(showToast({ variant: 'error', message: msg }));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topCategories = categories.filter((c) => !c.parentId);
  const subCategoriesForSelected = categories.filter((c) => c.parentId === form.categoryId);

  const openCreateModal = () => {
    const defaultCat = topCategories[0]?.id || categories[0]?.id || '';
    setForm(emptyProductForm(defaultCat));
    setModalOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    const catId = typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId;
    const subCatId = p.subCategoryId && typeof p.subCategoryId === 'object' ? (p.subCategoryId as { _id: string })._id : p.subCategoryId || '';
    const brandId = p.brandId && typeof p.brandId === 'object' ? p.brandId._id : p.brandId || '';
    setForm({
      id: p.id,
      name: p.name,
      nameBn: p.nameBn || '',
      slug: p.slug,
      sku: p.sku,
      categoryId: catId || '',
      subCategoryId: subCatId || '',
      brandId: brandId || '',
      attributeGroup: p.attributeGroup || 'general',
      attributes: p.attributes || {},
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      basePrice: String(p.basePrice),
      salePrice: p.salePrice != null ? String(p.salePrice) : '',
      flashSalePrice: p.flashSalePrice != null ? String(p.flashSalePrice) : '',
      flashSaleStartsAt: p.flashSaleStartsAt ? p.flashSaleStartsAt.slice(0, 16) : '',
      flashSaleEndsAt: p.flashSaleEndsAt ? p.flashSaleEndsAt.slice(0, 16) : '',
      stockOnHand: String(p.stockOnHand ?? 0),
      lowStockThreshold: String(p.lowStockThreshold ?? 5),
      warrantyInfo: p.warrantyInfo || '',
      status: p.status,
      isFeatured: Boolean(p.isFeatured),
      isNewArrival: Boolean(p.isNewArrival),
      isPremiumCollection: Boolean(p.isPremiumCollection),
      bilingualKeywordsText: (p.bilingualKeywords || []).join(', '),
      imageUrl: p.images?.[0]?.url || '',
      imagePublicId: p.images?.[0]?.publicId || '',
      hasVariants: Boolean(p.hasVariants && p.variants?.length),
      variants: (p.variants || []).map((v) => ({
        sku: v.sku,
        title: v.title,
        price: v.price != null ? String(v.price) : '',
        salePrice: v.salePrice != null ? String(v.salePrice) : '',
        stockOnHand: String(v.stockOnHand),
        lowStockThreshold: String(v.lowStockThreshold || 5),
      })),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        nameBn: form.nameBn || undefined,
        slug: form.slug || slugify(form.name),
        sku: form.sku.toUpperCase(),
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || null,
        brandId: form.brandId || null,
        attributeGroup: form.attributeGroup,
        attributes: form.attributes,
        shortDescription: form.shortDescription || undefined,
        description: form.description,
        basePrice: Number(form.basePrice),
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        flashSalePrice: form.flashSalePrice ? Number(form.flashSalePrice) : null,
        flashSaleStartsAt: form.flashSaleStartsAt ? new Date(form.flashSaleStartsAt).toISOString() : null,
        flashSaleEndsAt: form.flashSaleEndsAt ? new Date(form.flashSaleEndsAt).toISOString() : null,
        stockOnHand: Number(form.stockOnHand || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 5),
        warrantyInfo: form.warrantyInfo || undefined,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isPremiumCollection: form.isPremiumCollection,
        bilingualKeywords: form.bilingualKeywordsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        images: form.imageUrl
          ? [{ url: form.imageUrl, publicId: form.imagePublicId || undefined, alt: form.name, sortOrder: 0 }]
          : [],
        hasVariants: form.hasVariants && form.variants.length > 0,
        variants: form.hasVariants
          ? form.variants.map((v) => ({
              sku: v.sku.toUpperCase(),
              title: v.title,
              options: { Variant: v.title },
              price: v.price ? Number(v.price) : null,
              salePrice: v.salePrice ? Number(v.salePrice) : null,
              stockOnHand: Number(v.stockOnHand || 0),
              lowStockThreshold: Number(v.lowStockThreshold || 5),
              isActive: true,
            }))
          : [],
      };

      if (form.id) {
        await apiRequest(`/api/admin/products/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Product updated & synced with storefront.' }));
      } else {
        await apiRequest('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Product created & synced with storefront.' }));
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to save product.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (p: ProductItem) => {
    const nextStatus = p.status === 'published' ? 'draft' : 'published';
    setTogglingId(p.id);
    try {
      await apiRequest(`/api/admin/products/${p.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      dispatch(
        showToast({
          variant: 'success',
          message:
            nextStatus === 'published'
              ? `"${p.name}" is now published on the storefront.`
              : `"${p.name}" moved to draft.`,
        }),
      );
      loadData();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Status update failed.' }));
    } finally {
      setTogglingId(null);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await apiRequest(`/api/admin/products/${archiveTarget.id}`, { method: 'DELETE' });
      dispatch(showToast({ variant: 'info', message: `Archived "${archiveTarget.name}".` }));
      setArchiveTarget(null);
      loadData();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Archive failed.' }));
    }
  };

  const handleCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    setCsvResult(null);
    const lines = csvInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      dispatch(showToast({ variant: 'warning', message: 'Paste a header row and at least one product row.' }));
      return;
    }

    const rows = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      return {
        sku: cols[0] || '',
        name: cols[1] || '',
        slug: cols[2] || slugify(cols[1] || ''),
        categorySlug: cols[3] || 'electronics',
        brandName: cols[4] || '',
        basePrice: Number(cols[5] || 0),
        salePrice: cols[6] ? Number(cols[6]) : null,
        stockOnHand: Number(cols[7] || 0),
        status: (cols[8] === 'published' ? 'published' : 'draft') as 'draft' | 'published',
        description: cols[9] || `${cols[1] || 'Product'} imported via bulk CSV`,
      };
    });

    try {
      const res = await apiRequest<{
        ok: boolean;
        importedCount: number;
        errors: Array<{ row: number; sku: string; error: string }>;
      }>('/api/admin/products/bulk/import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      setCsvResult({ importedCount: res.importedCount, errors: res.errors || [] });
      if (res.importedCount > 0) {
        dispatch(showToast({ variant: 'success', message: `Imported ${res.importedCount} products.` }));
        loadData();
      }
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'CSV import failed.' }));
    }
  };

  return (
    <AdminLayout title="Catalog · Products">
      <PermissionGuard permission="catalog.view">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search SKU, product name, brand..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/admin/products/bulk/export"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </a>
              <button
                type="button"
                onClick={() => {
                  setCsvResult(null);
                  setCsvModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
              >
                <Plus className="h-4 w-4" /> Add Product
              </button>
            </div>
          </div>

          {loadError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Stock (Avail/Res)</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading products...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-rose-600">
                        Unable to fetch catalog products from backend API.
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No products match your filter.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const avail = p.availableStock ?? Math.max(0, (p.stockOnHand || 0) - (p.reservedStock || 0));
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                                <ResilientImage src={p.images?.[0]?.url} alt={p.name} className="h-full w-full object-contain" />
                              </div>
                              <div>
                                <p className="font-semibold text-[#0F1D3A]">{p.name}</p>
                                <p className="text-[11px] text-slate-500">{p.brandName || 'NOVARA'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono-tabular px-4 py-3 text-slate-600">{p.sku}</td>
                          <td className="font-mono-tabular px-4 py-3">
                            <span className="font-bold text-[#0F1D3A]">
                              ৳{(p.currentPrice || p.salePrice || p.basePrice).toLocaleString('en-IN')}
                            </span>
                            {(p.originalPrice || p.salePrice) && (
                              <span className="ml-1.5 text-[11px] text-slate-400 line-through">
                                ৳{p.basePrice.toLocaleString('en-IN')}
                              </span>
                            )}
                          </td>
                          <td className="font-mono-tabular px-4 py-3">
                            <span className={avail <= 5 ? 'font-bold text-rose-600' : 'font-semibold text-emerald-700'}>
                              {avail}
                            </span>{' '}
                            <span className="text-slate-400">/ {p.reservedStock || 0} res</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                p.status === 'published'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : p.status === 'draft'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={togglingId === p.id}
                                onClick={() => handleTogglePublish(p)}
                                title={p.status === 'published' ? 'Move to Draft' : 'Publish to Storefront'}
                                aria-label={p.status === 'published' ? `Unpublish ${p.name}` : `Publish ${p.name}`}
                                className={`rounded-lg border border-slate-200 p-1.5 transition-colors ${
                                  p.status === 'published'
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : 'text-amber-600 hover:bg-amber-50'
                                }`}
                              >
                                {p.status === 'published' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                                aria-label={`Edit ${p.name}`}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {p.status !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() => setArchiveTarget(p)}
                                  className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                  aria-label={`Archive ${p.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Create / Edit Product Modal */}
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={form.id ? 'Edit Product' : 'Create New Product'}
            size="xl"
          >
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Product Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value,
                        slug: f.id ? f.slug : slugify(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Bangla Name (Optional)</label>
                  <input
                    value={form.nameBn}
                    onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">SKU *</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">URL Slug *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, subCategoryId: '' }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {subCategoriesForSelected.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Subcategory</label>
                    <select
                      value={form.subCategoryId}
                      onChange={(e) => setForm((f) => ({ ...f, subCategoryId: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">None (Primary Category Only)</option>
                      {subCategoriesForSelected.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Brand</label>
                  <select
                    value={form.brandId}
                    onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">No Brand / Generic</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Flash Sale */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Base Price (৳) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.basePrice}
                    onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Sale Price (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.salePrice}
                    onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Flash Price (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.flashSalePrice}
                    onChange={(e) => setForm((f) => ({ ...f, flashSalePrice: e.target.value }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Stock On Hand *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.stockOnHand}
                    onChange={(e) => setForm((f) => ({ ...f, stockOnHand: e.target.value }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {form.flashSalePrice && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Flash Sale Starts</label>
                    <input
                      type="datetime-local"
                      value={form.flashSaleStartsAt}
                      onChange={(e) => setForm((f) => ({ ...f, flashSaleStartsAt: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Flash Sale Ends</label>
                    <input
                      type="datetime-local"
                      value={form.flashSaleEndsAt}
                      onChange={(e) => setForm((f) => ({ ...f, flashSaleEndsAt: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              <CloudinaryImageField
                label="Primary Product Image"
                value={form.imageUrl}
                folder="products"
                onChange={(url, publicId) =>
                  setForm((f) => ({ ...f, imageUrl: url, imagePublicId: publicId || '' }))
                }
              />

              {/* Category-specific Attribute Fields */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F1D3A]">Category Attribute Schema</span>
                  <select
                    value={form.attributeGroup}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        attributeGroup: e.target.value as ProductItem['attributeGroup'],
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                  >
                    <option value="general">General Retail</option>
                    <option value="electronics">Electronics & Tech</option>
                    <option value="beauty">Beauty & Skincare</option>
                    <option value="books">Books & Publications</option>
                    <option value="home">Home & Appliances</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ATTRIBUTE_PRESETS[form.attributeGroup].map((attrKey) => (
                    <div key={attrKey}>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">{attrKey}</label>
                      <input
                        value={form.attributes[attrKey] || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            attributes: { ...f.attributes, [attrKey]: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Variants Toggle */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#0F1D3A]">
                    <input
                      type="checkbox"
                      checked={form.hasVariants}
                      onChange={(e) => setForm((f) => ({ ...f, hasVariants: e.target.checked }))}
                    />
                    Enable SKU Variants (Size / Color / Storage)
                  </label>
                  {form.hasVariants && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          variants: [
                            ...f.variants,
                            {
                              sku: `${f.sku || 'VAR'}-${f.variants.length + 1}`,
                              title: 'New Variant',
                              price: '',
                              salePrice: '',
                              stockOnHand: '10',
                              lowStockThreshold: '3',
                            },
                          ],
                        }))
                      }
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      + Add Variant
                    </button>
                  )}
                </div>
                {form.hasVariants &&
                  form.variants.map((v, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-5">
                      <input
                        placeholder="Variant Title"
                        value={v.title}
                        onChange={(e) => {
                          const next = [...form.variants];
                          next[idx] = { ...v, title: e.target.value };
                          setForm((f) => ({ ...f, variants: next }));
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Variant SKU"
                        value={v.sku}
                        onChange={(e) => {
                          const next = [...form.variants];
                          next[idx] = { ...v, sku: e.target.value.toUpperCase() };
                          setForm((f) => ({ ...f, variants: next }));
                        }}
                        className="font-mono-tabular rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Price (opt)"
                        value={v.price}
                        onChange={(e) => {
                          const next = [...form.variants];
                          next[idx] = { ...v, price: e.target.value };
                          setForm((f) => ({ ...f, variants: next }));
                        }}
                        className="font-mono-tabular rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Stock"
                        value={v.stockOnHand}
                        onChange={(e) => {
                          const next = [...form.variants];
                          next[idx] = { ...v, stockOnHand: e.target.value };
                          setForm((f) => ({ ...f, variants: next }));
                        }}
                        className="font-mono-tabular rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            variants: f.variants.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Description *</label>
                <textarea
                  required
                  rows={3}
                  minLength={10}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Bilingual Search Keywords (comma separated)
                  </label>
                  <input
                    value={form.bilingualKeywordsText}
                    onChange={(e) => setForm((f) => ({ ...f, bilingualKeywordsText: e.target.value }))}
                    placeholder="e.g. মোটিভেশনাল বই, motivational book, smartphone"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Publication Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as 'draft' | 'published' | 'archived' }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                  />
                  Best Seller / Featured
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isNewArrival}
                    onChange={(e) => setForm((f) => ({ ...f, isNewArrival: e.target.checked }))}
                  />
                  New Arrival
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isPremiumCollection}
                    onChange={(e) => setForm((f) => ({ ...f, isPremiumCollection: e.target.checked }))}
                  />
                  Our Premium Collection
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#1155EE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : form.id ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Bulk CSV Import Modal */}
          <Modal
            open={csvModalOpen}
            onClose={() => setCsvModalOpen(false)}
            title="Bulk CSV Product Import"
            description="Header required: sku,name,slug,categorySlug,brandName,basePrice,salePrice,stockOnHand,status,description"
            size="lg"
          >
            <form onSubmit={handleCsvImport} className="space-y-4">
              <textarea
                rows={7}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder={`sku,name,slug,categorySlug,brandName,basePrice,salePrice,stockOnHand,status,description\nNVR-BOOK-99,Atomic Habits Bangla,atomic-habits-bn,books-stationery,NOVARA,450,350,25,published,Bestselling habit guide in Bangla & English`}
                className="font-mono-tabular w-full rounded-xl border border-slate-300 p-3 text-xs"
              />
              {csvResult && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-[#0F1D3A]">Imported: {csvResult.importedCount} rows</p>
                  {csvResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-rose-600">
                      {csvResult.errors.map((er, i) => (
                        <li key={i}>
                          Row {er.row} ({er.sku}): {er.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
                >
                  Validate & Import
                </button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(archiveTarget)}
            onClose={() => setArchiveTarget(null)}
            onConfirm={handleArchive}
            title="Archive Product"
            message={`Archive "${archiveTarget?.name}"? Historical order snapshots remain intact, and the product will be hidden from the storefront.`}
            confirmLabel="Archive Product"
            destructive
          />
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminCategoriesPage() {
  useSeoMeta({ title: 'Admin Categories | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    nameBn: '',
    slug: '',
    parentId: '',
    iconName: 'Package',
    imageUrl: '',
    cloudinaryPublicId: '',
    attributeSchemaType: 'general' as CategoryItem['attributeSchemaType'],
    sortOrder: '0',
    isActive: true,
    showInHeader: true,
  });

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; categories: CategoryItem[] }>('/api/admin/categories');
      setCategories(res.categories);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load categories.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder || 0),
      };
      if (editingId) {
        await apiRequest(`/api/admin/categories/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Category updated.' }));
      } else {
        await apiRequest('/api/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Category created.' }));
      }
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/categories/${deleteTarget.id}`, { method: 'DELETE' });
      dispatch(showToast({ variant: 'success', message: 'Category deleted.' }));
      setDeleteTarget(null);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Delete failed.' }));
    }
  };

  return (
    <AdminLayout title="Catalog · Categories">
      <PermissionGuard permission="catalog.view">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: '',
                  nameBn: '',
                  slug: '',
                  parentId: '',
                  iconName: 'Package',
                  imageUrl: '',
                  cloudinaryPublicId: '',
                  attributeSchemaType: 'general',
                  sortOrder: '0',
                  isActive: true,
                  showInHeader: true,
                });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Schema</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold text-[#0F1D3A]">
                      {c.name} {c.nameBn && <span className="text-slate-500">({c.nameBn})</span>}
                    </td>
                    <td className="font-mono-tabular px-4 py-3 text-slate-600">{c.slug}</td>
                    <td className="px-4 py-3 capitalize">{c.attributeSchemaType}</td>
                    <td className="font-mono-tabular px-4 py-3">{c.sortOrder}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setForm({
                            name: c.name,
                            nameBn: c.nameBn || '',
                            slug: c.slug,
                            parentId: c.parentId || '',
                            iconName: c.iconName || 'Package',
                            imageUrl: c.imageUrl || '',
                            cloudinaryPublicId: '',
                            attributeSchemaType: c.attributeSchemaType,
                            sortOrder: String(c.sortOrder),
                            isActive: c.isActive,
                            showInHeader: c.showInHeader,
                          });
                          setModalOpen(true);
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editingId ? 'Edit Category' : 'Add Category'}
            size="md"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Category Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Bangla Name</label>
                  <input
                    value={form.nameBn}
                    onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Slug *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Attribute Schema</label>
                  <select
                    value={form.attributeSchemaType}
                    onChange={(e) => setForm((f) => ({ ...f, attributeSchemaType: e.target.value as CategoryItem['attributeSchemaType'] }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="general">General</option>
                    <option value="electronics">Electronics</option>
                    <option value="beauty">Beauty</option>
                    <option value="books">Books</option>
                    <option value="home">Home & Appliances</option>
                  </select>
                </div>
              </div>
              <CloudinaryImageField
                label="Category Thumbnail"
                value={form.imageUrl}
                folder="categories"
                onChange={(url, publicId) => setForm((f) => ({ ...f, imageUrl: url, cloudinaryPublicId: publicId || '' }))}
              />
              <div className="flex items-center gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  Active
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.showInHeader} onChange={(e) => setForm((f) => ({ ...f, showInHeader: e.target.checked }))} />
                  Show in Header
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
                  Save Category
                </button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Delete Category"
            message={`Delete "${deleteTarget?.name}"? Categories with assigned products cannot be deleted until products are reassigned.`}
            destructive
          />
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminBrandsPage() {
  useSeoMeta({ title: 'Admin Brands | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', logoUrl: '', cloudinaryPublicId: '', description: '', isActive: true });

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; brands: BrandItem[] }>('/api/admin/brands');
      setBrands(res.brands);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load brands.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      if (editingId) {
        await apiRequest(`/api/admin/brands/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/brands', { method: 'POST', body: JSON.stringify(payload) });
      }
      dispatch(showToast({ variant: 'success', message: 'Brand saved.' }));
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    }
  };

  return (
    <AdminLayout title="Catalog · Brands">
      <PermissionGuard permission="catalog.view">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: '', slug: '', logoUrl: '', cloudinaryPublicId: '', description: '', isActive: true });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Brand
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <ResilientImage src={b.logoUrl} alt={b.name} className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F1D3A]">{b.name}</p>
                    <p className="font-mono-tabular text-[11px] text-slate-500">{b.slug}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(b.id);
                    setForm({ name: b.name, slug: b.slug, logoUrl: b.logoUrl || '', cloudinaryPublicId: '', description: b.description || '', isActive: b.isActive });
                    setModalOpen(true);
                  }}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Brand' : 'Add Brand'}>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Brand Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <CloudinaryImageField
                label="Brand Logo"
                value={form.logoUrl}
                folder="brands"
                onChange={(url, publicId) => setForm((f) => ({ ...f, logoUrl: url, cloudinaryPublicId: publicId || '' }))}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
                  Save Brand
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminInventoryPage() {
  useSeoMeta({ title: 'Admin Inventory | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<Array<{ _id: string; sku: string; productName: string; type: string; delta: number; reason: string; actorName: string; createdAt: string }>>([]);
  const [adjustTarget, setAdjustTarget] = useState<ProductItem | null>(null);
  const [delta, setDelta] = useState('0');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [prodRes, movRes] = await Promise.all([
        apiRequest<{ ok: true; products: ProductItem[] }>('/api/admin/products?limit=50'),
        apiRequest<{ ok: true; movements: typeof movements }>('/api/admin/inventory/movements?limit=30'),
      ]);
      setProducts(prodRes.products);
      setMovements(movRes.movements);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load inventory.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      await apiRequest('/api/admin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: adjustTarget.id,
          delta: Number(delta),
          reason,
        }),
      });
      dispatch(showToast({ variant: 'success', message: 'Stock adjusted and logged.' }));
      setAdjustTarget(null);
      setDelta('0');
      setReason('');
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Adjustment failed.' }));
    }
  };

  return (
    <AdminLayout title="Inventory & Stock Control">
      <PermissionGuard permission="inventory.view">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="font-display text-sm font-bold text-[#0F1D3A]">Current Stock Balances</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">SKU</th>
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 text-right font-semibold">On Hand</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Reserved</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Available</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const avail = Math.max(0, (p.stockOnHand || 0) - (p.reservedStock || 0));
                    return (
                      <tr key={p.id}>
                        <td className="font-mono-tabular px-4 py-2.5">{p.sku}</td>
                        <td className="px-4 py-2.5 font-medium text-[#0F1D3A]">{p.name}</td>
                        <td className="font-mono-tabular px-4 py-2.5 text-right">{p.stockOnHand}</td>
                        <td className="font-mono-tabular px-4 py-2.5 text-right text-amber-600">{p.reservedStock || 0}</td>
                        <td className="font-mono-tabular px-4 py-2.5 text-right font-bold">{avail}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustTarget(p);
                              setDelta('5');
                              setReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1155EE] hover:bg-blue-50"
                          >
                            <SlidersHorizontal className="h-3 w-3" /> Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="font-display text-sm font-bold text-[#0F1D3A]">Stock Movement Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Time</th>
                    <th className="px-4 py-2.5 font-semibold">SKU / Product</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Delta</th>
                    <th className="px-4 py-2.5 font-semibold">Reason & Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m._id}>
                      <td className="px-4 py-2 text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium text-[#0F1D3A]">
                        <span className="font-mono-tabular text-slate-500">{m.sku}</span> · {m.productName}
                      </td>
                      <td className="px-4 py-2 capitalize">{m.type}</td>
                      <td className={`font-mono-tabular px-4 py-2 text-right font-bold ${m.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {m.reason} <span className="text-slate-400">({m.actorName})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Modal
            open={Boolean(adjustTarget)}
            onClose={() => setAdjustTarget(null)}
            title={`Adjust Stock: ${adjustTarget?.name || ''}`}
            size="sm"
          >
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Quantity Delta (positive to restock, negative to write off) *</label>
                <input
                  type="number"
                  required
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Adjustment Reason *</label>
                <input
                  required
                  minLength={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Warehouse physical count / Damaged stock"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAdjustTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
                  Apply Adjustment
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
