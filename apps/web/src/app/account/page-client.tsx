'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Camera,
  ChevronRight,
  Download,
  Headphones,
  Heart,
  History,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Package,
  Phone,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import type { ProductCardData } from '@/types/product'
import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import { formatBDT } from '@/lib/utils/currency'
import {
  DELIVERY_STAGES,
  formatOrderDate,
  fetchUserOrders,
  getDeliveryStage,
  getOrderStats,
  getStageIndex,
  isActiveOrder,
  openOrderInvoice,
  type DeliveryStage,
  type StoredOrder,
} from '@/lib/orders'
import { AccountGlass } from '@/components/account/AccountGlass'
import {
  ApiError,
  fetchAccountProfile,
  fetchWishlistProducts,
  sendAccountEmailVerification,
  updateAccountProfile,
  verifyAccountEmail,
} from '@/lib/api/account'
import { displayOrderCode, isFeatureEnabled } from '@splaro/config'
import { cn } from '@/lib/utils/cn'
import { BD_DISTRICTS } from '@/lib/checkout/bd-districts'
import { getThanasForDistrict } from '@/lib/checkout/bd-thanas'
import { formatBdPhoneInput } from '@/lib/checkout/phone'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'

type AccountSection =
  | 'dashboard'
  | 'orders'
  | 'history'
  | 'addresses'
  | 'wishlist'
  | 'profile'

const navItems: {
  id: AccountSection
  label: string
  icon: typeof Package
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'history', label: 'Order History', icon: History },
  { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

const trustItems = [
  { icon: Truck, title: 'Fast Delivery', text: 'On all orders' },
  { icon: Shield, title: 'Secure Payment', text: '100% protected' },
  { icon: RotateCcw, title: 'Easy Returns', text: 'Hassle free' },
  { icon: Headphones, title: '24/7 Support', text: 'Always here' },
]

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function DeliveryTimeline({ stage }: { stage: DeliveryStage }) {
  const activeIndex = getStageIndex(stage)

  return (
    <div className="account-timeline">
      {DELIVERY_STAGES.map((item, index) => {
        const done = index <= activeIndex
        const current = index === activeIndex

        return (
          <div key={item} className="account-timeline__step">
            <div className="account-timeline__track">
              <span
                className={cn(
                  'account-timeline__dot',
                  done && 'account-timeline__dot--done',
                  current && 'account-timeline__dot--current',
                )}
              />
              {index < DELIVERY_STAGES.length - 1 ? (
                <span
                  className={cn(
                    'account-timeline__line',
                    index < activeIndex && 'account-timeline__line--done',
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                'account-timeline__label',
                current && 'account-timeline__label--current',
              )}
            >
              {item}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function buildTrackOrderHref(order: StoredOrder): string {
  const phone = encodeURIComponent(order.customer.phone)
  const orderRef = encodeURIComponent(order.invoiceNumber || order.id)
  return `/track-order?phone=${phone}&order=${orderRef}`
}

function OrderCard({
  order,
  featured = false,
}: {
  order: StoredOrder
  featured?: boolean
}) {
  const stage = getDeliveryStage(order.createdAt, order.tracking?.stage, order.status)
  const item = order.items[0]
  const itemCount = order.items.reduce((sum, entry) => sum + entry.quantity, 0)

  return (
    <article className={cn('account-order-card', featured && 'account-order-card--featured')}>
      <div className="account-order-card__main">
        <div className="account-order-card__thumb">
          {item ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="88px"
              className="object-cover object-top"
            />
          ) : (
            <Package className="account-icon-muted h-6 w-6" strokeWidth={1.75} />
          )}
        </div>

        <div className="account-order-card__body">
          <div className="account-order-card__top">
            <div>
              <p className="account-order-card__id">{displayOrderCode(order.invoiceNumber, order.id)}</p>
              <p className="account-order-card__meta">
                {formatOrderDate(order.createdAt)} · {itemCount} item{itemCount === 1 ? '' : 's'}
              </p>
            </div>
            <p className="account-order-card__price">{formatBDT(order.total)}</p>
          </div>

          {featured ? (
            <DeliveryTimeline stage={stage} />
          ) : (
            <div className="account-order-card__status">
              <span
                className={cn(
                  'account-status-badge',
                  stage === 'Delivered'
                    ? 'account-status-badge--delivered'
                    : stage === 'Pending'
                      ? 'account-status-badge--pending'
                      : 'account-status-badge--active',
                )}
              >
                {stage}
              </span>
              {stage === 'Delivered' ? (
                <span className="account-order-card__delivered-on">
                  Delivered on {formatOrderDate(order.createdAt)}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="account-order-card__actions">
          <button type="button" className="account-btn account-btn--ghost" onClick={() => openOrderInvoice(order)}>
            <Download className="h-4 w-4" strokeWidth={2} />
            Download Invoice
          </button>
          <Link href={buildTrackOrderHref(order)} className="account-icon-btn" aria-label="Track order">
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.1} />
          </Link>
        </div>
      </div>
    </article>
  )
}

function AccountIconField({
  label,
  icon: Icon,
  children,
  className,
  hint,
}: {
  label: string
  icon: typeof UserRound
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={cn('account-field account-field--icon', className)}>
      <span className="account-field__label">{label}</span>
      <div className="account-input-wrap">
        <span className="account-input-wrap__icon" aria-hidden="true">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        {children}
      </div>
      {hint ? <span className="account-field__hint">{hint}</span> : null}
    </label>
  )
}

function TrustStrip() {
  return (
    <div className="account-trust">
      {trustItems.map(({ icon: Icon, title, text }) => (
        <div key={title} className="account-trust__item">
          <div className="account-trust__icon">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <p className="account-trust__title">{title}</p>
            <p className="account-trust__text">{text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AccountDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const signIn = useAuthStore((state) => state.signIn)
  const setUser = useAuthStore((state) => state.setUser)
  const signOut = useAuthStore((state) => state.signOut)
  const wishlistIds = useWishlistStore((state) => state.productIds)

  const [section, setSection] = useState<AccountSection>('orders')
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [wishlistProducts, setWishlistProducts] = useState<ProductCardData[]>([])
  const [wishlistError, setWishlistError] = useState<string | null>(null)
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' })
  const [address, setAddress] = useState({
    address: '',
    district: 'Dhaka',
    thana: getThanasForDistrict('Dhaka')[0] ?? '',
  })
  const [loyalty, setLoyalty] = useState({ points: 0, tier: 'BRONZE', memberSince: '' })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [verificationError, setVerificationError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationCooldown, setVerificationCooldown] = useState(0)

  const welcome = searchParams.get('welcome') === '1'

  const redirectToLogin = useCallback(() => {
    const tab = searchParams.get('tab')
    const next = tab ? `/account?tab=${tab}` : '/account'
    safeClientNavigate(router, `/login?next=${encodeURIComponent(next)}`, 'replace')
  }, [router, searchParams])

  const handleSessionExpired = useCallback(async () => {
    await signOut()
    redirectToLogin()
  }, [signOut, redirectToLogin])

  const loadAccountProfile = useCallback(async () => {
    setProfileLoading(true)
    setConnectionError('')

    try {
      const data = await fetchAccountProfile()
      setLoyalty({
        points: data.profile.loyaltyPoints,
        tier: data.profile.loyaltyTier,
        memberSince: data.profile.memberSince ?? '',
      })

      const current = useAuthStore.getState().user
      if (current) {
        setUser({
          ...current,
          emailVerified: Boolean(data.user.emailVerified),
          ...(data.user.avatar ? { avatar: data.user.avatar } : {}),
          ...(data.user.phoneVerified ? { phoneVerified: true } : {}),
          ...(data.user.loyaltyTier ? { loyaltyTier: data.user.loyaltyTier } : {}),
        })
      }

      if (data.address) {
        setAddress({
          address: data.address.address,
          district: data.address.district,
          thana: data.address.thana,
        })
      } else {
        try {
          const savedCustomer = window.localStorage.getItem('splaro-customer')
          if (savedCustomer) {
            const parsed = JSON.parse(savedCustomer) as {
              address?: string
              city?: string
              district?: string
              thana?: string
            }
            const district = parsed.district ?? parsed.city ?? 'Dhaka'
            setAddress({
              address: parsed.address ?? '',
              district,
              thana:
                parsed.thana || getThanasForDistrict(district)[0] || '',
            })
          }
        } catch {
          /* ignore corrupt local draft */
        }
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.isAuthError) {
        await handleSessionExpired()
        return
      }

      const message =
        error instanceof ApiError
          ? error.isNetworkError
            ? 'Could not reach SPLARO servers. Check your connection and retry.'
            : error.message
          : 'Could not load account data. Please refresh.'
      setConnectionError(message)
    } finally {
      setProfileLoading(false)
    }
  }, [handleSessionExpired, setUser])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const welcome = searchParams.get('welcome') === '1'
    if (tab === 'dashboard' || welcome) setSection('dashboard')
    else if (tab === 'orders') setSection('orders')
    else if (tab === 'history') setSection('history')
    else if (tab === 'addresses') setSection('addresses')
    else if (tab === 'wishlist') setSection('wishlist')
    else if (tab === 'profile' || tab === 'security') setSection('profile')
  }, [searchParams])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      redirectToLogin()
    }
  }, [authHydrated, user, redirectToLogin])

  useEffect(() => {
    if (!user) return
    setProfile({
      name: user.name,
      email: user.email,
      phone: user.phone,
    })
    fetchUserOrders()
      .then((data) => {
        setOrders(data)
        setOrdersError(null)
      })
      .catch((err: unknown) => {
        setOrders([])
        setOrdersError(err instanceof Error ? err.message : 'Could not load your orders.')
      })
  }, [user])

  useEffect(() => {
    if (!authHydrated || !user?.id) return
    void loadAccountProfile()
  }, [authHydrated, user?.id, loadAccountProfile])

  useEffect(() => {
    if (verificationCooldown <= 0) return
    const timer = window.setInterval(() => {
      setVerificationCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [verificationCooldown])

  useEffect(() => {
    if (!wishlistIds.length) {
      setWishlistProducts([])
      setWishlistError(null)
      return
    }

    fetchWishlistProducts(wishlistIds)
      .then((products) => {
        setWishlistProducts(products)
        setWishlistError(null)
      })
      .catch((err: unknown) => {
        setWishlistProducts([])
        setWishlistError(err instanceof Error ? err.message : 'Could not load your wishlist.')
      })
  }, [wishlistIds])

  const stats = useMemo(() => getOrderStats(orders), [orders])
  const activeOrder = useMemo(
    () => orders.find((order) => isActiveOrder(getDeliveryStage(order.createdAt, order.tracking?.stage, order.status))),
    [orders],
  )
  const recentOrders = useMemo(
    () =>
      orders
        .filter((order) => order.id !== activeOrder?.id)
        .slice(0, 4),
    [orders, activeOrder],
  )

  const thanaOptions = useMemo(() => getThanasForDistrict(address.district), [address.district])

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaveError('')
    setSaved(false)
    setIsSaving(true)

    const trimmedName = profile.name.trim()
    const trimmedAddress = address.address.trim()
    const trimmedDistrict = address.district.trim()
    const trimmedThana = address.thana.trim()

    if (!trimmedName) {
      setSaveError('Full name is required.')
      setIsSaving(false)
      return
    }
    if (!trimmedAddress || !trimmedDistrict || !trimmedThana) {
      setSaveError('Delivery address, district, and thana are required.')
      setIsSaving(false)
      return
    }

    try {
      const payload = await updateAccountProfile({
        name: trimmedName,
        address: trimmedAddress,
        district: trimmedDistrict,
        thana: trimmedThana,
      })

      if (!payload.user) {
        setSaveError(payload.error ?? 'Could not save profile')
        return
      }

      signIn({
        ...profile,
        ...payload.user,
        ...(user?.avatar ? { avatar: user.avatar } : {}),
        ...(user?.phoneVerified ? { phoneVerified: user.phoneVerified } : {}),
        ...(user?.loyaltyTier ? { loyaltyTier: user.loyaltyTier } : {}),
      })

      const nextAddress = payload.address ?? {
        address: trimmedAddress,
        district: trimmedDistrict,
        thana: trimmedThana,
      }
      setAddress(nextAddress)

      window.localStorage.setItem(
        'splaro-customer',
        JSON.stringify({
          name: trimmedName,
          email: profile.email,
          phone: profile.phone,
          address: nextAddress.address,
          city: nextAddress.district,
          district: nextAddress.district,
          thana: nextAddress.thana,
        }),
      )
      setSaved(true)
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) {
        await handleSessionExpired()
        return
      }
      setSaveError(
        error instanceof ApiError ? error.message : 'Network error. Please try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendVerification = async () => {
    if (verificationBusy || verificationCooldown > 0) return
    setVerificationBusy(true)
    setVerificationError('')
    setVerificationMessage('')
    try {
      const result = await sendAccountEmailVerification()
      setVerificationOpen(true)
      setVerificationMessage(result.message)
      setVerificationCooldown(result.expiresIn > 0 ? 60 : 0)
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) {
        await handleSessionExpired()
        return
      }
      setVerificationError(error instanceof Error ? error.message : 'Could not send verification email.')
    } finally {
      setVerificationBusy(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (verificationBusy) return
    const code = verificationCode.replace(/\D/g, '')
    if (code.length !== 6) {
      setVerificationError('Enter the 6-digit code from your email.')
      return
    }
    setVerificationBusy(true)
    setVerificationError('')
    try {
      const result = await verifyAccountEmail(code)
      setUser(result.user)
      setVerificationCode('')
      setVerificationOpen(false)
      setVerificationMessage('Email verified successfully.')
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) {
        await handleSessionExpired()
        return
      }
      setVerificationError(error instanceof Error ? error.message : 'Could not verify email.')
    } finally {
      setVerificationBusy(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Image must be under 2 MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const avatar = typeof reader.result === 'string' ? reader.result : null
      if (!avatar) return

      try {
        const payload = await updateAccountProfile({ avatar })
        if (!payload.user) {
          setSaveError(payload.error ?? 'Could not upload photo')
          return
        }
        signIn({ ...user, ...payload.user })
        setSaved(true)
        setSaveError('')
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) {
          await handleSessionExpired()
          return
        }
        setSaveError(
          error instanceof ApiError ? error.message : 'Could not upload photo',
        )
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAccountBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    safeClientNavigate(router, '/shop')
  }

  if (!authHydrated) {
    return (
      <div className="account-shell account-shell--loading">
        <AccountGlass center>
          <Loader2 className="account-icon-muted mx-auto h-8 w-8 animate-spin" strokeWidth={2} />
          <p className="account-loading-text mt-4 text-sm font-semibold">Loading your account…</p>
        </AccountGlass>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="account-shell account-shell--loading">
        <AccountGlass center>
          <Loader2 className="account-icon-muted mx-auto h-8 w-8 animate-spin" strokeWidth={2} />
          <p className="account-loading-text mt-4 text-sm font-semibold">Redirecting to sign in…</p>
        </AccountGlass>
      </div>
    )
  }

  const memberSince = loyalty.memberSince
    ? new Date(loyalty.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  const loyaltyEnabled = isFeatureEnabled('loyalty')
  const tierLabel = loyalty.tier.charAt(0) + loyalty.tier.slice(1).toLowerCase()

  return (
    <div className="account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />

      <div className="account-layout">
        <button type="button" className="account-back-btn" onClick={handleAccountBack}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
          Back
        </button>

        <AccountGlass className="account-sidebar">
          <div className="account-sidebar__profile">
            <div className="account-avatar-wrap">
              <div className="account-avatar">
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.name} fill sizes="72px" className="object-cover" />
                ) : (
                  initials(user.name)
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="account-avatar-upload"
                aria-label="Upload profile photo"
                onChange={handleAvatarChange}
              />
              <span className="account-avatar-edit" aria-hidden="true">
                <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
            </div>
            <div>
              <p className="account-sidebar__name">
                {user.name}
                {user.emailVerified ? (
                  <BadgeCheck className="account-verified-badge h-4 w-4" strokeWidth={2.2} aria-label="Verified email" />
                ) : null}
              </p>
              {user.email ? <p className="account-sidebar__email">{user.email}</p> : null}
              {loyaltyEnabled ? (
                <>
                  <div className="account-badge">{tierLabel} Member</div>
                  <p className="account-sidebar__meta">
                    {memberSince ? `Joined ${memberSince}` : 'Member'}
                    {' · '}
                    {loyalty.points.toLocaleString('en-BD')} Points
                  </p>
                </>
              ) : memberSince ? (
                <p className="account-sidebar__meta">Member since {memberSince}</p>
              ) : null}
            </div>
          </div>

          <div className="account-nav-panel">
            <nav className="account-nav" aria-label="Account navigation">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn('account-nav__item', section === id && 'account-nav__item--active')}
                  onClick={() => setSection(id)}
                  aria-current={section === id ? 'page' : undefined}
                >
                  <span className="account-nav__icon">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="account-nav__label">{label}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="account-nav__signout"
              onClick={() => {
                signOut()
                safeClientNavigate(router, '/login')
              }}
            >
              <span className="account-nav__icon account-nav__icon--muted">
                <LogOut className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="account-nav__label">Sign Out</span>
            </button>
          </div>
        </AccountGlass>

        <main className="account-main">
          {connectionError ? (
            <div className="account-connection-banner" role="alert">
              <p>{connectionError}</p>
              <button
                type="button"
                className="account-link-btn"
                onClick={() => void loadAccountProfile()}
              >
                Retry
              </button>
            </div>
          ) : null}
          {section === 'orders' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">My Orders</h1>
                  <p className="account-subtitle">Track, manage and view your orders.</p>
                </div>
                <Link href="/track-order" className="account-btn account-btn--primary">
                  <Package className="h-4 w-4" strokeWidth={2} />
                  Track Order
                </Link>
              </div>

              <div className="account-stats">
                {[
                  { label: 'Active Orders', value: stats.active },
                  { label: 'Total Orders', value: stats.total },
                  { label: 'Delivered', value: stats.delivered },
                  { label: 'Returns', value: stats.returns },
                ].map((item) => (
                  <AccountGlass key={item.label} className="account-stat">
                    <div className="account-stat__icon">
                      <Package className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="account-stat__value">{String(item.value).padStart(2, '0')}</p>
                      <p className="account-stat__label">{item.label}</p>
                    </div>
                  </AccountGlass>
                ))}
              </div>

              <section className="account-section">
                <div className="account-section__head">
                  <h2 className="account-section__title">Active Orders</h2>
                  <button type="button" className="account-link-btn" onClick={() => setSection('history')}>
                    View All
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                {activeOrder ? (
                  <OrderCard order={activeOrder} featured />
                ) : (
                  <AccountGlass className="account-empty">
                    <ShoppingBag className="account-icon-muted mx-auto h-8 w-8" strokeWidth={1.75} />
                    <p className="account-empty__title mt-4 text-lg font-bold">No active orders</p>
                    <p className="account-empty__text mt-2 text-sm font-medium">
                      Place an order to see live delivery tracking here.
                    </p>
                    <Link href="/shop" className="account-btn account-btn--primary mt-5">
                      Shop SPLARO
                    </Link>
                  </AccountGlass>
                )}
              </section>

              <section className="account-section">
                <div className="account-section__head">
                  <h2 className="account-section__title">Recent Orders</h2>
                  <button type="button" className="account-link-btn" onClick={() => setSection('history')}>
                    View All
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                {recentOrders.length > 0 ? (
                  <div className="account-order-list">
                    {recentOrders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                ) : (
                  <AccountGlass className="account-empty">
                    <Package className="account-icon-muted mx-auto h-8 w-8" strokeWidth={1.75} />
                    <p className="account-empty__title mt-4 text-lg font-bold">No recent orders</p>
                    <p className="account-empty__text mt-2 text-sm font-medium">
                      Your past SPLARO orders will show up here after checkout.
                    </p>
                    <Link href="/shop" className="account-btn account-btn--primary mt-5">
                      Start Shopping
                    </Link>
                  </AccountGlass>
                )}
              </section>

              <TrustStrip />
            </>
          ) : null}

          {section === 'dashboard' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">Dashboard</h1>
                  <p className="account-subtitle">
                    {welcome
                      ? `Welcome to SPLARO, ${user.name.split(' ')[0]}! Your account is ready.`
                      : `Welcome back, ${user.name.split(' ')[0]}.`}
                  </p>
                </div>
                <Link href="/shop" className="account-btn account-btn--primary">
                  Continue Shopping
                </Link>
              </div>
              {welcome ? (
                <AccountGlass className="account-welcome-banner">
                  <p className="account-welcome-banner__eyebrow">New member</p>
                  <h2 className="account-welcome-banner__title">Start with your first look</h2>
                  <p className="account-welcome-banner__text">
                    Browse the shop, save favourites, and checkout faster next time.
                  </p>
                  <Link href="/shop" className="account-btn account-btn--primary account-welcome-banner__cta">
                    Explore Shop
                  </Link>
                </AccountGlass>
              ) : null}
              <div className="account-stats">
                {[
                  { label: 'Active Orders', value: stats.active },
                  { label: 'Total Orders', value: stats.total },
                  { label: 'Delivered', value: stats.delivered },
                  { label: 'Returns', value: stats.returns },
                ].map((item) => (
                  <AccountGlass key={item.label} className="account-stat">
                    <div className="account-stat__icon">
                      <Package className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="account-stat__value">{String(item.value).padStart(2, '0')}</p>
                      <p className="account-stat__label">{item.label}</p>
                    </div>
                  </AccountGlass>
                ))}
              </div>
              <AccountGlass className="account-panel">
                <h2 className="account-section__title">Quick Access</h2>
                <div className="account-quick-grid">
                  {navItems.slice(1, 5).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className="account-quick-card"
                      onClick={() => setSection(id)}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                      {label}
                    </button>
                  ))}
                </div>
              </AccountGlass>
              <TrustStrip />
            </>
          ) : null}

          {section === 'history' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">Order History</h1>
                  <p className="account-subtitle">Every SPLARO order in one place.</p>
                </div>
              </div>
              {ordersError ? (
                <AccountGlass className="account-empty">
                  <p className="account-empty__text text-sm font-medium text-red-600">{ordersError}</p>
                  <button
                    type="button"
                    className="account-btn account-btn--primary mt-5"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </AccountGlass>
              ) : orders.length > 0 ? (
                <div className="account-order-list">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <AccountGlass className="account-empty">
                  <Package className="account-icon-muted mx-auto h-8 w-8" strokeWidth={1.75} />
                  <p className="account-empty__title mt-4 text-lg font-bold">No orders yet</p>
                  <p className="account-empty__text mt-2 text-sm font-medium">
                    When you place an order, tracking and invoices will live here.
                  </p>
                  <Link href="/shop" className="account-btn account-btn--primary mt-5">
                    Start Shopping
                  </Link>
                </AccountGlass>
              )}
            </>
          ) : null}

          {section === 'addresses' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">Saved Addresses</h1>
                  <p className="account-subtitle">Your default delivery details for faster checkout.</p>
                </div>
              </div>
              <AccountGlass className="account-panel">
                {address.address ? (
                  <div className="account-address-card">
                    <div className="account-address-card__icon">
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="account-address-card__label">Default Address</p>
                      <p className="account-address-card__name">{user.name}</p>
                      <p className="account-address-card__text">
                        {address.address}
                        <br />
                        {[address.thana, address.district].filter(Boolean).join(', ')}
                      </p>
                      <p className="account-address-card__phone">{formatBdPhoneInput(user.phone)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="account-empty account-empty--compact">
                    <MapPin className="account-icon-muted mx-auto h-7 w-7" strokeWidth={1.75} />
                    <p className="account-empty__title mt-3 text-base font-bold">No saved address yet</p>
                    <p className="account-empty__text mt-2 text-sm font-medium">
                      Add your delivery address in Profile for faster checkout.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  className="account-btn account-btn--primary account-address-card__edit"
                  onClick={() => setSection('profile')}
                >
                  {address.address ? 'Edit in Profile' : 'Add Address in Profile'}
                </button>
              </AccountGlass>
            </>
          ) : null}

          {section === 'wishlist' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">Wishlist</h1>
                  <p className="account-subtitle">Save pieces you love for later.</p>
                </div>
              </div>
              {wishlistError ? (
                <AccountGlass className="account-empty">
                  <p className="account-empty__text text-sm font-medium text-red-600">{wishlistError}</p>
                  <button
                    type="button"
                    className="account-btn account-btn--primary mt-5"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </AccountGlass>
              ) : wishlistProducts.length > 0 ? (
                <div className="account-wishlist-grid">
                  {wishlistProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : wishlistIds.length > 0 ? (
                <AccountGlass className="account-empty">
                  <p className="account-empty__text text-sm font-medium">Loading saved items…</p>
                </AccountGlass>
              ) : (
                <AccountGlass className="account-empty">
                  <Heart className="account-icon-muted mx-auto h-8 w-8" strokeWidth={1.75} />
                  <p className="account-empty__title mt-4 text-lg font-bold">Your wishlist is empty</p>
                  <Link href="/shop" className="account-btn account-btn--primary mt-5">
                    Explore Shop
                  </Link>
                </AccountGlass>
              )}
            </>
          ) : null}

          {section === 'profile' ? (
            <>
              <div className="account-main__head">
                <div>
                  <h1 className="account-title">Profile</h1>
                  <p className="account-subtitle">Update your profile and account details.</p>
                </div>
              </div>
              <AccountGlass className="account-panel account-panel--profile">
                <form onSubmit={handleProfileSave} className="account-profile-form">
                  <div className="account-form-section">
                    <div className="account-form-section__head">
                      <UserRound className="h-4 w-4" strokeWidth={2} />
                      <div>
                        <h2 className="account-form-section__title">Personal details</h2>
                        <p className="account-form-section__text">Name and verified contact info.</p>
                      </div>
                    </div>
                    <div className="account-form-grid">
                      <AccountIconField label="Full name" icon={UserRound}>
                        <input
                          required
                          value={profile.name}
                          onChange={(event) => {
                            setSaved(false)
                            setProfile({ ...profile, name: event.target.value })
                          }}
                          className="account-input account-input--with-icon"
                          autoComplete="name"
                        />
                      </AccountIconField>
                      <AccountIconField
                        label="Email"
                        icon={Mail}
                        hint={user.emailVerified ? 'Verified email · secured and locked' : 'Optional verification · account access is not restricted'}
                        className="account-field--email"
                      >
                        <input
                          readOnly
                          type="email"
                          value={profile.email}
                          className="account-input account-input--with-icon account-input--readonly"
                        />
                        <span className="account-input-wrap__lock" aria-hidden="true">
                          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span className={cn('account-email-status', user.emailVerified ? 'account-email-status--verified' : 'account-email-status--unverified')}>
                          {user.emailVerified ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </AccountIconField>
                      {!user.emailVerified ? (
                        <div className="account-email-verify account-field--full">
                          <div className="account-email-verify__intro">
                            <div className="account-email-verify__mark"><Mail className="h-5 w-5" strokeWidth={1.8} /></div>
                            <div>
                              <p className="account-email-verify__title">Protect your order updates</p>
                              <p className="account-email-verify__text">Optional: verify {profile.email} with a private 6-digit code.</p>
                            </div>
                            <button
                              type="button"
                              className="account-btn account-btn--verify"
                              onClick={() => void handleSendVerification()}
                              disabled={verificationBusy || verificationCooldown > 0}
                            >
                              {verificationBusy && !verificationOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                              {verificationCooldown > 0 ? `Resend in ${verificationCooldown}s` : verificationOpen ? 'Send again' : 'Verify email'}
                            </button>
                          </div>
                          {verificationOpen ? (
                            <div className="account-email-verify__form">
                              <input
                                value={verificationCode}
                                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="account-email-code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                aria-label="Six digit email verification code"
                                placeholder="000000"
                                maxLength={6}
                                autoFocus
                              />
                              <button type="button" className="account-btn account-btn--primary" onClick={() => void handleVerifyEmail()} disabled={verificationBusy || verificationCode.length !== 6}>
                                {verificationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Confirm code
                              </button>
                            </div>
                          ) : null}
                          {verificationMessage ? <p className="account-email-verify__success" role="status">{verificationMessage}</p> : null}
                          {verificationError ? <p className="account-email-verify__error" role="alert">{verificationError}</p> : null}
                        </div>
                      ) : null}
                      <AccountIconField
                        label="Phone"
                        icon={Phone}
                        hint="Verified account phone"
                      >
                        <input
                          readOnly
                          value={formatBdPhoneInput(profile.phone)}
                          className="account-input account-input--with-icon account-input--readonly"
                        />
                        <span className="account-input-wrap__lock" aria-hidden="true">
                          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                      </AccountIconField>
                    </div>
                  </div>

                  <div className="account-form-section">
                    <div className="account-form-section__head">
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                      <div>
                        <h2 className="account-form-section__title">Delivery address</h2>
                        <p className="account-form-section__text">
                          Saved for checkout and faster repeat orders.
                        </p>
                      </div>
                    </div>
                    <div className="account-form-grid">
                      <AccountIconField
                        label="House, road, area"
                        icon={MapPin}
                        className="account-field--full"
                      >
                        <input
                          required
                          value={address.address}
                          onChange={(event) => {
                            setSaved(false)
                            setAddress({ ...address, address: event.target.value })
                          }}
                          className="account-input account-input--with-icon"
                          placeholder="House, road, area"
                          autoComplete="street-address"
                        />
                      </AccountIconField>
                      <AccountIconField label="District" icon={Building2}>
                        <select
                          required
                          value={address.district}
                          onChange={(event) => {
                            setSaved(false)
                            const nextDistrict = event.target.value
                            const thanas = getThanasForDistrict(nextDistrict)
                            setAddress({
                              ...address,
                              district: nextDistrict,
                              thana: thanas[0] ?? '',
                            })
                          }}
                          className="account-input account-input--with-icon account-input--select"
                        >
                          {BD_DISTRICTS.map((district) => (
                            <option key={district} value={district}>
                              {district}
                            </option>
                          ))}
                        </select>
                      </AccountIconField>
                      <AccountIconField label="Thana / Upazila" icon={MapPinned}>
                        <select
                          required
                          value={address.thana}
                          onChange={(event) => {
                            setSaved(false)
                            setAddress({ ...address, thana: event.target.value })
                          }}
                          className="account-input account-input--with-icon account-input--select"
                        >
                          {thanaOptions.map((thana) => (
                            <option key={thana} value={thana}>
                              {thana}
                            </option>
                          ))}
                        </select>
                      </AccountIconField>
                    </div>
                  </div>

                  {saved ? (
                    <p className="account-save-note account-save-note--success" role="status">
                      Profile saved successfully.
                    </p>
                  ) : null}
                  {saveError ? (
                    <p className="account-save-note account-save-note--error" role="alert">
                      {saveError}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    className="account-btn account-btn--primary account-btn--save"
                    disabled={profileLoading || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </form>
              </AccountGlass>
            </>
          ) : null}

        </main>
      </div>
    </div>
  )
}
