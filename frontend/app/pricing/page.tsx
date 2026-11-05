"use client";

import { useState, useEffect } from "react";
import { api, STRIPE_PUBLISHABLE_KEY } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Navbar from "@/components/Navbar";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURE_CHECK = <ShieldCheck size={16} strokeWidth={2} />;
const FEATURE_CROSS = <span className="text-slate-400">—</span>;

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
    toast({
      title: "Coming soon",
      description: "Stripe Checkout integration ready — add your keys to subscribe.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse rounded-full h-8 w-8 bg-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="max-w-7xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the plan that fits your document generation needs. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`flex flex-col relative ${
                tier.id === "professional"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-600/20"
                  : "border-input"
              }`}
            >
              {tier.id === "professional" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="text-xs">Most popular</Badge>
                </div>
              )}
              <CardHeader>
                <h2 className="text-xl font-bold">{tier.name}</h2>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">
                    {tier.priceMonthly === 0 ? "Free" : `$${(tier.priceMonthly / 100).toFixed(2)}`}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  {tier.id === "free"
                    ? "Get started with automated document generation"
                    : tier.id === "starter"
                    ? "For individuals and small projects"
                    : tier.id === "professional"
                    ? "For growing teams and power users"
                    : "For enterprises and high-volume workflows"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 flex-1">
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {tier.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      {FEATURE_CHECK}
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleSubscribe(tier.stripePriceIdMonthly)}
                  disabled={!tier.stripePriceIdMonthly}
                  className={`w-full ${
                    tier.stripePriceIdMonthly
                      ? tier.id === "professional"
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "bg-brand-600 text-white hover:bg-brand-700"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {tier.priceMonthly === 0 ? "Get started free" : tier.stripePriceIdMonthly ? "Subscribe" : "Coming soon"}
                </Button>
                <div className="mt-3">
                  <Button
                    onClick={() => handleSubscribe(tier.stripePriceIdYearly)}
                    disabled={!tier.stripePriceIdYearly}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    {tier.stripePriceIdYearly ? `Yearly (save 2 months)` : "Coming soon"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 border-t border-input pt-12">
          <h2 className="text-2xl font-bold mb-8 text-center">Compare features</h2>
          <div className="overflow-x-auto border border-input rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.id} className="px-6 py-4 text-center">
                      <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
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
                  <tr key={row.label} className="border-b border-input">
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{row.label}</td>
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

        {!STRIPE_PUBLISHABLE_KEY && (
          <div className="mt-12 p-6 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-amber-900 dark:text-amber-100">Stripe not configured</CardTitle>
                <CardDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  To enable paid subscriptions, add these environment variables to your Railway project:
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1 mb-4">
                  <li>`STRIPE_SECRET_KEY`</li>
                  <li>`STRIPE_PUBLISHABLE_KEY`</li>
                  <li>`STRIPE_WEBHOOK_SECRET`</li>
                </ul>
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  Then create products and prices in the Stripe Dashboard and set the corresponding
                  <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">STRIPE_*_PRICE_ID_*</code>
                  env vars.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
