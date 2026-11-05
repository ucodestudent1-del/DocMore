"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  RefreshCw,
  Layers,
  ShieldCheck,
  Download,
  Upload,
  ArrowRight,
  Zap,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Document Generation",
    description: "Create professional documents quickly using customizable templates.",
    icon: FileText,
    gradient: "from-brand-500 to-indigo-500",
  },
  {
    title: "File Conversion",
    description: "Convert documents between supported file formats with ease.",
    icon: RefreshCw,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "Document Templates",
    description: "Save time with ready-made templates for your documents.",
    icon: Layers,
    gradient: "from-purple-500 to-fuchsia-500",
  },
];

const steps = [
  {
    step: "01",
    title: "Upload or generate",
    description: "Start with a template, paste a prompt, or upload a file to convert.",
  },
  {
    step: "02",
    title: "Edit & refine",
    description: "Use the built-in editor to polish your document before exporting.",
  },
  {
    step: "03",
    title: "Export & share",
    description: "Download as PDF, DOCX, HTML, or Markdown in one click.",
  },
];

const formats = [
  { label: "PDF", ext: ".pdf" },
  { label: "DOCX", ext: ".docx" },
  { label: "HTML", ext: ".html" },
  { label: "Markdown", ext: ".md" },
  { label: "XLSX", ext: ".xlsx", note: "coming soon" },
  { label: "PPTX", ext: ".pptx", note: "coming soon" },
];

const stats = [
  { label: "Documents processed", value: "10K+" },
  { label: "File formats supported", value: "12+" },
  { label: "Avg. conversion time", value: "< 5s" },
  { label: "Uptime", value: "99.9%" },
];

const faqs = [
  {
    q: "What file formats does EveryDoc support?",
    a: "EveryDoc supports conversion between PDF, DOCX, HTML, and Markdown. Additional formats are planned for future releases.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. EveryDoc offers a free tier to get started with document generation and conversion. Paid plans unlock higher limits and API access.",
  },
  {
    q: "Can I use templates?",
    a: "Absolutely. Choose from ready-made templates for invoices, resumes, contracts, and reports, then customize them with your own content.",
  },
  {
    q: "Do I need an account to convert files?",
    a: "Creating an account lets you save your documents and conversion history. Guest conversion is available for quick, one-off tasks.",
  },
];

export default function Page() {
  const [hoveredFormat, setHoveredFormat] = useState<string | null>(null);

  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative px-4 py-16 sm:py-28 lg:py-40 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] -z-10" />

        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800/30 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wider">
                <Zap size={14} strokeWidth={2} />
                Document productivity platform
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-balance leading-[1.1]">
                Documents made <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">
                  simple.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
                Generate, convert, and manage your documents — all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-8">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-brand-500/30">
                    Get Started Free <ArrowRight size={18} strokeWidth={2} className="ml-2" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Explore Pricing
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <ConversionPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-input bg-secondary/50 dark:bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Everything you need to move from idea to document</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              From first draft to final export, EveryDoc handles the busywork so you can focus on what matters.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className="group relative overflow-hidden hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-300"
                >
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-brand-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/20 dark:to-purple-900/20 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4 border-t">
                    <Link
                      href="/convert"
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      Get started <ArrowRight size={14} strokeWidth={2} />
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28 border-y border-input">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How EveryDoc works</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Turn your ideas into polished documents in three simple steps.
              </p>
            </div>
            <div className="space-y-6">
              {steps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white text-sm font-semibold shrink-0 flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Supported formats */}
      <section className="py-20 sm:py-28 bg-secondary/50 dark:bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Supported file formats</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Convert between the formats you use every day.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {formats.map((f) => {
              const isHovered = hoveredFormat === f.label;
              return (
                <div
                  key={f.label}
                  onMouseEnter={() => setHoveredFormat(f.label)}
                  onMouseLeave={() => setHoveredFormat(null)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
                    isHovered
                      ? "border-brand-600 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-brand-500/10"
                      : "border-input bg-background dark:bg-card hover:border-brand-200 dark:hover:border-brand-800"
                  )}
                >
                  <span className={cn("text-sm font-medium", isHovered ? "text-brand-600 dark:text-brand-400" : "text-slate-600 dark:text-slate-300")}>
                    {f.label}
                  </span>
                  {f.note && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                      {f.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Start free. Upgrade when you need more documents, conversions, and AI credits.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Get started with document generation",
                features: ["5 documents / month", "10 conversions / month", "500 MB storage", "10 AI credits"],
                cta: "Get started free",
                highlight: false,
              },
              {
                name: "Starter",
                price: "$9",
                desc: "For individuals and small projects",
                features: ["50 documents / month", "100 conversions / month", "5 GB storage", "100 AI credits"],
                cta: "Subscribe",
                highlight: false,
              },
              {
                name: "Professional",
                price: "$29",
                desc: "For growing teams and power users",
                features: ["250 documents / month", "500 conversions / month", "20 GB storage", "500 AI credits", "API access", "Batch conversion"],
                cta: "Subscribe",
                highlight: true,
              },
            ].map((tier) => (
              <Card
                key={tier.name}
                className={`flex flex-col relative ${
                  tier.highlight
                    ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20 shadow-xl shadow-brand-500/20 ring-1 ring-brand-600/20"
                    : "border-input hover:border-brand-200 dark:hover:border-brand-800 transition-all"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider">
                      Most popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <h2 className="text-lg font-bold">{tier.name}</h2>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <CardDescription className="mt-2">{tier.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 flex-1">
                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <ShieldCheck size={14} strokeWidth={2} className="text-brand-600 dark:text-brand-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    disabled={!tier.highlight && false}
                  >
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand-600 to-indigo-600 p-8 md:p-12 shadow-2xl shadow-brand-600/25">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-[100px] -z-10" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to simplify your documents?</h2>
            <p className="text-brand-100 mb-8 max-w-lg">
              Join teams generating invoices, resumes, contracts, and reports in seconds — not hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-white text-brand-600 hover:bg-brand-50 shadow-xl">
                  Get Started Free <ArrowRight size={18} strokeWidth={2} className="ml-2" />
                </Button>
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-white underline underline-offset-4 hover:opacity-80">
                Explore Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-input bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-brand-600 dark:text-brand-400">EveryDoc</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/pricing" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Pricing
            </Link>
            <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Features
            </Link>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-500">
            <span>© {new Date().getFullYear()} EveryDoc.</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ConversionPreview() {
  return (
    <div className="relative rounded-3xl border border-input bg-background shadow-2xl p-6 md:p-8 dark:border-slate-700">
      {/* Window controls */}
      <div className="flex items-center gap-2.5 absolute top-4 left-4 z-10">
        {[ "#ff5f56", "#ffbd2e", "#27c93f" ].map((color, i) => (
          <div key={i} className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-6">
            <Upload size={16} strokeWidth={2} className="text-brand-600 dark:text-brand-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-white">Upload document</span>
          </div>
          <div className="border-2 border-dashed border-input rounded-2xl p-8 text-center hover:border-brand-600 dark:hover:border-brand-500 transition-all group cursor-pointer">
            <div className="flex flex-col items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
              <Upload size={32} strokeWidth={2} className="text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Drag &amp; drop your file here</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">PDF · DOCX · HTML · Markdown</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["PDF", "DOCX", "HTML", "MD"].map((f) => (
              <button
                key={f}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-input bg-background hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preview</span>
            <Download size={14} strokeWidth={2} className="text-slate-400" />
          </div>
          <div className="flex-1 rounded-2xl border border-input bg-slate-50 dark:bg-slate-800 p-6 flex flex-col">
            <div className="mb-4 h-1 bg-slate-200 dark:bg-slate-700 rounded w-full" />
            <div className="mb-4 h-1 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-3 border border-brand-100 dark:border-brand-800">
                  <FileText size={24} strokeWidth={2} className="text-brand-400 dark:text-brand-500" />
                </div>
                <p className="text-sm text-slate-400 italic">Your document preview appears here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
