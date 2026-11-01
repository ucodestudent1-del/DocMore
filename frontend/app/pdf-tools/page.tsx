"use client";

import { useState, useRef } from "react";
import {
  uploadFile,
  pdfMerge,
  pdfSplit,
  pdfWatermark,
  pdfPageNumbers,
  pdfCompress,
  pdfProtect,
  pdfUnlock,
  pdfExtractText,
  pdfOcr,
  imagesToPdf,
  runAsyncJob,
  downloadFile,
} from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Download,
  Plus,
  Scissors,
  Image as ImageIcon,
  Lock,
  Unlock,
  FileText,
  Printer,
  Scan,
  Globe,
} from "lucide-react";

function FilePicker({ accept, onPicked }: { accept: string; onPicked: (id: string, name: string) => void }) {
  const [name, setName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setName(e.target.files[0].name);
      uploadFile(e.target.files[0])
        .then((r: any) => onPicked(r.id, r.original_name))
        .catch((e: any) => toast({ title: "Upload failed", description: e.message }));
    }
  };
  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-accent/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={onChange} />
        <Plus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm">Upload file</p>
      </div>
      {name && <p className="text-xs text-muted-foreground">{name}</p>}
    </div>
  );
}

function MultiFilePicker({ onPicked }: { onPicked: (ids: string[], files: File[], names: string[]) => void }) {
  const [names, setNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setNames(files.map((f) => f.name));
    const fd = new FormData();
    for (const f of files) fd.append("file", f);
    fetch("/api/upload", { method: "POST", body: fd })
      .then(async (res) => {
        if (!res.ok) throw new Error("upload failed");
        return res.json();
      })
      .then((r: any) => onPicked([r.id], files, names))
      .catch((e: any) => toast({ title: "Upload failed", description: e.message }));
  };
  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-accent/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".pdf" multiple onChange={onChange} />
        <Plus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm">Upload PDFs</p>
      </div>
      {names.length > 0 && (
        <p className="text-xs text-muted-foreground">{names.join(", ")}</p>
      )}
    </div>
  );
}

const RESULT_ICON: Record<string, any> = { pdf: FileText, txt: FileText };

const OCR_LANGS = [
  { code: "eng", name: "English" },
  { code: "spa", name: "Spanish" },
  { code: "fra", name: "French" },
  { code: "deu", name: "German" },
  { code: "ita", name: "Italian" },
  { code: "por", name: "Portuguese" },
  { code: "rus", name: "Russian" },
  { code: "chi_sim", name: "Chinese (Simplified)" },
  { code: "jpn", name: "Japanese" },
  { code: "kor", name: "Korean" },
  { code: "ara", name: "Arabic" },
  { code: "hin", name: "Hindi" },
];

export default function PdfToolsPage() {
  const [result, setResult] = useState<{ id: string; ext: string; name: string } | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfFileId, setPdfFileId] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState("eng");

  const download = (id: string) => {
    window.location.href = downloadFile(id);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PDF Tools</h1>
        <p className="text-muted-foreground">
          Merge, split, compress, rotate, watermark, add page numbers, extract text, and protect PDFs.
        </p>
      </div>

      <Tabs defaultValue="merge">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="merge">Merge</TabsTrigger>
          <TabsTrigger value="split">Split</TabsTrigger>
          <TabsTrigger value="watermark">Watermark</TabsTrigger>
          <TabsTrigger value="page-numbers">Page Numbers</TabsTrigger>
          <TabsTrigger value="compress">Compress</TabsTrigger>
          <TabsTrigger value="protect">Protect / Unlock</TabsTrigger>
          <TabsTrigger value="extract-text">Extract Text</TabsTrigger>
          <TabsTrigger value="ocr">OCR / Text Recognition</TabsTrigger>
          <TabsTrigger value="images-to-pdf">Images → PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="merge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Merge PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Combine multiple PDFs into one document.</p>
              <MultiFilePicker onPicked={async (ids) => {
                try {
                  const r = await runAsyncJob(() => pdfMerge(ids));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "merged.pdf" });
                } catch (e: any) {
                  toast({ title: "Merge failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="split" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Split PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                try {
                  const r = await runAsyncJob(() => pdfSplit(id));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "split.pdf" });
                } catch (e: any) {
                  toast({ title: "Split failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watermark" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Watermark</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                try {
                  const r = await runAsyncJob(() => pdfWatermark(id, "DRAFT"));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "watermarked.pdf" });
                } catch (e: any) {
                  toast({ title: "Watermark failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="page-numbers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Page Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                try {
                  const r = await runAsyncJob(() => pdfPageNumbers(id, "bottom-center"));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "numbered.pdf" });
                } catch (e: any) {
                  toast({ title: "Failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compress PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                try {
                  const r = await runAsyncJob(() => pdfCompress(id));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "compressed.pdf" });
                } catch (e: any) {
                  toast({ title: "Compress failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protect" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Protect / Unlock PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                setPdfFileId(id);
              }} />
              <div className="mt-4 space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (!pdfFileId) return;
                      if (!pdfPassword) {
                        toast({ title: "Password required", description: "Please enter a password" });
                        return;
                      }
                      runAsyncJob(() => pdfProtect(pdfFileId, pdfPassword))
                        .then((r: any) => setResult({ id: r.id, ext: r.ext, name: r.name || "protected.pdf" }))
                        .catch((e: any) => toast({ title: "Protect failed", description: e.message }));
                    }}
                    disabled={!pdfFileId || !pdfPassword}
                    className="w-full"
                  >
                    Protect
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!pdfFileId) return;
                      if (!pdfPassword) {
                        toast({ title: "Password required", description: "Please enter a password" });
                        return;
                      }
                      runAsyncJob(() => pdfUnlock(pdfFileId, pdfPassword))
                        .then((r: any) => setResult({ id: r.id, ext: r.ext, name: r.name || "unlocked.pdf" }))
                        .catch((e: any) => toast({ title: "Unlock failed", description: e.message }));
                    }}
                    disabled={!pdfFileId || !pdfPassword}
                    className="w-full"
                  >
                    Unlock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extract-text" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extract Text</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePicker accept=".pdf" onPicked={async (id) => {
                try {
                  const r = await runAsyncJob(() => pdfExtractText(id));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "extracted.txt" });
                } catch (e: any) {
                  toast({ title: "Extract failed", description: e.message });
                }
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OCR / Text Recognition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FilePicker accept=".pdf,.png,.jpg,.jpeg,.webp" onPicked={async (id) => {
                  setPdfFileId(id);
                }} />
                <div className="space-y-2">
                  <Label>OCR Language</Label>
                  <Select value={ocrLang} onValueChange={setOcrLang}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue>{OCR_LANGS.find((l) => l.code === ocrLang)?.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {OCR_LANGS.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (!pdfFileId) return;
                      runAsyncJob(() => pdfOcr(pdfFileId, ocrLang))
                        .then((r: any) => setResult({ id: r.id, ext: r.ext, name: r.name || "ocr.pdf" }))
                        .catch((e: any) => toast({ title: "OCR failed", description: e.message }));
                    }}
                    disabled={!pdfFileId}
                    className="w-full"
                  >
                    Run OCR
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requires Tesseract OCR engine and language data installed on the server.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images-to-pdf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Images to PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Convert one or more images into a single PDF.</p>
              <MultiFilePicker onPicked={async (_ids, files) => {
                try {
                  const r = await runAsyncJob(() => imagesToPdf(files));
                  setResult({ id: r.id, ext: r.ext, name: r.name || "images.pdf" });
                } catch (e: any) {
                  toast({ title: "Images → PDF failed", description: e.message });
                }
              }} />
              <p className="text-xs text-muted-foreground mt-2">Select images; backend assembles them into a PDF.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result ready</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-primary flex items-center justify-center text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{result.name}</p>
                <p className="text-xs text-muted-foreground">{result.ext.toUpperCase()}</p>
              </div>
              <a href={downloadFile(result.id)} download>
                <Button>Download <Download className="ml-2 h-4 w-4" /></Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
