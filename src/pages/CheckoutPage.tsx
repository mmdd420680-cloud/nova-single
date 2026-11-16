import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Lock, MapPin, Plus, Truck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { openAuthModal } from '../features/auth/authSlice';
import { clearCartAfterOrder } from '../features/cart/cartSlice';
import { showToast } from '../features/notifications/toastSlice';
import { apiRequest } from '../services/api';
import type { SavedAddress } from '../types/commerce';
import {
  calculateShippingCharge,
  getAreasForUpazila,
  getDistrictsForDivision,
  getDivisionNames,
  getUpazilasForDistrict,
} from '../lib/bdLocations';
import { useSeoMeta } from '../lib/useSeoMeta';

export function CheckoutPage() {
  useSeoMeta({ title: 'Checkout | NOVARA COMMERCE', noIndex: true });

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, initialized } = useAppSelector((s) => s.auth);
  const { items, subtotal, discount, couponCode } = useAppSelector((s) => s.cart);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [saveNewAddress, setSaveNewAddress] = useState(true);

  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Dhanmondi');
  const [area, setArea] = useState('Kalabagan');
  const [house, setHouse] = useState('');
  const [road, setRoad] = useState('');
  const [landmark, setLandmark] = useState('');
  const [postalCode, setPostalCode] = useState('1205');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'sslcommerz'>('cod');
  const [submitting, setSubmitting] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);

  const idempotencyKey = useMemo(() => `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, []);

  useEffect(() => {
    if (initialized && !user) {
      dispatch(
        openAuthModal({
          tab: 'login',
          returnUrl: '/checkout',
          notice: 'Customer authentication is required before placing an order.',
        }),
      );
    }
  }, [initialized, user, dispatch]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setRecipientName((prev) => prev || user.name);
    setPhone((prev) => prev || user.phone || '');

    apiRequest<{ ok: true; addresses: SavedAddress[] }>('/api/account/addresses', { signal: controller.signal })
      .then((res) => {
        setAddresses(res.addresses);
        if (res.addresses.length > 0) {
          const def = res.addresses.find((a) => a.isDefault) || res.addresses[0];
          setSelectedAddressId(def.id);
        }
      })
      .catch(() => undefined);

    fetch('/api/health', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) return;
        const d = (await r.json()) as { integrations?: { paymentGateway?: boolean } };
        setGatewayConfigured(Boolean(d.integrations?.paymentGateway));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [user]);

  const activeAddress = useMemo(() => {
    if (selectedAddressId !== 'new') {
      const found = addresses.find((a) => a.id === selectedAddressId);
      if (found) return found;
    }
    return {
      recipientName,
      phone,
      division,
      district,
      upazila,
      area,
      house,
      road,
      landmark,
      postalCode,
      deliveryInstructions,
    };
  }, [
    selectedAddressId,
    addresses,
    recipientName,
    phone,
    division,
    district,
    upazila,
    area,
    house,
    road,
    landmark,
    postalCode,
    deliveryInstructions,
  ]);

  const shippingInfo = calculateShippingCharge({
    division: activeAddress.division || 'Dhaka',
    district: activeAddress.district || 'Dhaka',
    upazila: activeAddress.upazila || 'Dhanmondi',
    subtotal,
    deliveryMethod,
  });

  const finalTotal = Math.max(0, subtotal - discount + shippingInfo.charge);

  const handleDivisionChange = (nextDiv: string) => {
    setDivision(nextDiv);
    const dists = getDistrictsForDivision(nextDiv);
    const nextDist = dists[0]?.name || '';
    setDistrict(nextDist);
    const upas = getUpazilasForDistrict(nextDiv, nextDist);
    const nextUpa = upas[0]?.name || '';
    setUpazila(nextUpa);
    const areas = getAreasForUpazila(nextDiv, nextDist, nextUpa);
    setArea(areas[0]?.name || '');
    setPostalCode(areas[0]?.postalCode || '');
  };

  const handleDistrictChange = (nextDist: string) => {
    setDistrict(nextDist);
    const upas = getUpazilasForDistrict(division, nextDist);
    const nextUpa = upas[0]?.name || '';
    setUpazila(nextUpa);
    const areas = getAreasForUpazila(division, nextDist, nextUpa);
    setArea(areas[0]?.name || '');
    setPostalCode(areas[0]?.postalCode || '');
  };

  const handleUpazilaChange = (nextUpa: string) => {
    setUpazila(nextUpa);
    const areas = getAreasForUpazila(division, district, nextUpa);
    setArea(areas[0]?.name || '');
    setPostalCode(areas[0]?.postalCode || '');
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      dispatch(
        openAuthModal({
          tab: 'login',
          returnUrl: '/checkout',
          notice: 'Please sign in to place your order.',
        }),
      );
      return;
    }

    setSubmitting(true);
    try {
      // Save new address first if requested
      if (selectedAddressId === 'new' && saveNewAddress) {
        await apiRequest('/api/account/addresses', {
          method: 'POST',
          body: JSON.stringify({
            label: 'Home',
            recipientName,
            phone,
            division,
            district,
            upazila,
            area,
            house,
            road,
            landmark,
            postalCode,
            deliveryInstructions,
            isDefault: addresses.length === 0,
          }),
        }).catch(() => undefined);
      }

      const res = await apiRequest<{ ok: true; order: { id: string; orderNumber: string }; gatewayUrl?: string | null }>(
        '/api/orders/checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            idempotencyKey,
            deliveryMethod,
            paymentMethod,
            couponCode,
            shippingAddress: {
              recipientName: activeAddress.recipientName,
              phone: activeAddress.phone,
              division: activeAddress.division,
              district: activeAddress.district,
              upazila: activeAddress.upazila,
              area: activeAddress.area,
              house: activeAddress.house,
              road: activeAddress.road,
              landmark: activeAddress.landmark,
              postalCode: activeAddress.postalCode,
              deliveryInstructions: activeAddress.deliveryInstructions,
            },
            items: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId || null,
              quantity: i.quantity,
            })),
          }),
        },
      );

      dispatch(clearCartAfterOrder());
      if (res.gatewayUrl) {
        window.location.href = res.gatewayUrl;
        return;
      }

      dispatch(showToast({ variant: 'success', message: `Order ${res.order.orderNumber} placed successfully!` }));
      navigate(`/account/orders/${res.order.id}`);
    } catch (err) {
      dispatch(
        showToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Checkout failed. Please review your details.',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Lock className="mx-auto h-12 w-12 text-[#1155EE]" />
        <h1 className="font-display mt-4 text-2xl font-bold text-[#0F1D3A]">Sign In Required for Checkout</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your cart items are preserved. Sign in or register an account to enter your Bangladesh delivery address and place your order.
        </p>
        <button
          type="button"
          onClick={() => dispatch(openAuthModal({ tab: 'login', returnUrl: '/checkout' }))}
          className="mt-6 rounded-full bg-[#1155EE] px-7 py-2.5 text-sm font-semibold text-white"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0F1D3A]">No Items to Checkout</h1>
        <Link to="/shop" className="mt-5 inline-block rounded-full bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white">
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-8">
      <h1 className="font-display mb-6 text-2xl font-bold text-[#0F1D3A]">Secure Checkout</h1>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Saved Addresses & Bangladesh Address Hierarchy */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#1155EE]" />
              <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Delivery Address (Bangladesh)</h2>
            </div>

            {addresses.length > 0 && (
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
                      selectedAddressId === addr.id
                        ? 'border-[#1155EE] bg-[#E9F0FD]/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F1D3A]">
                        {addr.label} {addr.isDefault ? '· Default' : ''}
                      </span>
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#0F1D3A]">{addr.recipientName}</p>
                    <p className="text-xs text-slate-600">{addr.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {addr.house}{addr.road ? `, ${addr.road}` : ''}, {addr.area}, {addr.upazila}, {addr.district}, {addr.division}
                    </p>
                  </label>
                ))}

                <button
                  type="button"
                  onClick={() => setSelectedAddressId('new')}
                  className={`flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-semibold ${
                    selectedAddressId === 'new'
                      ? 'border-[#1155EE] bg-[#E9F0FD]/50 text-[#1155EE]'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Deliver to a New Address
                </button>
              </div>
            )}

            {selectedAddressId === 'new' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 17XX-XXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Division *</label>
                  <select
                    value={division}
                    onChange={(e) => handleDivisionChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {getDivisionNames().map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">District *</label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {getDistrictsForDivision(division).map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Upazila / Thana *</label>
                  <select
                    value={upazila}
                    onChange={(e) => handleUpazilaChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {getUpazilasForDistrict(division, district).map((u) => (
                      <option key={u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Union / Ward / Area *</label>
                  <select
                    value={area}
                    onChange={(e) => {
                      const val = e.target.value;
                      setArea(val);
                      const found = getAreasForUpazila(division, district, upazila).find((a) => a.name === val);
                      if (found?.postalCode) setPostalCode(found.postalCode);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {getAreasForUpazila(division, district, upazila).map((a) => (
                      <option key={a.name} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">House / Building / Flat *</label>
                  <input
                    type="text"
                    required
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder="House 14, Apt 4B"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Road / Street</label>
                  <input
                    type="text"
                    value={road}
                    onChange={(e) => setRoad(e.target.value)}
                    placeholder="Road 7"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Landmark</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near Central Mosque"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Delivery Instructions</label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="Call upon arrival"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveNewAddress}
                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                  />
                  Save this address to my NOVARA account for future orders
                </label>
              </div>
            )}
          </section>

          {/* Delivery Method */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#1155EE]" />
              <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Delivery Speed</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                  deliveryMethod === 'standard' ? 'border-[#1155EE] bg-[#E9F0FD]/60' : 'border-slate-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-[#0F1D3A]">Standard Courier</p>
                  <p className="text-xs text-slate-500">Free on orders ≥ ৳999</p>
                </div>
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={deliveryMethod === 'standard'}
                  onChange={() => setDeliveryMethod('standard')}
                />
              </label>

              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                  deliveryMethod === 'express' ? 'border-[#1155EE] bg-[#E9F0FD]/60' : 'border-slate-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-[#0F1D3A]">Priority Express (+৳80)</p>
                  <p className="text-xs text-slate-500">Fast-track dispatch</p>
                </div>
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={deliveryMethod === 'express'}
                  onChange={() => setDeliveryMethod('express')}
                />
              </label>
            </div>
          </section>

          {/* Payment Method */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1155EE]" />
              <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Payment Method</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                  paymentMethod === 'cod' ? 'border-[#1155EE] bg-[#E9F0FD]/60' : 'border-slate-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-[#0F1D3A]">Cash on Delivery (COD)</p>
                  <p className="text-xs text-slate-500">Pay cash upon courier delivery</p>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
              </label>

              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                  paymentMethod === 'sslcommerz'
                    ? 'border-[#1155EE] bg-[#E9F0FD]/60'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-[#0F1D3A]">
                    SSLCommerz (Cards, bKash, Nagad)
                  </p>
                  <p className="text-xs text-slate-500">
                    {gatewayConfigured
                      ? 'Verified online gateway redirect'
                      : 'Requires PAYMENT_STORE_ID & PASSWORD env config'}
                  </p>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'sslcommerz'}
                  onChange={() => setPaymentMethod('sslcommerz')}
                />
              </label>
            </div>
          </section>
        </div>

        {/* Itemized Summary */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 lg:self-start">
          <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Order Summary</h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variantId || 'default'}`} className="flex justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0F1D3A]">
                    {item.quantity} × {item.name}
                  </p>
                  {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                </div>
                <span className="font-mono-tabular shrink-0 font-semibold">
                  ৳{(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-mono-tabular font-semibold">৳{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({couponCode})</span>
                <span className="font-mono-tabular font-semibold">-৳{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Shipping ({shippingInfo.estimatedDays})</span>
              <span className="font-mono-tabular font-semibold">
                {shippingInfo.charge === 0 ? 'FREE' : `৳${shippingInfo.charge}`}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-[#0F1D3A]">
              <span>Final Total</span>
              <span className="font-mono-tabular text-[#1155EE]">৳{finalTotal.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1155EE] py-3 text-sm font-semibold text-white hover:bg-[#0B44CC] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{submitting ? 'Confirming Order...' : 'Confirm & Place Order'}</span>
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            All prices, coupons, and stock availability are verified by the server at confirmation.
          </p>
        </aside>
      </form>
    </div>
  );
}
