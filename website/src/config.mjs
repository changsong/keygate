export const SITE_URL = process.env.SITE_URL || 'https://unionuser.com';
export const SITE_VERSION = process.env.SITE_VERSION || '2026.11';

export const CONSOLE_URL = process.env.CONSOLE_URL || 'https://keygate.unionuser.com';
export const LOGIN_URL = `${CONSOLE_URL}/login`;
export const PORTAL_URL = `${CONSOLE_URL}/portal`;
export const SALES_EMAIL = process.env.SALES_EMAIL || 'sales@unionuser.com';
export const DOCS_OPENAPI_URL = `${SITE_URL}/openapi.yaml`;

export const PUBKEY_HEX =
  'bf17435ee7b937b3592808941683c21d37c4e124d95d4e8fdd86fe775dd23b11';

export const PLANS = [
  {
    id: 'developer',
    name: 'Developer',
    priceMonthly: 0,
    priceYearly: 0,
    products: '1',
    licenses: '100',
    recommended: false,
    cta: 'start',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 290,
    products: '3',
    licenses: '1,000',
    recommended: true,
    cta: 'trial',
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 99,
    priceYearly: 990,
    products: '10',
    licenses: '10,000',
    recommended: false,
    cta: 'demo',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 399,
    priceYearly: 3990,
    products: 'Unlimited',
    licenses: 'Unlimited',
    recommended: false,
    cta: 'demo',
  },
];
