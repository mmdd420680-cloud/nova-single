import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/notifications/toastSlice';
import type { HomepageConfigData } from '../../types/commerce';

interface StoreFooterProps {
  contactInfo?: HomepageConfigData['contactInfo'];
}

export function StoreFooter({ contactInfo }: StoreFooterProps) {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: true; message: string }>('/api/storefront/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      dispatch(showToast({ variant: 'success', message: res.message }));
      setEmail('');
    } catch (err) {
      dispatch(
        showToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to subscribe right now.',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="mt-12">
      {/* Newsletter Subscription Band (Royal Blue) */}
      <section className="bg-gradient-to-r from-[#0C3CAE] via-[#1155EE] to-[#0B359E] text-white">
        <div className="mx-auto flex max-w-[1380px] flex-col items-start justify-between gap-6 px-4 py-7 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Subscribe to Our Newsletter</h2>
              <p className="text-xs text-blue-100">Get the latest updates, offers and more.</p>
            </div>
          </div>

          <form onSubmit={handleSubscribe} className="flex w-full max-w-lg items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Newsletter email address"
              className="h-11 flex-1 rounded-lg bg-white px-4 text-sm text-[#0F1D3A] placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#1D6BFF] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B44CC] disabled:opacity-60"
            >
              <span>{submitting ? 'Saving...' : 'Subscribe'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Main Dark Navy Footer */}
      <div className="bg-[#0B1730] text-slate-300">
        <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Link to="/" className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1155EE]">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">NOVARA</span>
            </Link>
            <p className="mt-3 text-xs font-semibold text-white">Shop Smart. Live Better.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Your trusted online shopping destination in Bangladesh for genuine technology, fashion, books, and lifestyle goods.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {contactInfo?.facebookUrl && (
                <a href={contactInfo.facebookUrl} target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                  Facebook
                </a>
              )}
              {contactInfo?.instagramUrl && (
                <a href={contactInfo.instagramUrl} target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                  Instagram
                </a>
              )}
              {contactInfo?.linkedinUrl && (
                <a href={contactInfo.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                  LinkedIn
                </a>
              )}
              {contactInfo?.whatsappUrl && (
                <a href={contactInfo.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white">Quick Links</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/" className="hover:text-white">Home</Link></li>
              <li><Link to="/shop" className="hover:text-white">Shop</Link></li>
              <li><Link to="/pages/about-us" className="hover:text-white">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white">Customer Care</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/pages/faqs" className="hover:text-white">FAQs</Link></li>
              <li><Link to="/pages/shipping-info" className="hover:text-white">Shipping Info</Link></li>
              <li><Link to="/pages/return-policy" className="hover:text-white">Return Policy</Link></li>
              <li><Link to="/track-order" className="hover:text-white">Track Order</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white">Get In Touch</h3>
            <ul className="mt-3 space-y-2.5 text-xs">
              {contactInfo?.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>{contactInfo.phone}</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>{contactInfo?.email || 'support@novara.com.bd'}</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>{contactInfo?.address || 'Dhaka, Bangladesh'}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-white">Secure Payments</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded bg-white px-2.5 py-1 text-[#1A1F71]">VISA</span>
              <span className="rounded bg-white px-2.5 py-1 text-[#EB001B]">Mastercard</span>
              <span className="rounded bg-[#E2136E] px-2.5 py-1 text-white">bKash</span>
              <span className="rounded bg-emerald-600 px-2.5 py-1 text-white">COD</span>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Verified SSL-encrypted checkout and Cash on Delivery across Bangladesh.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-white/10 bg-[#071024] text-slate-400">
        <div className="mx-auto flex max-w-[1380px] flex-col items-center justify-between gap-2 px-4 py-3.5 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} NOVARA COMMERCE. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/pages/privacy-policy" className="hover:text-white">Privacy Policy</Link>
            <span aria-hidden="true">|</span>
            <Link to="/pages/terms" className="hover:text-white">Terms &amp; Conditions</Link>
            <span aria-hidden="true">|</span>
            <a href="/sitemap.xml" className="hover:text-white">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
