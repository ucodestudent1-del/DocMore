"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Plus, FileText, Download, Search, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/Sidebar";

const statCards = [
  { label: "Documents", value: "0", icon: FileText, color: "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20" },
  { label: "Templates", value: "0", icon: "Layers", color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
  { label: "Conversions", value: "0", icon: "RefreshCw", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
  { label: "Storage", value: "1.2 GB / 5 GB", icon: Clock, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
];

export default function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredDocs = docs.filter(
    (d) => d.title.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    api("/api/v1/auth/me")
      .then((data: any) => setUser(data))
      .catch(() => {
        router.push("/login?next=/dashboard");
      })
      .finally(() => setCheckedAuth(true));
  }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        (document.querySelector('input[placeholder="Document title"]') as HTMLElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [d, t] = await Promise.all([api("/api/v1/documents"), api("/api/v1/templates")]);
      setDocs(d || []);
      setTemplates(t || []);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createDoc() {
    if (!newTitle.trim()) return;
    try {
      const doc = await api("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify({ title: newTitle }),
      });
      setDocs([doc, ...docs]);
      setNewTitle("");
      toast({ title: "Document created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    }
  }

  if (!checkedAuth) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-secondary dark:bg-slate-950">
      {!collapsed && <Sidebar user={user} onLogout={() => {}} collapsed={collapsed} setCollapsed={setCollapsed} />}
      <div className={`transition-all duration-300 ${collapsed ? "pl-16" : "pl-64"}`}>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-input px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your documents and templates</p>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => router.push("/convert")} className="hidden sm:flex">
                <Clock size={16} strokeWidth={2} className="mr-2" /> Convert File
              </Button>
              <Button size="sm" onClick={() => router.push("/templates")} className="hidden sm:flex">
                <LayersIcon size={16} strokeWidth={2} className="mr-2" /> Templates
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-12">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => {
              const Icon: any = s.icon === "Layers" ? LayersIcon : s.icon === "RefreshCw" ? RefreshCwIcon : s.icon;
              return (
                <Card key={s.label}>
                  <CardHeader className="pb-3 flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{s.label}</CardTitle>
                      <CardDescription className="text-xs">{s.value}</CardDescription>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                      <Icon size={16} strokeWidth={2} />
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent documents */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex items-center justify-between pb-4">
                  <div className="flex items-center gap-2">
                    <LayoutList size={18} strokeWidth={2} className="text-slate-400" />
                    <CardTitle className="text-sm">Recent documents</CardTitle>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => (document.querySelector('input[placeholder="Document title"]') as HTMLElement | null)?.focus()}>
                    <Plus size={16} strokeWidth={2} className="mr-1" /> New
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Search size={16} strokeWidth={2} className="text-slate-400" />
                    <Input
                      id="search-documents"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search documents..."
                      className="flex-1 text-sm"
                    />
                  </div>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-secondary dark:bg-slate-800/50">
                          <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Title</th>
                          <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                          <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6">
                              <div className="space-y-3">
                                <Skeleton w="lg" h="md" />
                                <Skeleton w="md" h="sm" />
                                <Skeleton w="md" h="sm" />
                              </div>
                            </td>
                          </tr>
                        ) : filteredDocs.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                              No documents found.
                            </td>
                          </tr>
                        ) : (
                          filteredDocs.map((d) => (
                            <tr key={d.id} className="border-b border-input hover:bg-secondary/50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3 dark:text-white">{d.title}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">
                                  {d.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`/documents?id=${d.id}`}
                                    className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                                  >
                                    Open <ArrowRight size={14} strokeWidth={2} className="ml-1" />
                                  </a>
                                  <button
                                    onClick={() => {
                                      downloadFile(`/api/v1/export/${d.id}/pdf`, `${d.title.replace(/\s+/g, "_")}.pdf`).catch((e: any) =>
                                        toast({ title: "Export failed", description: e.message, variant: "destructive" }),
                                      );
                                    }}
                                    className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
                                  >
                                    <Download size={14} strokeWidth={2} className="inline align-[-1px] mr-1" /> PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions + templates */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <Button
                    onClick={() => {
                      (document.querySelector('input[placeholder="Document title"]') as HTMLElement | null)?.focus();
                    }}
                    className="w-full text-left justify-start gap-2"
                  >
                    <Plus size={16} strokeWidth={2} /> Create document
                  </Button>
                  <Button
                    onClick={() => router.push("/convert")}
                    variant="outline"
                    className="w-full text-left justify-start gap-2"
                  >
                    <RefreshCwIcon size={16} strokeWidth={2} /> Convert file
                  </Button>
                  <Button
                    onClick={() => router.push("/templates")}
                    variant="outline"
                    className="w-full text-left justify-start gap-2"
                  >
                    <LayersIcon size={16} strokeWidth={2} /> Browse templates
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Template shortcuts</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="space-y-3">
                    {templates.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No templates yet.</p>
                    ) : (
                      templates.slice(0, 4).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-secondary/50 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors"
                          onClick={() => {
                            api("/api/v1/documents", {
                              method: "POST",
                              body: JSON.stringify({ title: t.name, templateId: t.id }),
                            })
                              .then(() => load())
                              .catch((e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }));
                          }}
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{t.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.variables?.length || 0} variables</div>
                          </div>
                          <ArrowRight size={14} strokeWidth={2} className="text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {docs.length === 0 && (
            <section className="mt-8">
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Get started by creating your first document.</p>
                  <Button className="mt-6" onClick={() => (document.querySelector('input[placeholder="Document title"]') as HTMLElement | null)?.focus()}>
                    <Plus size={16} strokeWidth={2} className="mr-2" /> Create your first document
                  </Button>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function LayersIcon({ className }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l2.87 4.45L19 11l-2.87 4.45L12 22l-2.87-4.45L5 11l2.87-4.45L12 2z" />
      <path d="M2 11h20" />
      <path d="M22 4L12 14.01L2 4z" />
    </svg>
  );
}

function RefreshCwIcon({ className }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 4v4a1 1 0 0 0 1 1h4" />
      <path d="M4 1v16a1 1 0 0 0 1 1h4" />
      <path d="M23 20v-4a1 1 0 0 0-1-1h-4" />
      <path d="M20 23V7a1 1 0 0 0-1-1h-4" />
    </svg>
  );
}

function LayoutList({ className }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
