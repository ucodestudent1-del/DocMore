"use client";

import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { useToast } from "../../components/Toast";
import { Skeleton } from "../../components/Skeleton";

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const t = await api("/api/v1/templates");
      setTemplates(t || []);
    } catch (e: any) {
      toast({ title: "Failed to load templates", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api("/api/v1/templates", {
        method: "POST",
        body: JSON.stringify({ name: newName, content: { blocks: [] }, variables: [] }),
      });
      setNewName("");
      load();
      toast({ title: "Template created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await api(`/api/v1/templates/${id}`, { method: "DELETE" });
      load();
      toast({ title: "Template deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Reusable document templates with merge variables
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-3 max-w-md">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Template name"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          onClick={createTemplate}
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? <><Plus size={16} strokeWidth={2} className="mr-2 inline animate-spin" /> Creating...</> : <><Plus size={16} strokeWidth={2} className="mr-2 inline" /> Create</>}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-800 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Variables</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8">
                  <div className="space-y-3">
                    <Skeleton w="lg" h="md" />
                    <Skeleton w="md" h="xs" />
                  </div>
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No templates yet. Create one above.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 dark:text-white">
                    <Link
                      href={`/documents/new?template=${t.id}`}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.variables?.length || 0}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => del(t.id)}
                      className="text-red-500 text-sm hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
