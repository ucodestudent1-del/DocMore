"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/Skeleton";

export default function Templates() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    api("/api/v1/auth/me")
      .catch(() => router.push("/login?next=/templates"))
      .finally(() => setCheckedAuth(true));
  }, [router]);

  if (!checkedAuth) return null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const t = await api("/api/v1/templates");
      setTemplates(t || []);
    } catch (e: any) {
      toast({ title: "Failed to load templates", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api("/api/v1/templates", {
        method: "POST",
        body: JSON.stringify({ name: newName, content: { blocks: [] }, variables: [] }),
      });
      setNewName("");
      load();
      toast({ title: "Template created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await api(`/api/v1/templates/${id}`, { method: "DELETE" });
      load();
      toast({ title: "Template deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Templates</h1>
          <p className="text-slate-500 text-sm dark:text-slate-400">
            Reusable document templates with merge variables
          </p>
        </div>
        <Button
          onClick={() => router.push("/convert")}
          variant="outline"
          className="hidden sm:flex"
        >
          <FileText size={16} strokeWidth={2} className="mr-2" /> Convert file
        </Button>
      </div>

      <div className="mb-6 flex gap-3 max-w-md">
        <Input
          id="template-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Template name"
          className="flex-1"
          aria-label="Template name"
        />
        <Button
          onClick={createTemplate}
          disabled={loading}
          className="px-6"
        >
          {loading ? <Plus size={16} strokeWidth={2} className="mr-2 inline animate-spin" /> : <Plus size={16} strokeWidth={2} className="mr-2 inline" />}
          Create
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText size={18} strokeWidth={2} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your templates</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Variables</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-input">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8">
                      <div className="space-y-3">
                        <Skeleton w="lg" h="md" />
                        <Skeleton w="md" h="xs" />
                      </div>
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No templates yet. Create one above.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 dark:text-white">
                        <Link
                          href={`/documents/new?template=${t.id}`}
                          className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {t.variables?.length || 0}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => del(t.id)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
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
  );
}
