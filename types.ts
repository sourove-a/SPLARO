
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
  role: 'USER' | 'ADMIN';
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

export interface SiteSettings {
  siteName: string;
  supportPhone: string;
  supportEmail: string;
  facebookLink: string;
  instagramLink: string;
  whatsappNumber: string;
  maintenanceMode: boolean;
  logoUrl?: string;
}

