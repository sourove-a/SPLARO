import type { Metadata } from 'next';
import NextAppClient from '../../components/NextAppClient';

export const revalidate = 300;
export const fetchCache = 'default-cache';

const metadataByRoute: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'SPLARO | Luxury Footwear & Bags',
    description: 'Premium imported footwear and bags with refined design and elevated finish.',
  },
  '/shop': {
    title: 'Shop | SPLARO',
    description: 'Explore premium footwear and bag collections from SPLARO.',
  },
  '/cart': {
    title: 'Cart | SPLARO',
    description: 'Review selected SPLARO products before checkout.',
  },
  '/checkout': {
    title: 'Checkout | SPLARO',
    description: 'Complete your SPLARO order securely.',
  },
  '/login': {
    title: 'Login | SPLARO',
    description: 'Sign in to manage your SPLARO account and orders.',
  },
  '/signup': {
    title: 'Create Account | SPLARO',
    description: 'Create your SPLARO account for faster checkout and order tracking.',
  },
  '/user_dashboard': {
    title: 'Account Dashboard | SPLARO',
    description: 'Manage your profile, orders, and security settings.',
  },
  '/admin_dashboard': {
    title: 'Admin Dashboard | SPLARO',
    description: 'Manage products, orders, users, and analytics in SPLARO admin.',
  },
  '/order-tracking': {
    title: 'Order Tracking | SPLARO',
    description: 'Track your SPLARO order and shipping updates.',
  },
  '/story': {
    title: 'Story | SPLARO',
    description: 'Latest brand updates and collection stories from SPLARO.',
  },
};

function resolvePath(slug?: string[]): string {
  if (!slug || slug.length === 0) return '/';
  return `/${slug.join('/')}`.toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolved = await params;
  const path = resolvePath(resolved.slug);
  const matched =
    metadataByRoute[path] ||
    (path.startsWith('/product/')
      ? {
          title: 'Product Details | SPLARO',
          description: 'View product details, pricing, and availability on SPLARO.',
        }
      : undefined) ||
    (path.startsWith('/admin/')
      ? {
          title: 'Admin | SPLARO',
          description: 'SPLARO admin tools and controls.',
        }
      : undefined) || {
      title: 'SPLARO',
      description: 'Luxury footwear and bags.',
    };

  return {
    title: matched.title,
    description: matched.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: matched.title,
      description: matched.description,
      url: path,
      siteName: 'SPLARO',
      images: ['/favicon-512.png'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: matched.title,
      description: matched.description,
      images: ['/favicon-512.png'],
    },
  };
}

export default function CatchAllPage() {
  return <NextAppClient />;
}
