import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Edit3, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../layouts/AdminLayout';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/notifications/toastSlice';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { CloudinaryImageField } from '../../components/admin/CloudinaryImageField';
import { ResilientImage } from '../../components/ui/ResilientImage';
import type { HomepageConfigData, PromotionalAdData, ReviewItem } from '../../types/commerce';
import type { RoleName } from '../../lib/rbac';
import { useSeoMeta } from '../../lib/useSeoMeta';

export function AdminCustomersPage() {
  useSeoMeta({ title: 'Admin Customers | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string; phone?: string; isVerified: boolean; status: string; createdAt: string }>>([]);

  useEffect(() => {
    apiRequest<{ ok: true; customers: typeof customers }>('/api/admin/customers')
      .then((res) => setCustomers(res.customers))
      .catch((err) => dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load customers.' })));
  }, [dispatch]);

  return (
    <AdminLayout title="Customers Directory">
      <PermissionGuard permission="customers.view">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Verified</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold text-[#0F1D3A]">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="font-mono-tabular px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">{c.isVerified ? 'Verified' : 'Pending'}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminReviewsPage() {
  useSeoMeta({ title: 'Admin Reviews | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [modTarget, setModTarget] = useState<ReviewItem | null>(null);
  const [modReason, setModReason] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiRequest<{ ok: true; reviews: ReviewItem[] }>(`/api/admin/reviews${qs}`);
      setReviews(res.reviews);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load reviews.' }));
    }
  }, [statusFilter, dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/api/admin/reviews/${id}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason: modReason || undefined }),
      });
      dispatch(showToast({ variant: 'success', message: `Review ${status}.` }));
      setModTarget(null);
      setModReason('');
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Moderation failed.' }));
    }
  };

  return (
    <AdminLayout title="Reviews Moderation">
      <PermissionGuard permission="reviews.moderate">
        <div className="space-y-4">
          <div className="flex gap-2">
            {['', 'pending', 'approved', 'rejected'].map((st) => (
              <button
                key={st || 'all'}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize ${
                  statusFilter === st ? 'bg-[#1155EE] text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {st || 'All'}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F1D3A]">
                      {r.title} <span className="text-amber-500">({r.rating}★)</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      By {r.userName} · Product: {typeof r.productId === 'object' ? r.productId.name : r.productId} ·{' '}
                      <span className="capitalize font-semibold">{r.status}</span>
                    </p>
                    <p className="mt-2 text-xs text-slate-700">{r.comment}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moderate(r._id, 'approved')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setModTarget(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Modal open={Boolean(modTarget)} onClose={() => setModTarget(null)} title="Reject Review" size="sm">
            <div className="space-y-4">
              <textarea
                rows={3}
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Reason for rejecting review (optional)"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => modTarget && moderate(modTarget._id, 'rejected')}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminCouponsPage() {
  useSeoMeta({ title: 'Admin Coupons | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [coupons, setCoupons] = useState<Array<{ id: string; code: string; description?: string; discountType: 'fixed' | 'percentage'; discountValue: number; minOrderAmount: number; usedCount: number; isActive: boolean }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(typeof coupons)[0] | null>(null);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'fixed' | 'percentage',
    discountValue: '10',
    maxDiscountAmount: '500',
    minOrderAmount: '500',
    isActive: true,
  });

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; coupons: typeof coupons }>('/api/admin/coupons');
      setCoupons(res.coupons);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load coupons.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: form.code.toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        minOrderAmount: Number(form.minOrderAmount || 0),
        isActive: form.isActive,
      };
      if (editingId) {
        await apiRequest(`/api/admin/coupons/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
      }
      dispatch(showToast({ variant: 'success', message: 'Coupon saved.' }));
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed to save coupon.' }));
    }
  };

  return (
    <AdminLayout title="Marketing · Coupons">
      <PermissionGuard permission="marketing.manage">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ code: '', description: '', discountType: 'percentage', discountValue: '10', maxDiscountAmount: '500', minOrderAmount: '500', isActive: true });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Create Coupon
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Discount</th>
                  <th className="px-4 py-3 font-semibold">Min Order</th>
                  <th className="px-4 py-3 font-semibold">Used</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono-tabular px-4 py-3 font-bold text-[#1155EE]">{c.code}</td>
                    <td className="font-mono-tabular px-4 py-3">
                      {c.discountType === 'percentage' ? `${c.discountValue}%` : `৳${c.discountValue}`}
                    </td>
                    <td className="font-mono-tabular px-4 py-3">৳{c.minOrderAmount}</td>
                    <td className="font-mono-tabular px-4 py-3">{c.usedCount}</td>
                    <td className="px-4 py-3">{c.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setForm({
                            code: c.code,
                            description: c.description || '',
                            discountType: c.discountType,
                            discountValue: String(c.discountValue),
                            maxDiscountAmount: '',
                            minOrderAmount: String(c.minOrderAmount),
                            isActive: c.isActive,
                          });
                          setModalOpen(true);
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="rounded-lg border border-slate-200 p-1.5 text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Coupon' : 'Create Coupon'} size="sm">
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Coupon Code *</label>
                <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Type</label>
                  <select value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as 'fixed' | 'percentage' }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Value *</label>
                  <input type="number" required min={1} value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Min Order (৳)</label>
                  <input type="number" min={0} value={form.minOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))} className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Max Discount Cap</label>
                  <input type="number" min={0} value={form.maxDiscountAmount} onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))} className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Save</button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onConfirm={async () => {
              if (!deleteTarget) return;
              await apiRequest(`/api/admin/coupons/${deleteTarget.id}`, { method: 'DELETE' });
              dispatch(showToast({ variant: 'info', message: 'Coupon deleted.' }));
              setDeleteTarget(null);
              load();
            }}
            title="Delete Coupon"
            message={`Delete coupon "${deleteTarget?.code}"?`}
            destructive
          />
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminCmsPage() {
  useSeoMeta({ title: 'Admin Homepage CMS | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [config, setConfig] = useState<HomepageConfigData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ ok: true; config: HomepageConfigData }>('/api/admin/cms/homepage')
      .then((res) => setConfig(res.config))
      .catch((err) => dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load CMS config.' })));
  }, [dispatch]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      await apiRequest('/api/admin/cms/homepage', { method: 'PUT', body: JSON.stringify(config) });
      dispatch(showToast({ variant: 'success', message: 'Homepage CMS configuration updated.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="CMS · Homepage Builder">
      <PermissionGuard permission="cms.manage">
        {!config ? (
          <p className="text-sm text-slate-500">Loading Homepage CMS settings...</p>
        ) : (
          <form onSubmit={handleSave} className="max-w-4xl space-y-6">
            {/* Announcement Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#0F1D3A]">Announcement Bar</h2>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={config.announcementBar.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, announcementBar: { ...config.announcementBar, enabled: e.target.checked } })
                    }
                  />
                  Enabled
                </label>
              </div>
              <input
                value={config.announcementBar.text}
                onChange={(e) =>
                  setConfig({ ...config, announcementBar: { ...config.announcementBar, text: e.target.value } })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Hero Slide 1 */}
            {config.heroSlides[0] && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0F1D3A]">Primary Hero Slide</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Badge text"
                    value={config.heroSlides[0].badgeText}
                    onChange={(e) => {
                      const slides = [...config.heroSlides];
                      slides[0] = { ...slides[0], badgeText: e.target.value };
                      setConfig({ ...config, heroSlides: slides });
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Headline Line 1"
                    value={config.heroSlides[0].headlineLine1}
                    onChange={(e) => {
                      const slides = [...config.heroSlides];
                      slides[0] = { ...slides[0], headlineLine1: e.target.value };
                      setConfig({ ...config, heroSlides: slides });
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Headline Line 2"
                    value={config.heroSlides[0].headlineLine2}
                    onChange={(e) => {
                      const slides = [...config.heroSlides];
                      slides[0] = { ...slides[0], headlineLine2: e.target.value };
                      setConfig({ ...config, heroSlides: slides });
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="CTA URL"
                    value={config.heroSlides[0].ctaUrl}
                    onChange={(e) => {
                      const slides = [...config.heroSlides];
                      slides[0] = { ...slides[0], ctaUrl: e.target.value };
                      setConfig({ ...config, heroSlides: slides });
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <CloudinaryImageField
                  label="Hero Showcase Artwork"
                  value={config.heroSlides[0].imageUrl}
                  folder="cms"
                  onChange={(url) => {
                    const slides = [...config.heroSlides];
                    slides[0] = { ...slides[0], imageUrl: url };
                    setConfig({ ...config, heroSlides: slides });
                  }}
                />
              </div>
            )}

            {/* Section Visibility */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-[#0F1D3A]">Homepage Section Visibility</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs font-semibold">
                {Object.entries(config.enabledSections || {}).map(([key, enabled]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(enabled)}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          enabledSections: { ...config.enabledSections, [key]: e.target.checked },
                        })
                      }
                    />
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]"
            >
              {saving ? 'Saving...' : 'Publish CMS Changes'}
            </button>
          </form>
        )}
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminAdsPage() {
  useSeoMeta({ title: 'Admin Promotional Placements | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [ads, setAds] = useState<PromotionalAdData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    altText: '',
    imageUrl: '',
    cloudinaryPublicId: '',
    destinationUrl: '/shop',
    placement: 'homepage_mid' as 'homepage_mid' | 'homepage_bottom',
    isEnabled: true,
    isPublished: false,
  });

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; ads: PromotionalAdData[] }>('/api/admin/ads');
      setAds(res.ads);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load placements.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiRequest(`/api/admin/ads/${editingId}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiRequest('/api/admin/ads', { method: 'POST', body: JSON.stringify(form) });
      }
      dispatch(showToast({ variant: 'success', message: 'Promotional placement saved.' }));
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    }
  };

  return (
    <AdminLayout title="Marketing · Promotional Placements">
      <PermissionGuard permission="ads.manage">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Optional banner slots; hidden on storefront unless enabled & published.</p>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ title: '', altText: '', imageUrl: '', cloudinaryPublicId: '', destinationUrl: '/shop', placement: 'homepage_mid', isEnabled: true, isPublished: false });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Placement
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ads.map((ad) => (
              <div key={ad.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-32 bg-slate-100">
                  <ResilientImage src={ad.imageUrl} alt={ad.altText} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-bold text-[#0F1D3A]">{ad.title}</p>
                    <p className="text-xs text-slate-500">
                      {ad.placement} · {ad.isEnabled && ad.isPublished ? 'Published Live' : 'Draft / Disabled'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(ad.id);
                      setForm({
                        title: ad.title,
                        altText: ad.altText,
                        imageUrl: ad.imageUrl,
                        cloudinaryPublicId: '',
                        destinationUrl: ad.destinationUrl,
                        placement: ad.placement,
                        isEnabled: ad.isEnabled,
                        isPublished: ad.isPublished,
                      });
                      setModalOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Placement' : 'New Placement'}>
            <form onSubmit={handleSave} className="space-y-3">
              <input required placeholder="Placement Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input required placeholder="Accessible Alt Text" value={form.altText} onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input required placeholder="Destination URL (/shop or https://...)" value={form.destinationUrl} onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <CloudinaryImageField label="Banner Image" value={form.imageUrl} folder="ads" onChange={(url, publicId) => setForm((f) => ({ ...f, imageUrl: url, cloudinaryPublicId: publicId || '' }))} />
              <div className="flex gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))} /> Enabled
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} /> Published
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Save</button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminSupportPage() {
  useSeoMeta({ title: 'Admin Support Enquiries | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [enquiries, setEnquiries] = useState<Array<{ id: string; name: string; email: string; subject: string; message: string; status: string; createdAt: string }>>([]);
  const [target, setTarget] = useState<(typeof enquiries)[0] | null>(null);
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('in_progress');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; enquiries: typeof enquiries }>('/api/admin/support');
      setEnquiries(res.enquiries);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load support enquiries.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    try {
      await apiRequest(`/api/admin/support/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, internalNote: note || undefined }),
      });
      dispatch(showToast({ variant: 'success', message: 'Enquiry updated.' }));
      setTarget(null);
      setNote('');
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Update failed.' }));
    }
  };

  return (
    <AdminLayout title="Support Enquiries">
      <PermissionGuard permission="support.manage">
        <div className="space-y-3">
          {enquiries.map((eq) => (
            <div key={eq.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#0F1D3A]">{eq.subject}</p>
                <p className="text-xs text-slate-500">
                  {eq.name} ({eq.email}) · <span className="capitalize font-semibold">{eq.status.replace('_', ' ')}</span>
                </p>
                <p className="mt-2 text-xs text-slate-700">{eq.message}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTarget(eq);
                  setStatus(eq.status as typeof status);
                }}
                className="rounded-lg bg-[#1155EE] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Manage
              </button>
            </div>
          ))}
        </div>

        <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Update Support Ticket" size="sm">
          <form onSubmit={handleUpdate} className="space-y-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal support note..." className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
              <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Save</button>
            </div>
          </form>
        </Modal>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminStaffPage() {
  useSeoMeta({ title: 'Admin Staff & Audit | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [staff, setStaff] = useState<Array<{ id: string; name: string; email: string; role: RoleName; status: string }>>([]);
  const [logs, setLogs] = useState<Array<{ _id: string; actorName: string; action: string; summary: string; createdAt: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'order_manager' as Exclude<RoleName, 'customer' | 'super_admin'> });

  const load = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        apiRequest<{ ok: true; staff: typeof staff }>('/api/admin/staff'),
        apiRequest<{ ok: true; logs: typeof logs }>('/api/admin/audit-logs'),
      ]);
      setStaff(sRes.staff);
      setLogs(lRes.logs);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load staff records.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/staff', { method: 'POST', body: JSON.stringify(form) });
      dispatch(showToast({ variant: 'success', message: 'Staff account created.' }));
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Create failed.' }));
    }
  };

  return (
    <AdminLayout title="Security · Staff RBAC & Audit Logs">
      <PermissionGuard permission="staff.manage">
        <div className="space-y-6">
          <div className="flex justify-end">
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
              <Plus className="h-4 w-4" /> Add Staff Member
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.email}</td>
                    <td className="px-4 py-3 capitalize font-semibold text-[#1155EE]">{s.role.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 capitalize">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-[#0F1D3A]">Audit Trail</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {logs.slice(0, 20).map((l) => (
                <li key={l._id} className="py-2 flex items-center justify-between gap-2">
                  <span>
                    <strong>{l.actorName}</strong> · {l.summary}
                  </span>
                  <span className="text-[11px] text-slate-400">{new Date(l.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Provision Staff Account" size="sm">
            <form onSubmit={handleCreate} className="space-y-3">
              <input required placeholder="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input required type="email" placeholder="Staff Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input required type="password" minLength={8} placeholder="Temporary Password (min 8)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof form.role }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="admin">Admin</option>
                <option value="order_manager">Order Manager</option>
                <option value="inventory_manager">Inventory Manager</option>
                <option value="catalog_manager">Catalog Manager</option>
                <option value="customer_support">Customer Support</option>
                <option value="finance_accounts">Finance & Accounts</option>
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Create Staff</button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminSettingsPage() {
  useSeoMeta({ title: 'Admin Settings | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [config, setConfig] = useState<HomepageConfigData | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ ok: true; config: HomepageConfigData; integrations: Record<string, boolean> }>('/api/admin/settings')
      .then((res) => {
        setConfig(res.config);
        setIntegrations(res.integrations || {});
      })
      .catch((err) => dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load settings.' })));
  }, [dispatch]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          shippingSettings: config.shippingSettings,
          contactInfo: config.contactInfo,
          seoDefaults: config.seoDefaults,
        }),
      });
      dispatch(showToast({ variant: 'success', message: 'Store settings updated.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Store Settings & Integrations">
      <PermissionGuard permission="settings.manage">
        <div className="max-w-4xl space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1155EE]" />
              <h2 className="font-display text-base font-bold text-[#0F1D3A]">External Integration Status</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
              {Object.entries(integrations).map(([key, configured]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="font-semibold capitalize">{key}</span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {configured ? 'Configured' : 'Missing Key'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {config && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0F1D3A]">Bangladesh Shipping Rates (৳)</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Dhaka Metro</label>
                    <input
                      type="number"
                      value={config.shippingSettings.dhakaMetroCharge}
                      onChange={(e) => setConfig({ ...config, shippingSettings: { ...config.shippingSettings, dhakaMetroCharge: Number(e.target.value) } })}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Dhaka Suburb</label>
                    <input
                      type="number"
                      value={config.shippingSettings.dhakaSuburbCharge}
                      onChange={(e) => setConfig({ ...config, shippingSettings: { ...config.shippingSettings, dhakaSuburbCharge: Number(e.target.value) } })}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Nationwide</label>
                    <input
                      type="number"
                      value={config.shippingSettings.nationwideCharge}
                      onChange={(e) => setConfig({ ...config, shippingSettings: { ...config.shippingSettings, nationwideCharge: Number(e.target.value) } })}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Free Shipping Over</label>
                    <input
                      type="number"
                      value={config.shippingSettings.freeShippingThreshold}
                      onChange={(e) => setConfig({ ...config, shippingSettings: { ...config.shippingSettings, freeShippingThreshold: Number(e.target.value) } })}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Express Surcharge</label>
                    <input
                      type="number"
                      value={config.shippingSettings.expressSurcharge}
                      onChange={(e) => setConfig({ ...config, shippingSettings: { ...config.shippingSettings, expressSurcharge: Number(e.target.value) } })}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={saving} className="rounded-xl bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
