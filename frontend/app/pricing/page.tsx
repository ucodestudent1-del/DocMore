"use client";

import { useState, useEffect } from "react";
import {
  getPricing,
  createCheckout,
  createCustomerPortal,
  getSubscription,
  isStripeConfigured,
  getUsage,
  getToken,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CheckCircle2, Crown, Sparkles, ShieldCheck, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceDisplay: "$0",
    description: "For personal use and occasional conversions.",
    features: [
      "Up to 10 MB per file",
      "5 conversions per hour",
      "1 concurrent job",
      "Standard support",
    ],
    limits: { maxFileSizeMb: 10, maxConversionsPerHour: 5, maxConcurrentJobs: 1 },
    popular: false,
    color: "bg-gray-100 text-gray-800",
  },
  {
    id: "premium",
    name: "Premium",
    price: 9.99,
    priceDisplay: "$9.99",
    description: "For professionals who need more power.",
    features: [
      "Up to 50 MB per file",
      "100 conversions per hour",
      "5 concurrent jobs",
      "Priority email support",
      "Advanced PDF tools",
    ],
    limits: { maxFileSizeMb: 50, maxConversionsPerHour: 100, maxConcurrentJobs: 5 },
    popular: true,
    color: "bg-blue-500 text-white",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 49.99,
    priceDisplay: "$49.99",
    description: "For teams and high-volume document processing.",
    features: [
      "Up to 100 MB per file",
      "1,000 conversions per hour",
      "20 concurrent jobs",
      "24/7 priority support",
      "SLA guarantee",
      "Audit logs & retention controls",
    ],
    limits: { maxFileSizeMb: 100, maxConversionsPerHour: 1000, maxConcurrentJobs: 20 },
    popular: false,
    color: "bg-purple-600 text-white",
  },
] as const;

export default function PricingPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router, getToken]);

  const loadData = async () => {
    try {
      const [p, s, u, c] = await Promise.all([
        getPricing().catch(() => null),
        getSubscription().catch(() => null),
        getUsage().catch(() => null),
        isStripeConfigured().catch(() => ({ configured: false })),
      ]);
      setPricing(p);
      setSubscription(s);
      setUsage(u);
      setStripeConfigured(c?.configured ?? false);
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string, interval: string = "monthly") => {
    if (!stripeConfigured) {
      toast({
        title: "Payments not configured",
        description: "Stripe is not set up on this server.",
      });
      return;
    }
    try {
      const result = await createCheckout(tier, interval);
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message });
    }
  };

  const handlePortal = async () => {
    try {
      const result = await createCustomerPortal(); // eslint-disable-line @typescript-eslint/no-unused-vars
      // In a real implementation this returns a portal_url to redirect to
      toast({ title: "Customer portal", description: "Opening billing portal..." });
    } catch (err: any) {
      toast({ title: "Portal failed", description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || "free";
  const currentUsage = usage?.usage || {};

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">
          Simple, transparent pricing for document processing.
        </p>
      </div>

      {/* Current subscription card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Plan</p>
              <p className="text-lg font-bold">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </p>
            </div>
            <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded">
              {subscription?.status || "unknown"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">File size limit</p>
              <p className="font-medium">{currentUsage.max_file_size_mb || TIERS.find(t => t.id === currentTier)?.limits.maxFileSizeMb || 10} MB</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Conversions/hour</p>
              <p className="font-medium">{currentUsage.max_conversions_per_hour || TIERS.find(t => t.id === currentTier)?.limits.maxConversionsPerHour || 5}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Concurrent jobs</p>
              <p className="font-medium">{currentUsage.max_concurrent_jobs || TIERS.find(t => t.id === currentTier)?.limits.maxConcurrentJobs || 1}</p>
            </div>
          </div>
          {usage && usage.usage && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage this month</p>
              <div className="flex items-center justify-between">
                <span className="text-sm">Conversions</span>
                <span className="text-sm font-medium">{usage.usage.conversions_this_month || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage</span>
                <span className="text-sm font-medium">{usage.usage.storage_mb || 0} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Concurrent jobs</span>
                <span className="text-sm font-medium">{usage.usage.concurrent_jobs || 0}</span>
              </div>
            </div>
          )}
          {!stripeConfigured && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              Stripe is not configured on this server. Upgrades are disabled.
            </div>
          )}
          {stripeConfigured && subscription?.stripeCustomerId && (
            <Button onClick={handlePortal} variant="outline" size="sm">
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <Card key={tier.id} className={`relative ${tier.popular ? "ring-2 ring-blue-500" : "border-border"}`}>
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
              Most popular
            </span>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>{tier.name}</CardTitle>
                {tier.id !== "free" && <Crown className="h-4 w-4 fill-current" />}
              </div>
              <p className="text-sm text-muted-foreground">{tier.description}</p>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.priceDisplay}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              {tier.id === "free" ? (
                <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">
                  Get started
                </Button>
              ) : stripeConfigured ? (
                <Button
                  onClick={() => handleUpgrade(tier.id)}
                  className={`w-full ${tier.popular ? "bg-blue-600" : ""}`}
                >
                  Upgrade to {tier.name}
                </Button>
              ) : (
                <Button disabled className="w-full opacity-50">
                  Contact sales
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Feature comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-3 text-muted-foreground">Feature</th>
                  {TIERS.map((t) => (
                    <th key={t.id} className="pb-3 text-center font-medium">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="font-medium">Max file size</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">{t.limits.maxFileSizeMb} MB</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">Conversions per hour</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">{t.limits.maxConversionsPerHour}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">Concurrent jobs</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">{t.limits.maxConcurrentJobs}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">PDF toolkit</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">
                      {t.id === "free" ? <Check className="h-3 w-3 text-green-500" /> : <Check className="h-3 w-3 text-green-500" />}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">Image processing</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">
                      {t.id === "free" ? <Check className="h-3 w-3 text-green-500" /> : <Check className="h-3 w-3 text-green-500" />}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">Document editor</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">
                      {t.id === "free" ? <Check className="h-3 w-3 text-green-500" /> : <Check className="h-3 w-3 text-green-500" />}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">Priority support</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">
                      {t.id !== "free" ? <Check className="h-3 w-3 text-green-500" /> : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-medium">SLA guarantee</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="text-center">
                      {t.id === "enterprise" ? <Check className="h-3 w-3 text-green-500" /> : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
