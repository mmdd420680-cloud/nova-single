import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Eye, Printer, Search, Truck } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../layouts/AdminLayout';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/notifications/toastSlice';
import { Modal } from '../../components/ui/Modal';
import type { OrderRecord } from '../../types/commerce';
import { useSeoMeta } from '../../lib/useSeoMeta';

export function AdminOrdersPage() {
  useSeoMeta({ title: 'Admin Orders | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<OrderRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled'>('confirmed');
  const [courierName, setCourierName] = useState('Steadfast Courier');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [staffNote, setStaffNote] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (statusFilter) qs.set('status', statusFilter);
      const res = await apiRequest<{ ok: true; orders: OrderRecord[] }>(`/api/admin/orders?${qs.toString()}`);
      setOrders(res.orders);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load orders.' }));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dispatch]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusTarget) return;
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/admin/orders/${statusTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextStatus,
          courierName: nextStatus === 'shipped' ? courierName : undefined,
          trackingNumber: nextStatus === 'shipped' ? trackingNumber : undefined,
          reason: statusReason || undefined,
        }),
      });
      dispatch(showToast({ variant: 'success', message: `Order ${res.order.orderNumber} updated to ${nextStatus}.` }));
      setStatusTarget(null);
      setStatusReason('');
      setTrackingNumber('');
      loadOrders();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Transition failed.' }));
    }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !staffNote.trim()) return;
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/admin/orders/${selectedOrder.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: staffNote }),
      });
      setSelectedOrder(res.order);
      setStaffNote('');
      dispatch(showToast({ variant: 'success', message: 'Internal staff note saved.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to save note.' }));
    }
  };

  return (
    <AdminLayout title="Operations · Orders & Fulfillment">
      <PermissionGuard permission="orders.view">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, customer name, email, phone..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="return_requested">Return Requested</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order #</th>
                    <th className="px-4 py-3 font-semibold">Customer & Zone</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-mono-tabular font-bold text-[#0F1D3A]">{o.orderNumber}</p>
                          <p className="text-[11px] text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0F1D3A]">{o.customerName}</p>
                          <p className="text-[11px] text-slate-500">
                            {o.shippingAddress.district}, {o.shippingAddress.division} · {o.customerPhone}
                          </p>
                        </td>
                        <td className="px-4 py-3 uppercase">
                          <span className="font-semibold">{o.paymentMethod}</span>{' '}
                          <span
                            className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              o.paymentStatus === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td className="font-mono-tabular px-4 py-3 font-bold text-[#0F1D3A]">
                          ৳{o.total.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-[#1155EE]">
                            {o.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusTarget(o);
                              setNextStatus(
                                o.orderStatus === 'pending'
                                  ? 'confirmed'
                                  : o.orderStatus === 'confirmed'
                                    ? 'processing'
                                    : o.orderStatus === 'processing'
                                      ? 'packed'
                                      : o.orderStatus === 'packed'
                                        ? 'shipped'
                                        : 'delivered',
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1155EE] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0B44CC]"
                          >
                            <Truck className="h-3.5 w-3.5" /> Fulfill
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Detail & Printable Invoice Modal */}
          <Modal
            open={Boolean(selectedOrder)}
            onClose={() => setSelectedOrder(null)}
            title={`Order Invoice · ${selectedOrder?.orderNumber || ''}`}
            size="lg"
          >
            {selectedOrder && (
              <div className="space-y-5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <p className="font-bold text-[#0F1D3A]">{selectedOrder.shippingAddress.recipientName}</p>
                    <p className="text-xs text-slate-600">
                      {selectedOrder.shippingAddress.house}, {selectedOrder.shippingAddress.area},{' '}
                      {selectedOrder.shippingAddress.upazila}, {selectedOrder.shippingAddress.district},{' '}
                      {selectedOrder.shippingAddress.division}
                    </p>
                    <p className="text-xs text-slate-500">Phone: {selectedOrder.shippingAddress.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Invoice
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 font-semibold">SKU</th>
                        <th className="px-3 py-2 text-right font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-[#0F1D3A]">{item.name}</td>
                          <td className="font-mono-tabular px-3 py-2 text-slate-500">{item.sku}</td>
                          <td className="font-mono-tabular px-3 py-2 text-right">{item.quantity}</td>
                          <td className="font-mono-tabular px-3 py-2 text-right">৳{item.unitPrice.toLocaleString('en-IN')}</td>
                          <td className="font-mono-tabular px-3 py-2 text-right font-bold">
                            ৳{item.lineTotal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col items-end space-y-1 text-xs">
                  <p>Subtotal: <strong className="font-mono-tabular">৳{selectedOrder.subtotal.toLocaleString('en-IN')}</strong></p>
                  <p>Discount: <strong className="font-mono-tabular">-৳{selectedOrder.discount.toLocaleString('en-IN')}</strong></p>
                  <p>Shipping: <strong className="font-mono-tabular">৳{selectedOrder.shippingCharge.toLocaleString('en-IN')}</strong></p>
                  <p className="text-base font-extrabold text-[#1155EE]">
                    Grand Total: <span className="font-mono-tabular">৳{selectedOrder.total.toLocaleString('en-IN')}</span>
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Internal Staff Notes</h4>
                  {(selectedOrder.staffNotes || []).map((n, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <p className="text-[#0F1D3A]">{n.note}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {n.actorName} · {new Date(n.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      value={staffNote}
                      onChange={(e) => setStaffNote(e.target.value)}
                      placeholder="Add private operational note..."
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button type="submit" className="rounded-xl bg-[#0B1730] px-3.5 py-1.5 text-xs font-semibold text-white">
                      Save Note
                    </button>
                  </form>
                </div>
              </div>
            )}
          </Modal>

          {/* Status Transition Modal */}
          <Modal
            open={Boolean(statusTarget)}
            onClose={() => setStatusTarget(null)}
            title={`Update Fulfillment · ${statusTarget?.orderNumber || ''}`}
            size="sm"
          >
            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Next Order Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {nextStatus === 'shipped' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Courier Partner</label>
                    <input
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Tracking Number</label>
                    <input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. SF-BD-984122"
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold">Reason / Note (Optional)</label>
                <input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStatusTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
                  Confirm Update
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminReturnsPage() {
  useSeoMeta({ title: 'Admin Returns | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [returns, setReturns] = useState<Array<{ id: string; orderNumber: string; reason: string; status: string; refundAmount: number; restocked: boolean; createdAt: string }>>([]);
  const [inspectTarget, setInspectTarget] = useState<(typeof returns)[0] | null>(null);
  const [status, setStatus] = useState<'approved' | 'rejected' | 'received' | 'refunded'>('approved');
  const [restockEligible, setRestockEligible] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ ok: true; returns: typeof returns }>('/api/admin/returns');
      setReturns(res.returns);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load returns.' }));
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!inspectTarget) return;
    try {
      await apiRequest(`/api/admin/returns/${inspectTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, restockEligible, inspectionNotes: notes }),
      });
      dispatch(showToast({ variant: 'success', message: 'Return workflow updated.' }));
      setInspectTarget(null);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Update failed.' }));
    }
  };

  return (
    <AdminLayout title="Operations · Returns & Refunds">
      <PermissionGuard permission="orders.view">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Refund Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Restocked</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No return requests submitted yet.
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono-tabular px-4 py-3 font-bold">{r.orderNumber}</td>
                    <td className="px-4 py-3">{r.reason}</td>
                    <td className="font-mono-tabular px-4 py-3">৳{r.refundAmount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{r.status}</td>
                    <td className="px-4 py-3">{r.restocked ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectTarget(r);
                          setStatus('received');
                          setRestockEligible(false);
                          setNotes('');
                        }}
                        className="rounded-lg bg-[#1155EE] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal open={Boolean(inspectTarget)} onClose={() => setInspectTarget(null)} title={`Inspect Return · ${inspectTarget?.orderNumber || ''}`} size="sm">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Return Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="approved">Approved (Awaiting Return)</option>
                <option value="received">Physically Received & Inspected</option>
                <option value="refunded">Refund Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {status === 'received' && (
              <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
                <input type="checkbox" checked={restockEligible} onChange={(e) => setRestockEligible(e.target.checked)} />
                Item passed physical QA inspection & is eligible for resale restock
              </label>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold">Inspection Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInspectTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
                Save Decision
              </button>
            </div>
          </form>
        </Modal>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminPaymentsPage() {
  useSeoMeta({ title: 'Admin Payments | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const [txns, setTxns] = useState<Array<{ id: string; orderNumber: string; transactionId: string; gateway: string; method: string; amount: number; status: string; createdAt: string }>>([]);

  useEffect(() => {
    apiRequest<{ ok: true; transactions: typeof txns }>('/api/admin/payments')
      .then((res) => setTxns(res.transactions))
      .catch((err) => dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to load payments.' })));
  }, [dispatch]);

  return (
    <AdminLayout title="Finance · Payment Transactions">
      <PermissionGuard permission="payments.view">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Transaction ID</th>
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Gateway / Method</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No gateway transactions recorded yet.
                  </td>
                </tr>
              ) : (
                txns.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono-tabular px-4 py-3 font-semibold">{t.transactionId}</td>
                    <td className="font-mono-tabular px-4 py-3">{t.orderNumber}</td>
                    <td className="px-4 py-3 uppercase">
                      {t.gateway} · {t.method}
                    </td>
                    <td className="font-mono-tabular px-4 py-3 font-bold">৳{t.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 capitalize">{t.status}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}

export function AdminReportsPage() {
  useSeoMeta({ title: 'Admin Reports | NOVARA COMMERCE', noIndex: true });
  return (
    <AdminLayout title="Finance · Sales Reports">
      <PermissionGuard permission="reports.view">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Export Operational & Sales CSV</h2>
          <p className="text-sm text-slate-600">
            Download complete order accounting data including subtotal, coupon discounts, Bangladesh shipping zones, payment statuses, and grand totals.
          </p>
          <a
            href="/api/admin/reports/sales-csv"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1155EE] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]"
          >
            <Download className="h-4 w-4" /> Download Sales Ledger (.csv)
          </a>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
