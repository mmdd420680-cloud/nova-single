import mongoose, { Schema, type Document } from 'mongoose';

export interface IHomepageConfig extends Document {
  key: string;
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
    cloudinaryPublicId?: string;
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
  updatedAt: Date;
}

const HomepageConfigSchema = new Schema<IHomepageConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    announcementBar: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: 'Free Shipping on Orders Over ৳999' },
      linkText: { type: String },
      linkUrl: { type: String },
    },
    heroSlides: {
      type: [
        {
          badgeText: { type: String, required: true },
          headlineLine1: { type: String, required: true },
          headlineLine2: { type: String, required: true },
          subtitle: { type: String, required: true },
          ctaLabel: { type: String, required: true },
          ctaUrl: { type: String, required: true },
          imageUrl: { type: String, required: true },
          cloudinaryPublicId: { type: String },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    promoBentoCards: {
      type: [
        {
          eyebrow: { type: String, required: true },
          title: { type: String, required: true },
          subtitle: { type: String, required: true },
          ctaLabel: { type: String, required: true },
          ctaUrl: { type: String, required: true },
          imageUrl: { type: String, required: true },
          theme: { type: String, enum: ['royal-blue', 'ice-blue', 'midnight-navy'], default: 'royal-blue' },
        },
      ],
      default: [],
    },
    featureBanners: {
      giftBanner: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: 'Special Gift' },
        subtitle: { type: String, default: 'For Our Valued Customers' },
        description: { type: String, default: 'Get a Free Gift on Orders Over ৳5,000' },
        ctaLabel: { type: String, default: 'Shop Now' },
        ctaUrl: { type: String, default: '/shop' },
      },
      trustBanner: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: 'Premium Quality Guaranteed' },
        subtitle: { type: String, default: 'Shop with Confidence' },
        bullets: { type: [String], default: ['Easy Returns', 'Secure Payment', 'Trusted Store'] },
      },
    },
    sectionOrder: {
      type: [String],
      default: [
        'hero',
        'categories',
        'promoBento',
        'bestSellers',
        'featureBanners',
        'promotionalAd',
        'premiumCollection',
        'reviews',
        'newsletter',
      ],
    },
    enabledSections: {
      type: Map,
      of: Boolean,
      default: {
        hero: true,
        categories: true,
        promoBento: true,
        bestSellers: true,
        featureBanners: true,
        promotionalAd: true,
        premiumCollection: true,
        reviews: true,
        newsletter: true,
      },
    },
    shippingSettings: {
      dhakaMetroCharge: { type: Number, default: 60 },
      dhakaSuburbCharge: { type: Number, default: 90 },
      nationwideCharge: { type: Number, default: 120 },
      freeShippingThreshold: { type: Number, default: 999 },
      expressSurcharge: { type: Number, default: 80 },
    },
    contactInfo: {
      phone: { type: String },
      email: { type: String },
      address: { type: String },
      whatsappUrl: { type: String },
      messengerUrl: { type: String },
      instagramUrl: { type: String },
      linkedinUrl: { type: String },
      facebookUrl: { type: String },
    },
    seoDefaults: {
      siteName: { type: String, default: 'NOVARA COMMERCE' },
      defaultTitle: { type: String, default: 'NOVARA COMMERCE – Smart Technology & Lifestyle Store Bangladesh' },
      defaultDescription: {
        type: String,
        default: 'Shop genuine electronics, fashion, books, and home essentials across Bangladesh with fast nationwide delivery.',
      },
    },
  },
  { timestamps: true },
);

export const HomepageConfigModel =
  mongoose.models.HomepageConfig || mongoose.model<IHomepageConfig>('HomepageConfig', HomepageConfigSchema);

export interface IPromotionalAd extends Document {
  title: string;
  altText: string;
  imageUrl: string;
  cloudinaryPublicId?: string;
  destinationUrl: string;
  placement: 'homepage_mid' | 'homepage_bottom';
  isEnabled: boolean;
  isPublished: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionalAdSchema = new Schema<IPromotionalAd>(
  {
    title: { type: String, required: true, maxlength: 140 },
    altText: { type: String, required: true, maxlength: 200 },
    imageUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    destinationUrl: { type: String, required: true },
    placement: { type: String, enum: ['homepage_mid', 'homepage_bottom'], default: 'homepage_mid' },
    isEnabled: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PromotionalAdModel =
  mongoose.models.PromotionalAd || mongoose.model<IPromotionalAd>('PromotionalAd', PromotionalAdSchema);

export interface ICmsPage extends Document {
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: Date;
}

const CmsPageSchema = new Schema<ICmsPage>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isPublished: { type: Boolean, default: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
  },
  { timestamps: true },
);

export const CmsPageModel = mongoose.models.CmsPage || mongoose.model<ICmsPage>('CmsPage', CmsPageSchema);
