"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TemplateBlock } from "@/lib/templates";
import { extractPlaceholders } from "@/lib/templates";

export function TemplateForm({ blocks, onUpdate }: { blocks: TemplateBlock[]; onUpdate: (id: string, patch: any) => void }) {
  const placeholders = extractPlaceholders(blocks);
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const applyValues = () => {
    Object.entries(values).forEach(([key, value]) => {
      blocks.forEach((block) => {
        if (typeof block.data.text === "string") {
          const newText = block.data.text.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value);
          onUpdate(block.id, { text: newText });
        }
        if (Array.isArray(block.data.rows)) {
          const newRows = block.data.rows.map((row: any[]) =>
            row.map((cell: string) => (typeof cell === "string" ? cell.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value) : cell))
          );
          onUpdate(block.id, { rows: newRows });
        }
        if (Array.isArray(block.data.items)) {
          const newItems = block.data.items.map((item: string) =>
            typeof item === "string" ? item.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value) : item
          );
          onUpdate(block.id, { items: newItems });
        }
      });
    });
  };

  if (placeholders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fill in template fields</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {placeholders.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Label className="w-32 text-sm">{key}</Label>
            <Input
              value={values[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`Enter ${key.replace(/_/g, " ")}`}
            />
          </div>
        ))}
      </div>
      <Button
        onClick={applyValues}
        disabled={Object.values(values).every((v) => !v)}
        className="w-full"
      >
        Apply values to document
      </Button>
    </div>
  );
}
