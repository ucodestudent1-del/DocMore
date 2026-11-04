"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, API_BASE, downloadFile } from "@/lib/api";
import { Upload, RefreshCw, Download, Trash2, Clock } from "lucide-react";
import { useToast } from "@/components/Toast";

type Format = "pdf" | "docx" | "html" | "md";

const FORMATS: Format[] = ["pdf", "docx", "html", "md"];
const EXT_LABEL: Record<Format, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  html: "HTML",
  md: "Markdown",
};

const MAX_FILE_SIZE_FREE = 25 * 1024 * 1024; // 25 MB

type Job = {
  id: string;
  file: File | null;
  url: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  targetFormat: Format;
  sourceFilename: string;
  targetFilename: string | null;
  downloadUrl: string | null;
  error: string | null;
  progress: number;
};

export default function Convert() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [targetFormat, setTargetFormat] = useState<Format>("pdf");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api("/api/v1/auth/me")
      .catch(() => router.push("/login?next=/convert"))
      .finally(() => setCheckedAuth(true));
  }, [router]);

  if (!checkedAuth) return null;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const sourceFormatOf = useCallback((name: string): Format | null => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "pdf";
      case "docx": return "docx";
      case "html": return "html";
      case "md":
      case "markdown": return "md";
      default: return null;
    }
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const sf = sourceFormatOf(file.name);
    if (!sf) return "Unsupported file type. Use PDF, DOCX, HTML, or Markdown.";
    if (file.size > MAX_FILE_SIZE_FREE) return `${file.name} exceeds the 25 MB free-tier limit.`;
    return null;
  }, [sourceFormatOf]);

  const startConversion = useCallback(async (file: File | null, url: string | null) => {
    const jobId = Math.random().toString(36).slice(2);
    const job: Job = {
      id: jobId,
      file,
      url,
      status: "queued",
      targetFormat,
      sourceFilename: url || file?.name || "upload",
      targetFilename: null,
      downloadUrl: null,
      error: null,
      progress: 0,
    };
    setJobs((prev) => [...prev, job]);

    const form = new FormData();
    if (file) form.append("file", file);
    if (url) form.append("url", url);
    form.append("targetFormat", targetFormat);

    try {
      const res = await fetch(`${API_BASE}/api/v1/convert`, {
        method: "POST",
        headers: { "X-User-Id": localStorage.getItem("ed_user_id") || "" },
        body: form,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Conversion failed ${res.status}`);
      }
      const data = await res.json();
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: "completed", downloadUrl: data.downloadUrl, targetFilename: data.outputFilename, progress: 100 }
            : j
        )
      );
      toast({ title: "Conversion complete" });
    } catch (e: any) {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "failed", error: e.message } : j))
      );
      toast({ title: "Conversion failed", description: e.message, variant: "destructive" });
    }
  }, [targetFormat, toast]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const items: { file: File | null; url: string | null }[] = [];
    files.forEach((f) => items.push({ file: f, url: null }));
    if (urlInput.trim()) items.push({ file: null, url: urlInput.trim() });

    if (items.length === 0) {
      setError("Upload a file or enter a URL to convert.");
      return;
    }

    for (const item of items) {
      if (item.file) {
        const v = validateFile(item.file);
        if (v) {
          setError(v);
          return;
        }
      }
    }

    setLoading(true);
    try {
      await Promise.all(items.map((item) => startConversion(item.file, item.url)));
      setFiles([]);
      setUrlInput("");
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUrl = () => setUrlInput("");

  const downloadJob = (job: Job) => {
    if (!job.downloadUrl || !job.targetFilename) return;
    downloadFile(job.downloadUrl, job.targetFilename).catch((e: any) =>
      toast({ title: "Download failed", description: e.message, variant: "destructive" })
    );
  };

  const statusLabel = (s: Job["status"]) => ({
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
  }[s]);

  const statusColor = (s: Job["status"]) => ({
    queued: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  }[s]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Convert a File</h1>
      <p className="text-gray-500 mb-6 dark:text-gray-400">
        Convert between PDF, Word, HTML, and Markdown. Upload files or import from a URL.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleConvert} className="space-y-5">
        <section>
          <label htmlFor="convert-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Files
          </label>
          <div
            id="convert-file"
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition dark:border-gray-600 dark:bg-gray-800/50 cursor-pointer"
          >
            <Upload size={32} strokeWidth={2} className="mx-auto mb-3 text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">
              Drag &amp; drop files, or click to browse
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.html,.md,.markdown"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]);
              }}
            />
            {files.length > 0 && (
              <div className="mt-4 space-y-2 max-w-xs mx-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm">
                    <span className="truncate text-gray-700 dark:text-gray-300" title={f.name}>
                      {f.name} ({(f.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Max 25 MB per file on the free tier. Accepted: PDF, DOCX, HTML, Markdown.
            </p>
          </div>
        </section>

        <section>
          <label htmlFor="convert-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Or import from URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="convert-url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={removeUrl}
              disabled={!urlInput.trim()}
              className="px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              aria-label="Clear URL"
            >
              ×
            </button>
          </div>
          {urlInput.trim() && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{urlInput}</p>
          )}
        </section>

        <section>
          <label htmlFor="convert-target-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target format
          </label>
          <fieldset id="convert-target-format" className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-2">
            <legend className="px-2 font-medium text-sm text-gray-700 dark:text-gray-300">
              Target format
            </legend>
            {FORMATS.map((f) => (
              <label key={f} className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-indigo-50 dark:border-gray-600 dark:hover:bg-gray-700">
                <input
                  id={`format-${f}`}
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
          </fieldset>
        </section>

        <button
          type="submit"
          disabled={loading || files.length === 0 && !urlInput.trim()}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {loading ? (
            <><RefreshCw size={18} strokeWidth={2} className="mr-2 inline animate-spin" /> Converting...</>
          ) : (
            <><Upload size={18} strokeWidth={2} className="mr-2 inline" /> Convert {files.length + (urlInput.trim() ? 1 : 0)} file{files.length + (urlInput.trim() ? 1 : 0) === 1 ? "" : "s"}</>
          )}
        </button>
      </form>

      {jobs.length > 0 && (
        <section className="mt-10 border border-gray-200 rounded-xl p-6 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
            <RefreshCw size={18} strokeWidth={2} /> Conversion results
          </h2>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={job.sourceFilename}>
                    {job.sourceFilename}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(job.status)}`}
                  >
                    {statusLabel(job.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">→ {EXT_LABEL[job.targetFormat]}</span>
                  {job.status === "completed" && job.downloadUrl && job.targetFilename && (
                    <button
                      onClick={() => downloadJob(job)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Download size={14} strokeWidth={2} /> Download
                    </button>
                  )}
                  {job.status === "failed" && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">{job.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
