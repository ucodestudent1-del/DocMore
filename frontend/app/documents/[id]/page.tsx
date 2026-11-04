"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Save, FileText, ArrowLeft, Copy } from "lucide-react";

type Block = { type: string; text: string };

export default function DocumentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadDoc();
  }, [id]);

  async function loadDoc() {
    try {
      const d = await api(`/api/v1/documents/${id}`);
      setDoc(d);
      setTitle(d.title);
      setBlocks((d.content?.blocks || []).map((b: any) => ({ type: b.type, text: b.text || "" })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function addBlock(type: "paragraph" | "heading") {
    setBlocks([...blocks, { type, text: "" }]);
  }

  function updateBlock(i: number, text: string) {
    const next = [...blocks];
    next[i] = { ...next[i], text };
    setBlocks(next);
  }

  function removeBlock(i: number) {
    setBlocks(blocks.filter((_, idx) => idx !== i));
  }

  async function saveDoc() {
    setSaving(true);
    try {
      await api(`/api/v1/documents/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, content: { blocks } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!doc) return null;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft size={16} strokeWidth={2} /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDoc}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${saving ? "bg-gray-300" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
          >
            {saving ? "Saving..." : <><Save size={16} strokeWidth={2} className="mr-2" /> Save</>}
          </button>
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
            className="text-gray-400 hover:text-indigo-600 p-1"
            title="Copy link"
          >
            <Copy size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-3xl font-bold border-b border-gray-300 pb-2 focus:border-indigo-500 focus:outline-none mb-6"
        placeholder="Untitled document"
      />

      <div className="space-y-4 min-h-[600px]">
        {blocks.map((b, i) => (
          <div key={i} className="flex gap-3">
            <button
              onClick={() => removeBlock(i)}
              className="p-1 text-gray-400 hover:text-red-500"
            >
                            ×
            </button>
            <div className="flex-1 border-b border-gray-200 pb-1">
              <textarea
                value={b.text}
                onChange={(e) => updateBlock(i, e.target.value)}
                className="w-full resize-none text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2"
                rows={3}
                placeholder={b.type === "heading" ? "Heading…" : "Type here…"}
                style={{ fontSize: b.type === "heading" ? "1.5rem" : "1rem", fontWeight: b.type === "heading" ? "700" : "400" }}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => addBlock("paragraph")}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            Paragraph
          </button>
          <button
            onClick={() => addBlock("heading")}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            Heading
          </button>
        </div>
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6 flex gap-4">
        {["pdf", "docx", "html", "md"].map((fmt) => (
          <a
            key={fmt}
            href={`/api/v1/export/${id}/${fmt}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-400 transition"
          >
            Export {fmt.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  );
}
