"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Plus, FileText, LayoutList, Download, Search, Clock, Check, ChevronRight } from "lucide-react";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function Dashboard() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredDocs = docs.filter(
    (d: any) => d.title.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    api("/api/v1/auth/me")
      .catch(() => router.push("/login?next=/dashboard"))
      .finally(() => setCheckedAuth(true));
  }, [router]);

  if (!checkedAuth) return null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [d, t, c, u] = await Promise.all([
        api("/api/v1/documents"),
        api("/api/v1/templates"),
        api("/api/v1/conversions").catch(() => []),
        api("/api/v1/usage").catch(() => null),
      ]);
      setDocs(d || []);
      setTemplates(t || []);
      setConversions(c || []);
      setUsage(u || null);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createDoc() {
    if (!newTitle.trim()) return;
    try {
      const doc = await api("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify({ title: newTitle }),
      });
      setDocs([doc, ...docs]);
      setNewTitle("");
      toast({ title: "Document created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Your documents and templates
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1 dark:text-gray-400">
            Authenticated
          </div>
        </div>
      </div>

      <section className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                Storage usage
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                1.2 GB / 5 GB
              </p>
            </div>
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              24% used
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "24%" }}></div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Documents: {docs.length}</span>
            <span>Templates: {templates.length}</span>
            <span>Recent conversions: {conversions.length}</span>
          </div>
        </div>

        {usage && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Documents this month
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {usage.documents?.used ?? 0}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  /{usage.documents?.limit ?? "∞"}
                </span>
              </div>
              {usage.documents?.exceeded && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Limit reached — upgrade to generate more documents
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Conversions this month
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {usage.conversions?.used ?? 0}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  /{usage.conversions?.limit ?? "∞"}
                </span>
              </div>
              {usage.conversions?.exceeded && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Limit reached — upgrade to convert more files
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
          <Plus size={18} strokeWidth={2} /> New Document
        </h2>
        <div className="flex gap-3 max-w-md">
          <input
            id="new-document-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            aria-label="Document title"
          />
          <button
            onClick={createDoc}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Create
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
            <LayoutList size={18} strokeWidth={2} />
            Documents ({filteredDocs.length})
          </h2>
          <div className="flex items-center gap-2 mb-3">
            <Search size={16} strokeWidth={2} className="text-gray-400" />
            <input
              id="search-documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              aria-label="Search documents"
            />
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Title</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6">
                      <div className="space-y-3">
                        <Skeleton w="lg" h="md" />
                        <Skeleton w="md" h="sm" />
                        <Skeleton w="md" h="sm" />
                      </div>
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 dark:text-white">{d.title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs dark:bg-green-900 dark:text-green-300">
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/documents?id=${d.id}`}
                          className="text-indigo-600 hover:underline text-sm dark:text-indigo-400"
                        >
                          Open
                        </a>
                        {" | "}
                        <button
                          onClick={() => {
                            downloadFile(`/api/v1/export/${d.id}/pdf`, `${d.title.replace(/\s+/g, "_")}.pdf`).catch((e: any) =>
                              toast({ title: "Export failed", description: e.message, variant: "destructive" }),
                            );
                          }}
                          className="text-indigo-600 hover:underline text-sm dark:text-indigo-400"
                        >
                          <Download size={14} strokeWidth={2} className="inline align-[-1px] mr-1" /> PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
            <FileText size={18} strokeWidth={2} /> Templates ({templates.length})
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800 dark:bg-gray-800">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <li className="px-4 py-4">
                  <Skeleton w="lg" h="md" />
                  <Skeleton w="md" h="xs" />
                </li>
              ) : templates.length === 0 ? (
                <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No templates available.
                </li>
              ) : (
                templates.map((t) => (
                  <li key={t.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t.variables?.length || 0} variables
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        api("/api/v1/documents", {
                          method: "POST",
                          body: JSON.stringify({ title: t.name, templateId: t.id }),
                        })
                          .then(() => load())
                          .catch((e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }));
                      }}
                      className="text-indigo-600 text-sm hover:underline dark:text-indigo-400"
                    >
                      Use
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>

      {docs.length === 0 && (
        <section className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
            <Clock size={18} strokeWidth={2} /> Getting started
          </h2>
          <ol className="space-y-3">
            {[
              { label: "Create your first document", href: "#" },
              { label: "Generate from AI or a template", href: "#" },
              { label: "Export to PDF, DOCX, HTML, or Markdown", href: "#" },
            ].map((step, i) => (
              <li key={step.label} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <a
                  href={step.href === "#" ? "/convert" : step.href}
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {step.label}
                </a>
                <ChevronRight size={14} strokeWidth={2} className="text-gray-400 shrink-0" />
              </li>
            ))}
          </ol>
        </section>
      )}

      {conversions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
            <Download size={18} strokeWidth={2} /> Recent conversions
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">File</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Target</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 dark:text-white">{c.sourceFilename || c.fileName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.targetFormat}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs dark:bg-green-900 dark:text-green-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.downloadUrl ? (
                        <button
                          onClick={() => downloadFile(c.downloadUrl, c.outputFilename || "download").catch((e: any) =>
                            toast({ title: "Download failed", description: e.message, variant: "destructive" })
                          )}
                          className="text-indigo-600 hover:underline text-sm dark:text-indigo-400"
                        >
                          Download
                        </button>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
