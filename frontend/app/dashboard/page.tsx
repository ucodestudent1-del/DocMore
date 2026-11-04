"use client";

import { useState, useEffect, useCallback } from "react";
import { api, downloadFile, getUserId, setUserId } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Plus, FileText, LayoutList, Download, Search } from "lucide-react";
import { Skeleton, SkeletonText } from "@/components/Skeleton";
export default function Dashboard() {
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredDocs = docs.filter(
    (d) => d.title.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        (document.querySelector('input[placeholder="Document title"]') as HTMLElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [d, t] = await Promise.all([api("/api/v1/documents"), api("/api/v1/templates")]);
      setDocs(d || []);
      setTemplates(t || []);
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
            User: {getUserId() || "not set"}
          </div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white">
          <Plus size={18} strokeWidth={2} /> New Document
        </h2>
        <div className="flex gap-3 max-w-md">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
    </div>
  );
}
