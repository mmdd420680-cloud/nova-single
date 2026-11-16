import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchCurrentUser } from './features/auth/authSlice';
import { fetchServerCart } from './features/cart/cartSlice';
import { StorefrontLayout } from './layouts/StorefrontLayout';
import { AuthModal } from './features/auth/AuthModal';
import { CartDrawer } from './features/cart/CartDrawer';
import { ToastContainer } from './components/feedback/ToastContainer';

import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import {
  AccountProfilePage,
  OrderDetailPage,
  OrderHistoryPage,
  SavedAddressesPage,
  WishlistPage,
} from './pages/AccountPages';
import {
  CmsStaticPage,
  ContactPage,
  NotFoundPage,
  TrackOrderPage,
} from './pages/SupportAndInfoPages';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import {
  AdminBrandsPage,
  AdminCategoriesPage,
  AdminInventoryPage,
  AdminProductsPage,
} from './pages/admin/AdminCatalogPages';
import {
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminReturnsPage,
} from './pages/admin/AdminOperationsPages';
import {
  AdminAdsPage,
  AdminCmsPage,
  AdminCouponsPage,
  AdminCustomersPage,
  AdminReviewsPage,
  AdminSettingsPage,
  AdminStaffPage,
  AdminSupportPage,
} from './pages/admin/AdminGrowthAndCmsPages';

function AppBootstrap() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      dispatch(fetchServerCart());
    }
  }, [dispatch, user]);

  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppBootstrap />
        <Routes>
          {/* Storefront Customer Routes */}
          <Route
            path="/"
            element={
              <StorefrontLayout>
                <HomePage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/shop"
            element={
              <StorefrontLayout>
                <ShopPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/category/:slug"
            element={
              <StorefrontLayout>
                <ShopPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/product/:slug"
            element={
              <StorefrontLayout>
                <ProductDetailPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/cart"
            element={
              <StorefrontLayout>
                <CartPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/checkout"
            element={
              <StorefrontLayout>
                <CheckoutPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/wishlist"
            element={
              <StorefrontLayout>
                <WishlistPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/track-order"
            element={
              <StorefrontLayout>
                <TrackOrderPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/contact"
            element={
              <StorefrontLayout>
                <ContactPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/pages/:slug"
            element={
              <StorefrontLayout>
                <CmsStaticPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/account"
            element={
              <StorefrontLayout>
                <AccountProfilePage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/account/orders"
            element={
              <StorefrontLayout>
                <OrderHistoryPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/account/orders/:id"
            element={
              <StorefrontLayout>
                <OrderDetailPage />
              </StorefrontLayout>
            }
          />
          <Route
            path="/account/addresses"
            element={
              <StorefrontLayout>
                <SavedAddressesPage />
              </StorefrontLayout>
            }
          />

          {/* Admin Operations Portal Routes */}
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/brands" element={<AdminBrandsPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/returns" element={<AdminReturnsPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/customers" element={<AdminCustomersPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/coupons" element={<AdminCouponsPage />} />
          <Route path="/admin/cms" element={<AdminCmsPage />} />
          <Route path="/admin/ads" element={<AdminAdsPage />} />
          <Route path="/admin/support" element={<AdminSupportPage />} />
          <Route path="/admin/staff" element={<AdminStaffPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />

          {/* 404 Fallback */}
          <Route
            path="*"
            element={
              <StorefrontLayout>
                <NotFoundPage />
              </StorefrontLayout>
            }
          />
        </Routes>

        {/* Global Overlays */}
        <AuthModal />
        <CartDrawer />
        <ToastContainer />
      </BrowserRouter>
    </Provider>
  );
}
