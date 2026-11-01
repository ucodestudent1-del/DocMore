"use client";

import { useEffect, useState } from "react";
import { listHistory, downloadFile } from "@/lib/api";
import { formatBytes, iconForExtension } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, Clock, Play, Download } from "lucide-react";
import Link from "next/link";

const RECENT_ACTIONS = [
  { label: "Convert a document", href: "/convert", icon: Upload, desc: "PDF, Word, Excel, images and more" },
  { label: "Generate a document", href: "/generate", icon: File, desc: "Build from templates or blank" },
  { label: "PDF tools", href: "/pdf-tools", icon: Play, desc: "Merge, split, watermark, protect" },
];

export default function Dashboard() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHistory(10).then((h: any) => {
      setHistory(h.history || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Convert, generate, and manage your documents.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {RECENT_ACTIONS.map((a) => (
          <Card key={a.label}>
            <CardHeader>
              <CardTitle>{a.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{a.desc}</p>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" size="sm">
                <Link href={a.href}>{a.label} <a.icon className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quick convert</CardTitle>
              <Button asChild size="sm">
                <Link href="/convert">Go to converter</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center py-8 border border-dashed border-border rounded-lg">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop a document or click to upload</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="w-full lg:w-96">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground">Loading…</div>
              ) : history.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p>No recent conversions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 cursor-pointer group">
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                        {iconForExtension(item.ext || "") === "FileText" ? (
                          <File className="h-5 w-5" />
                        ) : (
                          <File className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{item.original_name || item.stored_name || item.id}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(item.size || 0)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = downloadFile(item.id);
                        }}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
