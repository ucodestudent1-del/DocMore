"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Upload, RefreshCw, Download } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type Format = "pdf" | "docx" | "html" | "md";

const FORMATS: Format[] = ["pdf", "docx", "html", "md"];
const EXT_LABEL: Record<Format, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  html: "HTML",
  md: "Markdown",
};

export default function Convert() {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<Format>("pdf");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  function sourceFormatOf(name: string): Format | null {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "pdf";
      case "docx": return "docx";
      case "html": return "html";
      case "md":
      case "markdown": return "md";
      default: return null;
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const sf = sourceFormatOf(file.name);
    if (!sf) {
      toast({ title: "Unsupported file type", variant: "destructive" });
      return;
    }

    setLoading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("targetFormat", targetFormat);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/convert`, {
        method: "POST",
        headers: { "X-User-Id": localStorage.getItem("ed_user_id") || "" },
        body: form,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Conversion failed ${res.status}`);
      }
      const data = await res.json();
      setJob(data);
      toast({ title: "Conversion complete" });
    } catch (e: any) {
      toast({ title: "Conversion failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Convert a File</h1>
      <p className="text-gray-500 mb-6 dark:text-gray-400">
        Convert between PDF, Word, HTML, and Markdown.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleConvert} className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition dark:border-gray-600 dark:bg-gray-800/50">
          <Upload size={32} strokeWidth={2} className="mx-auto mb-3 text-gray-400 dark:text-gray-500" />
          <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">
            Drag &amp; drop a file, or click to browse
          </p>
          <input
            type="file"
            accept=".pdf,.docx,.html,.md,.markdown"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
            onChange={(e) => {
              if (e.target.files?.[0]) setFile(e.target.files[0]);
            }}
          />
          {file && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-indigo-50 dark:border-gray-600 dark:hover:bg-gray-700">
              <input
                type="radio"
                name="targetFormat"
                value={f}
                checked={targetFormat === f}
                onChange={() => setTargetFormat(f)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm dark:text-gray-300">{EXT_LABEL[f]}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? <><RefreshCw size={18} strokeWidth={2} className="mr-2 inline animate-spin" /> Converting...</> : "Convert File"}
        </button>
      </form>

      {job && (
        <section className="mt-8 border border-gray-200 rounded-lg p-6 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
            <RefreshCw size={18} strokeWidth={2} /> Conversion Result
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className="font-medium dark:text-white">{job.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Source:</span>
              <span className="dark:text-white">{job.sourceFilename || file?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Target:</span>
              <span className="dark:text-white">{EXT_LABEL[job.targetFormat as keyof typeof EXT_LABEL]}</span>
            </div>
            {job.outputFilename && (
              <a
                href={job.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition"
              >
                <Download size={16} strokeWidth={2} /> Download {job.outputFilename}
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
