import Link from "next/link";
import {
  FileText,
  RefreshCw,
  Layers,
  ShieldCheck,
  Download,
  Upload,
  ArrowRight,
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
  },
  {
    title: "File Conversion",
    description: "Convert documents between supported file formats with ease.",
    icon: RefreshCw,
  },
  {
    title: "Document Templates",
    description: "Save time with ready-made templates for your documents.",
    icon: Layers,
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
  return (
    <div className="bg-background text-foreground">
      <section className="relative px-4 py-16 sm:py-24 lg:py-32 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wider">
                Document productivity platform
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-balance leading-tight">
                Documents made simple.
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                Generate, convert, and manage your documents — all in one place.
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                Create professional documents and convert files between formats without the hassle.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
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

      <section className="border-y border-input bg-slate-50 dark:bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to move from idea to document</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              From first draft to final export, EveryDoc handles the busywork so you can focus on what matters.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title}>
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <CardTitle>{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">How EveryDoc works</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Turn your ideas into polished documents in three simple steps.
              </p>
            </div>
            <div className="space-y-6">
              {steps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white text-sm font-semibold shrink-0">
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

      <section className="border-y border-input">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Supported file formats</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Convert between the formats you use every day.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {formats.map((f) => (
              <div
                key={f.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-input bg-background p-4 hover:border-brand-600 dark:hover:border-brand-500 transition"
              >
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  {f.label}
                </span>
                {f.note && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {f.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-6">Simple, transparent pricing</h2>
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
              <Card key={tier.name} className={`flex flex-col ${tier.highlight ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20" : ""}`}>
                <CardHeader>
                  {tier.highlight && <Badge variant="outline" className="text-xs">Most popular</Badge>}
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <CardDescription>{tier.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
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
                  <Button className="w-full" variant={tier.highlight ? "default" : "outline"}>
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{faq.q}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-input bg-background py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-brand-600 dark:text-brand-400">EveryDoc</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/pricing" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Pricing
            </Link>
            <span className="text-slate-400">·</span>
            <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Features
            </Link>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            © {new Date().getFullYear()} EveryDoc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function ConversionPreview() {
  return (
    <div className="rounded-2xl border border-input bg-background shadow-lg p-6 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-3 w-3 rounded-full bg-red-500"></div>
        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
        <div className="h-3 w-3 rounded-full bg-green-500"></div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={16} strokeWidth={2} className="text-brand-600 dark:text-brand-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-white">Upload document</span>
          </div>
          <div className="border-2 border-dashed border-input rounded-xl p-6 text-center hover:border-brand-600 transition">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Drag &amp; drop your file here</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">PDF · DOCX · HTML · Markdown</p>
          </div>
          <div className="mt-4 flex gap-2">
            {["PDF", "DOCX", "HTML", "MD"].map((f) => (
              <button
                key={f}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-input bg-background hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/2">
          <div className="rounded-xl border border-input bg-slate-50 dark:bg-slate-800 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preview</span>
              <Download size={14} strokeWidth={2} className="text-slate-400" />
            </div>
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-slate-400 italic">Your document preview appears here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
