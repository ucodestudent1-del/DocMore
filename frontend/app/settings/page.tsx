"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
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
