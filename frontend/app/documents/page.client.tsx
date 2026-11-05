"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { Save, FileText, ArrowLeft, Copy, Download, MoreHorizontal } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Block = { type: string; text: string };

export default function DocumentPageClient({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api("/api/v1/auth/me")
      .catch(() => router.push(`/login?next=/documents?id=${initialId || ""}`))
      .finally(() => setCheckedAuth(true));
  }, [router, initialId]);

  if (!checkedAuth) return null;

  const [doc, setDoc] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spId = params.get("id");
    if (spId && spId !== id) setId(spId);
    if (!id && initialId) setId(initialId);
  }, [id, initialId]);

  const loadDoc = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api(`/api/v1/documents/${id}`);
      setDoc(d);
      setTitle(d.title);
      setBlocks((d.content?.blocks || []).map((b: any) => ({ type: b.type, text: b.text || "" })));
      setDirty(false);
    } catch (e: any) {
      toast({ title: "Failed to load document", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDoc();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveDoc]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function addBlock(type: "paragraph" | "heading") {
    setBlocks([...blocks, { type, text: "" }]);
    setDirty(true);
  }

  function updateBlock(i: number, text: string) {
    const next = [...blocks];
    next[i] = { ...next[i], text };
    setBlocks(next);
    setDirty(true);
  }

  function removeBlock(i: number) {
    setBlocks(blocks.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function saveDoc() {
    if (!id) return;
    setSaving(true);
    try {
      await api(`/api/v1/documents/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, content: { blocks } }),
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 1500);
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!id) return <div className="p-8 text-slate-400">No document selected.</div>;
  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (error) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>;
  if (!doc) return null;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 mb-2"
          >
            <ArrowLeft size={16} strokeWidth={2} /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDoc}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${saving ? "bg-slate-200 text-slate-500" : "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-700"}`}
          >
            {saving ? "Saving..." : <><Save size={16} strokeWidth={2} className="mr-2" /> Save (⌘S)</>}
          </button>
          {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
              toast({ title: "Link copied" });
            }}
            className="text-slate-400 hover:text-brand-600 p-1.5 dark:text-slate-500 dark:hover:text-brand-400"
            title="Copy link"
            aria-label="Copy link"
          >
            <Copy size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <Input
        id="document-title"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
        placeholder="Untitled document"
        className="text-3xl font-bold border-b border-input pb-2 focus:border-brand-600 focus:ring-0 bg-transparent dark:border-slate-700 dark:text-white"
        aria-label="Document title"
      />

      <div className="space-y-4 min-h-[600px]">
        {blocks.map((b, i) => (
          <div key={i} className="flex gap-3">
            <button
              onClick={() => removeBlock(i)}
              className="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition"
              aria-label="Remove block"
            >
              ×
            </button>
            <div className="flex-1 border-b border-input pb-1 dark:border-slate-700">
              <textarea
                value={b.text}
                onChange={(e) => updateBlock(i, e.target.value)}
                className="w-full resize-none text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 p-2 bg-transparent dark:text-white"
                rows={3}
                placeholder={b.type === "heading" ? "Heading…" : "Type here…"}
                style={{ fontSize: b.type === "heading" ? "1.5rem" : "1rem", fontWeight: b.type === "heading" ? "700" : "400" }}
                aria-label={b.type === "heading" ? "Heading" : "Paragraph"}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => addBlock("paragraph")}
            className="px-4 py-2 border border-input rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800 transition"
          >
            Paragraph
          </button>
          <button
            onClick={() => addBlock("heading")}
            className="px-4 py-2 border border-input rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800 transition"
          >
            Heading
          </button>
        </div>
      </div>

      <div className="mt-8 border-t border-input pt-6 flex gap-3">
        {["pdf", "docx", "html", "md"].map((fmt) => (
          <button
            key={fmt}
            onClick={() => {
              downloadFile(`/api/v1/export/${id}/${fmt}`, `${title.replace(/\s+/g, "_")}.${fmt}`).catch((e: any) =>
                toast({ title: "Export failed", description: e.message, variant: "destructive" }),
              );
            }}
            className="px-5 py-2 border border-input rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800 transition"
          >
            <Download size={16} strokeWidth={2} className="mr-1 inline align-[-1px]" />
            Export {fmt.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
