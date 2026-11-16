import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tag,
  TicketPercent,
  Users,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logoutUser, openAuthModal } from '../features/auth/authSlice';
import { hasPermission, isStaffRole, type Permission } from '../lib/rbac';

interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Overview', permission: 'dashboard.view', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', permission: 'orders.view', icon: ShoppingBag },
  { to: '/admin/returns', label: 'Returns & Refunds', permission: 'orders.view', icon: RotateCcw },
  { to: '/admin/products', label: 'Products', permission: 'catalog.view', icon: Package },
  { to: '/admin/categories', label: 'Categories', permission: 'catalog.view', icon: FolderTree },
  { to: '/admin/brands', label: 'Brands', permission: 'catalog.view', icon: Tag },
  { to: '/admin/inventory', label: 'Inventory', permission: 'inventory.view', icon: Boxes },
  { to: '/admin/payments', label: 'Payments', permission: 'payments.view', icon: CreditCard },
  { to: '/admin/reports', label: 'Sales Reports', permission: 'reports.view', icon: BarChart3 },
  { to: '/admin/customers', label: 'Customers', permission: 'customers.view', icon: Users },
  { to: '/admin/reviews', label: 'Reviews', permission: 'reviews.moderate', icon: Star },
  { to: '/admin/coupons', label: 'Coupons', permission: 'marketing.manage', icon: TicketPercent },
  { to: '/admin/cms', label: 'Homepage CMS', permission: 'cms.manage', icon: LayoutTemplate },
  { to: '/admin/ads', label: 'Promo Placements', permission: 'ads.manage', icon: Megaphone },
  { to: '/admin/support', label: 'Support Enquiries', permission: 'support.manage', icon: MessageSquare },
  { to: '/admin/staff', label: 'Staff & Audit', permission: 'staff.manage', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Store Settings', permission: 'settings.manage', icon: Settings },
];

export function PermissionGuard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useAppSelector((s) => s.auth);
  if (!user || !hasPermission(user.role, permission, user.customPermissions)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
        <h2 className="font-display mt-3 text-lg font-bold text-[#0F1D3A]">Permission Required</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your role (<span className="font-semibold">{user?.role || 'guest'}</span>) does not include{' '}
          <code className="font-mono-tabular rounded bg-slate-100 px-1.5 py-0.5 text-xs">{permission}</code>.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const dispatch = useAppDispatch();
  const { user, initialized } = useAppSelector((s) => s.auth);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] text-sm text-slate-500">
        Verifying staff session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1155EE]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-display mt-4 text-xl font-bold text-[#0F1D3A]">NOVARA Admin Console</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with an authorized staff or administrator account to manage catalog, orders, and CMS.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => dispatch(openAuthModal({ tab: 'login', returnUrl: '/admin' }))}
              className="w-full rounded-xl bg-[#1155EE] py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]"
            >
              Sign In to Admin
            </button>
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isStaffRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] p-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-11 w-11 text-rose-600" />
          <h1 className="font-display mt-4 text-xl font-bold text-[#0F1D3A]">Access Denied (403)</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as <strong>{user.email}</strong> (Customer). Staff permissions are required for the admin portal.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-5 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  const visibleNav = ADMIN_NAV_ITEMS.filter((item) =>
    hasPermission(user.role, item.permission, user.customPermissions),
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B1730] text-slate-200">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <Link to="/admin" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1155EE] font-display text-sm font-extrabold text-white">
            N
          </div>
          <div>
            <p className="font-display text-sm font-extrabold tracking-tight text-white">NOVARA ADMIN</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{user.role.replace(/_/g, ' ')}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#1155EE] text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> View Storefront
        </Link>
        <button
          type="button"
          onClick={() => dispatch(logoutUser())}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F6F8FC] text-[#0F1D3A]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 w-64 max-w-[80vw]">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-bold text-[#0F1D3A]">{title || 'Admin Operations'}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-slate-500 sm:inline">{user.email}</span>
            <span className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-[#1155EE]">
              {user.name}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
