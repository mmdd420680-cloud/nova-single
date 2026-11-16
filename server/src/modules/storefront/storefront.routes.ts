import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HomepageConfigModel, PromotionalAdModel, CmsPageModel } from '../cms/cms.model';
import { CategoryModel, BrandModel } from '../categories/category.model';
import { ProductModel } from '../products/product.model';
import { ReviewModel } from '../reviews/review.model';
import { NewsletterSubscriptionModel, SupportEnquiryModel } from '../support/support.model';
import { isDatabaseReady, requireDatabase } from '../../database/connection';
import { AppError } from '../../middleware/error.middleware';
import { enrichProductPricing } from '../products/productCatalogHelpers';
import { env } from '../../config/env';

const router = Router();

function formatProductCard(p: Record<string, unknown>) {
  const enriched = enrichProductPricing(p) as Record<string, unknown>;
  return {
    id: enriched.id,
    name: enriched.name,
    slug: enriched.slug,
    sku: enriched.sku,
    brandName: enriched.brandName || '',
    categoryId: enriched.categoryId,
    subCategoryId: enriched.subCategoryId ?? null,
    attributeGroup: enriched.attributeGroup || 'general',
    images: enriched.images || [],
    currentPrice: enriched.currentPrice,
    originalPrice: enriched.originalPrice,
    discountPercent: enriched.discountPercent,
    isFlashSaleActive: enriched.isFlashSaleActive,
    availableStock: enriched.availableStock,
    hasVariants: Boolean(enriched.hasVariants) && Array.isArray(enriched.variants) && enriched.variants.length > 0,
    variants: enriched.variants || [],
    ratingAverage: Number(enriched.ratingAverage || 0),
    reviewCount: Number(enriched.reviewCount || 0),
    soldCount: Number(enriched.soldCount || 0),
    isFeatured: Boolean(enriched.isFeatured),
    isNewArrival: Boolean(enriched.isNewArrival),
    isPremiumCollection: Boolean(enriched.isPremiumCollection),
  };
}

// Homepage payload driven dynamically by MongoDB Atlas CMS + real catalog
router.get('/homepage', requireDatabase, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const [
      config,
      categories,
      featuredRaw,
      latestRaw,
      bestSellersRaw,
      trendingRaw,
      newArrivalsRaw,
      collectionRaw,
      approvedReviews,
      activeAd,
    ] = await Promise.all([
      HomepageConfigModel.findOne({ key: 'main' }).lean(),
      CategoryModel.find({ isActive: true, parentId: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      ProductModel.find({ status: 'published', isFeatured: true })
        .populate('categoryId', 'name slug')
        .sort({ soldCount: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      ProductModel.find({ status: 'published' })
        .populate('categoryId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      ProductModel.find({ status: 'published' })
        .populate('categoryId', 'name slug')
        .sort({ soldCount: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      ProductModel.find({ status: 'published' })
        .populate('categoryId', 'name slug')
        .sort({ soldCount: -1, ratingAverage: -1, updatedAt: -1 })
        .limit(8)
        .lean(),
      ProductModel.find({ status: 'published', isNewArrival: true })
        .populate('categoryId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      ProductModel.find({ status: 'published', isPremiumCollection: true })
        .populate('categoryId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      ReviewModel.find({ status: 'approved', isVerifiedPurchase: true })
        .populate('productId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      PromotionalAdModel.findOne({
        isEnabled: true,
        isPublished: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const effectivePremium = collectionRaw.length > 0 ? collectionRaw : latestRaw;
    const effectiveFeatured = featuredRaw.length > 0 ? featuredRaw : bestSellersRaw;
    const effectiveNewArrivals = newArrivalsRaw.length > 0 ? newArrivalsRaw : latestRaw;

    res.json({
      ok: true,
      config: config || null,
      categories: categories.map((c) => ({ ...c, id: String(c._id), parentId: c.parentId ? String(c.parentId) : null })),
      featuredProducts: effectiveFeatured.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      latestProducts: latestRaw.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      bestSellers: bestSellersRaw.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      trendingProducts: trendingRaw.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      newArrivals: effectiveNewArrivals.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      premiumCollection: effectivePremium.map((p) => formatProductCard(p as unknown as Record<string, unknown>)),
      testimonials: approvedReviews.map((r) => ({
        id: String(r._id),
        userName: r.userName,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
        product: r.productId,
      })),
      promotionalAd: activeAd ? { ...activeAd, id: String(activeAd._id) } : null,
    });
  } catch (err) {
    next(err);
  }
});

// Header navigation & global storefront metadata
router.get('/navigation', requireDatabase, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [categories, brands, config] = await Promise.all([
      CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      BrandModel.find({ isActive: true }).sort({ name: 1 }).lean(),
      HomepageConfigModel.findOne({ key: 'main' }).select('announcementBar contactInfo shippingSettings seoDefaults').lean(),
    ]);
    res.json({
      ok: true,
      categories: categories.map((c) => ({ ...c, id: String(c._id), parentId: c.parentId ? String(c.parentId) : null })),
      brands: brands.map((b) => ({ ...b, id: String(b._id) })),
      settings: config || null,
    });
  } catch (err) {
    next(err);
  }
});

// CMS static info & policy pages
router.get('/pages/:slug', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = await CmsPageModel.findOne({ slug: String(req.params.slug).toLowerCase(), isPublished: true }).lean();
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Requested page not found.');
    res.json({ ok: true, page });
  } catch (err) {
    next(err);
  }
});

// Newsletter subscription with explicit consent tracking
router.post('/newsletter/subscribe', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().trim().email('Please enter a valid email address.').toLowerCase(),
      source: z.string().max(60).optional(),
    });
    const parsed = schema.parse(req.body);

    const existing = await NewsletterSubscriptionModel.findOne({ email: parsed.email });
    if (existing && existing.status === 'subscribed') {
      res.json({ ok: true, alreadySubscribed: true, message: 'This email is already subscribed to NOVARA updates.' });
      return;
    }

    if (existing) {
      existing.status = 'subscribed';
      existing.consentRecordedAt = new Date();
      existing.unsubscribedAt = null;
      await existing.save();
    } else {
      await NewsletterSubscriptionModel.create({
        email: parsed.email,
        status: 'subscribed',
        consentRecordedAt: new Date(),
        source: parsed.source || 'homepage_newsletter',
      });
    }

    res.status(201).json({ ok: true, message: 'Thank you for subscribing to NOVARA COMMERCE updates!' });
  } catch (err) {
    next(err);
  }
});

router.post('/newsletter/unsubscribe', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().trim().email().toLowerCase() }).parse(req.body);
    await NewsletterSubscriptionModel.updateOne(
      { email },
      { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } },
    );
    res.json({ ok: true, message: 'You have been unsubscribed from marketing updates.' });
  } catch (err) {
    next(err);
  }
});

// Customer support enquiry submission
router.post('/support/enquiry', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().toLowerCase(),
      phone: z.string().trim().max(24).optional(),
      subject: z.string().trim().min(3).max(140),
      orderNumber: z.string().trim().max(40).optional(),
      message: z.string().trim().min(10).max(2000),
      websiteHoneyPot: z.string().max(0).optional(), // Spam protection
    });
    const parsed = schema.parse(req.body);
    if (parsed.websiteHoneyPot) {
      throw new AppError(400, 'SPAM_DETECTED', 'Invalid submission.');
    }

    const enquiry = await SupportEnquiryModel.create({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      subject: parsed.subject,
      orderNumber: parsed.orderNumber,
      message: parsed.message,
    });

    res.status(201).json({
      ok: true,
      ticketId: String(enquiry._id),
      message: 'Your support enquiry has been received. Our team will respond shortly.',
    });
  } catch (err) {
    next(err);
  }
});

// Dynamic XML Sitemap
export async function sitemapHandler(_req: Request, res: Response): Promise<void> {
  const baseUrl = env.APP_URL.replace(/\/$/, '');
  let urls = ['', '/shop', '/track-order', '/contact', '/pages/about-us', '/pages/shipping-info', '/pages/return-policy', '/pages/faqs'];

  if (isDatabaseReady()) {
    try {
      const [categories, products] = await Promise.all([
        CategoryModel.find({ isActive: true }).select('slug updatedAt').lean(),
        ProductModel.find({ status: 'published' }).select('slug updatedAt').lean(),
      ]);
      urls = [
        ...urls,
        ...categories.map((c) => `/category/${c.slug}`),
        ...products.map((p) => `/product/${p.slug}`),
      ];
    } catch {
      // Serve base static routes if DB query fails
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${baseUrl}${path}</loc></url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
}

router.get(['/sitemap.xml', '/seo/sitemap.xml'], sitemapHandler);

export default router;
