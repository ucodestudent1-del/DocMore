"use client";


import { useEffect, useState } from "react";
import { listHistory } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock } from "lucide-react";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHistory(50).then((r: any) => {
      setHistory(r.history || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Processing History</h1>
        <p className="text-muted-foreground">Your recent uploads and conversions.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : history.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p>No activity yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3">File</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Size</th>
                    <th className="pb-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 truncate max-w-xs">{item.original_name || item.stored_name || item.id}</td>
                      <td className="py-3 text-muted-foreground">{item.ext || "—"}</td>
                      <td className="py-3 text-muted-foreground">{formatBytes(item.size || 0)}</td>
                      <td className="py-3 text-muted-foreground text-xs">{new Date(item.ts * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

