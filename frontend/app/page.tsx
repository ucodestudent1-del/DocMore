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
  Users,
  Lock,
  Mail,
  Phone,
  Globe,
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

const pricingTiers = [
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
    highlight: true,
  },
  {
    name: "Professional",
    price: "$29",
    desc: "For growing teams and power users",
    features: ["250 documents / month", "500 conversions / month", "20 GB storage", "500 AI credits", "API access", "Batch conversion"],
    cta: "Subscribe",
    highlight: false,
  },
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

const navLinks = [
  { name: "Product", href: "/" },
  { name: "Pricing", href: "/pricing" },
  { name: "Templates", href: "/templates" },
];

export default function Page() {
  return (
    <div className="bg-background text-foreground">
      <Navbar />

      {/* Hero Section */}
      <section className="relative px-6 py-20 sm:py-32 lg:py-40 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#eff6ff 0%,#f1f5f9 100%)] dark:bg-[linear-gradient(135deg,#0f172a 0%,#1e293b 100%)] -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-100/50 rounded-full blur-[120px] -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-purple-100/50 rounded-full blur-[120px] -z-10" />

        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-8">
              <Zap size={14} strokeWidth={2} />
              Document productivity platform
            </div>
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
              Documents made
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-500">
                effortless.
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              Generate, convert, and manage professional documents — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="Button-as-link">
                <Button size="lg" className="w-full sm:w-auto shadow-xl shadow-brand-500/40">
                  Get Started Free <ArrowRight size={18} strokeWidth={2} className="ml-2" />
                </Button>
              </Link>
              <Link href="/pricing" className="Button-as-link">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 relative">
            <ConversionPreview />
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="border-y border-input bg-secondary/50 dark:bg-slate-950/30">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-sm font-medium text-slate-500 dark:text-slate-400">
            {[
              { label: "Documents processed", value: "10K+" },
              { label: "File formats supported", value: "12+" },
              { label: "Avg. conversion time", value: "< 5s" },
              { label: "Uptime", value: "99.9%" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">Everything you need to move from idea to document</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              From first draft to final export, EveryDoc handles the busywork so you can focus on what matters.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className="group relative overflow-hidden hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-300"
                >
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/20 dark:to-purple-900/20 text-brand-600 dark:text-brand-400 group-hover:scale-105 transition-transform duration-300">
                      <Icon size={24} strokeWidth={2} />
                    </div>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-5 border-t">
                    <Link
                      href="/convert"
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-2"
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
      <section className="py-24 sm:py-32 border-y border-input">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How EveryDoc works</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Turn your ideas into polished documents in three simple steps.
              </p>
            </div>
            <div className="space-y-8">
              {steps.map((s) => (
                <div key={s.step} className="flex items-start gap-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white text-lg font-semibold shrink-0 flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{s.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Supported formats */}
      <section className="py-24 sm:py-32 bg-secondary/50 dark:bg-slate-950/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">Supported file formats</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Convert between the formats you use every day.
            </p>
          </div>
          <div className="grid md:grid-cols-6 gap-6">
            {formats.map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-3 rounded-2xl border p-6 transition-all duration-200 hover:border-brand-600 dark:hover:border-brand-500 hover:shadow-md">
                <span className={cn("text-sm font-medium", "text-slate-600 dark:text-slate-300")}>
                  {f.label}
                </span>
                {f.note && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                    {f.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Start free. Upgrade when you need more documents, conversions, and AI credits.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={`flex flex-col relative ${
                  tier.highlight
                    ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20 shadow-2xl shadow-brand-500/25 ring-1 ring-brand-600/20"
                    : "border-input hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-300"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider px-3 py-1.5">
                      Most popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <h2 className="text-lg font-bold">{tier.name}</h2>
                  <div className="flex items-baseline justify-center gap-1 mt-4">
                    <span className="text-5xl font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <CardDescription className="mt-3">{tier.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pb-6 flex-1">
                  <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-3">
                        <ShieldCheck size={16} strokeWidth={2} className="text-brand-600 dark:text-brand-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-6">
                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
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
      <section className="py-28 sm:py-36">
        <div className="max-w-3xl mx-auto px-6">
          <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 p-8 md:p-12 shadow-2xl shadow-brand-600/30">
            <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/20 rounded-full blur-[128px] -z-10" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to simplify your documents?</h2>
            <p className="text-brand-100 mb-10 max-w-lg leading-relaxed">
              Join teams generating invoices, resumes, contracts, and reports in seconds — not hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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

      <Footer />
    </div>
  );
}

function ConversionPreview() {
  return (
    <div className="relative rounded-[2rem] overflow-hidden border border-input bg-background shadow-2xl p-6 md:p-8 dark:border-slate-700">
      <div className="flex items-center gap-2 absolute top-4 left-4 z-10">
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((color, i) => (
          <div key={i} className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-8">
            <Upload size={16} strokeWidth={2} className="text-brand-600 dark:text-brand-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-white">Upload document</span>
          </div>
          <div className="border-2 border-dashed border-input rounded-2xl p-10 text-center hover:border-brand-600 dark:hover:border-brand-500 transition-all group cursor-pointer">
            <div className="flex flex-col items-center gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
              <Upload size={40} strokeWidth={2} className="text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Drag &amp; drop your file here</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">PDF · DOCX · HTML · Markdown</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {["PDF", "DOCX", "HTML", "MD"].map((f) => (
              <button key={f} className="px-4 py-2.5 rounded-xl text-xs font-medium border border-input bg-background hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-all">
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
          <div className="flex-1 rounded-2xl border border-input bg-slate-50 dark:bg-slate-800 p-8 flex flex-col">
            <div className="mb-6 h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
            <div className="mb-6 h-2 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-4 border border-brand-100 dark:border-brand-800">
                  <FileText size={28} strokeWidth={2} className="text-brand-400 dark:text-brand-500" />
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

function Navbar() {
  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-input" aria-label="Main navigation">
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/40">
              <span className="text-xl font-bold tracking-tighter">E</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              EveryDoc
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <a href="/pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register" className="Button-as-link">
              <Button size="sm" className="shadow-md shadow-brand-500/30">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  const footerLinks = [
    { name: "Product", items: ["Dashboard", "Convert", "Templates", "Pricing"] },
    { name: "Resources", items: ["Documentation", "Help Center", "API", "Changelog"] },
    { name: "Company", items: ["About", "Contact", "Privacy", "Terms"] },
  ];

  return (
    <footer className="border-t border-input bg-background py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <span className="text-lg font-bold">E</span>
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">EveryDoc</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs">
              Document productivity platform for generating, converting, and managing documents.
            </p>
          </div>
          {footerLinks.map((group) => (
            <div key={group.name}>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 uppercase tracking-wider">
                {group.name}
              </h4>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item}>
                    <Link
                      href={item.toLowerCase()}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Separator className="my-12" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
            <span>© {new Date().getFullYear()} EveryDoc Inc.</span>
            <span className="hidden md:block">·</span>
            <span>All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-500">
            <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              Features
            </Link>
            <span className="text-slate-400">·</span>
            <Link href="/pricing" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
