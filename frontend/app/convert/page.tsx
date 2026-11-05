"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, API_BASE, downloadFile } from "@/lib/api";
import { Upload, RefreshCw, Download, Clock, FileText } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Format = "pdf" | "docx" | "html" | "md";

const FORMATS: Format[] = ["pdf", "docx", "html", "md"];

const EXT_LABEL: Record<Format, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  html: "HTML",
  md: "Markdown",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type JobStatus = "queued" | "processing" | "completed" | "failed";

const statusLabel: Record<JobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const statusColor: Record<JobStatus, string> = {
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function Convert() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<Format>("pdf");
  const [job, setJob] = useState<{ id: string; status: JobStatus; targetFormat: string; sourceFilename: string; downloadUrl: string | null; error: string | null } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

  const validateFile = useCallback((f: File): string | null => {
    const sf = sourceFormatOf(f.name);
    if (!sf) return "Unsupported file type. Use PDF, DOCX, HTML, or Markdown.";
    if (f.size > MAX_FILE_SIZE) return f.name + " exceeds the 25 MB free-tier limit.";
    return null;
  }, [sourceFormatOf]);

  const pollJob = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api("/api/v1/convert/" + id);
        setJob((prev) => (prev ? { ...prev, status: data.status, downloadUrl: data.downloadUrl, error: data.error || null } : prev));
        if (data.status === "completed" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  }, []);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please upload a file to convert.");
      return;
    }
    const v = validateFile(file);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("targetFormat", targetFormat);

    try {
      const res = await fetch(API_BASE + "/api/v1/convert", {
        method: "POST",
        headers: { "X-User-Id": localStorage.getItem("ed_user_id") || "" },
        body: form,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Conversion failed " + res.status);
      }
      const data = await res.json();
      setJob({
        id: data.id,
        status: data.status,
        targetFormat: data.targetFormat,
        sourceFilename: file.name,
        downloadUrl: data.downloadUrl ?? null,
        error: null,
      });
      pollJob(data.id);
      toast({ title: "Conversion started" });
    } catch (e: any) {
      toast({ title: "Conversion failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => setFile(null);

  const downloadJob = async () => {
    if (!job?.downloadUrl) return;
    try {
      const name = job.sourceFilename.replace(/\.[^/.]+$/, "");
      await downloadFile(job.downloadUrl, name + "." + job.targetFormat);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const formatButtonClass = (f: Format) => {
    const base = "flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 text-sm transition-all duration-200";
    if (targetFormat === f) {
      return base + " border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shadow-sm shadow-brand-500/20";
    }
    return base + " border-input text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800";
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Convert a File</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Convert between PDF, Word, HTML, and Markdown.
          </p>
        </div>
        <Button asChild>
          <a href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Clock size={16} strokeWidth={2} className="mr-2" /> Back to dashboard
          </a>
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>
            Select a single file (PDF, DOCX, HTML, or Markdown) to convert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleConvert}>
            <div
              onClick={() => (document.getElementById("convert-file") as HTMLInputElement)?.click()}
              className="border-2 border-dashed border-input rounded-2xl p-8 text-center hover:border-brand-600 dark:hover:border-brand-500 transition-all cursor-pointer group"
            >
              <input
                id="convert-file"
                type="file"
                accept=".pdf,.docx,.html,.md,.markdown"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0]);
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <Upload size={36} strokeWidth={2} className="text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                <p className="text-sm text-slate-600 dark:text-slate-300">Drag &amp; drop a file, or click to browse</p>
              </div>
              {file && (
                <div className="flex items-center gap-4 px-4 py-3 mt-4 rounded-xl bg-secondary dark:bg-slate-800 border border-input">
                  <FileText size={18} strokeWidth={2} className="text-brand-600 dark:text-brand-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate" title={file.name}>{file.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">Max 25 MB per file on the free tier.</p>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Target format</label>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <label key={f} className={formatButtonClass(f)}>
                    <input
                      type="radio"
                      name="targetFormat"
                      value={f}
                      checked={targetFormat === f}
                      onChange={() => setTargetFormat(f)}
                      className="sr-only"
                    />
                    {EXT_LABEL[f]}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading || !file} className="w-full shadow-lg shadow-brand-500/30">
                {loading ? (
                  <><RefreshCw size={18} strokeWidth={2} className="mr-2 inline animate-spin" /> Converting...</>
                ) : (
                  <><Upload size={18} strokeWidth={2} className="mr-2 inline" /> Convert File</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Conversion result</CardTitle>
            <Badge variant={job.status === "completed" ? "default" : "outline"}>
              {statusLabel[job.status]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Source</span>
              <span className="font-medium text-slate-900 dark:text-white truncate">{job.sourceFilename}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Target</span>
              <span className="font-medium text-slate-900 dark:text-white">{EXT_LABEL[job.targetFormat as keyof typeof EXT_LABEL]}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Status</span>
              <span className={statusColor[job.status] + " text-xs font-semibold px-2.5 py-1 rounded-full"}>
                {statusLabel[job.status]}
              </span>
            </div>
            {job.status === "completed" && job.downloadUrl && (
              <CardFooter>
                <Button onClick={downloadJob} className="w-full shadow-sm">
                  <Download size={16} strokeWidth={2} /> Download {job.sourceFilename.replace(/\.[^/.]+$/, "")}.{job.targetFormat}
                </Button>
              </CardFooter>
            )}
            {job.status === "failed" && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {job.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
