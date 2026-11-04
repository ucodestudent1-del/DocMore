import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { readFile } from "../services/filesystem";
import { getMimeForFormat } from "../services/conversion";
import { PDFDocument } from "pdf-lib";
import { marked } from "marked";
import TurndownService from "turndown";

const router = Router();

router.get("/:docId/:format", requireUser, asyncHandler(async (req: any, res: any) => {
  const { docId, format } = req.params;
  const userId = req.user.id;
  if (!["pdf", "docx", "html", "md"].includes(format)) {
    return res.status(400).json({ error: "Unsupported format", status: 400 });
  }

  const { rows } = await query(
    `SELECT d.id, d.title, d.content
     FROM documents d
     JOIN workspaces w ON w.id = d.workspace_id
     WHERE d.id = $1 AND w.owner_id = $2`,
    [docId, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found", status: 404 });
  const doc = rows[0];
  const content: any = doc.content || {};
  const blocks: Array<{ type: string; text: string }> = content.blocks || [];

  const plainText = blocks.map((b: any) => b.text).filter(Boolean).join("\n");
  const title = doc.title || "Untitled";

  let outBuf: Buffer;
  let mime: string;
  let filename: string;

  switch (format) {
    case "pdf": {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]);
      page.drawText(title, { x: 50, y: 800, size: 18 });
      let y = 760;
      for (const line of plainText.split("\n")) {
        if (y < 50) {
          const p2 = pdfDoc.addPage([595, 842]);
          p2.drawText(line, { x: 50, y: 800, size: 12 });
          y = 760;
        } else {
          page.drawText(line, { x: 50, y, size: 12 });
          y -= 20;
        }
      }
      outBuf = Buffer.from(await pdfDoc.save());
      mime = "application/pdf";
      filename = `${title.replace(/\s+/g, "_")}.pdf`;
      break;
    }
    case "docx": {
      const docxMod: any = await import("docx");
      const { Document, Packer, Paragraph, TextRun } = docxMod;
      const paras = [title, ...plainText.split("\n")].map((t) => new Paragraph({ children: [new TextRun(t)] }));
      const docx = new Document({ sections: [{ children: paras }] });
      const buf = await Packer.toBuffer(docx);
      outBuf = Buffer.from(buf);
      mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      filename = `${title.replace(/\s+/g, "_")}.docx`;
      break;
    }
    case "html": {
      const html = `<html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${plainText.split("\n").map((l) => `<p>${l}</p>`).join("")}</body></html>`;
      outBuf = Buffer.from(html, "utf-8");
      mime = "text/html";
      filename = `${title.replace(/\s+/g, "_")}.html`;
      break;
    }
    case "md": {
      const turndown = new TurndownService();
      const md = `# ${title}\n\n${plainText}`;
      outBuf = Buffer.from(md, "utf-8");
      mime = "text/markdown";
      filename = `${title.replace(/\s+/g, "_")}.md`;
      break;
    }
    default:
      return res.status(400).json({ error: "Unsupported format", status: 400 });
  }

  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.set("Content-Type", mime);
  res.send(outBuf);
}));

export default router;
