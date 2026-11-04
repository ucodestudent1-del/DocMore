"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Upload, FileText, RefreshCw, Download } from "lucide-react";

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
  const [progress, setProgress] = useState(0);

  const accept = ".pdf,.docx,.html,.md,.markdown";

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
      setError("Unsupported source file type.");
      return;
    }

    setLoading(true);
    setError("");
    setProgress(0);
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
      setProgress(100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Convert a File</h1>
      <p className="text-gray-500 mb-6">
        Convert between PDF, Word, HTML, and Markdown.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
      )}

      <form onSubmit={handleConvert} className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition">
          <Upload size={32} strokeWidth={2} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-600 mb-2">Drag &amp; drop a file, or click to browse</p>
          <input
            type="file"
            accept={accept}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            onChange={(e) => {
              if (e.target.files?.[0]) setFile(e.target.files[0]);
            }}
          />
          {file && (
            <p className="mt-2 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-indigo-50">
              <input
                type="radio"
                name="targetFormat"
                value={f}
                checked={targetFormat === f}
                onChange={() => setTargetFormat(f)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm">{EXT_LABEL[f as keyof typeof EXT_LABEL]}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? "Converting..." : "Convert File"}
        </button>
      </form>

      {job && (
        <section className="mt-8 border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <RefreshCw size={18} strokeWidth={2} /> Conversion Result
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium">{job.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Source:</span>
              <span>{job.sourceFilename || file?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Target:</span>
              <span>{EXT_LABEL[job.targetFormat as keyof typeof EXT_LABEL]}</span>
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
