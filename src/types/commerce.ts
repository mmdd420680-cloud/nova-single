import type { RoleName } from '../lib/rbac';
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from '../lib/orderStateMachine';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RoleName;
  customPermissions: string[];
  isVerified: boolean;
  notificationPrefs: {
    orderUpdates: boolean;
    promotions: boolean;
    backInStock: boolean;
  };
}

export interface ProductImage {
  url: string;
  publicId?: string;
  alt: string;
  sortOrder: number;
}

export interface ProductVariant {
  _id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  price?: number | null;
  salePrice?: number | null;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface ProductItem {
  id: string;
  _id?: string;
  name: string;
  nameBn?: string;
  slug: string;
  sku: string;
  barcode?: string;
  brandId?: string | { _id: string; name: string; slug: string; logoUrl?: string } | null;
  brandName?: string;
  categoryId: string | { _id: string; name: string; nameBn?: string; slug: string; attributeSchemaType?: string };
  subCategoryId?: string | null;
  description: string;
  shortDescription?: string;
  features?: string[];
  attributeGroup: 'general' | 'electronics' | 'beauty' | 'books' | 'home';
  attributes?: Record<string, string>;
  specifications?: Array<{ label: string; value: string }>;
  bilingualKeywords?: string[];
  basePrice: number;
  salePrice?: number | null;
  flashSalePrice?: number | null;
  flashSaleStartsAt?: string | null;
  flashSaleEndsAt?: string | null;
  currentPrice: number;
  originalPrice: number | null;
  discountPercent: number;
  isFlashSaleActive: boolean;
  availableStock: number;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold?: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  warrantyInfo?: string;
  returnPolicyNote?: string;
  faqs?: Array<{ question: string; answer: string }>;
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isPremiumCollection?: boolean;
  soldCount: number;
  ratingAverage: number;
  reviewCount: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface CategoryItem {
  id: string;
  _id?: string;
  name: string;
  nameBn?: string;
  slug: string;
  parentId?: string | null;
  iconName?: string;
  imageUrl?: string;
  description?: string;
  attributeSchemaType: 'general' | 'electronics' | 'beauty' | 'books' | 'home';
  sortOrder: number;
  isActive: boolean;
  showInHeader: boolean;
}

export interface BrandItem {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
}

export interface CartLine {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  sku: string;
  variantTitle?: string | null;
  imageUrl: string;
  unitPrice: number;
  originalPrice?: number | null;
  quantity: number;
  availableStock: number;
  isAvailable: boolean;
  categoryId?: string;
}

export interface SavedAddress {
  id: string;
  _id?: string;
  label: string;
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  house: string;
  road?: string;
  landmark?: string;
  postalCode?: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}

export interface OrderRecord {
  id: string;
  _id?: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    variantId?: string | null;
    sku: string;
    name: string;
    slug: string;
    imageUrl: string;
    variantOptions?: Record<string, string>;
    quantity: number;
    unitPrice: number;
    originalPrice?: number | null;
    lineTotal: number;
  }>;
  shippingAddress: {
    recipientName: string;
    phone: string;
    division: string;
    district: string;
    upazila: string;
    area: string;
    house: string;
    road?: string;
    landmark?: string;
    postalCode?: string;
    deliveryInstructions?: string;
  };
  deliveryMethod: 'standard' | 'express';
  shippingZone: string;
  couponCode?: string | null;
  subtotal: number;
  discount: number;
  shippingCharge: number;
  tax: number;
  total: number;
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'card';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  courierName?: string;
  trackingNumber?: string;
  cancellationReason?: string;
  deliveredAt?: string;
  createdAt: string;
  statusHistory: Array<{
    fromStatus?: string;
    toStatus: string;
    actorName: string;
    reason?: string;
    timestamp: string;
  }>;
  staffNotes?: Array<{ note: string; actorName: string; timestamp: string }>;
}

export interface ReviewItem {
  _id: string;
  id?: string;
  productId: string | { _id: string; name: string; slug: string; sku?: string };
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  status: 'pending' | 'approved' | 'rejected';
  moderationReason?: string;
  reportedBy?: string[];
  createdAt: string;
}

export interface HomepageConfigData {
  announcementBar: {
    enabled: boolean;
    text: string;
    linkText?: string;
    linkUrl?: string;
  };
  heroSlides: Array<{
    badgeText: string;
    headlineLine1: string;
    headlineLine2: string;
    subtitle: string;
    ctaLabel: string;
    ctaUrl: string;
    imageUrl: string;
    isActive: boolean;
  }>;
  promoBentoCards: Array<{
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaUrl: string;
    imageUrl: string;
    theme: 'royal-blue' | 'ice-blue' | 'midnight-navy';
  }>;
  featureBanners: {
    giftBanner: {
      enabled: boolean;
      title: string;
      subtitle: string;
      description: string;
      ctaLabel: string;
      ctaUrl: string;
    };
    trustBanner: {
      enabled: boolean;
      title: string;
      subtitle: string;
      bullets: string[];
    };
  };
  sectionOrder: string[];
  enabledSections: Record<string, boolean>;
  shippingSettings: {
    dhakaMetroCharge: number;
    dhakaSuburbCharge: number;
    nationwideCharge: number;
    freeShippingThreshold: number;
    expressSurcharge: number;
  };
  contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
    whatsappUrl?: string;
    messengerUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
  };
  seoDefaults: {
    siteName: string;
    defaultTitle: string;
    defaultDescription: string;
  };
}

export interface PromotionalAdData {
  id: string;
  title: string;
  altText: string;
  imageUrl: string;
  destinationUrl: string;
  placement: 'homepage_mid' | 'homepage_bottom';
  isEnabled: boolean;
  isPublished: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}
