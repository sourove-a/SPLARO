import { z } from 'zod';

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional().default(''),
  status: z.string().trim().max(32).optional().default(''),
});

export const orderStatusPatchSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  actor: z.string().trim().max(120).optional(),
});

export const orderCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(5).max(500),
  district: z.string().trim().min(1).max(120),
  thana: z.string().trim().min(1).max(120),
  product_name: z.string().trim().min(1).max(220),
  product_url: z.string().trim().url().max(500).optional().or(z.literal('')),
  image_url: z.string().trim().url().max(500).optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1).max(999),
  notes: z.string().trim().max(1200).optional().default(''),
  website: z.string().optional(),
});

export const signupCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  phone: z.string().trim().min(6).max(30),
  district: z.string().trim().min(1).max(120),
  thana: z.string().trim().min(1).max(120),
  address: z.string().trim().min(5).max(500),
  website: z.string().optional(),
});

export const subscriptionCreateSchema = z.object({
  email: z.string().trim().email().max(190),
  consent: z.coerce.boolean(),
  source: z.enum(['footer', 'popup']).default('footer'),
  website: z.string().optional(),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type OrderStatusPatchInput = z.infer<typeof orderStatusPatchSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type SignupCreateInput = z.infer<typeof signupCreateSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;

export const authSignupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(50),
  district: z.string().trim().max(120).optional().default(''),
  thana: z.string().trim().max(120).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  password: z.string().min(6).max(120).optional(),
});

export const authLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(120),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(120).optional().default(''),
  type: z.string().trim().max(20).optional().default(''),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  category_id: z.string().trim().max(64).optional().default(''),
  product_type: z.enum(['shoe', 'bag']),
  image_url: z.string().trim().max(1000).optional().default(''),
  product_url: z.string().trim().max(1000).optional().default(''),
  price: z.coerce.number().min(0),
  discount_price: z.coerce.number().min(0).optional().nullable(),
  stock_quantity: z.coerce.number().int().min(0).optional().default(0),
  variants_json: z.string().trim().optional().default(''),
  seo_title: z.string().trim().max(255).optional().default(''),
  seo_description: z.string().trim().max(1000).optional().default(''),
  meta_keywords: z.string().trim().max(255).optional().default(''),
  active: z.coerce.boolean().optional().default(true),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productBulkImportSchema = z.object({
  rows: z.array(productCreateSchema).min(1),
  mode: z.enum(['UPSERT', 'INSERT_ONLY']).optional().default('UPSERT'),
});

export const orderItemSchema = z.object({
  product_id: z.string().trim().max(64).optional(),
  product_name: z.string().trim().min(1).max(255),
  product_url: z.string().trim().max(1000).optional().default(''),
  image_url: z.string().trim().max(1000).optional().default(''),
  quantity: z.coerce.number().int().min(1).max(999),
  unit_price: z.coerce.number().min(0),
});

export const orderCreatePayloadSchema = z.object({
  user_id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(50),
  address: z.string().trim().min(5).max(1000),
  district: z.string().trim().max(120).optional().default(''),
  thana: z.string().trim().max(120).optional().default(''),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional().default('PENDING'),
  shipping: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  items: z.array(orderItemSchema).min(1),
});

export const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  refund_requested: z.coerce.boolean().optional(),
  refunded: z.coerce.boolean().optional(),
  actor_id: z.string().trim().max(64).optional(),
});

export const orderNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  actor_id: z.string().trim().max(64).optional(),
});

export const userBlockSchema = z.object({
  is_blocked: z.coerce.boolean(),
  actor_id: z.string().trim().max(64).optional(),
});

export const userRoleSchema = z.object({
  role: z.enum(['admin', 'staff', 'user']),
  actor_id: z.string().trim().max(64).optional(),
});

export const couponCreateSchema = z.object({
  code: z.string().trim().min(3).max(64),
  discount_type: z.enum(['PERCENT', 'FIXED']),
  discount_value: z.coerce.number().min(0),
  expiry_at: z.string().trim().optional().nullable(),
  usage_limit: z.coerce.number().int().min(0).optional().default(0),
  is_active: z.coerce.boolean().optional().default(true),
});

export const couponUpdateSchema = couponCreateSchema.partial();

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  status: z.enum(['Draft', 'Active', 'Paused', 'Completed']).optional().default('Draft'),
  audience_segment: z.enum(['ALL_USERS', 'NEW_SIGNUPS_7D', 'INACTIVE_30D']).optional().default('ALL_USERS'),
  target_count: z.coerce.number().int().min(0).optional().default(0),
  pulse_percent: z.coerce.number().int().min(0).max(100).optional().default(0),
  schedule_time: z.string().trim().optional(),
  content: z.string().trim().optional().default(''),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

export const campaignSendSchema = z.object({
  mode: z.enum(['test', 'now']).default('now'),
  actor_id: z.string().trim().max(64).optional(),
});

export type AuthSignupInput = z.infer<typeof authSignupSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductBulkImportInput = z.infer<typeof productBulkImportSchema>;
export type OrderCreatePayloadInput = z.infer<typeof orderCreatePayloadSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
export type OrderNoteInput = z.infer<typeof orderNoteSchema>;
export type UserBlockInput = z.infer<typeof userBlockSchema>;
export type UserRoleInput = z.infer<typeof userRoleSchema>;
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CampaignSendInput = z.infer<typeof campaignSendSchema>;
