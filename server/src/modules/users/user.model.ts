import mongoose, { Schema, type Document } from 'mongoose';
import type { RoleName } from '../../../../src/lib/rbac';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  role: RoleName;
  customPermissions: string[];
  isVerified: boolean;
  status: 'active' | 'suspended';
  oauthProviders: {
    googleId?: string;
    facebookId?: string;
  };
  verificationTokenHash?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  notificationPrefs: {
    orderUpdates: boolean;
    promotions: boolean;
    backInStock: boolean;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, maxlength: 24 },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: [
        'customer',
        'super_admin',
        'admin',
        'order_manager',
        'inventory_manager',
        'catalog_manager',
        'customer_support',
        'finance_accounts',
      ],
      default: 'customer',
      index: true,
    },
    customPermissions: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    oauthProviders: {
      googleId: { type: String, sparse: true },
      facebookId: { type: String, sparse: true },
    },
    verificationTokenHash: { type: String, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    notificationPrefs: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      backInStock: { type: Boolean, default: true },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
