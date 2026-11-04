export type Tier = "free" | "starter" | "professional" | "business";

export interface PricingTier {
  id: Tier;
  name: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents
  documentsPerMonth: number | null; // null = unlimited
  conversionsPerMonth: number | null; // null = unlimited
  storageGB: number;
  aiCreditsPerMonth: number;
  features: string[];
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    documentsPerMonth: 5,
    conversionsPerMonth: 10,
    storageGB: 0.5,
    aiCreditsPerMonth: 10,
    features: [
      "Up to 5 documents/month",
      "Up to 10 conversions/month",
      "500 MB storage",
      "Public templates",
      "Watermark on export",
      "Community support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_FREE_PRICE_ID_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_FREE_PRICE_ID_YEARLY,
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 900, // $9.00
    priceYearly: 9000, // $90.00 (2 months free)
    documentsPerMonth: 50,
    conversionsPerMonth: 100,
    storageGB: 5,
    aiCreditsPerMonth: 100,
    features: [
      "Up to 50 documents/month",
      "Up to 100 conversions/month",
      "5 GB storage",
      "No watermark",
      "Priority queue",
      "Email support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_STARTER_PRICE_ID_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_STARTER_PRICE_ID_YEARLY,
  },
  {
    id: "professional",
    name: "Professional",
    priceMonthly: 2900, // $29.00
    priceYearly: 29000, // $290.00 (2 months free)
    documentsPerMonth: 250,
    conversionsPerMonth: 500,
    storageGB: 20,
    aiCreditsPerMonth: 500,
    features: [
      "Up to 250 documents/month",
      "Up to 500 conversions/month",
      "20 GB storage",
      "API access",
      "Batch conversion",
      "Team workspace",
      "Chat support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PROFESSIONAL_PRICE_ID_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PROFESSIONAL_PRICE_ID_YEARLY,
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 7900, // $79.00
    priceYearly: 79000, // $790.00 (2 months free)
    documentsPerMonth: null,
    conversionsPerMonth: null,
    storageGB: 100,
    aiCreditsPerMonth: 2000,
    features: [
      "Unlimited documents",
      "Unlimited conversions",
      "100 GB storage",
      "API access",
      "SSO / SAML",
      "Admin dashboard",
      "SLA + dedicated support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_BUSINESS_PRICE_ID_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_BUSINESS_PRICE_ID_YEARLY,
  },
];

export function getTier(tierId: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === tierId);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
