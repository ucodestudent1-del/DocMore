import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from "docx";

export type OutputFormat = "pdf" | "docx" | "html" | "md";

interface RenderContext {
  [key: string]: any;
  this?: any;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getValue(ctx: any, path: string): any {
  let cur: any = ctx;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function render(template: string, ctx: RenderContext): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);

    let close = template.indexOf("}}", open + 2);
    if (close === -1) {
      out += template.slice(open);
      break;
    }

    let content = template.slice(open + 2, close);
    let raw = false;
    let tagEnd = close + 2;

    if (template[open + 2] === "{") {
      const te = template.indexOf("}}}", open + 3);
      if (te !== -1) {
        content = template.slice(open + 3, te);
        raw = true;
        tagEnd = te + 3;
      }
    }

    content = content.trim();
    const section = content.match(/^([#\/])(\w+)(?:\s+(.*))?$/);

    if (section && section[1] === "#") {
      const closeTag = `{{/${section[2]}}}`;
      const closeIdx = template.indexOf(closeTag, tagEnd);
      if (closeIdx === -1) {
        out += template.slice(open, tagEnd);
        i = tagEnd;
        continue;
      }
      const inner = template.slice(tagEnd, closeIdx);
      if (section[2] === "each") {
        const arr = getValue(ctx, section[3] || ".");
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const itemCtx: RenderContext = { ...ctx, this: item };
            if (item && typeof item === "object") {
              for (const k of Object.keys(item)) itemCtx[k] = item[k];
            }
            out += render(inner, itemCtx);
          }
        }
      } else if (section[2] === "if") {
        const val = getValue(ctx, section[3] || ".");
        if (val) out += render(inner, ctx);
      }
      i = closeIdx + closeTag.length;
    } else if (section && section[1] === "/") {
      i = tagEnd;
    } else {
      const val = content === "this" ? ctx : getValue(ctx, content);
      out += raw ? (val == null ? "" : String(val)) : val == null ? "" : escapeHtml(String(val));
      i = tagEnd;
    }
  }
  return out;
}

export function renderHtml(template: string, data: any): string {
  return render(template, { ...(data || {}), this: data });
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  // Best-effort text-based PDF. Production fidelity requires Puppeteer/headless Chromium
  // (see blueprint Section 2.3). This path keeps the engine dependency-free and runnable.
  const { PDFDocument } = require("pdf-lib");
  const text = htmlToText(html);
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const fontSize = 11;
  let y = 800;
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    const words = para.split(" ");
    let cur = "";
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (trial.length > 95) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);
    lines.push("");
  }
  for (const line of lines) {
    if (y < 50) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(line, { x: 50, y, size: fontSize });
    y -= 18;
  }
  return Buffer.from(await pdfDoc.save());
}

export async function jsonToDocx(data: any, opts: { title?: string } = {}): Promise<Buffer> {
  const children: any[] = [];
  const title = opts.title || "Document";
  children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));

  function addValue(key: string, val: any) {
    if (val === null || val === undefined) {
      children.push(new Paragraph({ text: `${key}:` }));
      return;
    }
    if (Array.isArray(val)) {
      children.push(new Paragraph({ text: key, heading: HeadingLevel.HEADING_1 }));
      if (val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
        const keys = Object.keys(val[0]);
        const rows = [
          new TableRow({
            children: keys.map((k) => new TableCell({ children: [new Paragraph(k)] })),
          }),
        ];
        for (const row of val) {
          rows.push(
            new TableRow({
              children: keys.map((k) => new TableCell({ children: [new Paragraph(String(row[k] ?? ""))] })),
            }),
          );
        }
        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
      } else {
        for (const item of val) {
          children.push(new Paragraph({ text: `- ${String(item)}` }));
        }
      }
    } else if (typeof val === "object") {
      children.push(new Paragraph({ text: key, heading: HeadingLevel.HEADING_1 }));
      for (const [k, v] of Object.entries(val)) {
        children.push(new Paragraph({ text: `${k}: ${String(v)}` }));
      }
    } else {
      children.push(new Paragraph({ text: `${key}: ${String(val)}` }));
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) addValue(k, v);
  } else {
    addValue("content", data);
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function generateDocument(
  templateContent: string | undefined,
  data: any,
  outputFormat: OutputFormat,
): Promise<Buffer> {
  switch (outputFormat) {
    case "html":
      return Buffer.from(renderHtml(templateContent || "", data || {}), "utf-8");
    case "md": {
      const html = renderHtml(templateContent || "", data || {});
      return Buffer.from(htmlToText(html), "utf-8");
    }
    case "pdf": {
      const html = renderHtml(templateContent || "", data || {});
      return htmlToPdf(html);
    }
    case "docx":
      return jsonToDocx(data || {});
    default:
      throw new Error(`Unsupported output format: ${outputFormat}`);
  }
}
