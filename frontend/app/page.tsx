import Link from "next/link";
import { Zap, FileText, Layers, Edit } from "lucide-react";

export default function Page() {
  const features = [
    {
      name: "AI text-to-document",
      description: "Turn a natural-language prompt into a full document with merge variables.",
      Icon: Zap,
    },
    {
      name: "Multi-format conversion",
      description: "Convert between PDF, DOCX, HTML, and Markdown — one file or batch.",
      Icon: FileText,
    },
    {
      name: "Template gallery",
      description: "Reusable invoice, resume, contract, and report templates you can edit.",
      Icon: Layers,
    },
    {
      name: "WYSIWYG editor",
      description: "Edit generated documents live with real-time preview and auto-save.",
      Icon: Edit,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">
                EveryDoc
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="/pricing" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                Pricing
              </a>
              <a href="/features" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                Features
              </a>
              <a href="/login" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium">
                Sign in
              </a>
              <a
                href="/register"
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition"
              >
                Create account
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content">
        <section className="relative px-4 py-16 sm:py-24 lg:py-32 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <span className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-900/30">
              Automated document generation
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Generate and convert documents in seconds
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              EveryDoc is an all-in-one platform for AI-powered document generation and multi-format file
              conversion. Create invoices, resumes, contracts, and reports from templates or prompts — then export
              to PDF, DOCX, HTML, or Markdown.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/register"
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition shadow-lg"
              >
                Create free account
              </a>
              <a
                href="/convert"
                className="px-8 py-4 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition"
              >
                Convert a file &rarr;
              </a>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Everything you need to move from idea to document</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                From first draft to final export, EveryDoc handles the busywork so you can focus on content.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => {
                const Icon = f.Icon;
                return (
                  <div key={f.name} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Start free. Upgrade when you need more documents, conversions, and AI credits.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  name: "Free",
                  price: "$0",
                  desc: "Get started with automated document generation",
                  features: ["5 documents / month", "10 conversions / month", "500 MB storage", "10 AI credits", "Public templates"],
                  cta: "Get started free",
                  highlight: false,
                },
                {
                  name: "Starter",
                  price: "$9",
                  desc: "For individuals and small projects",
                  features: ["50 documents / month", "100 conversions / month", "5 GB storage", "100 AI credits", "No watermark"],
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
                <div
                  key={tier.name}
                  className={`rounded-xl p-6 border transition ${tier.highlight ? "border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800"}`}
                >
                  <div className="mb-6">
                    {tier.highlight && (
                      <span className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{tier.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">{tier.price}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{tier.desc}</p>
                  </div>
                  <ul className="space-y-3 mb-6 text-sm text-gray-600 dark:text-gray-300">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-indigo-600 dark:text-indigo-400">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-3 rounded-xl font-medium transition ${tier.highlight ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  >
                    {tier.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-900/30">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Ready to stop wrestling with documents?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Join teams generating invoices, resumes, contracts, and reports in seconds — not hours.
            </p>
            <a
              href="/register"
              className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition inline-block"
            >
              Create your free account
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
