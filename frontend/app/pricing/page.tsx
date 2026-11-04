"use client";

import { useState, useEffect } from "react";
import { api, STRIPE_PUBLISHABLE_KEY } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { CreditCard, Crown, DollarSign, Layers, ShieldCheck, Zap } from "lucide-react";

const FEATURE_CHECK = <ShieldCheck size={16} strokeWidth={2} />;
const FEATURE_CROSS = <span className="text-gray-400">—</span>;

export default function PricingPage() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    api("/api/v1/billing/tiers")
      .then((data: any) => setTiers(data))
      .catch(() => setTiers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = (priceId: string | undefined) => {
    if (!priceId) {
      toast({
        title: "Stripe not configured",
        description: "Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY env vars to enable subscriptions.",
        variant: "destructive",
      });
      return;
    }
    // Placeholder: redirect to Stripe Checkout once keys are configured
    toast({
      title: "Coming soon",
      description: "Stripe Checkout integration ready — add your keys to subscribe.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse rounded-full h-8 w-8 bg-gray-200 dark:bg-gray-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">EveryDoc</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="/dashboard" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
                Dashboard
              </a>
              <a href="/convert" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
                Convert
              </a>
            </div>
            <a href="/" className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Back to home</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your document generation needs. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`border rounded-xl p-6 transition hover:border-indigo-300 dark:border-gray-800 dark:hover:border-indigo-900 ${
                tier.id === "professional"
                  ? "border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "bg-white dark:bg-gray-900"
              }`}
            >
              <div className="mb-6">
                {tier.id === "professional" && (
                  <span className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                    Most popular
                  </span>
                )}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tier.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {tier.priceMonthly === 0 ? "Free" : `$${(tier.priceMonthly / 100).toFixed(2)}`}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {tier.id === "free"
                    ? "Get started with automated document generation"
                    : tier.id === "starter"
                    ? "For individuals and small projects"
                    : tier.id === "professional"
                    ? "For growing teams and power users"
                    : "For enterprises and high-volume workflows"}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    {FEATURE_CHECK}
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.stripePriceIdMonthly)}
                disabled={!tier.stripePriceIdMonthly}
                className={`w-full py-3 rounded-lg font-medium transition ${
                  tier.stripePriceIdMonthly
                    ? tier.id === "professional"
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed"
                }`}
              >
                {tier.priceMonthly === 0 ? "Get started free" : tier.stripePriceIdMonthly ? "Subscribe" : "Coming soon"}
              </button>

              <div className="mt-4">
                <button
                  onClick={() => handleSubscribe(tier.stripePriceIdYearly)}
                  disabled={!tier.stripePriceIdYearly}
                  className={`w-full py-2 rounded-lg font-medium text-sm transition ${
                    tier.stripePriceIdYearly
                      ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                      : "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {tier.stripePriceIdYearly ? `Yearly (save 2 months)` : "Coming soon"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-gray-200 dark:border-gray-800 pt-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Compare features</h2>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.id} className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-900 dark:text-white">{t.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Documents per month", key: "documentsPerMonth" },
                  { label: "Conversions per month", key: "conversionsPerMonth" },
                  { label: "Storage", key: "storageGB" },
                  { label: "AI credits per month", key: "aiCreditsPerMonth" },
                  { label: "API access", key: "api" },
                  { label: "Batch conversion", key: "batch" },
                  { label: "Team workspace", key: "team" },
                  { label: "Priority support", key: "support" },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-gray-200 dark:border-gray-800">
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">{row.label}</td>
                    {tiers.map((t) => {
                      const features = t.features || [];
                      const hasFeature = features.some((f: string) =>
                        f.toLowerCase().includes(row.key.charAt(0).toUpperCase() + row.key.slice(1)),
                      );
                      let value: React.ReactNode;
                      switch (row.key) {
                        case "documentsPerMonth":
                          value = t.documentsPerMonth === null ? "Unlimited" : String(t.documentsPerMonth);
                          break;
                        case "conversionsPerMonth":
                          value = t.conversionsPerMonth === null ? "Unlimited" : String(t.conversionsPerMonth);
                          break;
                        case "storageGB":
                          value = `${t.storageGB} GB`;
                          break;
                        case "aiCreditsPerMonth":
                          value = `${t.aiCreditsPerMonth}`;
                          break;
                        default:
                          value = hasFeature ? FEATURE_CHECK : FEATURE_CROSS;
                      }
                      return (
                        <td key={t.id} className="px-6 py-4 text-center">
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {STRIPE_PUBLISHABLE_KEY ? null : (
          <div className="mt-12 p-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50">
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">Stripe not configured</h3>
            <p className="text-amber-800 dark:text-amber-200 text-sm mb-4">
              To enable paid subscriptions, add these environment variables to your Railway project:
            </p>
            <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1 mb-4">
              <li>`STRIPE_SECRET_KEY`</li>
              <li>`STRIPE_PUBLISHABLE_KEY`</li>
              <li>`STRIPE_WEBHOOK_SECRET`</li>
            </ul>
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              Then create products and prices in the Stripe Dashboard and set the corresponding
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">STRIPE_*_PRICE_ID_*</code> env vars.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
