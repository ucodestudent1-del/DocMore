"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  uploadFile,
  convertFile,
  runAsyncJob,
  downloadFile,
  listFormats,
  convertOptions,
  conversionsForSource,
} from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Image as ImageIcon,
  Download,
  Loader2,
  Plus,
  ArrowRight,
} from "lucide-react";

const ConvertSchema = z.object({
  target: z.string().min(1),
});

type ConvertForm = z.infer<typeof ConvertSchema>;

const ICONS: Record<string, any> = {
  pdf: FileText,
  docx: FileText,
  jpg: ImageIcon,
  png: ImageIcon,
};

function IconFor(ext: string) {
  const Comp: any = ICONS[ext.toLowerCase()] || FileText;
  return <Comp className="h-4 w-4" />;
}

// Recommended target format for common source types
const RECOMMENDED_TARGETS: Record<string, string> = {
  pdf: "docx",
  docx: "pdf",
  doc: "pdf",
  odt: "pdf",
  rtf: "pdf",
  xlsx: "csv",
  xls: "csv",
  csv: "xlsx",
  pptx: "pdf",
  ppt: "pdf",
  odp: "pdf",
  png: "jpg",
  jpeg: "png",
  webp: "png",
  gif: "png",
  bmp: "png",
  tiff: "png",
  svg: "png",
  md: "pdf",
  txt: "pdf",
  html: "pdf",
  htm: "pdf",
  json: "csv",
  epub: "pdf",
};

export default function ConvertPage() {
  const [formats, setFormats] = useState<any>([]);
  const [sourceFile, setSourceFile] = useState<any>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [recommendedTarget, setRecommendedTarget] = useState<string | null>(null);
  const fileInput = useRef<any>(null);

  useEffect(() => {
    listFormats().then((r: any) => {
      setFormats(r.formats || []);
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        fileInput.current?.click();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fileInput]);

  const form = useForm<any>({
    resolver: zodResolver(ConvertSchema),
    defaultValues: { target: "" },
  });

  const handlePick = useCallback(async (file: File) => {
    try {
      const r = await uploadFile(file);
      setSourceFile({
        id: r.id,
        name: r.original_name,
        ext: r.ext,
        mime: r.mime,
        size: r.size,
      });
      setTargets([]);
      setResult(null);
      setError(null);
      try {
        const res: any = await conversionsForSource(r.ext);
        const supported = res?.targets || [];
        setTargets(supported);
        // Auto-select recommended target if supported
        const recommended = RECOMMENDED_TARGETS[r.ext];
        if (recommended && supported.includes(recommended)) {
          setRecommendedTarget(recommended);
          form.setValue("target", recommended);
        } else {
          setRecommendedTarget(null);
          form.setValue("target", "");
        }
      } catch {
        setTargets([]);
        setRecommendedTarget(null);
        form.setValue("target", "");
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message });
    }
  }, [form]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handlePick(e.dataTransfer.files[0]);
    }
  };

  const onSubmit = async (values: ConvertForm) => {
    if (!sourceFile) return;
    setConverting(true);
    setError(null);
    try {
      const r = await runAsyncJob(() => convertFile(sourceFile.id, values.target, {}));
      setResult({ id: r.id, ext: r.ext });
    } catch (e: any) {
      setError(e.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Universal Converter</h1>
        <p className="text-muted-foreground">
          Convert documents between PDF, Word, Excel, PowerPoint, images, HTML, Markdown, and more.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload document</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer ${dragOver ? "border-primary bg-accent/30 border-solid" : "border-border bg-transparent"}`}
                onClick={() => fileInput.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handlePick(e.target.files[0]);
                    }
                  }}
                />
                {dragOver ? (
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRight className="mx-auto h-8 w-8 text-primary mb-2 animate-pulse" />
                    <p className="text-sm font-medium text-primary">Drop file here</p>
                    <p className="text-xs text-muted-foreground">Release to upload</p>
                  </div>
                ) : (
                  <>
                    <Plus className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Click to upload a file</p>
                    <p className="text-xs text-muted-foreground">or drag and drop</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {sourceFile && (
            <Card>
              <CardHeader>
                <CardTitle>Convert to</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target format</Label>
                    <Select
                      onValueChange={(v) => {
                        form.setValue("target", v);
                      }}
                      disabled={targets.length === 0}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Choose format" />
                      </SelectTrigger>
                      <SelectContent>
                        {targets.map((t) => (
                          <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                        ))}
                        {targets.length === 0 && (
                          <SelectItem disabled value="detecting">Detecting supported formats...</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </div>
                  {recommendedTarget && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Recommended for you</span>
                      </div>
                      <p className="text-sm text-blue-700 mb-2">
                        Convert your {sourceFile.ext.toUpperCase()} to{" "}
                        <span className="font-semibold">{recommendedTarget.toUpperCase()}</span>
                      </p>
                      <Button
                        onClick={() => {
                          form.setValue("target", recommendedTarget);
                          onSubmit(form.getValues());
                        }}
                        className="w-full"
                      >
                        Convert to {recommendedTarget.toUpperCase()}
                      </Button>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={converting || targets.length === 0}
                    className="w-full"
                  >
                    {converting ? "Converting..." : "Convert"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="lg:col-span-5 space-y-6">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Ready to download</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <a href={downloadFile(result.id)} download>
                    <Button>
                      Download <Download className="ml-2 h-4 w-4" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
