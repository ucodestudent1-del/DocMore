"use client";

import { TemplateBlock } from "@/lib/templates";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function TemplatePreview({ blocks }: { blocks: TemplateBlock[] }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-background min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live preview</h3>
      </div>
      <div className="flex-1 p-4 border border-border/50 rounded bg-white/50 overflow-y-auto">
        {blocks.map((block) => (
          <div key={block.id} className="mb-4 last:mb-0">
            {block.type === "heading" && (
              <div
                className={[
                  "mb-2 font-medium tracking-tight uppercase",
                  block.data.level === 1 ? "text-2xl" : block.data.level === 2 ? "text-xl" : "text-lg",
                ].join(" ")}
              >
                {escapeHtml(block.data.text || "")}
              </div>
            )}
            {block.type === "paragraph" && (
              <p className="mb-2 leading-relaxed whitespace-pre-wrap text-sm">{escapeHtml(block.data.text || "")}</p>
            )}
            {block.type === "list" && (
              <ul className="mb-2 list-disc pl-6 text-sm space-y-1 leading-relaxed">
                {Array.isArray(block.data.items) &&
                  block.data.items.map((item: string, idx: number) => (
                    <li key={idx}>{escapeHtml(item)}</li>
                  ))}
              </ul>
            )}
            {block.type === "table" && (
              <div className="overflow-x-auto mb-2">
                <table className="min-w-full border-collapse border border-border/30 text-sm">
                  <thead>
                    {Array.isArray(block.data.rows) && block.data.rows.length > 0 && (
                      <tr>
                        {block.data.rows[0].map((cell: string, idx: number) => (
                          <th key={idx} className="border border-border/30 bg-gray-50/50 px-2 py-1 text-left font-medium text-xs uppercase tracking-wider">
                            {escapeHtml(cell)}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {Array.isArray(block.data.rows) &&
                      block.data.rows.slice(1).map((row: string[], rowIdx: number) => (
                        <tr key={rowIdx}>
                          {row.map((cell: string, cellIdx: number) => (
                            <td key={cellIdx} className="border border-border/30 px-2 py-1 text-sm">
                              {escapeHtml(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {block.type === "pagebreak" && (
              <div className="my-4 border-t border-dashed border-border/30" />
            )}
            {block.type === "image" && (
              <div className="mb-2 flex items-center justify-center text-muted-foreground text-xs">
                [Image: {block.data.path || "image"}]
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
