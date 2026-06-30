/** Phone OTP for track-order — off by default (no SMS cost). Set true when SMS is ready. */
export function isStorefrontPhoneOtpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STOREFRONT_PHONE_OTP_ENABLED === 'true'
}
