import { Router, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { CouponModel } from '../coupons/coupon.model';
import { ReviewModel } from '../reviews/review.model';
import { ProductModel } from '../products/product.model';
import { UserModel } from '../users/user.model';
import { HomepageConfigModel, PromotionalAdModel } from '../cms/cms.model';
import { SupportEnquiryModel, AuditLogModel } from '../support/support.model';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, recordAuditLog, requirePermission, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { integrations } from '../../config/env';

const router = Router();
router.use(requireDatabase, authenticateRequired);

// Coupons CRUD
const couponSchema = z.object({
  code: z.string().trim().min(3).max(40).toUpperCase(),
  description: z.string().max(240).optional(),
  discountType: z.enum(['fixed', 'percentage']),
  discountValue: z.number().min(1),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  minOrderAmount: z.number().min(0).default(0),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).nullable().optional(),
});

router.get('/coupons', requirePermission('marketing.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const coupons = await CouponModel.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, coupons: coupons.map((c) => ({ ...c, id: String(c._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/coupons', requirePermission('marketing.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = couponSchema.parse(req.body);
    const coupon = await CouponModel.create(parsed);
    await recordAuditLog({
      actor: req.user,
      action: 'coupon.create',
      resourceType: 'Coupon',
      resourceId: coupon.code,
      summary: `Created coupon ${coupon.code}`,
    });
    res.status(201).json({ ok: true, coupon: { ...coupon.toObject(), id: String(coupon._id) } });
  } catch (err) {
    next(err);
  }
});

router.put('/coupons/:id', requirePermission('marketing.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = couponSchema.parse(req.body);
    const updated = await CouponModel.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
    if (!updated) throw new AppError(404, 'COUPON_NOT_FOUND', 'Coupon not found.');
    res.json({ ok: true, coupon: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.delete('/coupons/:id', requirePermission('marketing.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await CouponModel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Reviews Moderation (updates product real ratingAverage and reviewCount on approval/rejection)
async function recomputeProductRating(productId: unknown) {
  const agg = await ReviewModel.aggregate([
    { $match: { productId, status: 'approved' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0]?.avg ? Number(agg[0].avg.toFixed(2)) : 0;
  const count = agg[0]?.count ? Number(agg[0].count) : 0;
  await ProductModel.updateOne({ _id: productId }, { $set: { ratingAverage: avg, reviewCount: count } });
}

router.get('/reviews', requirePermission('reviews.moderate'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status || '');
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const reviews = await ReviewModel.find(filter)
      .populate('productId', 'name slug sku')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ ok: true, reviews: reviews.map((r) => ({ ...r, id: String(r._id) })) });
  } catch (err) {
    next(err);
  }
});

router.patch('/reviews/:id/moderate', requirePermission('reviews.moderate'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(['approved', 'rejected']),
      reason: z.string().trim().max(300).optional(),
    });
    const parsed = schema.parse(req.body);

    const review = await ReviewModel.findById(req.params.id);
    if (!review) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review not found.');

    review.status = parsed.status;
    review.moderationReason = parsed.reason;
    review.moderatedBy = req.user!._id as unknown as typeof review.moderatedBy;
    review.moderatedAt = new Date();
    await review.save();

    await recomputeProductRating(review.productId);

    await recordAuditLog({
      actor: req.user,
      action: 'review.moderate',
      resourceType: 'Review',
      resourceId: String(review._id),
      summary: `Moderated review ${review._id} -> ${parsed.status}`,
    });

    res.json({ ok: true, review: { ...review.toObject(), id: String(review._id) } });
  } catch (err) {
    next(err);
  }
});

// Customers List (privacy-conscious projection: excludes password hashes & secret tokens)
router.get('/customers', requirePermission('customers.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customers = await UserModel.find({ role: 'customer' })
      .select('name email phone isVerified status createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ ok: true, customers: customers.map((c) => ({ ...c, id: String(c._id) })) });
  } catch (err) {
    next(err);
  }
});

// Homepage CMS Config & Settings
router.get('/cms/homepage', requirePermission('cms.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = await HomepageConfigModel.findOne({ key: 'main' }).lean();
    res.json({ ok: true, config });
  } catch (err) {
    next(err);
  }
});

router.put('/cms/homepage', requirePermission('cms.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await HomepageConfigModel.findOneAndUpdate(
      { key: 'main' },
      { $set: req.body },
      { new: true, upsert: true },
    );
    await recordAuditLog({
      actor: req.user,
      action: 'cms.homepage_update',
      resourceType: 'HomepageConfig',
      summary: 'Updated homepage CMS layout and settings',
    });
    res.json({ ok: true, config: updated });
  } catch (err) {
    next(err);
  }
});

// Promotional Ads CRUD (validates safe destination URLs)
const promoAdSchema = z.object({
  title: z.string().trim().min(2).max(140),
  altText: z.string().trim().min(2).max(200),
  imageUrl: z.string().min(1),
  cloudinaryPublicId: z.string().optional(),
  destinationUrl: z
    .string()
    .trim()
    .refine(
      (url) => url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://'),
      'Destination URL must be a relative path or valid HTTP/HTTPS URL.',
    ),
  placement: z.enum(['homepage_mid', 'homepage_bottom']).default('homepage_mid'),
  isEnabled: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

router.get('/ads', requirePermission('ads.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ads = await PromotionalAdModel.find().sort({ updatedAt: -1 }).lean();
    res.json({ ok: true, ads: ads.map((a) => ({ ...a, id: String(a._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/ads', requirePermission('ads.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = promoAdSchema.parse(req.body);
    const ad = await PromotionalAdModel.create(parsed);
    await recordAuditLog({
      actor: req.user,
      action: 'ad.create',
      resourceType: 'PromotionalAd',
      resourceId: String(ad._id),
      summary: `Created promotional placement: ${ad.title}`,
    });
    res.status(201).json({ ok: true, ad: { ...ad.toObject(), id: String(ad._id) } });
  } catch (err) {
    next(err);
  }
});

router.put('/ads/:id', requirePermission('ads.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = promoAdSchema.parse(req.body);
    const updated = await PromotionalAdModel.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
    if (!updated) throw new AppError(404, 'AD_NOT_FOUND', 'Promotional placement not found.');
    res.json({ ok: true, ad: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.delete('/ads/:id', requirePermission('ads.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await PromotionalAdModel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Support Enquiries Management
router.get('/support', requirePermission('support.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const enquiries = await SupportEnquiryModel.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ ok: true, enquiries: enquiries.map((e) => ({ ...e, id: String(e._id) })) });
  } catch (err) {
    next(err);
  }
});

router.patch('/support/:id', requirePermission('support.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
      internalNote: z.string().trim().max(500).optional(),
    });
    const parsed = schema.parse(req.body);

    const enquiry = await SupportEnquiryModel.findById(req.params.id);
    if (!enquiry) throw new AppError(404, 'ENQUIRY_NOT_FOUND', 'Enquiry not found.');

    enquiry.status = parsed.status;
    if (parsed.internalNote) {
      enquiry.internalNotes.push({ note: parsed.internalNote, actorName: req.user!.name, timestamp: new Date() });
    }
    await enquiry.save();
    res.json({ ok: true, enquiry: { ...enquiry.toObject(), id: String(enquiry._id) } });
  } catch (err) {
    next(err);
  }
});

// Staff & RBAC Management (Super Admin only)
router.get('/staff', requirePermission('staff.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const staff = await UserModel.find({ role: { $ne: 'customer' } })
      .select('name email phone role status customPermissions lastLoginAt createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, staff: staff.map((s) => ({ ...s, id: String(s._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/staff', requirePermission('staff.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().toLowerCase(),
      password: z.string().min(8).max(128),
      role: z.enum([
        'admin',
        'order_manager',
        'inventory_manager',
        'catalog_manager',
        'customer_support',
        'finance_accounts',
      ]),
    });
    const parsed = schema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 12);

    const staff = await UserModel.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      isVerified: true,
      status: 'active',
    });

    await recordAuditLog({
      actor: req.user,
      action: 'staff.create',
      resourceType: 'User',
      resourceId: String(staff._id),
      summary: `Created staff member ${staff.email} with role ${staff.role}`,
    });

    res.status(201).json({
      ok: true,
      staff: { id: String(staff._id), name: staff.name, email: staff.email, role: staff.role, status: staff.status },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/staff/:id', requirePermission('staff.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      role: z.enum([
        'super_admin',
        'admin',
        'order_manager',
        'inventory_manager',
        'catalog_manager',
        'customer_support',
        'finance_accounts',
      ]),
      status: z.enum(['active', 'suspended']),
    });
    const parsed = schema.parse(req.body);
    if (String(req.params.id) === String(req.user!._id) && parsed.status === 'suspended') {
      throw new AppError(400, 'SELF_SUSPEND_FORBIDDEN', 'You cannot suspend your own Super Admin account.');
    }

    const updated = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: { role: parsed.role, status: parsed.status } },
      { new: true },
    ).select('name email role status');

    if (!updated) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found.');

    await recordAuditLog({
      actor: req.user,
      action: 'staff.role_update',
      resourceType: 'User',
      resourceId: String(updated._id),
      summary: `Updated staff ${updated.email} -> role=${updated.role}, status=${updated.status}`,
    });

    res.json({ ok: true, staff: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', requirePermission('audit.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const logs = await AuditLogModel.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ ok: true, logs });
  } catch (err) {
    next(err);
  }
});

// Store Settings & Integration Status
router.get('/settings', requirePermission('settings.manage'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = await HomepageConfigModel.findOne({ key: 'main' }).lean();
    res.json({
      ok: true,
      config,
      integrations,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      shippingSettings: z
        .object({
          dhakaMetroCharge: z.number().min(0),
          dhakaSuburbCharge: z.number().min(0),
          nationwideCharge: z.number().min(0),
          freeShippingThreshold: z.number().min(0),
          expressSurcharge: z.number().min(0),
        })
        .optional(),
      contactInfo: z
        .object({
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.string().optional(),
          whatsappUrl: z.string().optional(),
          messengerUrl: z.string().optional(),
          instagramUrl: z.string().optional(),
          linkedinUrl: z.string().optional(),
          facebookUrl: z.string().optional(),
        })
        .optional(),
      seoDefaults: z
        .object({
          siteName: z.string().min(2),
          defaultTitle: z.string().min(4),
          defaultDescription: z.string().min(10),
        })
        .optional(),
    });
    const parsed = schema.parse(req.body);

    const updated = await HomepageConfigModel.findOneAndUpdate(
      { key: 'main' },
      { $set: parsed },
      { new: true, upsert: true },
    );
    await recordAuditLog({
      actor: req.user,
      action: 'settings.update',
      resourceType: 'HomepageConfig',
      summary: 'Updated store shipping, contact, and SEO settings',
    });
    res.json({ ok: true, config: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
