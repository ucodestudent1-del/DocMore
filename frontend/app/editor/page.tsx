"use client";

import {
  useState, useEffect, useCallback, useRef,
} from "react";
import {
  listDocuments,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocumentVersions,
  restoreDocumentVersion,
  exportDocument,
  downloadFile,
  getToken,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Save,
  Download,
  Trash2,
  History,
  RotateCcw,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronLeft,
  Plus,
  FileText,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("doc");

  const [doc, setDoc] = useState<{
    id: string;
    title: string;
    content: string;
    folder_id?: string | null;
    mime: string;
    updated_at: string;
    version: number;
  } | null>(null);
  const [documents, setDocuments] = useState<Array<{
    id: string;
    title: string;
    updated_at: string;
    version_count: number;
  }>>([]);
  const [versions, setVersions] = useState<Array<{
    id: string;
    version: number;
    created_at: string;
  }>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formats = [
    { label: "Bold", icon: Bold, cmd: "bold" },
    { label: "Italic", icon: Italic, cmd: "italic" },
    { label: "Underline", icon: Underline, cmd: "underline" },
    { label: "Align Left", icon: AlignLeft, cmd: "justifyLeft" },
    { label: "Align Center", icon: AlignCenter, cmd: "justifyCenter" },
    { label: "Align Right", icon: AlignRight, cmd: "justifyRight" },
    { label: "Bullet List", icon: List, cmd: "insertUnorderedList" },
    { label: "Ordered List", icon: ListOrdered, cmd: "insertOrderedList" },
    { label: "Link", icon: Link, cmd: "createLink" },
    { label: "Image", icon: ImageIcon, cmd: "insertImage" },
  ];

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadDocuments();
    if (docIdParam) {
      loadDocument(docIdParam);
    }
  }, [router, docIdParam, getToken]);

  const loadDocuments = async () => {
    try {
      const r = await listDocuments();
      setDocuments(r.documents || []);
    } catch {
      // Ignore
    }
  };

  const loadDocument = async (id: string) => {
    setLoading(true);
    try {
      const r = await getDocument(id);
      setDoc({
        id: r.id,
        title: r.title,
        content: r.content || "",
        folder_id: r.folder_id ?? null,
        mime: r.mime,
        updated_at: r.updated_at,
        version: r.version || 1,
      });
      loadVersions(id);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (id: string) => {
    try {
      const r = await listDocumentVersions(id);
      setVersions(r.versions || []);
    } catch {
      // Ignore
    }
  };

  const createNewDocument = async () => {
    const title = prompt("Document title:", "Untitled Document");
    if (!title) return;
    setLoading(true);
    try {
      const r = await createDocument(title, "");
      router.push(`/editor?doc=${r.id}`);
      setDocuments((prev) => [
        { id: r.id, title, updated_at: new Date().toISOString(), version_count: 1 },
        ...prev,
      ]);
      toast({ title: "Document created" });
    } catch (err: any) {
      toast({ title: "Create failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAutosave = useCallback(async () => {
    if (!doc || saving) return;
    const content = editorRef.current?.innerHTML || "";
    setSaving(true);
    try {
      await updateDocument(doc.id, doc.title, content, doc.folder_id || undefined);
      setLastSaved(new Date());
      setDoc((prev) => prev ? { ...prev, version: (prev.version || 0) + 1 } : prev);
    } catch (err: any) {
      toast({ title: "Autosave failed", description: err.message });
    } finally {
      setSaving(false);
    }
  }, [doc, saving]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(handleAutosave, 2000);
  }, [handleAutosave]);

  const handleEditorInput = () => {
    scheduleSave();
  };

  const applyFormat = (cmd: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (cmd === "createLink") {
      const url = prompt("Enter URL:");
      if (url) document.execCommand(cmd, false, url);
    } else if (cmd === "insertImage") {
      const url = prompt("Enter image URL:");
      if (url) document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, undefined);
    }
    handleEditorInput();
  };

  const updateTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!doc) return;
    setDoc({ ...doc, title: e.target.value });
    scheduleSave();
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirm(`Delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc.id);
      router.push("/editor");
      toast({ title: "Document deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message });
    }
  };

  const handleRestore = async (versionId: string, versionNum: number) => {
    if (!doc) return;
    try {
      const r = await restoreDocumentVersion(doc.id, versionId);
      setDoc((prev) => prev ? { ...prev, content: r.content, version: r.version } : prev);
      if (editorRef.current) {
        editorRef.current.innerHTML = r.content;
      }
      loadVersions(doc.id);
      toast({ title: `Restored version ${versionNum}` });
    } catch (err: any) {
      toast({ title: "Restore failed", description: err.message });
    }
  };

  const handleExport = async (format: string) => {
    if (!doc) return;
    try {
      const r = await exportDocument(doc.id, format);
      downloadFile(r.id);
      toast({ title: `Exported as ${format.toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message });
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading…</p>
      </div>
    </div>
  );

  if (!doc) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Editor</h1>
        <p className="text-muted-foreground">
          Create and edit documents with autosave, version history, and export.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={createNewDocument}>
          <Plus className="mr-2 h-4 w-4" /> New Document
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No documents yet. Create one to get started.</p>
          ) : (
            <div className="divide-y">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/editor?doc=${d.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      v{d.version_count} • {new Date(d.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="border-b border-border bg-background/50 backdrop-blur p-3 flex flex-wrap items-center gap-2">
        <Button
          onClick={() => router.push("/editor")}
          variant="ghost"
          size="icon"
          aria-label="Back to documents"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          value={doc.title}
          onChange={updateTitle}
          placeholder="Untitled document"
          className="flex-1 text-lg font-medium bg-transparent border-none focus:ring-0 px-0"
        />
        <div className="flex-1 flex justify-end gap-2">
          <Button
            onClick={() => handleExport("pdf")}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            <Download className="mr-2 h-3 w-3" /> PDF
          </Button>
          <Button
            onClick={() => handleExport("docx")}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            DOCX
          </Button>
          <Button
            onClick={() => handleExport("html")}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            HTML
          </Button>
          <Button
            onClick={() => handleExport("md")}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            MD
          </Button>
          <Button
            onClick={() => handleExport("txt")}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            TXT
          </Button>
          <Button
            onClick={handleDelete}
            variant="destructive"
            size="sm"
            disabled={saving}
          >
            <Trash2 className="mr-2 h-3 w-3" /> Delete
          </Button>
        </div>
        <div className="flex gap-1">
          {formats.map((f) => (
            <Button
              key={f.cmd}
              onClick={() => applyFormat(f.cmd)}
              variant="ghost"
              size="icon"
              disabled={!editorRef.current || saving}
              aria-label={f.label}
            >
              <f.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Save className="h-3 w-3" />
          <span>
            {saving ? "Saving…" : lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : "Ready"}
          </span>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: doc.content }}
          onInput={handleEditorInput}
          onBlur={scheduleSave}
          className="flex-1 overflow-y-auto p-6 bg-white text-gray-900 outline-none min-h-[400px] placeholder-gray-400"
          data-placeholder="Start writing…"
        />
      </div>

      {/* Versions panel (slide-over) */}
      {versions.length > 0 && (
        <div className="absolute inset-0 z-50 bg-black/50" onClick={() => setVersions([])} />
      )}
      {versions.length > 0 && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-border shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b border-border">
            <CardTitle className="text-base">Version History</CardTitle>
            <p className="text-xs text-muted-foreground">Restore a previous version</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {versions.map((v) => (
              <div
                key={v.id}
                className="px-4 py-3 hover:bg-muted/50 cursor-pointer"
                onClick={() => handleRestore(v.id, v.version)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Version {v.version}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>
                  <History className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
