
export enum View {
  HOME = 'HOME',
  SHOP = 'SHOP',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  CART = 'CART',
  CHECKOUT = 'CHECKOUT',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  USER_DASHBOARD = 'USER_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ORDER_SUCCESS = 'ORDER_SUCCESS',
  STORY = 'STORY',
  SUPPORT = 'SUPPORT'
}

export type Language = 'EN' | 'BN';
export type Theme = 'DARK' | 'LIGHT';

export interface Product {
  id: string;
  name: string;
  productType?: 'shoe' | 'bag' | string;
  brand: 'Nike' | 'Adidas' | 'Jordan' | 'Splaro' | 'Luxury Imports' | 'New Balance' | 'Yeezy' | 'Balenciaga' | 'Gucci' | 'Prada' | 'Louis Vuitton' |
  'Anta' | 'Li-Ning' | '361 Degrees' | 'Xtep' | 'Peak' | 'Qiaodan' | 'Bmai' | 'ERKE' | 'Feiyue' | 'Warrior' | 'Belle' | 'Red Dragonfly' | 'Aokang' | 'Fuguiniao' | 'Staccato' | 'Teenmix' | 'Do-win' | 'Dynafish' |
  'Dior' | 'Versace' | 'Fendi' | 'Hermes' | 'Saint Laurent' | 'Burberry' | 'Chanel' | 'Valentino' | 'Givenchy' | 'Off-White' | 'Alexander McQueen' | string;
  price: number;
  originalPrice?: number;
  image: string;
  category: 'Sneakers' | 'Running' | 'Casual' | 'Basketball' | 'Sandals' | 'Boots' | 'Formal' | 'Shoes' | 'Bags' | string;
  subCategory?: string;
  type: 'Men' | 'Women' | 'Unisex';
  description: { EN: string; BN: string };
  sizes: string[];
  colors: string[];
  materials?: string[];
  featured?: boolean;
  tags?: ('New Arrival' | 'Best Seller' | 'On Sale')[];
  sku?: string;
  weight?: string;
  dimensions?: { l: string; w: string; h: string };
  stock?: number;
  discountPercentage?: number;
  sizeChartImage?: string;
  additionalImages?: string[];
  seoTitle?: string;
  seoDescription?: string;
  variations?: {
    color: string;
    sizes: string[];
    price?: number;
    stock?: number;
    image?: string;
    sku?: string;
  }[];
}


export type OrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface DiscountCode {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrder?: number;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  profileImage?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
  defaultShippingAddress?: string;
  notificationEmail?: boolean;
  notificationSms?: boolean;
  preferredLanguage?: 'EN' | 'BN' | string;
  twoFactorEnabled?: boolean;
  lastPasswordChangeAt?: string;
  forceRelogin?: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  items: any[];
  total: number;
  discountAmount?: number;
  discountCode?: string;
  shippingFee: number;
  district: string;
  thana: string;
  address: string;
  status: OrderStatus;
  trackingNumber?: string;
  adminNotes?: string;
  customerComment?: string;
  createdAt: string;
}

export type HeroTitleMode = 'AUTO' | 'MANUAL';
export type HeroBackgroundType = 'GRADIENT' | 'IMAGE';
export type HeroAlignment = 'LEFT' | 'CENTER';

export interface ThemeSettings {
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  typography: {
    fontFamily: 'Inter' | 'Manrope' | 'Plus Jakarta Sans' | 'Urbanist' | 'Poppins';
    baseSize: number;
    headingScale: number;
  };
  borderRadius: number;
  shadowIntensity: number;
  buttonStyle: 'PILL' | 'ROUNDED';
  focusStyle: 'SUBTLE' | 'BRIGHT';
  containerWidth: 'LG' | 'XL' | '2XL' | 'FULL';
  spacingScale: 'COMPACT' | 'COMFORTABLE' | 'RELAXED';
  reduceGlow: boolean;
  premiumMinimalMode: boolean;
}

export interface HeroSettings {
  heroTitle: string;
  heroTitleMode: HeroTitleMode;
  heroTitleManualBreaks: string;
  heroSubtitle: string;
  heroBadge: string;
  heroCtaLabel: string;
  heroCtaUrl: string;
  heroBgType: HeroBackgroundType;
  heroBgValue: string;
  heroAlignment: HeroAlignment;
  heroMaxLines: number;
  heroEnabled: boolean;
  autoBalance: boolean;
}

export interface CategoryHeroOverride extends Partial<HeroSettings> {
  sortDefault?: 'Newest' | 'PriceLowToHigh' | 'PriceHighToLow';
}

export interface CmsBundle {
  themeSettings: ThemeSettings;
  heroSettings: HeroSettings;
  categoryHeroOverrides: {
    all: CategoryHeroOverride;
    shoes: CategoryHeroOverride;
    bags: CategoryHeroOverride;
  };
}

export interface CmsRevision {
  id: string;
  mode: 'DRAFT' | 'PUBLISHED';
  timestamp: string;
  adminUser: string;
  payload: CmsBundle;
}

export interface SiteSettings {
  siteName: string;
  supportPhone: string;
  supportEmail: string;
  googleClientId?: string;
  facebookLink: string;
  instagramLink: string;
  whatsappNumber: string;
  maintenanceMode: boolean;
  logoUrl?: string;
  cmsPages: {
    manifest: {
      heading: string;
      subheading: string;
      body: string;
    };
    privacyPolicy: {
      heading: string;
      subheading: string;
      body: string;
    };
    termsConditions: {
      heading: string;
      subheading: string;
      body: string;
    };
    orderTracking: {
      heading: string;
      subheading: string;
      body: string;
    };
    refundPolicy: {
      heading: string;
      subheading: string;
      body: string;
    };
  };
  storyPosts: {
    id: string;
    title: string;
    excerpt: string;
    body: string;
    imageUrl?: string;
    published: boolean;
    publishAt?: string;
    createdAt: string;
    updatedAt?: string;
  }[];
  cmsDraft: CmsBundle;
  cmsPublished: CmsBundle;
  cmsActiveVersion: 'DRAFT' | 'PUBLISHED';
  cmsRevisions: CmsRevision[];
}
