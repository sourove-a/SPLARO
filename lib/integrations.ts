export type IntegrationProvider = 'bkash' | 'nagad' | 'sslcommerz' | 'rocket' | 'pathao' | 'steadfast' | 'meta';

export type IntegrationMode = 'SANDBOX' | 'LIVE';

export type IntegrationCategory =
  | 'PAYMENT GATEWAYS'
  | 'COURIER & LOGISTICS'
  | 'MARKETING & ANALYTICS';

export type IntegrationField = {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  required?: boolean;
};

export type IntegrationDefinition = {
  provider: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  supportsMode: boolean;
  defaultMode: IntegrationMode;
  defaultConnected?: boolean;
  fields: IntegrationField[];
};

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    provider: 'bkash',
    name: 'bKash Payment Gateway',
    category: 'PAYMENT GATEWAYS',
    description: 'Tokenized checkout for bKash collections and controlled sandbox/live switching.',
    supportsMode: true,
    defaultMode: 'SANDBOX',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'bkash_api_key', required: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'bkash_api_secret', secret: true, required: true },
      { key: 'username', label: 'Username', placeholder: 'merchant_username', required: false },
      { key: 'password', label: 'Password', placeholder: 'merchant_password', secret: true, required: false },
    ],
  },
  {
    provider: 'nagad',
    name: 'Nagad Payment Gateway',
    category: 'PAYMENT GATEWAYS',
    description: 'Nagad merchant checkout credentials with validation and secure key storage.',
    supportsMode: true,
    defaultMode: 'SANDBOX',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'NAGAD_MERCHANT_ID', required: true },
      { key: 'apiKey', label: 'API Key', placeholder: 'NAGAD_API_KEY', required: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'NAGAD_API_SECRET', secret: true, required: true },
    ],
  },
  {
    provider: 'sslcommerz',
    name: 'SSLCommerz Gateway',
    category: 'PAYMENT GATEWAYS',
    description: 'Primary card/wallet gateway with transaction validation endpoint checks.',
    supportsMode: true,
    defaultMode: 'SANDBOX',
    fields: [
      { key: 'storeId', label: 'Store ID', placeholder: 'SSLCOMMERZ_STORE_ID', required: true },
      { key: 'storePassword', label: 'Store Password', placeholder: 'SSLCOMMERZ_STORE_PASSWORD', secret: true, required: true },
      { key: 'successUrl', label: 'Success URL', placeholder: 'https://splaro.co/payment/success', required: true },
      { key: 'failUrl', label: 'Fail URL', placeholder: 'https://splaro.co/payment/fail', required: true },
      { key: 'cancelUrl', label: 'Cancel URL', placeholder: 'https://splaro.co/payment/cancel', required: true },
      { key: 'ipnUrl', label: 'IPN URL', placeholder: 'https://splaro.co/api/payment/sslcommerz/ipn', required: true },
    ],
  },
  {
    provider: 'rocket',
    name: 'Rocket Mode',
    category: 'PAYMENT GATEWAYS',
    description: 'Rocket channel credentials for wallet-mode checkout routing and failover.',
    supportsMode: true,
    defaultMode: 'SANDBOX',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'ROCKET_MERCHANT_ID', required: true },
      { key: 'apiKey', label: 'API Key', placeholder: 'ROCKET_API_KEY', required: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'ROCKET_API_SECRET', secret: true, required: true },
    ],
  },
  {
    provider: 'pathao',
    name: 'Pathao Courier',
    category: 'COURIER & LOGISTICS',
    description: 'Create and track deliveries with Pathao merchant credentials and pickup setup.',
    supportsMode: false,
    defaultMode: 'LIVE',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'PATHAO_API_KEY', required: true },
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'PATHAO_MERCHANT_ID', required: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'PATHAO_API_SECRET', secret: true, required: true },
    ],
  },
  {
    provider: 'steadfast',
    name: 'Steadfast Courier',
    category: 'COURIER & LOGISTICS',
    description: 'Book consignments and sync shipment status with Steadfast delivery APIs.',
    supportsMode: false,
    defaultMode: 'LIVE',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'STEADFAST_API_KEY', required: true },
      { key: 'storeId', label: 'Store ID', placeholder: 'STEADFAST_STORE_ID', required: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'STEADFAST_API_SECRET', secret: true, required: false },
    ],
  },
  {
    provider: 'meta',
    name: 'Facebook / Meta',
    category: 'MARKETING & ANALYTICS',
    description: 'Audience pixel and conversion events for campaign attribution and retargeting.',
    supportsMode: false,
    defaultMode: 'LIVE',
    defaultConnected: true,
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: 'META_PIXEL_ID', required: false },
      { key: 'accessToken', label: 'Access Token', placeholder: 'META_ACCESS_TOKEN', secret: true, required: false },
    ],
  },
];

export const INTEGRATION_BY_PROVIDER: Record<IntegrationProvider, IntegrationDefinition> =
  INTEGRATION_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.provider] = definition;
    return acc;
  }, {} as Record<IntegrationProvider, IntegrationDefinition>);

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'PAYMENT GATEWAYS',
  'COURIER & LOGISTICS',
  'MARKETING & ANALYTICS',
];
