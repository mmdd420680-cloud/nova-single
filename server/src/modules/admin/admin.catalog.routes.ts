import { Router, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ProductModel } from '../products/product.model';
import { CategoryModel, BrandModel } from '../categories/category.model';
import { InventoryMovementModel } from '../inventory/inventoryMovement.model';
import { OrderModel } from '../orders/order.model';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, recordAuditLog, requirePermission, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { deleteCloudinaryAsset, uploadImageToCloudinary } from '../../services/cloudinary.service';
import { buildCategoryAncestryPath, enrichProductPricing } from '../products/productCatalogHelpers';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireDatabase, authenticateRequired);

// Cloudinary image upload endpoint
router.post(
  '/media/upload',
  requirePermission('catalog.manage'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'Please attach an image file to upload.');
      }
      const folder = String(req.body.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
      const result = await uploadImageToCloudinary({
        buffer: req.file.buffer,
        folder,
      });

      await recordAuditLog({
        actor: req.user,
        action: 'media.upload',
        resourceType: 'CloudinaryAsset',
        resourceId: result.publicId,
        summary: `Uploaded image asset to ${folder}`,
      });

      res.status(201).json({ ok: true, asset: result });
    } catch (err) {
      next(err);
    }
  },
);

// Categories CRUD
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameBn: z.string().trim().max(100).optional(),
  slug: z.string().trim().min(2).max(100).toLowerCase(),
  parentId: z.string().nullable().optional(),
  iconName: z.string().trim().max(40).optional(),
  imageUrl: z.string().optional(),
  cloudinaryPublicId: z.string().optional(),
  description: z.string().max(500).optional(),
  attributeSchemaType: z.enum(['general', 'electronics', 'beauty', 'books', 'home']).default('general'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  showInHeader: z.boolean().default(true),
});

router.get('/categories', requirePermission('catalog.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ ok: true, categories: categories.map((c) => ({ ...c, id: String(c._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const cat = await CategoryModel.create({
      ...parsed,
      parentId: parsed.parentId || null,
    });
    await recordAuditLog({
      actor: req.user,
      action: 'category.create',
      resourceType: 'Category',
      resourceId: String(cat._id),
      summary: `Created category ${cat.name}`,
    });
    res.status(201).json({ ok: true, category: { ...cat.toObject(), id: String(cat._id) } });
  } catch (err) {
    next(err);
  }
});

router.put('/categories/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const updated = await CategoryModel.findByIdAndUpdate(
      req.params.id,
      { $set: { ...parsed, parentId: parsed.parentId || null } },
      { new: true },
    );
    if (!updated) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
    await recordAuditLog({
      actor: req.user,
      action: 'category.update',
      resourceType: 'Category',
      resourceId: String(updated._id),
      summary: `Updated category ${updated.name}`,
    });
    res.json({ ok: true, category: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cat = await CategoryModel.findById(req.params.id);
    if (!cat) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
    const linkedProducts = await ProductModel.countDocuments({ categoryId: cat._id });
    if (linkedProducts > 0) {
      throw new AppError(409, 'CATEGORY_IN_USE', `Cannot delete category used by ${linkedProducts} products. Archive or reassign them first.`);
    }
    if (cat.cloudinaryPublicId) {
      await deleteCloudinaryAsset(cat.cloudinaryPublicId);
    }
    await cat.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Brands CRUD
const brandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).toLowerCase(),
  logoUrl: z.string().optional(),
  cloudinaryPublicId: z.string().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

router.get('/brands', requirePermission('catalog.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const brands = await BrandModel.find().sort({ name: 1 }).lean();
    res.json({ ok: true, brands: brands.map((b) => ({ ...b, id: String(b._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/brands', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = brandSchema.parse(req.body);
    const brand = await BrandModel.create(parsed);
    await recordAuditLog({
      actor: req.user,
      action: 'brand.create',
      resourceType: 'Brand',
      resourceId: String(brand._id),
      summary: `Created brand ${brand.name}`,
    });
    res.status(201).json({ ok: true, brand: { ...brand.toObject(), id: String(brand._id) } });
  } catch (err) {
    next(err);
  }
});

router.put('/brands/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = brandSchema.parse(req.body);
    const updated = await BrandModel.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
    if (!updated) throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
    res.json({ ok: true, brand: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.delete('/brands/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandModel.findById(req.params.id);
    if (!brand) throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
    if (brand.cloudinaryPublicId) {
      await deleteCloudinaryAsset(brand.cloudinaryPublicId);
    }
    await brand.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Products CRUD & Bulk CSV
const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  nameBn: z.string().trim().max(200).optional(),
  slug: z.string().trim().min(2).max(200).toLowerCase(),
  sku: z.string().trim().min(2).max(60).toUpperCase(),
  barcode: z.string().trim().max(60).optional(),
  brandId: z.string().nullable().optional(),
  brandName: z.string().trim().optional(),
  categoryId: z.string().min(1),
  subCategoryId: z.string().nullable().optional(),
  description: z.string().min(10),
  shortDescription: z.string().max(400).optional(),
  features: z.array(z.string()).default([]),
  attributeGroup: z.enum(['general', 'electronics', 'beauty', 'books', 'home']).default('general'),
  attributes: z.record(z.string(), z.string()).default({}),
  specifications: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  bilingualKeywords: z.array(z.string()).default([]),
  basePrice: z.number().min(0),
  salePrice: z.number().min(0).nullable().optional(),
  flashSalePrice: z.number().min(0).nullable().optional(),
  flashSaleStartsAt: z.string().nullable().optional(),
  flashSaleEndsAt: z.string().nullable().optional(),
  stockOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  hasVariants: z.boolean().default(false),
  variants: z
    .array(
      z.object({
        _id: z.string().optional(),
        sku: z.string().trim().min(2).toUpperCase(),
        title: z.string().trim().min(1),
        options: z.record(z.string(), z.string()).default({}),
        price: z.number().min(0).nullable().optional(),
        salePrice: z.number().min(0).nullable().optional(),
        stockOnHand: z.number().int().min(0).default(0),
        lowStockThreshold: z.number().int().min(0).default(5),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .default([]),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        publicId: z.string().optional(),
        alt: z.string().default(''),
        sortOrder: z.number().default(0),
      }),
    )
    .default([]),
  warrantyInfo: z.string().max(300).optional(),
  returnPolicyNote: z.string().max(300).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isPremiumCollection: z.boolean().default(false),
  seoTitle: z.string().max(140).optional(),
  seoDescription: z.string().max(240).optional(),
});

router.get('/products', requirePermission('catalog.view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (categoryId) {
      filter.$or = [{ categoryId }, { subCategoryId: categoryId }];
    }
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchCond = [{ name: regex }, { sku: regex }, { brandName: regex }, { slug: regex }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or as unknown[] }, { $or: searchCond }];
        delete filter.$or;
      } else {
        filter.$or = searchCond;
      }
    }

    const [total, products] = await Promise.all([
      ProductModel.countDocuments(filter),
      ProductModel.find(filter)
        .populate('categoryId', 'name slug')
        .populate('subCategoryId', 'name slug')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      ok: true,
      products: products.map((p) => enrichProductPricing(p as unknown as Record<string, unknown>)),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/products', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = productSchema.parse(req.body);
    const allCategories = await CategoryModel.find().lean();
    const category = allCategories.find((c) => String(c._id) === parsed.categoryId);
    if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');

    if (parsed.subCategoryId) {
      const subCat = allCategories.find((c) => String(c._id) === parsed.subCategoryId);
      if (!subCat) throw new AppError(400, 'INVALID_SUBCATEGORY', 'Selected subcategory does not exist.');
    }

    let brandName = parsed.brandName || '';
    if (parsed.brandId) {
      const brand = await BrandModel.findById(parsed.brandId);
      if (brand) brandName = brand.name;
    }

    const categoryPath = buildCategoryAncestryPath({
      categoryId: String(category._id),
      subCategoryId: parsed.subCategoryId || null,
      allCategories,
    });

    const product = await ProductModel.create({
      ...parsed,
      brandId: parsed.brandId || null,
      subCategoryId: parsed.subCategoryId || null,
      brandName,
      categoryPath,
    });

    await recordAuditLog({
      actor: req.user,
      action: 'product.create',
      resourceType: 'Product',
      resourceId: String(product._id),
      summary: `Created product ${product.name} (${product.sku}) [${product.status}]`,
    });

    res.status(201).json({
      ok: true,
      product: enrichProductPricing(product.toObject() as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/products/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = productSchema.parse(req.body);
    const existing = await ProductModel.findById(req.params.id);
    if (!existing) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

    const allCategories = await CategoryModel.find().lean();
    const category = allCategories.find((c) => String(c._id) === parsed.categoryId);
    if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');

    if (parsed.subCategoryId) {
      const subCat = allCategories.find((c) => String(c._id) === parsed.subCategoryId);
      if (!subCat) throw new AppError(400, 'INVALID_SUBCATEGORY', 'Selected subcategory does not exist.');
    }

    let brandName = parsed.brandName || '';
    if (parsed.brandId) {
      const brand = await BrandModel.findById(parsed.brandId);
      if (brand) brandName = brand.name;
    }

    const categoryPath = buildCategoryAncestryPath({
      categoryId: String(category._id),
      subCategoryId: parsed.subCategoryId || null,
      allCategories,
    });

    const priceChanged = existing.basePrice !== parsed.basePrice || existing.salePrice !== parsed.salePrice;

    Object.assign(existing, {
      ...parsed,
      brandId: parsed.brandId || null,
      subCategoryId: parsed.subCategoryId || null,
      brandName,
      categoryPath,
    });
    await existing.save();

    await recordAuditLog({
      actor: req.user,
      action: priceChanged ? 'product.price_change' : 'product.update',
      resourceType: 'Product',
      resourceId: String(existing._id),
      summary: `Updated product ${existing.name} (${existing.sku})${priceChanged ? ' [Price Updated]' : ''}`,
    });

    res.json({
      ok: true,
      product: enrichProductPricing(existing.toObject() as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id/status', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.enum(['draft', 'published', 'archived']) }).parse(req.body);
    const product = await ProductModel.findById(req.params.id);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

    const prevStatus = product.status;
    product.status = status;
    await product.save();

    await recordAuditLog({
      actor: req.user,
      action: 'product.status_change',
      resourceType: 'Product',
      resourceId: String(product._id),
      summary: `Changed product ${product.name} (${product.sku}) status from ${prevStatus} to ${status}`,
    });

    res.json({
      ok: true,
      product: enrichProductPricing(product.toObject() as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await ProductModel.findById(req.params.id);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

    const permanent = req.query.permanent === 'true';
    if (permanent) {
      const referencedOrders = await OrderModel.countDocuments({ 'items.productId': product._id });
      if (referencedOrders > 0) {
        throw new AppError(
          409,
          'PRODUCT_HAS_ORDERS',
          `Cannot permanently delete product linked to ${referencedOrders} historical orders. Archive it instead.`,
        );
      }
      await product.deleteOne();
      await recordAuditLog({
        actor: req.user,
        action: 'product.delete_permanent',
        resourceType: 'Product',
        resourceId: String(product._id),
        summary: `Permanently deleted product ${product.name} (${product.sku})`,
      });
      res.json({ ok: true, deleted: true, archived: false });
      return;
    }

    // Soft archive to protect historical order snapshots
    product.status = 'archived';
    await product.save();

    await recordAuditLog({
      actor: req.user,
      action: 'product.archive',
      resourceType: 'Product',
      resourceId: String(product._id),
      summary: `Archived product ${product.name} (${product.sku})`,
    });
    res.json({ ok: true, archived: true });
  } catch (err) {
    next(err);
  }
});

// Bulk CSV Export
router.get('/products/bulk/export', requirePermission('catalog.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const products = await ProductModel.find({ status: { $ne: 'archived' } }).populate('categoryId', 'slug').lean();
    const header = 'sku,name,slug,categorySlug,brandName,basePrice,salePrice,stockOnHand,status,description';
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = products.map((p) =>
      [
        escapeCsv(p.sku),
        escapeCsv(p.name),
        escapeCsv(p.slug),
        escapeCsv((p.categoryId as unknown as { slug?: string })?.slug || 'general'),
        escapeCsv(p.brandName || ''),
        p.basePrice,
        p.salePrice ?? '',
        p.stockOnHand,
        p.status,
        escapeCsv(p.description),
      ].join(','),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="novara-products-export.csv"');
    res.send([header, ...rows].join('\n'));
  } catch (err) {
    next(err);
  }
});

// Bulk CSV Import (validates rows before committing)
router.post('/products/bulk/import', requirePermission('catalog.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = z
      .object({
        rows: z
          .array(
            z.object({
              sku: z.string().trim().min(2).toUpperCase(),
              name: z.string().trim().min(2),
              slug: z.string().trim().min(2).toLowerCase(),
              categorySlug: z.string().trim().min(1),
              brandName: z.string().optional(),
              basePrice: z.number().min(0),
              salePrice: z.number().min(0).nullable().optional(),
              stockOnHand: z.number().int().min(0),
              status: z.enum(['draft', 'published']).default('draft'),
              description: z.string().min(5),
            }),
          )
          .max(500),
      })
      .parse(req.body);

    const categories = await CategoryModel.find().lean();
    const catSlugMap = new Map(categories.map((c) => [c.slug, c]));

    const errors: Array<{ row: number; sku: string; error: string }> = [];
    const seenSkus = new Set<string>();
    const validOps = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (seenSkus.has(row.sku)) {
        errors.push({ row: i + 1, sku: row.sku, error: 'Duplicate SKU inside CSV file.' });
        continue;
      }
      seenSkus.add(row.sku);

      const cat = catSlugMap.get(row.categorySlug.toLowerCase());
      if (!cat) {
        errors.push({ row: i + 1, sku: row.sku, error: `Category slug "${row.categorySlug}" not found.` });
        continue;
      }

      const existingSku = await ProductModel.findOne({ sku: row.sku }).select('_id').lean();
      if (existingSku) {
        errors.push({ row: i + 1, sku: row.sku, error: `SKU "${row.sku}" already exists in catalog.` });
        continue;
      }

      validOps.push({
        name: row.name,
        slug: row.slug,
        sku: row.sku,
        categoryId: cat._id,
        categoryPath: buildCategoryAncestryPath({
          categoryId: String(cat._id),
          allCategories: categories,
        }),
        brandName: row.brandName || '',
        basePrice: row.basePrice,
        salePrice: row.salePrice ?? null,
        stockOnHand: row.stockOnHand,
        status: row.status,
        description: row.description,
      });
    }

    if (errors.length > 0 && validOps.length === 0) {
      res.status(400).json({ ok: false, importedCount: 0, errors });
      return;
    }

    let insertedCount = 0;
    if (validOps.length > 0) {
      const inserted = await ProductModel.insertMany(validOps, { ordered: false });
      insertedCount = inserted.length;
      await recordAuditLog({
        actor: req.user,
        action: 'product.bulk_import',
        resourceType: 'Product',
        summary: `Bulk imported ${insertedCount} products (${errors.length} row errors)`,
      });
    }

    res.json({ ok: true, importedCount: insertedCount, errors });
  } catch (err) {
    next(err);
  }
});

// Inventory Movements log
router.get('/inventory/movements', requirePermission('inventory.view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Number(req.query.limit || 40));
    const movements = await InventoryMovementModel.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ ok: true, movements });
  } catch (err) {
    next(err);
  }
});

router.post('/inventory/adjust', requirePermission('inventory.adjust'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      delta: z.number().int().refine((n) => n !== 0, 'Adjustment delta cannot be zero'),
      reason: z.string().trim().min(3).max(240),
    });
    const parsed = schema.parse(req.body);

    const product = await ProductModel.findById(parsed.productId);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

    if (parsed.variantId) {
      const variant = product.variants.find((v: { _id: unknown }) => String(v._id) === parsed.variantId);
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found.');
      const prev = variant.stockOnHand;
      const nextVal = prev + parsed.delta;
      if (nextVal < variant.reservedStock) {
        throw new AppError(409, 'INVALID_STOCK_LEVEL', `Stock cannot drop below reserved quantity (${variant.reservedStock}).`);
      }
      variant.stockOnHand = nextVal;
      await product.save();

      await InventoryMovementModel.create({
        productId: product._id,
        variantId: variant._id,
        sku: variant.sku,
        productName: `${product.name} (${variant.title})`,
        type: 'adjustment',
        delta: parsed.delta,
        previousStockOnHand: prev,
        newStockOnHand: nextVal,
        previousReserved: variant.reservedStock,
        newReserved: variant.reservedStock,
        reason: parsed.reason,
        actorId: req.user!._id,
        actorName: req.user!.name,
      });
    } else {
      const prev = product.stockOnHand;
      const nextVal = prev + parsed.delta;
      if (nextVal < product.reservedStock) {
        throw new AppError(409, 'INVALID_STOCK_LEVEL', `Stock cannot drop below reserved quantity (${product.reservedStock}).`);
      }
      product.stockOnHand = nextVal;
      await product.save();

      await InventoryMovementModel.create({
        productId: product._id,
        sku: product.sku,
        productName: product.name,
        type: 'adjustment',
        delta: parsed.delta,
        previousStockOnHand: prev,
        newStockOnHand: nextVal,
        previousReserved: product.reservedStock,
        newReserved: product.reservedStock,
        reason: parsed.reason,
        actorId: req.user!._id,
        actorName: req.user!.name,
      });
    }

    await recordAuditLog({
      actor: req.user,
      action: 'inventory.adjust',
      resourceType: 'Product',
      resourceId: String(product._id),
      summary: `Adjusted stock for ${product.name} by ${parsed.delta > 0 ? `+${parsed.delta}` : parsed.delta} (${parsed.reason})`,
    });

    res.json({ ok: true, product: { ...product.toObject(), id: String(product._id) } });
  } catch (err) {
    next(err);
  }
});

export default router;
