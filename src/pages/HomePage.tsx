import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Gift,
  Headphones,
  Home,
  Laptop,
  Package,
  RefreshCw,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Watch,
} from 'lucide-react';
import { apiRequest, ApiError, isAbortError } from '../services/api';
import type { CategoryItem, HomepageConfigData, ProductItem, PromotionalAdData } from '../types/commerce';
import { ProductCard } from '../components/catalog/ProductCard';
import { ResilientImage } from '../components/ui/ResilientImage';
import { useSeoMeta } from '../lib/useSeoMeta';

interface TestimonialItem {
  id: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  product?: { name?: string; slug?: string };
}

interface HomepagePayload {
  ok: true;
  config: HomepageConfigData | null;
  categories: CategoryItem[];
  featuredProducts?: ProductItem[];
  latestProducts?: ProductItem[];
  bestSellers: ProductItem[];
  trendingProducts?: ProductItem[];
  newArrivals?: ProductItem[];
  premiumCollection: ProductItem[];
  testimonials: TestimonialItem[];
  promotionalAd: PromotionalAdData | null;
}

const ICON_MAP: Record<string, typeof Smartphone> = {
  Smartphone,
  Laptop,
  Headphones,
  Watch,
  Camera,
  Gamepad2,
  Home,
  Shirt,
  ShoppingBag,
  BookOpen,
  Sparkles,
};

export function HomePage() {
  useSeoMeta({
    title: 'NOVARA COMMERCE – Smart Technology & Lifestyle Store Bangladesh',
    description:
      'Shop genuine electronics, fashion, books, and home essentials across Bangladesh with fast nationwide delivery and secure checkout.',
  });

  const [data, setData] = useState<HomepagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'electronics' | 'fashion' | 'home' | 'books'>('all');
  const categoryStripRef = useRef<HTMLDivElement>(null);

  const loadHomepage = async (signal?: AbortSignal) => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await apiRequest<HomepagePayload>('/api/storefront/homepage', { signal });
      setData(res);
    } catch (err) {
      if (isAbortError(err)) return;
      if (err instanceof ApiError) {
        setErrorState({ code: err.code, message: err.message });
      } else {
        setErrorState({ code: 'NETWORK_ERROR', message: 'Unable to load storefront data.' });
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadHomepage(controller.signal);
    return () => controller.abort();
  }, []);

  const slides =
    data?.config?.heroSlides && data.config.heroSlides.length > 0
      ? data.config.heroSlides.filter((s) => s.isActive !== false)
      : [
          {
            badgeText: 'Up to 50% OFF',
            headlineLine1: 'Smart Technology',
            headlineLine2: 'Better Life',
            subtitle: 'Discover the latest gadgets and upgrade your lifestyle with NOVARA.',
            ctaLabel: 'Shop Now',
            ctaUrl: '/shop',
            imageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
            isActive: true,
          },
        ];

  const currentSlide = slides[activeSlide % slides.length] || slides[0];
  const promoCards = data?.config?.promoBentoCards || [
    {
      eyebrow: 'Big Sale',
      title: 'UP TO 70% OFF',
      subtitle: "Don't Miss Out!",
      ctaLabel: 'Shop Now',
      ctaUrl: '/shop?discount=true',
      imageUrl: '/src/assets/images/promo_headphones_1794832024152.jpg',
      theme: 'royal-blue' as const,
    },
    {
      eyebrow: 'New Arrivals',
      title: 'Explore the Latest Trends',
      subtitle: 'Fashion · Tech · Lifestyle',
      ctaLabel: 'Shop Now',
      ctaUrl: '/shop?sort=newest',
      imageUrl: '/src/assets/images/promo_sneakers_1794832025309.jpg',
      theme: 'ice-blue' as const,
    },
    {
      eyebrow: 'Premium Quality',
      title: 'Smart Devices',
      subtitle: 'Innovate Your Life',
      ctaLabel: 'Shop Now',
      ctaUrl: '/category/smart-watches',
      imageUrl: '/src/assets/images/promo_smartwatch_1794832026084.jpg',
      theme: 'midnight-navy' as const,
    },
  ];

  const DEFAULT_CATEGORY_SHORTCUTS: Array<{ id: string; name: string; slug: string; iconName: string }> = [
    { id: 'c1', name: 'Mobiles & Tablets', slug: 'mobiles-tablets', iconName: 'Smartphone' },
    { id: 'c2', name: 'Laptops & Computers', slug: 'laptops-computers', iconName: 'Laptop' },
    { id: 'c3', name: 'Audio & Headphones', slug: 'audio-headphones', iconName: 'Headphones' },
    { id: 'c4', name: 'Smart Watches', slug: 'smart-watches', iconName: 'Watch' },
    { id: 'c5', name: 'Cameras & Drones', slug: 'cameras-drones', iconName: 'Camera' },
    { id: 'c6', name: 'Gaming & Consoles', slug: 'gaming-consoles', iconName: 'Gamepad2' },
    { id: 'c7', name: 'Home Appliances', slug: 'home-appliances', iconName: 'Home' },
    { id: 'c8', name: 'Fashion & Lifestyle', slug: 'fashion-lifestyle', iconName: 'Shirt' },
    { id: 'c9', name: 'Bags & Wallets', slug: 'bags-wallets', iconName: 'ShoppingBag' },
    { id: 'c10', name: 'Books & Education', slug: 'books-education', iconName: 'BookOpen' },
  ];

  const categories = data?.categories && data.categories.length > 0 ? data.categories : DEFAULT_CATEGORY_SHORTCUTS;
  const bestSellers = Array.isArray(data?.bestSellers) ? data.bestSellers : [];
  const featuredProducts = Array.isArray(data?.featuredProducts) ? data.featuredProducts : [];
  const latestProducts = Array.isArray(data?.latestProducts) ? data.latestProducts : [];
  const newArrivals = Array.isArray(data?.newArrivals) ? data.newArrivals : [];
  const trendingProducts = Array.isArray(data?.trendingProducts) ? data.trendingProducts : [];
  const collectionItems = (Array.isArray(data?.premiumCollection) ? data.premiumCollection : []).filter((item) => {
    if (collectionFilter === 'all') return true;
    const catObj = typeof item.categoryId === 'object' ? item.categoryId : null;
    const slug = catObj?.slug || '';
    if (collectionFilter === 'electronics') {
      return item.attributeGroup === 'electronics' || ['mobiles-tablets', 'laptops-computers', 'audio-headphones', 'smart-watches'].includes(slug);
    }
    if (collectionFilter === 'fashion') {
      return ['fashion-lifestyle', 'bags-wallets', 'shoes-footwear'].includes(slug);
    }
    if (collectionFilter === 'home') {
      return item.attributeGroup === 'home' || slug === 'home-appliances';
    }
    if (collectionFilter === 'books') {
      return item.attributeGroup === 'books' || slug === 'books-education';
    }
    return true;
  });

  const hasAnyCatalogProducts =
    bestSellers.length > 0 ||
    featuredProducts.length > 0 ||
    latestProducts.length > 0 ||
    newArrivals.length > 0 ||
    trendingProducts.length > 0 ||
    (data?.premiumCollection?.length ?? 0) > 0;

  const scrollCategories = (dir: -1 | 1) => {
    categoryStripRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  const enabledSections = data?.config?.enabledSections || {};
  const isSectionEnabled = (key: string) => enabledSections[key] !== false;

  return (
    <div className="pb-4">
      {/* 1. Hero Campaign Banner */}
      {isSectionEnabled('hero') && (
        <section className="relative overflow-hidden bg-gradient-to-r from-[#E4EEFD] via-[#EEF4FD] to-[#D7E4F8]">
          <div className="mx-auto grid max-w-[1380px] grid-cols-1 items-center gap-6 px-4 py-8 md:py-12 lg:grid-cols-12">
            <div className="z-10 lg:col-span-5">
              <span className="inline-block rounded-full bg-[#1155EE] px-4 py-1 text-xs font-bold text-white shadow-xs">
                {currentSlide.badgeText}
              </span>
              <h1 className="font-display mt-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-[#0B1730] sm:text-4xl lg:text-[46px]">
                {currentSlide.headlineLine1}
                <span className="block text-[#1155EE]">{currentSlide.headlineLine2}</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#334155] sm:text-base">
                {currentSlide.subtitle}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link
                  to={currentSlide.ctaUrl || '/shop'}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B44CC]"
                >
                  <span>{currentSlide.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative mx-auto aspect-[16/9] max-h-[340px] w-full overflow-hidden rounded-2xl shadow-sm">
                <ResilientImage
                  src={currentSlide.imageUrl}
                  alt={`${currentSlide.headlineLine1} ${currentSlide.headlineLine2}`}
                  loading="eager"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Carousel Dots */}
          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`View slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    activeSlide === idx ? 'w-6 bg-[#1155EE]' : 'w-2 bg-slate-400/50 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mx-auto max-w-[1380px] space-y-8 px-4 pt-6">
        {/* Non-DB unexpected error banner (DB banner is already displayed once at top of StorefrontLayout) */}
        {errorState && errorState.code !== 'DATABASE_UNAVAILABLE' && (
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h2 className="font-display text-base font-bold text-[#0F1D3A]">Unable to Load Live Catalog</h2>
                  <p className="mt-1 text-sm text-slate-600">{errorState.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadHomepage()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* 2. Category Shortcuts Carousel Strip */}
        {isSectionEnabled('categories') && categories.length > 0 && (
          <section aria-label="Product categories" className="relative rounded-2xl border border-slate-200/80 bg-white px-10 py-3.5 shadow-xs">
            <button
              type="button"
              onClick={() => scrollCategories(-1)}
              aria-label="Scroll categories left"
              className="absolute left-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div
              ref={categoryStripRef}
              className="flex items-stretch gap-3 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {categories.slice(0, 12).map((cat) => {
                const IconComp = (cat.iconName && ICON_MAP[cat.iconName]) || Package;
                return (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.slug}`}
                    className="flex min-w-[106px] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-2 text-center transition-colors hover:border-blue-100 hover:bg-[#F4F8FF]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#1155EE]">
                      <IconComp className="h-5 w-5" />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#0F1D3A]">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollCategories(1)}
              aria-label="Scroll categories right"
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {/* 3. Three Promotional Bento Cards */}
        {isSectionEnabled('promoBento') && (
          <section aria-label="Promotional highlights" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {promoCards.map((card, idx) => {
              const isIce = card.theme === 'ice-blue';
              const bgClass =
                card.theme === 'royal-blue'
                  ? 'bg-gradient-to-br from-[#0A1F5C] via-[#1144C8] to-[#1155EE] text-white'
                  : card.theme === 'midnight-navy'
                  ? 'bg-gradient-to-br from-[#071024] via-[#0F1D3A] to-[#172B52] text-white'
                  : 'bg-gradient-to-br from-[#DCEBFF] via-[#EAF2FF] to-[#F4F8FF] text-[#0B1730] border border-blue-100';

              return (
                <div
                  key={idx}
                  className={`relative flex min-h-[168px] items-center justify-between overflow-hidden rounded-2xl p-5 shadow-xs ${bgClass}`}
                >
                  <div className="z-10 max-w-[60%]">
                    <p className={`text-xs font-semibold ${isIce ? 'text-[#1155EE]' : 'text-blue-200'}`}>
                      {card.eyebrow}
                    </p>
                    <h2 className="font-display mt-1 text-xl font-extrabold leading-tight">
                      {card.title}
                    </h2>
                    <p className={`mt-1 text-xs ${isIce ? 'text-slate-600' : 'text-slate-200'}`}>
                      {card.subtitle}
                    </p>
                    <Link
                      to={card.ctaUrl}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        isIce
                          ? 'bg-[#1155EE] text-white hover:bg-[#0B44CC]'
                          : 'bg-white text-[#0B1730] hover:bg-blue-50'
                      }`}
                    >
                      <span>{card.ctaLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl">
                    <ResilientImage
                      src={card.imageUrl}
                      alt={card.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 4. Best Sellers Section (Driven by real soldCount from MongoDB Atlas) */}
        {isSectionEnabled('bestSellers') && (loading || bestSellers.length > 0) && (
          <section aria-labelledby="best-sellers-heading">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="best-sellers-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  Best Sellers
                </h2>
              </div>
              <Link
                to="/shop?sort=popular"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline"
              >
                <span>View All Products</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200/70" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                {bestSellers.map((prod) => (
                  <ProductCard key={prod.id} product={prod} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Genuine Empty Published Catalog Notice (only when DB is connected and returns 0 products) */}
        {!loading && !errorState && !hasAnyCatalogProducts && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
            <h2 className="font-display text-lg font-bold text-[#0F1D3A]">No Published Products Yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              Publish products in the Admin Panel to populate Best Sellers, Featured, New Arrivals, and Collection sections.
            </p>
            <Link
              to="/shop"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1155EE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
            >
              Browse Shop
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        {/* Inline Catalog Unavailable Notice when DB is not connected */}
        {!loading && errorState?.code === 'DATABASE_UNAVAILABLE' && (
          <section className="rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-xs">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <h2 className="font-display mt-2.5 text-lg font-bold text-[#0F1D3A]">Live Catalog Waiting on Database</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
              {errorState.message} Once connected, Best Sellers, Featured Products, New Arrivals, Trending Products, and Premium Collection sections load directly from MongoDB Atlas.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => loadHomepage()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1155EE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Catalog
              </button>
              <Link
                to="/shop"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-[#0F1D3A] hover:bg-slate-50"
              >
                Open Shop Catalog
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* 5. Mid-Page Dual Feature Banners */}
        {isSectionEnabled('featureBanners') && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-[136px] items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-[#E6EFFD] to-[#F4F8FF] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1155EE] text-white shadow-sm">
                  <Gift className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1155EE]">
                    {data?.config?.featureBanners?.giftBanner?.title || 'Special Gift'}
                  </p>
                  <h3 className="font-display text-xl font-extrabold text-[#0B1730]">
                    {data?.config?.featureBanners?.giftBanner?.subtitle || 'For Our Valued Customers'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {data?.config?.featureBanners?.giftBanner?.description || 'Get a Free Gift on Orders Over ৳5,000'}
                  </p>
                </div>
              </div>
              <Link
                to={data?.config?.featureBanners?.giftBanner?.ctaUrl || '/shop'}
                className="shrink-0 rounded-full bg-[#1155EE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
              >
                {data?.config?.featureBanners?.giftBanner?.ctaLabel || 'Shop Now'} →
              </Link>
            </div>

            <div className="flex min-h-[136px] items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#071024] via-[#0F1D3A] to-[#132955] p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1155EE]/25 text-[#5895FF] ring-1 ring-[#1155EE]/50">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-extrabold">
                    {data?.config?.featureBanners?.trustBanner?.title || 'Premium Quality Guaranteed'}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-300">
                    {data?.config?.featureBanners?.trustBanner?.subtitle || 'Shop with Confidence'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-blue-200">
                    {(data?.config?.featureBanners?.trustBanner?.bullets || ['Easy Returns', 'Secure Payment', 'Trusted Store']).map(
                      (b) => (
                        <span key={b} className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#5895FF]" />
                          {b}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 6. Optional Admin-Managed Promotional Placement (Omitted completely if not active/published!) */}
        {data?.promotionalAd && (
          <section aria-label={data.promotionalAd.title}>
            <a
              href={data.promotionalAd.destinationUrl}
              className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-opacity hover:opacity-95"
            >
              <ResilientImage
                src={data.promotionalAd.imageUrl}
                alt={data.promotionalAd.altText}
                className="max-h-[220px] w-full object-cover"
              />
            </a>
          </section>
        )}

        {/* 7. Our Premium Collection (Filterable Row) */}
        {isSectionEnabled('premiumCollection') && (loading || (data?.premiumCollection && data.premiumCollection.length > 0)) && (
          <section aria-labelledby="premium-collection-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="premium-collection-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  Our Premium Collection
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'electronics', label: 'Electronics' },
                    { key: 'fashion', label: 'Fashion' },
                    { key: 'home', label: 'Home & Living' },
                    { key: 'books', label: 'Books' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCollectionFilter(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      collectionFilter === tab.key
                        ? 'bg-[#1155EE] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:text-[#0F1D3A]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {collectionItems.length === 0 && !loading ? (
              <div className="rounded-xl border border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
                No products match this collection filter yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
                {collectionItems.map((prod) => (
                  <ProductCard key={prod.id} product={prod} compact showRating={false} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 7B. Featured & New Arrivals / Latest Catalog Rows (Real DB-Driven) */}
        {!loading && featuredProducts.length > 0 && (
          <section aria-labelledby="featured-products-heading">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="featured-products-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  Featured Products
                </h2>
              </div>
              <Link
                to="/shop?section=featured"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline"
              >
                <span>View Featured</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {featuredProducts.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </section>
        )}

        {!loading && newArrivals.length > 0 && (
          <section aria-labelledby="new-arrivals-heading">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="new-arrivals-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  New Arrivals &amp; Latest
                </h2>
              </div>
              <Link
                to="/shop?sort=newest"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline"
              >
                <span>Shop New Arrivals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {newArrivals.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </section>
        )}

        {!loading && trendingProducts.length > 0 && (
          <section aria-labelledby="trending-products-heading">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="trending-products-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  Trending Products
                </h2>
              </div>
              <Link
                to="/shop?sort=trending"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline"
              >
                <span>View Trending</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {trendingProducts.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </section>
        )}

        {/* 8. What Our Clients Say (Strictly authentic approved verified-purchase reviews) */}
        {isSectionEnabled('reviews') && data?.testimonials && data.testimonials.length > 0 && (
          <section aria-labelledby="reviews-heading">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-[#1155EE]" aria-hidden="true" />
                <h2 id="reviews-heading" className="font-display text-lg font-bold text-[#0B1730] sm:text-xl">
                  What Our Clients Say
                </h2>
              </div>
              <Link to="/shop" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1155EE] hover:underline">
                <span>Browse Reviewed Items</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {data.testimonials.slice(0, 3).map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#0B1730]">{review.userName}</p>
                      <p className="text-[11px] font-medium text-emerald-700">Verified Purchase</p>
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: review.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3.5 w-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">&ldquo;{review.comment}&rdquo;</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
