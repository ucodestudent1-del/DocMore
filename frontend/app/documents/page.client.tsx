"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "../../lib/api";
import { Save, FileText, ArrowLeft, Copy, Download } from "lucide-react";
import { useToast } from "../../components/Toast";

type Block = { type: string; text: string };

export default function DocumentPageClient({ initialId }: { initialId?: string }) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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
    if (spId && spId !== id) {
      setId(spId);
    }
    if (!id && initialId) {
      setId(initialId);
    }
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

  if (!id) return <div className="p-8 dark:text-white">No document selected.</div>;
  if (loading) return <div className="p-8 dark:text-white">Loading...</div>;
  if (error) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>;
  if (!doc) return null;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 dark:text-gray-400 dark:hover:text-indigo-400 no-print"
          >
            <ArrowLeft size={16} strokeWidth={2} /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={saveDoc}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${saving ? "bg-gray-300" : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"}`}
          >
            {saving ? "Saving..." : <><Save size={16} strokeWidth={2} className="mr-2" /> Save (⌘S)</>}
          </button>
          {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
              toast({ title: "Link copied" });
            }}
            className="text-gray-400 hover:text-indigo-600 p-1 dark:text-gray-500 dark:hover:text-indigo-400"
            title="Copy link"
          >
            <Copy size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
        className="w-full text-3xl font-bold border-b border-gray-300 pb-2 focus:border-indigo-500 focus:outline-none mb-6 bg-transparent dark:border-gray-600 dark:text-white"
        placeholder="Untitled document"
      />

      <div className="space-y-4 min-h-[600px]">
        {blocks.map((b, i) => (
          <div key={i} className="flex gap-3">
            <button
              onClick={() => removeBlock(i)}
              className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
            >
                            ×
            </button>
            <div className="flex-1 border-b border-gray-200 pb-1 dark:border-gray-700">
              <textarea
                value={b.text}
                onChange={(e) => updateBlock(i, e.target.value)}
                className="w-full resize-none text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 bg-transparent dark:text-white"
                rows={3}
                placeholder={b.type === "heading" ? "Heading…" : "Type here…"}
                style={{ fontSize: b.type === "heading" ? "1.5rem" : "1rem", fontWeight: b.type === "heading" ? "700" : "400" }}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2 no-print">
          <button
            onClick={() => addBlock("paragraph")}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Paragraph
          </button>
          <button
            onClick={() => addBlock("heading")}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Heading
          </button>
        </div>
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6 flex gap-4 no-print dark:border-gray-700">
        {["pdf", "docx", "html", "md"].map((fmt) => (
          <button
            key={fmt}
            onClick={() => {
              downloadFile(`/api/v1/export/${id}/${fmt}`, `${title.replace(/\s+/g, "_")}.${fmt}`).catch((e: any) =>
                toast({ title: "Export failed", description: e.message, variant: "destructive" }),
              );
            }}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-400 transition dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Download size={16} strokeWidth={2} className="mr-1 inline align-[-1px]" />
            Export {fmt.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
