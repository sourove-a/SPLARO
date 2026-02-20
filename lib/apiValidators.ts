export type SignupPayload = {
  name?: string;
  email: string;
  phone?: string;
  district?: string;
  thana?: string;
  address?: string;
  password?: string;
  provider?: 'LOCAL' | 'GOOGLE';
};

export type OrderPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  thana: string;
  product_name: string;
  product_url?: string;
  image_url?: string;
  quantity: number;
  unit_price?: number;
  shipping?: number;
  discount?: number;
  notes?: string;
};

export type SubscribePayload = {
  email: string;
  consent?: boolean;
  source?: 'footer' | 'popup' | string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupPayload(input: unknown): {
  ok: boolean;
  data?: SignupPayload;
  message?: string;
} {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Invalid payload' };
  }

  const body = input as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!emailRegex.test(email)) {
    return { ok: false, message: 'Invalid email' };
  }

  const providerRaw = String(body.provider ?? 'LOCAL').toUpperCase();
  const provider: 'LOCAL' | 'GOOGLE' = providerRaw === 'GOOGLE' ? 'GOOGLE' : 'LOCAL';
  const password = String(body.password ?? '');
  if (provider === 'LOCAL' && password.length < 6) {
    return { ok: false, message: 'Password must be at least 6 characters' };
  }

  return {
    ok: true,
    data: {
      name: String(body.name ?? '').trim(),
      email,
      phone: String(body.phone ?? '').trim(),
      district: String(body.district ?? '').trim(),
      thana: String(body.thana ?? '').trim(),
      address: String(body.address ?? '').trim(),
      password,
      provider,
    },
  };
}

export function validateOrderPayload(input: unknown): {
  ok: boolean;
  data?: OrderPayload;
  message?: string;
} {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Invalid payload' };
  }

  const body = input as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!emailRegex.test(email)) {
    return { ok: false, message: 'Invalid email' };
  }

  const quantity = Number(body.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    return { ok: false, message: 'Quantity must be between 1 and 100' };
  }

  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const address = String(body.address ?? '').trim();
  const district = String(body.district ?? '').trim();
  const thana = String(body.thana ?? '').trim();
  const productName = String(body.product_name ?? '').trim();

  if (!name || !phone || !address || !district || !thana || !productName) {
    return { ok: false, message: 'Missing required fields' };
  }

  const unitPrice = body.unit_price != null ? Number(body.unit_price) : undefined;
  const shipping = body.shipping != null ? Number(body.shipping) : undefined;
  const discount = body.discount != null ? Number(body.discount) : undefined;

  return {
    ok: true,
    data: {
      name,
      email,
      phone,
      address,
      district,
      thana,
      product_name: productName,
      product_url: String(body.product_url ?? '').trim(),
      image_url: String(body.image_url ?? '').trim(),
      quantity,
      unit_price: Number.isFinite(unitPrice as number) ? unitPrice : undefined,
      shipping: Number.isFinite(shipping as number) ? shipping : undefined,
      discount: Number.isFinite(discount as number) ? discount : undefined,
      notes: String(body.notes ?? '').trim(),
    },
  };
}

export function validateSubscribePayload(input: unknown): {
  ok: boolean;
  data?: SubscribePayload;
  message?: string;
} {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Invalid payload' };
  }

  const body = input as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!emailRegex.test(email)) {
    return { ok: false, message: 'Invalid email' };
  }

  return {
    ok: true,
    data: {
      email,
      consent: Boolean(body.consent),
      source: String(body.source ?? 'footer').trim() || 'footer',
    },
  };
}
