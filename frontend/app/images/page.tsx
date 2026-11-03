"use client";

import { useState, useEffect } from "react";
import {
  imagesUpload,
  imageConvert,
  imageResize,
  imageCompress,
  imageRotate,
  imagesToPdfFromIds,
  imageFormats,
  runAsyncJob,
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
  Download,
  Image as ImageIcon,
  RotateCcw,
  Maximize,
  Minimize,
  RefreshCw,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

type ImageFile = {
  id: string;
  original_name: string;
  mime: string;
  ext: string;
  size: number;
  selected?: boolean;
};

export default function ImagesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ImageFile | null>(null);
  const [processing, setProcessing] = useState(false);
  const [formats, setFormats] = useState<{ input: string[]; output: string[] }>({
    input: [],
    output: [],
  });

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    imageFormats().then((r: any) => setFormats(r)).catch(() => {});
  }, [router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    setProcessing(true);
    try {
      const r = await imagesUpload(Array.from(selected));
      const newFiles: ImageFile[] = (r.files || []).map((f: any) => ({
        id: f.id,
        original_name: f.original_name,
        mime: f.mime,
        ext: f.ext,
        size: f.size,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      toast({ title: "Upload complete", description: `${newFiles.length} image(s) uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message });
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  };

  const runConvert = async (targetFormat: string) => {
    if (!selectedFile) return;
    setProcessing(true);
    try {
      const job = await runAsyncJob(() =>
        imageConvert(selectedFile.id, targetFormat, 85),
      );
      const out = job.output_id || job.id;
      toast({ title: "Conversion complete", description: `Converted to ${targetFormat.toUpperCase()}` });
      setSelectedFile(null);
      downloadFile(out);
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const runResize = async (width?: number, height?: number, fit = "cover") => {
    if (!selectedFile) return;
    setProcessing(true);
    try {
      const job = await runAsyncJob(() =>
        imageResize(selectedFile.id, width, height, fit, 85),
      );
      const out = job.output_id || job.id;
      toast({ title: "Resize complete", description: `Resized image` });
      setSelectedFile(null);
      downloadFile(out);
    } catch (err: any) {
      toast({ title: "Resize failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const runCompress = async (quality: number) => {
    if (!selectedFile) return;
    setProcessing(true);
    try {
      const job = await runAsyncJob(() => imageCompress(selectedFile.id, quality));
      const out = job.output_id || job.id;
      toast({ title: "Compression complete", description: `Quality ${quality}%` });
      setSelectedFile(null);
      downloadFile(out);
    } catch (err: any) {
      toast({ title: "Compression failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const runRotate = async (degrees: number) => {
    if (!selectedFile) return;
    setProcessing(true);
    try {
      const job = await runAsyncJob(() => imageRotate(selectedFile.id, degrees, true, 85));
      const out = job.output_id || job.id;
      toast({ title: "Rotation complete", description: `Rotated ${degrees}°` });
      setSelectedFile(null);
      downloadFile(out);
    } catch (err: any) {
      toast({ title: "Rotation failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const runImagesToPdf = async () => {
    const selected = files.filter((f) => f.selected);
    if (selected.length === 0) {
      toast({ title: "No images selected", description: "Select images to combine into PDF" });
      return;
    }
    setProcessing(true);
    try {
      const job = await runAsyncJob(() =>
        imagesToPdfFromIds(selected.map((f) => f.id), "letter", 85),
      );
      const out = job.output_id || job.id;
      toast({ title: "PDF created", description: `${selected.length} image(s) combined` });
      setFiles(files.map((f) => ({ ...f, selected: false })));
      downloadFile(out);
    } catch (err: any) {
      toast({ title: "PDF creation failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const isImage = (mime: string) => mime.startsWith("image/");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Image Processing</h1>
        <p className="text-muted-foreground">
          Upload, convert, resize, compress, rotate, and combine images into PDF.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Upload panel */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-lg">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <label className="cursor-pointer flex flex-col items-center gap-2">
                  <Button variant="secondary">Select images</Button>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP, GIF, BMP, TIFF, ICO
                </p>
              </div>
              {processing && (
                <div className="text-xs text-muted-foreground">Uploading…</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* File list */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Uploaded images</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No images uploaded yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer group"
                        onClick={() => setSelectedFile(selectedFile?.id === f.id ? null : f)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {f.mime} • {((f.size / 1024).toFixed(1))} KB
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={f.selected}
                            onChange={(e) =>
                              setFiles(
                                files.map((x) =>
                                  x.id === f.id ? { ...x, selected: e.target.checked } : x
                                ),
                              )
                            }
                            className="h-4 w-4"
                          />
                          {selectedFile?.id === f.id && (
                            <RefreshCw className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {isImage(f.mime) ? "image" : "file"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t">
                <Button
                  onClick={runImagesToPdf}
                  disabled={processing || files.filter((f) => f.selected).length === 0}
                  className="w-full"
                >
                  {processing ? "Creating PDF…" : "Selected → PDF"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing panel */}
        <div className="lg:col-span-4 space-y-6">
          {!selectedFile ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Select an image to process</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedFile.original_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedFile.mime} • {((selectedFile.size / 1024).toFixed(1))} KB
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Convert to</Label>
                    <div className="flex flex-wrap gap-2">
                      {formats.output.map((fmt) => (
                        <Button
                          key={fmt}
                          onClick={() => runConvert(fmt)}
                          variant="outline"
                          size="sm"
                          disabled={processing}
                        >
                          {fmt.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Resize</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => runResize(800, undefined, "contain")}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        800px wide
                      </Button>
                      <Button
                        onClick={() => runResize(undefined, 600, "contain")}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        600px tall
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Compress quality</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => runCompress(80)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        High (80%)
                      </Button>
                      <Button
                        onClick={() => runCompress(50)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        Medium (50%)
                      </Button>
                      <Button
                        onClick={() => runCompress(30)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        Low (30%)
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Rotate</Label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => runRotate(90)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        90° CW
                      </Button>
                      <Button
                        onClick={() => runRotate(180)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        180°
                      </Button>
                      <Button
                        onClick={() => runRotate(270)}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                      >
                        270° CW
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
