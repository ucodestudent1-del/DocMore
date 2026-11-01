export type TemplateBlock = {
  id: string;
  type: "heading" | "paragraph" | "list" | "table" | "image" | "pagebreak";
  data: any;
};

export type Template = {
  name: string;
  desc: string;
  blocks: TemplateBlock[];
};

export const TEMPLATES: Template[] = [
  {
    name: "invoice",
    desc: "Professional invoice with line items and totals",
    blocks: [
      { id: "b1", type: "heading", data: { text: "INVOICE", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "INV-{{invoice_number}}", align: "right" } },
      { id: "b3", type: "paragraph", data: { text: "Bill To: {{customer}}" } },
      { id: "b4", type: "table", data: { rows: [["Item", "Qty", "Price", "Total"], ["{{item}}", "{{qty}}", "{{price}}", "{{total}}"]] } },
      { id: "b5", type: "paragraph", data: { text: "Total Due: {{total_due}}", align: "right" } },
    ],
  },
  {
    name: "business-letter",
    desc: "Formal business correspondence",
    blocks: [
      { id: "b1", type: "heading", data: { text: "Business Letter", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "Dear {{recipient}}," } },
      { id: "b3", type: "paragraph", data: { text: "{{body}}" } },
      { id: "b4", type: "paragraph", data: { text: "Sincerely,\n{{sender}}" } },
    ],
  },
  {
    name: "resume",
    desc: "Clean resume/CV layout",
    blocks: [
      { id: "b1", type: "heading", data: { text: "{{name}}", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "{{email}} | {{phone}} | {{location}}" } },
      { id: "b3", type: "heading", data: { text: "Experience", level: 2 } },
      { id: "b4", type: "list", data: { items: ["{{exp1}}", "{{exp2}}"], ordered: false } },
    ],
  },
  {
    name: "report",
    desc: "Structured report with findings",
    blocks: [
      { id: "b1", type: "heading", data: { text: "{{title}}", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "{{summary}}" } },
      { id: "b3", type: "heading", data: { text: "Findings", level: 2 } },
      { id: "b4", type: "list", data: { items: ["{{finding1}}", "{{finding2}}"] } },
    ],
  },
  {
    name: "certificate",
    desc: "Certificate of completion",
    blocks: [
      { id: "b1", type: "heading", data: { text: "Certificate of Completion", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "This is awarded to {{recipient}}" } },
      { id: "b3", type: "paragraph", data: { text: "for {{achievement}}" } },
      { id: "b4", type: "paragraph", data: { text: "Date: {{date}}" } },
    ],
  },
  {
    name: "cover-letter",
    desc: "Job application cover letter",
    blocks: [
      { id: "b1", type: "heading", data: { text: "Cover Letter", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "Dear {{hiring_manager}}," } },
      { id: "b3", type: "paragraph", data: { text: "{{body}}" } },
      { id: "b4", type: "paragraph", data: { text: "Best regards,\n{{sender}}" } },
    ],
  },
  {
    name: "meeting-minutes",
    desc: "Meeting agenda and notes",
    blocks: [
      { id: "b1", type: "heading", data: { text: "Meeting Minutes", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "Meeting: {{meeting}} | Date: {{date}}" } },
      { id: "b3", type: "paragraph", data: { text: "Attendees: {{attendees}}" } },
      { id: "b4", type: "heading", data: { text: "Agenda", level: 2 } },
      { id: "b5", type: "list", data: { items: ["{{agenda1}}", "{{agenda2}}"] } },
    ],
  },
];

export function getTemplateByName(name: string): Template | undefined {
  return TEMPLATES.find((t) => t.name === name);
}

export function extractPlaceholders(blocks: TemplateBlock[]): string[] {
  const pattern = /{{\s*([\w.]+)\s*}}/g;
  const seen = new Set<string>();
  for (const block of blocks) {
    const text = typeof block.data.text === "string" ? block.data.text : "";
    for (const match of text.matchAll(pattern)) {
      seen.add(match[1]);
    }
    if (Array.isArray(block.data.rows)) {
      for (const row of block.data.rows) {
        for (const cell of row) {
          if (typeof cell === "string") {
            for (const match of cell.matchAll(pattern)) {
              seen.add(match[1]);
            }
          }
        }
      }
    }
    if (Array.isArray(block.data.items)) {
      for (const item of block.data.items) {
        if (typeof item === "string") {
          for (const match of item.matchAll(pattern)) {
            seen.add(match[1]);
          }
        }
      }
    }
  }
  return Array.from(seen);
}
