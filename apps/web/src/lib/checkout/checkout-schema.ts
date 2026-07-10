import { z } from 'zod'
import { getBdPhoneError } from '@/lib/checkout/phone'

const paymentMethodSchema = z.enum(['Cash on Delivery', 'bKash', 'Nagad', 'SSLCommerz'])

export const checkoutFormSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  email: z.union([
    z.literal(''),
    z.string().trim().email('Enter a valid email address'),
  ]),
  phone: z.string().superRefine((value, ctx) => {
    const message = getBdPhoneError(value)
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    }
  }),
  address: z.string().trim().min(1, 'Delivery address is required'),
  city: z.string().min(1, 'Select a district'),
  thana: z.string().min(1, 'Select a thana'),
  payment: paymentMethodSchema,
})

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>
