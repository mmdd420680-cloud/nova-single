import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  DollarSign,
  PackageX,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { AdminLayout, PermissionGuard } from '../../layouts/AdminLayout';
import { useSeoMeta } from '../../lib/useSeoMeta';

interface OverviewResponse {
  ok: true;
  periodDays: number;
  metrics: {
    grossSales: number;
    netSales: number;
    orderCount: number;
    activeOrderCount: number;
    avgOrderValue: number;
    pendingOrders: number;
    lowStockCount: number;
    outOfStockCount: number;
    cancelledCount: number;
    returnedCount: number;
    paidTotal: number;
    codPendingTotal: number;
  };
  lowStockProducts: Array<{
    _id: string;
    name: string;
    sku: string;
    stockOnHand: number;
    reservedStock: number;
    lowStockThreshold: number;
  }>;
  recentAudit: Array<{
    _id: string;
    actorName: string;
    actorRole: string;
    action: string;
    summary: string;
    createdAt: string;
  }>;
}

export function AdminOverviewPage() {
  useSeoMeta({ title: 'Admin Overview | NOVARA COMMERCE', noIndex: true });
  const [days, setDays] = useState(30);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest<OverviewResponse>(`/api/admin/overview?days=${days}`)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.'))
      .finally(() => setLoading(false));
  }, [days]);

  const m = data?.metrics;

  return (
    <AdminLayout title="Operations Overview">
      <PermissionGuard permission="dashboard.view">
        <div className="space-y-6">
          {/* Period Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Business Performance</h2>
              <p className="text-xs text-slate-500">
                Net sales exclude cancelled and returned orders; available stock deducts active reservations.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    days === d ? 'bg-[#1155EE] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Last {d}d
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : (
            m && (
              <>
                {/* Primary KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Net Sales ({days}d)</span>
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[#0F1D3A]">
                      ৳{m.netSales.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gross: ৳{m.grossSales.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Orders ({days}d)</span>
                      <ShoppingBag className="h-4 w-4 text-[#1155EE]" />
                    </div>
                    <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[#0F1D3A]">
                      {m.orderCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Avg Order Value: ৳{m.avgOrderValue.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Pending Fulfillment</span>
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[#0F1D3A]">
                      {m.pendingOrders}
                    </p>
                    <Link
                      to="/admin/orders"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline"
                    >
                      Manage Queue <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Collections & COD</span>
                      <DollarSign className="h-4 w-4 text-indigo-600" />
                    </div>
                    <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[#0F1D3A]">
                      ৳{m.paidTotal.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      COD Uncollected: ৳{m.codPendingTotal.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Operational Alerts & Audit Row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Low Stock Alerts */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h3 className="font-display text-base font-bold text-[#0F1D3A]">
                          Low & Out-of-Stock Alerts
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        <PackageX className="h-3.5 w-3.5" /> {m.outOfStockCount} Out of Stock
                      </span>
                    </div>

                    {data.lowStockProducts.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">All published products are above threshold.</p>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 font-semibold">SKU</th>
                              <th className="py-2 font-semibold">Product</th>
                              <th className="py-2 text-right font-semibold">Available</th>
                              <th className="py-2 text-right font-semibold">Reserved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.lowStockProducts.map((p) => {
                              const avail = Math.max(0, p.stockOnHand - p.reservedStock);
                              return (
                                <tr key={p._id}>
                                  <td className="font-mono-tabular py-2.5 text-slate-600">{p.sku}</td>
                                  <td className="py-2.5 font-medium text-[#0F1D3A]">{p.name}</td>
                                  <td className="font-mono-tabular py-2.5 text-right font-bold text-rose-600">
                                    {avail}
                                  </td>
                                  <td className="font-mono-tabular py-2.5 text-right text-slate-500">
                                    {p.reservedStock}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-4">
                      <Link to="/admin/inventory" className="text-xs font-semibold text-[#1155EE] hover:underline">
                        Open Inventory & Stock Adjustments →
                      </Link>
                    </div>
                  </div>

                  {/* Recent Audit Logs */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-base font-bold text-[#0F1D3A]">Recent Staff Activity</h3>
                    {data.recentAudit.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">No audit entries recorded yet.</p>
                    ) : (
                      <ul className="mt-4 divide-y divide-slate-100 text-xs">
                        {data.recentAudit.map((log) => (
                          <li key={log._id} className="py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#0F1D3A]">{log.summary}</span>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {log.actorName} ({log.actorRole}) · <code className="font-mono-tabular">{log.action}</code>
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
