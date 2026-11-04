"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Calculator, DollarSign, TrendingUp, Shield, RefreshCw } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Rental Analyzer</span>
          </div>
          <div className="flex items-center gap-4 hidden sm:flex">
            <Link href="/analyzer" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Analyzer
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Sign in
            </Link>
            <Button className="ml-4">Get started — free</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-24 lg:pt-32 lg:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Real estate investor grade
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
            Analyze rental property deals<span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"> in seconds</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Input purchase price, rent, financing, taxes, insurance, and operating expenses. Get instant cash flow,
            cap rate, cash-on-cash return, and total ROI — built for real estate investors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="px-8 py-3 flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 transition-all" onClick={() => window.location.href = "/register"}>
              <Calculator className="h-5 w-5" />
              Get started — free
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-3" asChild>
              <Link href="/analyzer">Try the analyzer</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust / Stats Bar */}
      <section className="border-y border-border/50 bg-muted/50 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground">4</div>
              <div className="text-sm text-muted-foreground">Core investment KPIs</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">Instant</div>
              <div className="text-sm text-muted-foreground">Calculation engine</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">100%</div>
              <div className="text-sm text-muted-foreground">Private &amp; secure</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">Saved</div>
              <div className="text-sm text-muted-foreground">Per-user deal history</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Everything you need to evaluate a deal</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Run the numbers before you buy. Know your cash flow, cap rate, and cash-on-cash return up front.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<DollarSign className="h-6 w-6" />}
              title="Monthly &amp; Annual Cash Flow"
              description="Rent minus mortgage, taxes, insurance, and operating expenses — see exactly what a property puts in your pocket."
            />
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Cap Rate &amp; Cash-on-Cash Return"
              description="Compare deals objectively with unlevered cap rate and leveraged cash-on-cash return on your actual down payment."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Save &amp; Track Deals"
              description="Every analysis is saved to your account. Review past deals and track your pipeline in one place."
            />
            <FeatureCard
              icon={<Home className="h-6 w-6" />}
              title="Built for Investors"
              description="Clean, fintech-grade interface optimized for desktop and mobile. No clutter, just the numbers that matter."
            />
            <FeatureCard
              icon={<RefreshCw className="h-6 w-6" />}
              title="Instant Recalculation"
              description="Tweak any input and watch every metric update immediately. Scenario-test deals in seconds."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl bg-primary p-8 md:p-12 text-primary-foreground overflow-hidden">
            <h2 className="text-3xl font-bold mb-4">Stop guessing on deals</h2>
            <p className="text-lg mb-8 opacity-90 max-w-lg">
              Run accurate rental property analysis before you make an offer. No credit card required to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-primary-foreground text-primary px-8 py-3" asChild>
                <Link href="/register">Create free account</Link>
              </Button>
              <Button variant="outline" size="lg" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-3" asChild>
                <Link href="/analyzer">Try the analyzer</Link>
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
                <Home className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">Rental Analyzer</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/analyzer" className="hover:text-primary transition-colors">Analyzer</Link>
              <Link href="/login" className="hover:text-primary transition-colors">Sign in</Link>
            </div>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub">
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032 1.129 1.537 1.912 2.317 2.644 1.773.077-.548.291-1.11.576-1.366-2.233-.253-4.55-1.118-4.55-4.986 0-1.101.392-1.992 1.037-2.693-.103-.253-.456-1.272.096-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85 0 1.705.112 2.521.332 1.907-1.296 2.747-1.027 2.747-1.027.551 1.379.2 2.398.096 2.65.645.701 1.037 1.592 1.037 2.693 0 3.872-2.324 4.729-4.565 4.986.362.316.778.934.778 1.935 0 1.388-.012 2.514-.012 2.854 0 .268.18.579.686.482A10.017 10.017 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" /></svg>
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-8">
            © {new Date().getFullYear()} Rental Analyzer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="hover:border-primary/50 transition-colors group">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
    </Card>
  );
}
