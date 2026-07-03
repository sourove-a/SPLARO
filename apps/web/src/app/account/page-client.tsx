'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  Download,
  Gem,
  Headphones,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  Shield,
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
  updateAccountProfile,
} from '@/lib/api/account'
import { cn } from '@/lib/utils/cn'

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
              <p className="account-order-card__id">{order.invoiceNumber}</p>
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
          {!featured ? (
            <button type="button" className="account-btn account-btn--ghost" onClick={() => openOrderInvoice(order)}>
              <Download className="h-4 w-4" strokeWidth={2} />
              Download Invoice
            </button>
          ) : null}
          <Link href="/track-order" className="account-icon-btn" aria-label="Track order">
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.1} />
          </Link>
        </div>
      </div>
    </article>
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
  const [wishlistProducts, setWishlistProducts] = useState<ProductCardData[]>([])
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' })
  const [address, setAddress] = useState({ address: '', city: 'Dhaka' })
  const [loyalty, setLoyalty] = useState({ points: 0, tier: 'BRONZE', memberSince: '' })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')

  const redirectToLogin = useCallback(() => {
    const tab = searchParams.get('tab')
    const next = tab ? `/account?tab=${tab}` : '/account'
    router.replace(`/login?next=${encodeURIComponent(next)}`)
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
          ...(data.user.avatar ? { avatar: data.user.avatar } : {}),
          ...(data.user.phoneVerified ? { phoneVerified: true } : {}),
          ...(data.user.loyaltyTier ? { loyaltyTier: data.user.loyaltyTier } : {}),
        })
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
    if (tab === 'wishlist') setSection('wishlist')
    if (tab === 'profile' || tab === 'security') setSection('profile')
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
    fetchUserOrders().then(setOrders)

    const savedCustomer = window.localStorage.getItem('splaro-customer')
    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer) as { address?: string; city?: string }
        setAddress({
          address: parsed.address ?? '',
          city: parsed.city ?? 'Dhaka',
        })
      } catch {
        /* ignore corrupt local draft */
      }
    }
  }, [user])

  useEffect(() => {
    if (!authHydrated || !user?.id) return
    void loadAccountProfile()
  }, [authHydrated, user?.id, loadAccountProfile])

  useEffect(() => {
    if (!wishlistIds.length) {
      setWishlistProducts([])
      return
    }

    fetchWishlistProducts(wishlistIds)
      .then(setWishlistProducts)
      .catch(() => setWishlistProducts([]))
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

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaveError('')
    setSaved(false)

    try {
      const payload = await updateAccountProfile({ name: profile.name })

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
      window.localStorage.setItem(
        'splaro-customer',
        JSON.stringify({ ...profile, ...address }),
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
    router.push('/shop')
  }

  if (!authHydrated || !user) {
    return (
      <div className="account-shell account-shell--loading">
        <AccountGlass center>
          <UserRound className="account-icon-muted mx-auto h-8 w-8" strokeWidth={2} />
          <p className="account-loading-text mt-4 text-sm font-semibold">Loading your account...</p>
        </AccountGlass>
      </div>
    )
  }

  const memberSince = loyalty.memberSince
    ? new Date(loyalty.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—'
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
            </div>
            <div>
              <p className="account-sidebar__name">
                {user.name}
                <BadgeCheck className="account-verified-badge h-4 w-4" strokeWidth={2.2} aria-label="Verified member" />
              </p>
              <div className="account-badge">
                <Gem className="h-3 w-3" strokeWidth={2.2} />
                {tierLabel} Member
              </div>
              <p className="account-sidebar__meta">
                Joined {memberSince} · {loyalty.points.toLocaleString('en-BD')} Points
              </p>
            </div>
          </div>

          <nav className="account-nav" aria-label="Account navigation">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={cn('account-nav__item', section === id && 'account-nav__item--active')}
                onClick={() => setSection(id)}
              >
                <span className="account-nav__icon">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="account-nav__label">{label}</span>
                <ChevronRight className="account-nav__chevron" strokeWidth={2} />
              </button>
            ))}
          </nav>

          <div className="account-nav__footer">
            <button
              type="button"
              className="account-nav__signout"
              onClick={() => {
                signOut()
                router.push('/login')
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
                    <p className="account-empty__text text-sm font-medium">Your recent orders will appear here.</p>
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
                  <p className="account-subtitle">Welcome back, {user.name.split(' ')[0]}.</p>
                </div>
                <Link href="/shop" className="account-btn account-btn--primary">
                  Continue Shopping
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
              {orders.length > 0 ? (
                <div className="account-order-list">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <AccountGlass className="account-empty">
                  <p className="account-empty__text text-sm font-medium">No orders yet.</p>
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
                <div className="account-address-card">
                  <div className="account-address-card__icon">
                    <MapPin className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="account-address-card__label">Default Address</p>
                    <p className="account-address-card__name">{user.name}</p>
                    <p className="account-address-card__text">
                      {address.address || 'Add your delivery address at checkout.'}
                      {address.address ? (
                        <>
                          <br />
                          {address.city}
                        </>
                      ) : null}
                    </p>
                    <p className="account-address-card__phone">{user.phone}</p>
                  </div>
                </div>
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
              {wishlistProducts.length > 0 ? (
                <div className="account-wishlist-grid">
                  {wishlistProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
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
              <AccountGlass className="account-panel">
                <form onSubmit={handleProfileSave}>
                <div className="account-form-grid">
                  <label className="account-field">
                    <span>Full name</span>
                    <input
                      required
                      value={profile.name}
                      onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                      className="account-input"
                    />
                  </label>
                  <label className="account-field">
                    <span>Email</span>
                    <input
                      required
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                      className="account-input"
                    />
                  </label>
                  <label className="account-field">
                    <span>Phone</span>
                    <input
                      required
                      value={profile.phone}
                      onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                      className="account-input"
                    />
                  </label>
                  <label className="account-field account-field--full">
                    <span>Delivery address</span>
                    <input
                      value={address.address}
                      onChange={(event) => setAddress({ ...address, address: event.target.value })}
                      className="account-input"
                      placeholder="House, road, area"
                    />
                  </label>
                  <label className="account-field">
                    <span>City</span>
                    <input
                      value={address.city}
                      onChange={(event) => setAddress({ ...address, city: event.target.value })}
                      className="account-input"
                    />
                  </label>
                </div>
                {saved ? (
                  <p className="account-save-note">Profile updated successfully.</p>
                ) : null}
                {saveError ? (
                  <p className="account-save-note account-save-note--error" role="alert">
                    {saveError}
                  </p>
                ) : null}
                <button type="submit" className="account-btn account-btn--primary" disabled={profileLoading}>
                  Save Changes
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
