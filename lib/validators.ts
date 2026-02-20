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
