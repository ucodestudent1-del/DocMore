"use client";

import { useState, useEffect } from "react";
import { api, getUserId } from "@/lib/api";
import { Plus, FileText, LayoutList, Download } from "lucide-react";

export default function Dashboard() {
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [d, t] = await Promise.all([api("/api/v1/documents"), api("/api/v1/templates")]);
      setDocs(d || []);
      setTemplates(t || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createDoc() {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const doc = await api("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify({ title: newTitle }),
      });
      setDocs([doc, ...docs]);
      setNewTitle("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Your documents and templates</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1">User: {getUserId() || "not set"}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} strokeWidth={2} /> New Document
        </h2>
        <div className="flex gap-3 max-w-md">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <button
            onClick={createDoc}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <LayoutList size={18} strokeWidth={2} /> Documents ({docs.length})
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{d.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/documents/${d.id}`}
                        className="text-indigo-600 hover:underline text-sm"
                      >
                        Open
                      </a>
                      {" | "}
                      <a
                        href={`/documents/${d.id}/export/pdf`}
                        className="text-indigo-600 hover:underline text-sm"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download size={14} strokeWidth={2} className="inline align-[-1px] mr-1" /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      No documents yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText size={18} strokeWidth={2} /> Templates ({templates.length})
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y border-gray-200">
              {templates.map((t) => (
                <li key={t.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.variables?.length || 0} variables</div>
                  </div>
                  <button
                    onClick={() => {
                      // create doc from template
                      api("/api/v1/documents", {
                        method: "POST",
                        body: JSON.stringify({ title: t.name, templateId: t.id }),
                      }).then(() => load());
                    }}
                    className="text-indigo-600 text-sm hover:underline"
                  >
                    Use
                  </button>
                </li>
              ))}
              {templates.length === 0 && (
                <li className="px-4 py-8 text-center text-gray-500">
                  No templates available.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
