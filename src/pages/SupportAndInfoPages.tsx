import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Mail, MapPin, MessageSquare, Phone, RefreshCw, Search } from 'lucide-react';
import { ApiError, apiRequest, isAbortError } from '../services/api';
import { useAppDispatch } from '../app/hooks';
import { showToast } from '../features/notifications/toastSlice';
import type { HomepageConfigData, OrderRecord } from '../types/commerce';
import { useSeoMeta } from '../lib/useSeoMeta';

export function TrackOrderPage() {
  useSeoMeta({ title: 'Track Your Order | NOVARA COMMERCE' });
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>('/api/orders/track', {
        method: 'POST',
        body: JSON.stringify({ orderNumber, contact }),
      });
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to find matching order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-[#0F1D3A]">Track Your Order</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your NOVARA order number and the email or phone number used during checkout.
        </p>

        <form onSubmit={handleTrack} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Order Number *</label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="e.g. NVR-261116-A1B2C3"
              className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email or Phone Number *</label>
            <input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email address or +880 phone number"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1155EE] py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? 'Searching...' : 'Track Order'}</span>
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {order && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-base font-bold text-[#0F1D3A]">{order.orderNumber}</span>
              <span className="rounded-lg bg-[#E9F0FD] px-3 py-1 text-xs font-bold uppercase text-[#1155EE]">
                {order.orderStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Destination: {order.shippingAddress?.district}, {order.shippingAddress?.division} · Total: ৳{order.total.toLocaleString()}
            </p>
            <ul className="mt-4 space-y-2.5">
              {order.statusHistory.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold uppercase text-[#0F1D3A]">{step.toStatus.replace('_', ' ')}</p>
                    <p className="text-slate-500">{new Date(step.timestamp).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContactPage() {
  useSeoMeta({ title: 'Contact & Support | NOVARA COMMERCE' });
  const dispatch = useAppDispatch();

  const [contactInfo, setContactInfo] = useState<HomepageConfigData['contactInfo'] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ ok: true; settings: { contactInfo?: HomepageConfigData['contactInfo'] } | null }>('/api/storefront/navigation', {
      signal: controller.signal,
    })
      .then((res) => setContactInfo(res.settings?.contactInfo || null))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: true; ticketId: string; message: string }>('/api/storefront/support/enquiry', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, subject, orderNumber, message, websiteHoneyPot: honeypot }),
      });
      dispatch(showToast({ variant: 'success', message: `${res.message} (Ref: ${res.ticketId.slice(-6)})` }));
      setSubject('');
      setOrderNumber('');
      setMessage('');
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to send enquiry' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <h1 className="font-display text-3xl font-bold text-[#0F1D3A]">Customer Support</h1>
          <p className="text-sm text-slate-600">
            Have a question about an order, product warranty, or delivery across Bangladesh? Send us an enquiry and our support team will assist you.
          </p>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[#1155EE]" />
              <span>{contactInfo?.email || 'support@novara.com.bd'}</span>
            </div>
            {contactInfo?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#1155EE]" />
                <span>{contactInfo.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-[#1155EE]" />
              <span>{contactInfo?.address || 'Dhaka, Bangladesh'}</span>
            </div>
          </div>

          {(contactInfo?.whatsappUrl || contactInfo?.messengerUrl || contactInfo?.instagramUrl || contactInfo?.linkedinUrl) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-display mb-3 text-sm font-bold text-[#0F1D3A]">Official Channels</h2>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {contactInfo?.whatsappUrl && (
                  <a href={contactInfo.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                    WhatsApp
                  </a>
                )}
                {contactInfo?.messengerUrl && (
                  <a href={contactInfo.messengerUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-50 px-3 py-2 text-[#1155EE]">
                    Messenger
                  </a>
                )}
                {contactInfo?.instagramUrl && (
                  <a href={contactInfo.instagramUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                    Instagram
                  </a>
                )}
                {contactInfo?.linkedinUrl && (
                  <a href={contactInfo.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#1155EE]" />
            <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Send a Support Enquiry</h2>
          </div>

          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name *" className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your Email *" className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Order Number (optional)" className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
          </div>
          <input type="text" required minLength={3} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject *" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
          <textarea required minLength={10} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help you?" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />

          <button type="submit" disabled={submitting} className="rounded-xl bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]">
            {submitting ? 'Submitting...' : 'Submit Enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CmsStaticPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<{ title: string; content: string; seoTitle?: string; seoDescription?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSeoMeta({
    title: page ? `${page.seoTitle || page.title} | NOVARA COMMERCE` : 'Information | NOVARA COMMERCE',
    description: page?.seoDescription,
  });

  const loadPage = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const res = await apiRequest<{ ok: true; page: { title: string; content: string; seoTitle?: string; seoDescription?: string } }>(
          `/api/storefront/pages/${slug}`,
          { signal },
        );
        setPage(res.page);
      } catch (err) {
        if (isAbortError(err)) return;
        setPage(null);
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load this page right now.');
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPage(controller.signal);
    return () => controller.abort();
  }, [loadPage]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500">Loading page...</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-9 w-9 text-rose-500" />
          <h1 className="font-display mt-3 text-xl font-bold text-[#0F1D3A]">Unable to Load Page</h1>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => loadPage()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (notFound || !page) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <article className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-10">
        <h1 className="font-display text-2xl font-bold text-[#0F1D3A] sm:text-3xl">{page.title}</h1>
        <div className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{page.content}</div>
      </article>
    </div>
  );
}

export function NotFoundPage() {
  useSeoMeta({ title: 'Page Not Found | NOVARA COMMERCE', noIndex: true });
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-mono-tabular text-4xl font-extrabold text-[#1155EE]">404</p>
      <h1 className="font-display mt-2 text-2xl font-bold text-[#0F1D3A]">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-600">The page or product you requested does not exist or has been archived.</p>
      <Link to="/" className="mt-6 inline-block rounded-full bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white">
        Return Home
      </Link>
    </div>
  );
}
