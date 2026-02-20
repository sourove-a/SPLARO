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

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type OrderStatusPatchInput = z.infer<typeof orderStatusPatchSchema>;
