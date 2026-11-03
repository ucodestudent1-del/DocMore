"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Check,
  Clock,
  Download,
  FileText,
  Globe,
  LayoutGrid,
  Lock,
  Play,
  Rocket,
  Shield,
  Sparkles,
  Upload,
  Users,
  Watch,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">DocStudio</span>
          </div>
          <div className="flex items-center gap-4 hidden sm:flex">
            <Link href="/convert" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Convert
            </Link>
            <Link href="/generate" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Generate
            </Link>
            <Link href="/pdf-tools" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              PDF Tools
            </Link>
            <Link href="/templates" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Templates
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Sign in
            </Link>
            <Button className="ml-4">Get started — it's free</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Launching soon — free tier available
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
            Convert, generate &amp; automate<span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"> all your documents</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            The universal document platform. Convert between 30+ formats, generate professional documents from templates,
            and power your document workflows — no installation required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="px-8 py-3 flex items-center gap-2" onClick={() => window.location.href = "/register"}>
              <Rocket className="h-5 w-5" />
              Get started — free
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-3" asChild>
              <Link href="/convert">Try the converter</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust / Stats Bar */}
      <section className="border-y border-border/50 bg-muted/50 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground">30+</div>
              <div className="text-sm text-muted-foreground">File formats supported</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">2s</div>
              <div className="text-sm text-muted-foreground">Avg. conversion time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">100%</div>
              <div className="text-sm text-muted-foreground">Private &amp; secure</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">24/7</div>
              <div className="text-sm text-muted-foreground">Background processing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Everything you need, in one place</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From simple conversions to complex document generation, DocStudio handles it all.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Upload className="h-6 w-6" />}
              title="Universal Converter"
              description="Convert between PDF, Word, Excel, PowerPoint, images, HTML, Markdown, and 30+ more formats with high fidelity."
              href="/convert"
            />
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Document Generator"
              description="Create invoices, receipts, contracts, resumes, reports, and certificates from templates or from scratch."
              href="/generate"
            />
            <FeatureCard
              icon={<Play className="h-6 w-6" />}
              title="PDF Toolkit"
              description="Merge, split, compress, watermark, rotate, rearrange, OCR, protect, and unlock PDFs."
              href="/pdf-tools"
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Web-First"
              description="No software to install. Works in any browser on desktop, tablet, and mobile."
              href="/convert"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Secure &amp; Private"
              description="Your files are processed securely with enterprise-grade encryption. Never shared, never sold."
              href="/convert"
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title="Background Jobs"
              description="Large files are processed asynchronously with job tracking and notifications."
              href="/convert"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Three steps to done</h2>
            <p className="text-lg text-muted-foreground">Upload, convert, download — that's it.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepStep number="1" title="Upload" description="Drag and drop your file or paste content. Supports all major document types." icon={<Upload className="h-5 w-5" />} />
            <StepStep number="2" title="Process" description="Choose your target format or template. We handle the conversion in the background." icon={<Sparkles className="h-5 w-5" />} />
            <StepStep number="3" title="Download" description="Get your result instantly. All files are ready to use and share." icon={<Download className="h-5 w-5" />} />
          </div>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Convert between anything</h2>
            <p className="text-lg text-muted-foreground">30+ formats, all directions supported.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
            <FormatBadge>PDF → DOCX</FormatBadge>
            <FormatBadge>DOCX → PDF</FormatBadge>
            <FormatBadge>XLSX → CSV</FormatBadge>
            <FormatBadge>PPTX → PDF</FormatBadge>
            <FormatBadge>JPG → PDF</FormatBadge>
            <FormatBadge>HTML → PDF</FormatBadge>
            <FormatBadge>MD → HTML</FormatBadge>
            <FormatBadge>TXT → PDF</FormatBadge>
            <FormatBadge>CSV → XLSX</FormatBadge>
            <FormatBadge>PDF → JPG</FormatBadge>
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/formats" className="text-sm font-medium text-primary hover:underline">
              View all supported formats →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard
              name="Free"
              price="$0"
              period="/mo"
              description="For individuals getting started"
              features={[
                "Up to 10 conversions per month",
                "All major formats supported",
                "Standard processing speed",
                "Community support",
              ]}
              isPopular={false}
              buttonText="Get started"
              href="/register"
            />
            <PricingCard
              name="Pro"
              price="$12"
              period="/mo"
              description="For professionals and small teams"
              features={[
                "Up to 500 conversions per month",
                "All formats + priority queue",
                "Background job processing",
                "Email support",
                "File history &amp; re-downloads",
              ]}
              isPopular={true}
              buttonText="Upgrade to Pro"
              href="/pricing"
            />
            <PricingCard
              name="Enterprise"
              price="Contact"
              period="us"
              description="For large organizations"
              features={[
                "Unlimited conversions",
                "Custom integrations &amp; API access",
                "Dedicated support &amp; SLA",
                "On-premise deployment",
                "Advanced security &amp; compliance",
              ]}
              isPopular={false}
              buttonText="Contact sales"
              href="/contact"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl bg-primary p-8 md:p-12 text-primary-foreground overflow-hidden">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 opacity-10">
              <Watch className="h-32 w-32" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to streamline your documents?</h2>
            <p className="text-lg mb-8 opacity-90 max-w-lg">
              Join thousands of users converting and generating documents every day. No credit card required to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-primary-foreground text-primary px-8 py-3" asChild>
                <Link href="/register">Create free account</Link>
              </Button>
              <Button variant="outline" size="lg" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-3" asChild>
                <Link href="/convert">Try without signing up</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/50 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">DocStudio</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/convert" className="hover:text-primary transition-colors">Convert</Link>
              <Link href="/generate" className="hover:text-primary transition-colors">Generate</Link>
              <Link href="/pdf-tools" className="hover:text-primary transition-colors">PDF Tools</Link>
              <Link href="/templates" className="hover:text-primary transition-colors">Templates</Link>
              <Link href="/login" className="hover:text-primary transition-colors">Sign in</Link>
            </div>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub">
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032 1.129 1.537 1.912 2.317 2.644 1.773.077-.548.291-1.11.576-1.366-2.233-.253-4.55-1.118-4.55-4.986 0-1.101.392-1.992 1.037-2.693-.103-.253-.456-1.272.096-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85 0 1.705.112 2.521.332 1.907-1.296 2.747-1.027 2.747-1.027.551 1.379.2 2.398.096 2.65.645.701 1.037 1.592 1.037 2.693 0 3.872-2.324 4.729-4.565 4.986.362.316.778.934.778 1.935 0 1.388-.012 2.514-.012 2.854 0 .268.18.579.686.482A10.017 10.017 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" /></svg>
              </a>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} DocStudio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, href }: { icon: React.ReactNode; title: string; description: string; href: string }) {
  return (
    <Card className="hover:border-primary/50 transition-colors group">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <div className="p-6 pt-0 border-t-0">
        <Link href={href} className="text-xs font-medium text-primary flex items-center gap-1 hover:text-primary/90 transition-colors">
          Learn more <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

function StepStep({ number, title, description, icon }: { number: string | number; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground z-10 flex-shrink-0">
        {icon}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20"></span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

function FormatBadge({ children }: { children: string }) {
  return (
    <span className="px-4 py-2 rounded-lg border border-border/50 bg-background text-sm text-muted-foreground">
      {children}
    </span>
  );
}

function PricingCard({ name, price, period, description, features, isPopular, buttonText, href }: { name: string; price: string; period: string; description: string; features: string[]; isPopular: boolean; buttonText: string; href: string }) {
  return (
    <Card className={`relative ${isPopular ? "border-primary" : ""}`}>
      {isPopular && (
        <div className="absolute -top-3 left-0 right-0 flex justify-center">
          <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">Most popular</span>
        </div>
      )}
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{price}</span>
          <span className="text-muted-foreground">{period}</span>
        </div>
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span className="text-sm">{f}</span>
          </div>
        ))}
      </CardContent>
      <div className="p-6 border-t-0">
        <Button asChild className="w-full" variant={isPopular ? "default" : "outline"}>
          <Link href={href}>{buttonText}</Link>
        </Button>
      </div>
    </Card>
  );
}
