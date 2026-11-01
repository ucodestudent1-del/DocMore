"use client";


import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Play, List, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Universal Document Studio</h1>
        <p className="text-lg text-muted-foreground mt-4">
          Convert, generate, and automate documents. PDF, Word, Excel, PowerPoint, images, HTML, Markdown, and more.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <a href="/convert" className="p-6 border rounded-2xl hover:bg-accent transition-colors text-left">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="h-6 w-6" /><span className="font-semibold">Universal Converter</span>
          </div>
          <p className="text-sm text-muted-foreground">Convert between 30+ formats.</p>
        </a>
        <a href="/pdf-tools" className="p-6 border rounded-2xl hover:bg-accent transition-colors text-left">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-6 w-6" /><span className="font-semibold">PDF Tools</span>
          </div>
          <p className="text-sm text-muted-foreground">Merge, split, compress, watermark, protect.</p>
        </a>
        <a href="/generate" className="p-6 border rounded-2xl hover:bg-accent transition-colors text-left">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-6 w-6" /><span className="font-semibold">Document Generator</span>
          </div>
          <p className="text-sm text-muted-foreground">Rich text editor with templates.</p>
        </a>
      </div>
      <div className="border-t pt-8 text-center text-muted-foreground text-sm">
        Backend API running at <code>http://127.0.0.1:8000</code>
      </div>
    </div>
  );
}

