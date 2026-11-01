"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";

export default function TemplatesPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">Generate documents from pre-built templates.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <CardTitle>{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                className="w-full"
                onClick={() => router.push(`/generate?template=${t.name}`)}
              >
                Use template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
