import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { View, Product, Order, Language, Theme, OrderStatus, DiscountCode, User, SiteSettings } from './types';


const INITIAL_SLIDES = [
  { img: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=1600', title: 'Nike Air Max', subtitle: 'Global Archive', tags: ['VOLT', 'AIR'] },
  { img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1600', title: 'Jordan Retro', subtitle: 'Heritage Elite', tags: ['RED', 'OG'] },
  { img: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?q=80&w=1600', title: 'Adidas Pulse', subtitle: 'Performance', tags: ['WHITE', 'BOOST'] }
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'n1',
    name: 'Nike Air Max Flow',
    brand: 'Nike',
    price: 16500,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Imported high-performance cushioning with Air Flow technology.', BN: 'এয়ার ফ্লো টেকনোলজি সহ উন্নত কুশনিং যুক্ত ইম্পোর্টেড জুতা।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Volt Green', 'Black'],
    featured: true
  },
  {
    id: 'ad1',
    name: 'Adidas Ultra Boost',
    brand: 'Adidas',
    price: 18500,
    image: 'https://images.unsplash.com/photo-1587563877366-c4584ca64ecb?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Legendary energy return and superior comfort.', BN: 'অসাধারণ এনার্জি রিটার্ন এবং আরামদায়ক অ্যাডডাস স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Cloud White', 'Black'],
    featured: true
  },
  {
    id: 'j1',
    name: 'Air Jordan 1 Retro',
    brand: 'Jordan',
    price: 24500,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'The basketball legacy, remastered with premium materials.', BN: 'প্রিমিয়াম ম্যাটেরিয়াল দিয়ে তৈরি করা বাস্কেটবল লেজেন্ড।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Chicago Red', 'Obsidian'],
    featured: true
  },
  {
    id: 'gc1',
    name: 'Gucci Ace Sneaker',
    brand: 'Gucci',
    price: 68000,
    image: 'https://images.unsplash.com/photo-1621245033771-e14768305372?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Italian craftsmanship with iconic web stripe detail.', BN: 'আইকনিক ওয়েব স্ট্রাইপ সহ ইতালিয়ান ক্রাফটসম্যানশিপ।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['White/Green/Red'],
    featured: true
  },
  {
    id: 'lv1',
    name: 'LV Trainer Elite',
    brand: 'Louis Vuitton',
    price: 85000,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Luxury fashion combined with vintage aesthetic.', BN: 'ভিনটেজ নান্দনিকতার সাথে লাক্সারি ফ্যাশন।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Damier Azure', 'Black/Gold'],
    featured: true
  },
  {
    id: 'b1',
    name: 'Balenciaga Track v2',
    brand: 'Balenciaga',
    price: 55000,
    image: 'https://images.unsplash.com/photo-1512374382149-433a72b75d9b?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'High-fashion chunky sneaker with layered construction.', BN: 'লেয়ার্ড কনস্ট্রাকশন সহ হাই-ফ্যাশন স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['White/Orange', 'Full Black'],
    featured: true
  },
  {
    id: 'pr1',
    name: 'Prada Cloudbust Thunder',
    brand: 'Prada',
    price: 72000,
    image: 'https://images.unsplash.com/photo-1588117304481-229448ee3901?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Futuristic design with sculptural 3D sole.', BN: 'থ্রিডি সোল সহ ফিউচারিস্টিক প্রাদা স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Matte Black', 'Silver'],
    featured: true
  },
  {
    id: 'dr1',
    name: 'Dior B23 High-Top',
    brand: 'Dior',
    price: 92000,
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Oblique canvas with transparent paneling.', BN: 'ট্রান্সপারেন্ট প্যানেলিং সহ ডিওর অবলিক ক্যানভাস।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Dior Oblique'],
    featured: true
  },
  {
    id: 'vr1',
    name: 'Versace Chain Reaction',
    brand: 'Versace',
    price: 64000,
    image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Bold chain-link sole with Medusa details.', BN: 'মেডুসা ডিটেইল সহ বোল্ড চেইন-লিঙ্ক সোল।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Multi-Color'],
    featured: true
  },
  {
    id: 'fn1',
    name: 'Fendi Flow Sneaker',
    brand: 'Fendi',
    price: 58000,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Sleek design with side zipper and FF motif.', BN: 'এফএফ মোটিফ সহ আধুনিক স্লিড ডিজাইন।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Yellow/Black'],
    featured: true
  },
  {
    id: 'hm1',
    name: 'Hermes Bouncing Sneaker',
    brand: 'Hermes',
    price: 98000,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Pinnacle of luxury materials and craftsmanship.', BN: 'লাক্সারি ম্যাটেরিয়াল এবং ক্রাফটসম্যানশিপের শীর্ষে।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Cognac', 'White'],
    featured: true
  },
  {
    id: 'ysl1',
    name: 'SLP Court Classic',
    brand: 'Saint Laurent',
    price: 48000,
    image: 'https://images.unsplash.com/photo-1512374382149-433a72b75d9b?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Minimalist leather sneaker with hand-written logo.', BN: 'হ্যান্ড-রাইটিং লোগো সহ মিনিমালিস্ট লেদার স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Optical White'],
    featured: true
  },
  {
    id: 'bb1',
    name: 'Burberry Larkhall',
    brand: 'Burberry',
    price: 42000,
    image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Classic check pattern on premium canvas.', BN: 'প্রিমিয়াম ক্যানভাসে ক্লাসিক চেক প্যাটার্ন।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Archive Beige'],
    featured: true
  },
  {
    id: 'ch1',
    name: 'Chanel CC Low-Top',
    brand: 'Chanel',
    price: 115000,
    image: 'https://images.unsplash.com/photo-1584735175315-9d58238a06c4?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'The ultimate fashion statement with CC logo.', BN: 'সিসি লোগো সহ ফ্যাশন স্টেটমেন্ট।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Black/White Velvet'],
    featured: true
  },
  {
    id: 'v1',
    name: 'Valentino Rockstud',
    brand: 'Valentino',
    price: 52000,
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Signature studs on premium leather sneaker.', BN: 'প্রিমিয়াম লেদার স্নিকারে সিগনেচার স্টাডস।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Burgundy', 'Navy'],
    featured: true
  },
  {
    id: 'gv1',
    name: 'Givenchy City Court',
    brand: 'Givenchy',
    price: 46000,
    image: 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Modern urban sneaker with 4G metal hardware.', BN: 'ফোর-জি মেটাল হার্ডওয়্যার সহ মডার্ন স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Silver Chrome'],
    featured: true
  },
  {
    id: 'ow1',
    name: 'Off-White ODSY-1000',
    brand: 'Off-White',
    price: 62000,
    image: 'https://images.unsplash.com/photo-1588117304481-229448ee3901?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Virgil Ablohs industrial design language.', BN: 'ভার্জিল আবলো এর ইন্ডাস্ট্রিয়াল ডিজাইন ল্যাঙ্গুয়েজ।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Gradient Orange'],
    featured: true
  },
  {
    id: 'y1',
    name: 'Yeezy Boost 350',
    brand: 'Yeezy',
    price: 32000,
    image: 'https://images.unsplash.com/photo-1584735175315-9d58238a06c4?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Kanye West design, pinnacle of comfort and style.', BN: 'আরাম এবং স্টাইলের শীর্ষে থাকা কানিয়ি ওয়েস্ট ডিজাইন।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Carbon', 'Zebra'],
    featured: true
  },
  {
    id: 'nb1',
    name: 'NB 9060 Crystal',
    brand: 'New Balance',
    price: 24000,
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Modern chunky silhouette with futuristic cushioning.', BN: 'ফিউচারিস্টিক কুশনিং সহ মডার্ন চাঙ্কি স্নিকার।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Sea Salt', 'Grey'],
    featured: true
  },
  {
    id: 'amq1',
    name: 'McQueen Oversized',
    brand: 'Alexander McQueen',
    price: 54000,
    image: 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=800',
    category: 'Shoes',
    type: 'Men',
    description: { EN: 'Iconic oversized sole with luxury leather upper.', BN: 'লাক্সারি লেদার সহ আইকনিক ওভারসাইজড সোল।' },
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    colors: ['Black Suede'],
    featured: true
  }
];






const INITIAL_DISCOUNTS: DiscountCode[] = [
  { id: 'd1', code: 'SPLARO2026', type: 'PERCENTAGE', value: 10, minOrder: 10000, active: true },
  { id: 'd2', code: 'WELCOME500', type: 'FIXED', value: 500, active: true }
];

interface AppContextType {
  view: View;
  setView: (v: View) => void;
  products: Product[];
  addOrUpdateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  cart: any[];
  addToCart: (item: any) => void;
  removeFromCart: (cartId: string) => void;
  orders: Order[];
  addOrder: (o: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrderMetadata: (orderId: string, data: { trackingNumber?: string; adminNotes?: string }) => void;
  deleteOrder: (id: string) => void;
  user: User | null;
  setUser: (u: User | null) => void;
  users: User[];
  deleteUser: (id: string) => void;
  updateUser: (u: User) => void;

  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  discounts: DiscountCode[];

  addDiscount: (d: DiscountCode) => void;
  toggleDiscount: (id: string) => void;
  deleteDiscount: (id: string) => void;
  slides: any[];
  setSlides: (s: any[]) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  smtpSettings: any;
  setSmtpSettings: (s: any) => void;
  logisticsConfig: any;
  setLogisticsConfig: (c: any) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (b: boolean) => void;
  siteSettings: SiteSettings;
  setSiteSettings: (s: SiteSettings) => void;
  dbStatus: 'CONNECTED' | 'LOCAL' | 'OFFLINE';
  logs: any[];
  trafficData: any[];
  initializeSheets: () => Promise<void>;
}



const AppContext = createContext<AppContextType | undefined>(undefined);

const loadFromStorage = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return defaultValue;

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(defaultValue) && !Array.isArray(parsed)) return defaultValue;
      return parsed;
    } catch (e) {
      // Fallback for non-JSON strings (like historical theme data)
      if (typeof defaultValue === 'string') return saved;
      throw e;
    }
  } catch (e) {
    console.error(`Error loading ${key} from storage:`, e);
    return defaultValue;
  }
};


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<View>(View.HOME);
  const [language, setLanguage] = useState<Language>(loadFromStorage('splaro-language', 'EN'));
  const [theme, setTheme] = useState<Theme>(loadFromStorage('splaro-theme', 'DARK'));
  const [cart, setCart] = useState<any[]>(loadFromStorage('splaro-cart', []));
  const [products, setProducts] = useState<Product[]>(loadFromStorage('splaro-products', INITIAL_PRODUCTS));
  const [orders, setOrders] = useState<Order[]>(loadFromStorage('splaro-orders', []));
  const [user, setUser] = useState<User | null>(loadFromStorage('splaro-user', null));
  const [discounts, setDiscounts] = useState<DiscountCode[]>(loadFromStorage('splaro-discounts', INITIAL_DISCOUNTS));
  const [users, setUsers] = useState<User[]>(loadFromStorage('splaro-registered-users', []));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [slides, setSlides] = useState<any[]>(loadFromStorage('splaro-slides', INITIAL_SLIDES));
  const [logs, setLogs] = useState<any[]>([]);
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [smtpSettings, setSmtpSettings] = useState(loadFromStorage('splaro-smtp', { host: 'smtp.hostinger.com', port: '465', user: 'info@splaro.co' }));
  const [logisticsConfig, setLogisticsConfig] = useState(loadFromStorage('splaro-logistics', { metro: 90, regional: 140 }));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(loadFromStorage('splaro-site-settings', {
    siteName: 'Splaro',
    supportPhone: '+880 1905 010 205',
    supportEmail: 'info@splaro.co',
    facebookLink: 'https://facebook.com/splaro.co',
    instagramLink: 'https://instagram.com/splaro.co',
    whatsappNumber: '+8801905010205',
    maintenanceMode: false
  }));

  const [dbStatus, setDbStatus] = useState<'CONNECTED' | 'LOCAL' | 'OFFLINE'>('LOCAL');




  useEffect(() => {
    localStorage.setItem('splaro-language', JSON.stringify(language));
  }, [language]);


  useEffect(() => {
    localStorage.setItem('splaro-registered-users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('splaro-products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('splaro-orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('splaro-user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('splaro-discounts', JSON.stringify(discounts));
  }, [discounts]);

  useEffect(() => {
    localStorage.setItem('splaro-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('splaro-slides', JSON.stringify(slides));
  }, [slides]);

  useEffect(() => {
    localStorage.setItem('splaro-smtp', JSON.stringify(smtpSettings));
  }, [smtpSettings]);

  useEffect(() => {
    localStorage.setItem('splaro-logistics', JSON.stringify(logisticsConfig));
  }, [logisticsConfig]);

  useEffect(() => {
    localStorage.setItem('splaro-site-settings', JSON.stringify(siteSettings));
  }, [siteSettings]);

  // SYNC CORE: PRODUCTION HANDSHAKE
  const IS_PROD = window.location.hostname !== 'localhost';
  const API_NODE = '/api/index.php';

  useEffect(() => {
    if (IS_PROD) {
      const syncRegistry = async () => {
        try {
          const res = await fetch(`${API_NODE}?action=sync`);
          const result = await res.json();
          if (result.status === 'success') {
            setDbStatus('CONNECTED');
            if (result.data.products?.length > 0) setProducts(result.data.products);
            if (result.data.logs?.length > 0) setLogs(result.data.logs);
            if (result.data.traffic?.length > 0) setTrafficData(result.data.traffic);
            if (result.data.orders?.length > 0) {
              const mappedOrders = result.data.orders.map((o: any) => ({
                ...o,
                userId: o.user_id,
                customerName: o.customer_name,
                customerEmail: o.customer_email,
                items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
                createdAt: o.created_at,
                shippingFee: o.shipping_fee || 120,
              }));
              setOrders(mappedOrders);
            }
            if (result.data.users?.length > 0) setUsers(result.data.users);
            if (result.data.settings) setSiteSettings(result.data.settings);
            if (result.data.logs) setLogs(result.data.logs);
          } else {
            setDbStatus('LOCAL');
          }
        } catch (e) {
          setDbStatus('LOCAL');
          console.warn('ARCHIVAL_SYNC_BYPASS: Operative terminal logic initialized locally.');
        }
      };
      syncRegistry();
    } else {
      setDbStatus('LOCAL');
    }
  }, [IS_PROD]);

  // LIVE HEARTBEAT PROTOCOL: PROJECTING COLLECTOR COORDINATES
  useEffect(() => {
    if (!IS_PROD) return;

    let sessionId = localStorage.getItem('splaro-session-id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('splaro-session-id', sessionId);
    }

    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_NODE}?action=heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: user?.id,
            path: window.location.pathname
          })
        });
      } catch (e) {
        console.error('HEARTBEAT_FAILURE: Lost connection to archival node.');
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000); // 30s Protocol
    return () => clearInterval(interval);
  }, [IS_PROD, user, window.location.pathname]);

  const addOrUpdateProduct = (p: Product) => {
    setProducts(prev => {
      const exists = prev.find(item => item.id === p.id);
      const newProducts = exists ? prev.map(item => item.id === p.id ? p : item) : [p, ...prev];

      if (IS_PROD) {
        fetch(`${API_NODE}?action=sync_products`, {
          method: 'POST',
          body: JSON.stringify(newProducts)
        });
      }

      return newProducts;
    });
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => {
      const newProducts = prev.filter(p => p.id !== id);
      if (IS_PROD) {
        fetch(`${API_NODE}?action=sync_products`, {
          method: 'POST',
          body: JSON.stringify(newProducts)
        });
      }
      return newProducts;
    });
  };

  const addOrder = (o: Order) => {
    setOrders(prev => [o, ...prev]);
    setCart([]);

    if (IS_PROD) {
      fetch(`${API_NODE}?action=create_order`, {
        method: 'POST',
        body: JSON.stringify(o)
      });
    }
  };

  const deleteOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    if (IS_PROD) {
      fetch(`${API_NODE}?action=delete_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    // Optimistic Update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    try {
      await fetch(`${API_NODE}?action=update_order_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status })
      });
    } catch (error) {
      console.error('Logistics Sync Failure:', error);
    }
  };

  const updateOrderMetadata = (orderId: string, data: { trackingNumber?: string; adminNotes?: string }) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } : o));
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i =>
        i.product.id === item.product.id &&
        i.selectedSize === item.selectedSize &&
        i.selectedColor === item.selectedColor
      );
      if (existing) {
        return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, { ...item, cartId: Math.random().toString(36).substr(2, 9) }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const addDiscount = (d: DiscountCode) => {
    setDiscounts(prev => [d, ...prev]);
  };

  const toggleDiscount = (id: string) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const deleteDiscount = (id: string) => {
    setDiscounts(prev => prev.filter(d => d.id !== id));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (IS_PROD) {
      fetch(`${API_NODE}?action=delete_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };


  const initializeSheets = async () => {
    if (IS_PROD) {
      const res = await fetch(`${API_NODE}?action=initialize_sheets`, { method: 'POST' });
      const result = await res.json();
      if (result.status === 'success') {
        alert('REGISTRY_SYNC: Institutional Columns initialized on Google Sheets.');
      }
    }
  };


  const value = useMemo(() => ({
    view, setView, products, addOrUpdateProduct, deleteProduct, language, setLanguage, theme, setTheme,
    cart, addToCart, removeFromCart, orders, addOrder, updateOrderStatus, deleteOrder, user, setUser,
    users, deleteUser, updateUser,
    selectedProduct, setSelectedProduct, discounts, addDiscount, toggleDiscount, deleteDiscount,
    slides, setSlides, selectedCategory, setSelectedCategory,
    smtpSettings, setSmtpSettings, logisticsConfig, setLogisticsConfig,
    searchQuery, setSearchQuery,
    isSearchOpen, setIsSearchOpen,
    siteSettings, setSiteSettings,
    updateOrderMetadata,
    dbStatus, initializeSheets, logs, trafficData
  }), [view, language, theme, cart, orders, products, user, users, selectedProduct, discounts, slides, selectedCategory, smtpSettings, logisticsConfig, searchQuery, isSearchOpen, siteSettings, dbStatus, logs, trafficData]);



  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

