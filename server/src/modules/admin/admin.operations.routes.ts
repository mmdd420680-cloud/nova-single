import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { OrderModel, PaymentTransactionModel } from '../orders/order.model';
import { ProductModel } from '../products/product.model';
import { ReturnRequestModel } from '../reviews/review.model';
import { InventoryMovementModel } from '../inventory/inventoryMovement.model';
import { AuditLogModel } from '../support/support.model';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, recordAuditLog, requirePermission, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { canTransitionOrderStatus, shouldRestoreStockOnCancel, type OrderStatus } from '../../../../src/lib/orderStateMachine';

const router = Router();
router.use(requireDatabase, authenticateRequired);

// Overview Dashboard metrics with strict definitions (gross, net excluding cancelled/refunded, pending, low stock)
router.get('/overview', requirePermission('dashboard.view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [ordersInWindow, pendingCount, lowStockProducts, outOfStockCount, recentAudit] = await Promise.all([
      OrderModel.find({ createdAt: { $gte: since } }).lean(),
      OrderModel.countDocuments({ orderStatus: { $in: ['pending', 'confirmed', 'processing', 'packed'] } }),
      ProductModel.find({
        status: 'published',
        $expr: { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, '$lowStockThreshold'] },
      })
        .select('name sku stockOnHand reservedStock lowStockThreshold')
        .limit(12)
        .lean(),
      ProductModel.countDocuments({
        status: 'published',
        $expr: { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, 0] },
      }),
      AuditLogModel.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    let grossSales = 0;
    let netSales = 0;
    let cancelledCount = 0;
    let returnedCount = 0;
    let paidTotal = 0;
    let codPendingTotal = 0;

    for (const o of ordersInWindow) {
      grossSales += o.total;
      if (o.orderStatus === 'cancelled') cancelledCount += 1;
      if (o.orderStatus === 'returned' || o.orderStatus === 'return_requested') returnedCount += 1;
      if (o.orderStatus !== 'cancelled' && o.orderStatus !== 'returned') {
        netSales += o.total;
      }
      if (o.paymentStatus === 'paid') paidTotal += o.total;
      if (o.paymentMethod === 'cod' && o.paymentStatus === 'unpaid' && o.orderStatus !== 'cancelled') {
        codPendingTotal += o.total;
      }
    }

    const activeOrderCount = ordersInWindow.filter((o) => o.orderStatus !== 'cancelled').length;
    const avgOrderValue = activeOrderCount > 0 ? Math.round(netSales / activeOrderCount) : 0;

    res.json({
      ok: true,
      periodDays: days,
      metrics: {
        grossSales,
        netSales,
        orderCount: ordersInWindow.length,
        activeOrderCount,
        avgOrderValue,
        pendingOrders: pendingCount,
        lowStockCount: lowStockProducts.length,
        outOfStockCount,
        cancelledCount,
        returnedCount,
        paidTotal,
        codPendingTotal,
      },
      lowStockProducts,
      recentAudit,
    });
  } catch (err) {
    next(err);
  }
});

// Orders Management
router.get('/orders', requirePermission('orders.view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: Record<string, unknown> = {};
    if (status) filter.orderStatus = status;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderNumber: regex }, { customerName: regex }, { customerEmail: regex }, { customerPhone: regex }];
    }

    const [total, orders] = await Promise.all([
      OrderModel.countDocuments(filter),
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      ok: true,
      orders: orders.map((o) => ({ ...o, id: String(o._id) })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/status', requirePermission('orders.manage_fulfillment'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nextStatus: z.enum(['confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled']),
      reason: z.string().trim().max(240).optional(),
      courierName: z.string().trim().max(80).optional(),
      trackingNumber: z.string().trim().max(80).optional(),
    });
    const parsed = schema.parse(req.body);

    const order = await OrderModel.findById(req.params.id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');

    const check = canTransitionOrderStatus({
      currentStatus: order.orderStatus,
      nextStatus: parsed.nextStatus as OrderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    });
    if (!check.allowed) {
      throw new AppError(400, 'ILLEGAL_TRANSITION', check.reason || 'Transition not allowed.');
    }

    const prevStatus = order.orderStatus;

    // On shipping: finalize stock deduction (convert reservedStock -> reduce stockOnHand + increment soldCount)
    if (parsed.nextStatus === 'shipped' && prevStatus !== 'shipped') {
      for (const item of order.items) {
        if (item.variantId) {
          await ProductModel.updateOne(
            { _id: item.productId, 'variants._id': item.variantId },
            {
              $inc: {
                'variants.$.stockOnHand': -item.quantity,
                'variants.$.reservedStock': -item.quantity,
                soldCount: item.quantity,
              },
            },
          );
        } else {
          await ProductModel.updateOne(
            { _id: item.productId },
            {
              $inc: {
                stockOnHand: -item.quantity,
                reservedStock: -item.quantity,
                soldCount: item.quantity,
              },
            },
          );
        }
        await InventoryMovementModel.create({
          productId: item.productId,
          variantId: item.variantId || null,
          sku: item.sku,
          productName: item.name,
          type: 'sale',
          delta: -item.quantity,
          previousStockOnHand: 0,
          newStockOnHand: 0,
          previousReserved: item.quantity,
          newReserved: 0,
          reason: `Shipped order ${order.orderNumber}`,
          referenceId: order.orderNumber,
          actorId: req.user!._id,
          actorName: req.user!.name,
        }).catch(() => undefined);
      }
      order.fulfillmentStatus = 'shipped';
      if (parsed.courierName) order.courierName = parsed.courierName;
      if (parsed.trackingNumber) order.trackingNumber = parsed.trackingNumber;
    }

    if (parsed.nextStatus === 'packed') order.fulfillmentStatus = 'packing';
    if (parsed.nextStatus === 'delivered') {
      order.fulfillmentStatus = 'delivered';
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
        order.paymentStatus = 'paid';
      }
    }

    if (parsed.nextStatus === 'cancelled') {
      if (shouldRestoreStockOnCancel(prevStatus, order.paymentStatus)) {
        for (const item of order.items) {
          if (item.variantId) {
            await ProductModel.updateOne(
              { _id: item.productId, 'variants._id': item.variantId },
              { $inc: { 'variants.$.reservedStock': -item.quantity } },
            );
          } else {
            await ProductModel.updateOne({ _id: item.productId }, { $inc: { reservedStock: -item.quantity } });
          }
          await InventoryMovementModel.create({
            productId: item.productId,
            variantId: item.variantId || null,
            sku: item.sku,
            productName: item.name,
            type: 'release',
            delta: item.quantity,
            previousStockOnHand: 0,
            newStockOnHand: 0,
            previousReserved: item.quantity,
            newReserved: 0,
            reason: parsed.reason || `Cancelled by staff (${order.orderNumber})`,
            referenceId: order.orderNumber,
            actorId: req.user!._id,
            actorName: req.user!.name,
          }).catch(() => undefined);
        }
      }
      order.fulfillmentStatus = 'cancelled';
      order.cancellationReason = parsed.reason || 'Cancelled by operations team';
    }

    order.orderStatus = parsed.nextStatus;
    order.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: parsed.nextStatus,
      actorId: req.user!._id as unknown as typeof order.statusHistory[0]['actorId'],
      actorName: req.user!.name,
      reason: parsed.reason,
      timestamp: new Date(),
    });
    await order.save();

    await recordAuditLog({
      actor: req.user,
      action: 'order.status_change',
      resourceType: 'Order',
      resourceId: order.orderNumber,
      summary: `Order ${order.orderNumber} transitioned ${prevStatus} -> ${parsed.nextStatus}`,
    });

    res.json({ ok: true, order: { ...order.toObject(), id: String(order._id) } });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/notes', requirePermission('orders.view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { note } = z.object({ note: z.string().trim().min(2).max(500) }).parse(req.body);
    const order = await OrderModel.findById(req.params.id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    order.staffNotes.push({ note, actorName: req.user!.name, timestamp: new Date() });
    await order.save();
    res.json({ ok: true, order: { ...order.toObject(), id: String(order._id) } });
  } catch (err) {
    next(err);
  }
});

// Returns & Refunds inspection workflow (explicitly requires physical inspection before restocking)
router.get('/returns', requirePermission('orders.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const returns = await ReturnRequestModel.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, returns: returns.map((r) => ({ ...r, id: String(r._id) })) });
  } catch (err) {
    next(err);
  }
});

router.patch('/returns/:id', requirePermission('refunds.manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(['approved', 'rejected', 'received', 'refunded']),
      inspectionNotes: z.string().trim().max(500).optional(),
      restockEligible: z.boolean().default(false),
    });
    const parsed = schema.parse(req.body);

    const ret = await ReturnRequestModel.findById(req.params.id);
    if (!ret) throw new AppError(404, 'RETURN_NOT_FOUND', 'Return request not found.');

    ret.status = parsed.status;
    if (parsed.inspectionNotes) ret.inspectionNotes = parsed.inspectionNotes;
    ret.handledBy = req.user!._id as unknown as typeof ret.handledBy;

    // Only restock when physically received & marked eligible for resale
    if (parsed.status === 'received' && parsed.restockEligible && !ret.restocked) {
      for (const item of ret.items) {
        await ProductModel.updateOne({ _id: item.productId }, { $inc: { stockOnHand: item.quantity } });
        await InventoryMovementModel.create({
          productId: item.productId,
          sku: item.sku,
          productName: item.name,
          type: 'return',
          delta: item.quantity,
          previousStockOnHand: 0,
          newStockOnHand: 0,
          previousReserved: 0,
          newReserved: 0,
          reason: `Restocked after return inspection (${ret.orderNumber})`,
          referenceId: ret.orderNumber,
          actorId: req.user!._id,
          actorName: req.user!.name,
        }).catch(() => undefined);
      }
      ret.restocked = true;
    }

    if (parsed.status === 'refunded') {
      await OrderModel.updateOne(
        { _id: ret.orderId },
        { $set: { orderStatus: 'returned', paymentStatus: 'refunded', fulfillmentStatus: 'returned' } },
      );
      await PaymentTransactionModel.updateOne(
        { orderId: ret.orderId, status: 'paid' },
        { $set: { status: 'refunded', refundedAmount: ret.refundAmount } },
      );
    }

    await ret.save();

    await recordAuditLog({
      actor: req.user,
      action: 'return.update',
      resourceType: 'ReturnRequest',
      resourceId: ret.orderNumber,
      summary: `Updated return for ${ret.orderNumber} to ${parsed.status}`,
    });

    res.json({ ok: true, returnRequest: { ...ret.toObject(), id: String(ret._id) } });
  } catch (err) {
    next(err);
  }
});

// Payment transactions reconciliation
router.get('/payments', requirePermission('payments.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transactions = await PaymentTransactionModel.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ ok: true, transactions: transactions.map((t) => ({ ...t, id: String(t._id) })) });
  } catch (err) {
    next(err);
  }
});

// Reports & Filtered CSV export
router.get('/reports/sales-csv', requirePermission('reports.view'), async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orders = await OrderModel.find().sort({ createdAt: -1 }).limit(1000).lean();
    const header = 'orderNumber,date,customerName,customerPhone,division,paymentMethod,paymentStatus,orderStatus,subtotal,discount,shippingCharge,total';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = orders.map((o) =>
      [
        esc(o.orderNumber),
        esc(new Date(o.createdAt).toISOString()),
        esc(o.customerName),
        esc(o.customerPhone),
        esc(o.shippingAddress?.division || ''),
        esc(o.paymentMethod),
        esc(o.paymentStatus),
        esc(o.orderStatus),
        o.subtotal,
        o.discount,
        o.shippingCharge,
        o.total,
      ].join(','),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="novara-sales-report.csv"');
    res.send([header, ...rows].join('\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
