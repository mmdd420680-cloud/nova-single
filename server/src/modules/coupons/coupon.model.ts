import mongoose, { Schema, type Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  description?: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  eligibleCategoryIds: mongoose.Types.ObjectId[];
  eligibleProductIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, maxlength: 240 },
    discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    maxDiscountAmount: { type: Number, min: 0, default: null },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    usageLimit: { type: Number, min: 1, default: null },
    usedCount: { type: Number, default: 0, min: 0 },
    perCustomerLimit: { type: Number, min: 1, default: 1 },
    eligibleCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    eligibleProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true },
);

export const CouponModel = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);

export interface ICouponRedemption extends Document {
  couponId: mongoose.Types.ObjectId;
  code: string;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  discountAmount: number;
  createdAt: Date;
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    code: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    discountAmount: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CouponRedemptionModel =
  mongoose.models.CouponRedemption || mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema);
