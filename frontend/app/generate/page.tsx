"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import {
  generateDocument,
  generateTemplate,
  generateBatch,
  generateBatchCsv,
  generateBatchJson,
  runAsyncJob,
  listTemplates,
  templatePlaceholders,
  listFormats,
  downloadFile,
  getToken,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Download,
  Plus,
  Trash2,
  List,
  ChevronUp,
  ChevronDown,
  Undo,
  Redo,
} from "lucide-react";
import { TemplateForm } from "@/app/generate/components/TemplateForm";
import { TemplatePreview } from "@/app/generate/components/TemplatePreview";
import { TEMPLATES, type TemplateBlock } from "@/lib/templates";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

type Block = {
  id: string;
  type: "heading" | "paragraph" | "list" | "table" | "image" | "pagebreak";
  data: any;
};

const INITIAL_BLOCKS: Block[] = [
  { id: "b1", type: "heading", data: { text: "My Document", level: 1 } },
  { id: "b2", type: "paragraph", data: { text: "Start writing your document here.", align: "left" } },
];

const FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (DOCX)" },
  { value: "html", label: "HTML" },
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Plain Text" },
  { value: "epub", label: "EPUB" },
];

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GeneratePageContent />
    </Suspense>
  );
}

function GeneratePageContent() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [undoStack, setUndoStack] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);
  const [format, setFormat] = useState("pdf");
  const [pageSize, setPageSize] = useState("letter");
  const [orientation, setOrientation] = useState("portrait");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ id: string; ext: string; name: string } | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResult, setBatchResult] = useState<{ template: string; format: string; total: number; results: any[] } | null>(null);
  const [batchData, setBatchData] = useState("");
  const [batchMode, setBatchMode] = useState("csv"); // "csv" | "json"
  const [batchTemplate, setBatchTemplate] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [batchFormat, setBatchFormat] = useState("pdf");
  const [formats, setFormats] = useState<{ format: string; status: string }[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setTemplateName(params.get("template"));
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    listTemplates().then((r: any) => setTemplates(r.templates || [])).catch(() => {});
    listFormats().then((r: any) => {
      if (Array.isArray(r)) setFormats(r);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (templateName && !templateLoaded) {
      const tpl = TEMPLATES.find((t) => t.name === templateName);
      if (tpl) {
        setBlocks(tpl.blocks);
        setTemplateLoaded(true);
        toast({ title: "Template loaded", description: `${tpl.name.charAt(0).toUpperCase() + tpl.name.slice(1)} template applied` });
      }
    }
  }, [templateName, templateLoaded]);

  useEffect(() => {
    if (batchTemplate) {
      templatePlaceholders(batchTemplate).then((r: any) => setPlaceholders(r.placeholders || [])).catch(() => {});
    }
  }, [batchTemplate]);

  useEffect(() => {
    localStorage.setItem("ud-draft", JSON.stringify(blocks));
  }, [blocks]);

  useEffect(() => {
    if (!templateName) {
      const saved = localStorage.getItem("ud-draft");
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (Array.isArray(draft) && draft.length > 0) {
            setBlocks(draft);
            toast({ title: "Draft restored", description: "Your previous document was restored." });
          }
        } catch {
          // Ignore malformed draft
        }
      }
    }
  }, [templateName]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (result) downloadFile(result.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [result]);

  const pushToUndo = useCallback((next: Block[]) => {
    setUndoStack((prev) => {
      const nextStack = [...prev, blocks];
      if (nextStack.length > 50) nextStack.shift();
      return nextStack;
    });
    setRedoStack([]);
    setBlocks(next);
  }, [blocks]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const [last, ...rest] = prev;
      setRedoStack((r) => [...r, blocks]);
      setBlocks(last);
      return rest;
    });
  }, [blocks]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [last, ...rest] = prev;
      setUndoStack((u) => [...u, blocks]);
      setBlocks(last);
      return rest;
    });
  }, [blocks]);

  const addBlock = useCallback((type: Block["type"]) => {
    const id = Date.now().toString();
    let data: any = {};
    if (type === "heading") data = { text: "New section", level: 2 };
    if (type === "paragraph") data = { text: "", align: "left" };
    if (type === "list") data = { items: ["Item 1", "Item 2"], ordered: false };
    if (type === "table") data = { rows: [["", ""], ["", ""]] };
    if (type === "image") data = { path: "", width: 4 };
    pushToUndo([...blocks, { id, type, data }]);
  }, [blocks, pushToUndo]);

  const removeBlock = useCallback((id: string) => {
    pushToUndo(blocks.filter((b) => b.id !== id));
  }, [blocks, pushToUndo]);

  const updateBlock = useCallback((id: string, patch: any) => {
    pushToUndo(blocks.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)));
  }, [blocks, pushToUndo]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await runAsyncJob(() => generateDocument(blocks, format, undefined, pageSize, orientation));
      setResult({ id: r.id, ext: r.ext, name: r.name || `document.${r.ext}` });
      toast({ title: "Document generated", description: `Exported as ${format.toUpperCase()}` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const generateBatch = async () => {
    setBatchGenerating(true);
    try {
      let job: any;
      if (batchMode === "csv") {
        job = await runAsyncJob(() => generateBatchCsv(batchTemplate || "", batchData, batchFormat, "letter", "portrait"));
      } else {
        job = await runAsyncJob(() => generateBatchJson(batchTemplate || "", batchData, batchFormat, "letter", "portrait"));
      }
      const rows = batchData.trim().split(/\r?\n/).filter(Boolean).length;
      setBatchResult({ template: batchTemplate || "", format: batchFormat, total: rows, results: job.results || [] });
      toast({ title: "Batch generation complete", description: `Generated ${job.results?.length || 0} documents` });
    } catch (e: any) {
      toast({ title: "Batch generation failed", description: e.message });
    } finally {
      setBatchGenerating(false);
    }
  };

  const download = () => {
    if (result) downloadFile(result.id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Generator</h1>
        <p className="text-muted-foreground">Build documents with rich content blocks and export to PDF, Word, HTML, Markdown, or TXT.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Document editor</CardTitle>
                <p className="text-xs text-muted-foreground">Add and arrange blocks</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  variant="ghost"
                  size="icon"
                  aria-label="Undo"
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  variant="ghost"
                  size="icon"
                  aria-label="Redo"
                >
                  <Redo className="h-4 w-4" />
                </Button>
                <Button onClick={() => addBlock("heading")} size="sm" variant="outline">
                  <List className="mr-2 h-4 w-4" /> Heading
                </Button>
                <Button onClick={() => addBlock("paragraph")} size="sm" variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> Paragraph
                </Button>
                <Button onClick={() => addBlock("list")} size="sm" variant="outline">
                  <List className="mr-2 h-4 w-4" /> List
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 p-4 bg-background rounded-lg border border-border min-h-[400px]">
                {blocks.map((b) => (
                  <BlockEditor key={b.id} block={b} onUpdate={updateBlock} onRemove={removeBlock} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export settings</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue>{FORMATS.find((f) => f.value === format)?.label || format}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="flex items-center gap-2">{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Page size</Label>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger><SelectValue>{pageSize}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="A4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger><SelectValue>{orientation}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generate} disabled={generating} className="w-full">
                <span className="flex items-center justify-between w-full">
                  <span>{generating ? "Generating…" : "Generate & Download"}</span>
                  <Download className="h-4 w-4" />
                </span>
              </Button>
            </CardContent>
          </Card>

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
                  <Button onClick={() => downloadFile(result.id)}>
                    Download</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Batch generation</CardTitle>
              <p className="text-xs text-muted-foreground">Generate multiple documents from one template using CSV or JSON data.</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={batchTemplate || ""} onValueChange={setBatchTemplate}>
                  <SelectTrigger><SelectValue>{batchTemplate || "Select a template"}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data source</Label>
                <div className="flex gap-2">
                  <Button onClick={() => setBatchMode("csv")} variant={batchMode === "csv" ? "default" : "outline"} size="sm">
                    CSV
                  </Button>
                  <Button onClick={() => setBatchMode("json")} variant={batchMode === "json" ? "default" : "outline"} size="sm">
                    JSON
                  </Button>
                </div>
              </div>
              <Textarea
                value={batchData}
                onChange={(e) => setBatchData(e.target.value)}
                placeholder={batchMode === "csv" ? "name,email,role\nAlice,alice@example.com,Engineer\nBob,bob@example.com,Designer" : '[{"name":"Alice","email":"alice@example.com"},{"name":"Bob","email":"bob@example.com"}]'}
                className="h-40 font-mono text-sm"
              />
              {placeholders.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Placeholders:</span> {placeholders.join(", ")}
                </div>
              )}
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={batchFormat} onValueChange={setBatchFormat}>
                  <SelectTrigger><SelectValue>{batchFormat}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f.format} value={f.format}>{f.format.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generateBatch} disabled={batchGenerating || !batchTemplate || !batchData.trim()} className="w-full">
                {batchGenerating ? "Generating batch…" : "Generate Batch"}
              </Button>
            </CardContent>
          </Card>
          {batchResult && (
            <Card>
              <CardHeader>
                <CardTitle>Batch results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{batchResult.results.length} of {batchResult.total} documents generated ({batchResult.format.toUpperCase()})</p>
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  {batchResult.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 text-sm border-b border-border/50 last:border-0">
                      <span className="truncate">{r.name || `doc-${i + 1}.${batchResult.format}`}</span>
                      {r.output_id ? (
                        <Button onClick={() => downloadFile(r.output_id)} variant="ghost" size="icon">
                          <Download className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-xs text-destructive">{r.error || "failed"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {templateName && templateLoaded && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Template: {templateName.charAt(0).toUpperCase() + templateName.slice(1)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TemplateForm key={templateName} blocks={blocks} onUpdate={updateBlock} />
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Live preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <TemplatePreview blocks={blocks} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ block, onUpdate, onRemove }: { block: Block; onUpdate: (id: string, patch: any) => void; onRemove: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [text, setText] = useState(block.data.text || "");

  const common = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onUpdate(block.id, { text: e.target.value });

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground cursor-pointer" onClick={() => setCollapsed(false)}>
        <ChevronDown className="h-3 w-3" /> {block.type} (click to expand)
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(true)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground uppercase">{block.type}</span>
        <Button variant="ghost" size="sm" onClick={() => onRemove(block.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {block.type === "heading" && (
        <>
          <Select value={String(block.data.level || 1)} onValueChange={(v) => onUpdate(block.id, { level: Number(v) })}>
            <SelectTrigger className="w-12"><SelectValue>{block.data.level}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1</SelectItem>
              <SelectItem value="2">H2</SelectItem>
              <SelectItem value="3">H3</SelectItem>
              <SelectItem value="4">H4</SelectItem>
            </SelectContent>
          </Select>
          <Input value={text} onChange={common} placeholder="Heading text" />
        </>
      )}
      {block.type === "paragraph" && (
        <Textarea value={text} onChange={common} placeholder="Paragraph text" className="h-32" />
      )}
      {block.type === "list" && (
        <Textarea value={Array.isArray(block.data.items) ? block.data.items.join("\n") : ""} onChange={(e) => onUpdate(block.id, { items: e.target.value.split("\n") })} placeholder="One item per line" className="h-32" />
      )}
      {block.type === "table" && (
        <>
          <div className="text-xs text-muted-foreground mb-1">Table (CSV): rows separated by newlines, cells by commas</div>
          <Textarea value={Array.isArray(block.data.rows) ? block.data.rows.map((r: any[]) => r.join(",")).join("\n") : ""} onChange={(e) => onUpdate(block.id, { rows: e.target.value.split("\n").map((line: string) => line.split(",")) })} placeholder="a,b,c" className="h-32" />
        </>
      )}
      {block.type === "image" && (
        <Input value={block.data.path || ""} onChange={(e) => onUpdate(block.id, { path: e.target.value })} placeholder="Image URL or path" />
      )}
      {block.type === "pagebreak" && (
        <p className="text-xs text-muted-foreground">Page break inserted</p>
      )}
    </div>
  );
}
