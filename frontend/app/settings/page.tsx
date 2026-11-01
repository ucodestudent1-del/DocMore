"use client";

import { useState, useEffect } from "react";
import { getToken, fetchMe } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api";
import { apiRequest } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

const TIER_LIMITS = {
  free: {
    name: "Free",
    price: "$0/month",
    limits: "10 uploads/day, 5 files/batch, 10 MB max file",
  },
  premium: {
    name: "Premium",
    price: "$9/month",
    limits: "100 uploads/day, 50 files/batch, 100 MB max file",
  },
  enterprise: {
    name: "Enterprise",
    price: "$49/month",
    limits: "1000 uploads/day, 500 files/batch, 1000 MB max file",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("system");
  const [maxSize, setMaxSize] = useState("50");
  const [userTier, setUserTier] = useState("");
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    fetchMe().then((user: any) => {
      setUserTier(user.tier || "free");
      setTierLoading(false);
    }).catch(() => setTierLoading(false));
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Application preferences.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-xs text-muted-foreground">Choose light, dark, or system mode.</p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue>{theme}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Max upload size (MB)</Label>
              <p className="text-xs text-muted-foreground">Server-side limit is 50 MB.</p>
            </div>
            <Input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} className="w-20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tierLoading ? (
            <p className="text-sm text-muted-foreground">Loading subscription...</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Current Plan</Label>
                  <p className="text-xs text-muted-foreground">Your subscription tier</p>
                </div>
                <Select value={userTier} onValueChange={setUserTier} disabled={true}>
                  <SelectTrigger>
                    <SelectValue>{TIER_LIMITS[userTier as keyof typeof TIER_LIMITS]?.name || userTier}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIER_LIMITS).map(([key, tier]) => (
                      <SelectItem key={key} value={key}>
                        {tier.name} ({tier.price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Included in {TIER_LIMITS[userTier as keyof typeof TIER_LIMITS]?.name}:</p>
                <p className="text-xs text-muted-foreground">{TIER_LIMITS[userTier as keyof typeof TIER_LIMITS]?.limits}</p>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Upgrade your plan to increase upload limits and access advanced features.
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Backend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">API configured</p>
          <Button variant="outline" size="sm" onClick={() => {
            apiRequest("/api/health").then(() => toast({ title: "Backend", description: "Online" }))
              .catch(() => toast({ title: "Backend", description: "Offline" }));
          }}>Health check</Button>
        </CardContent>
      </Card>
    </div>
  );
}
