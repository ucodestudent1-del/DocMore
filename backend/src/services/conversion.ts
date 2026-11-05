const { PDFDocument } = require("pdf-lib");
const { readFile, saveFile } = require("./filesystem");

const pdfParse: any = require("pdf-parse");
const mammoth: any = require("mammoth");
const marked: any = require("marked");
const TurndownService: any = require("turndown");

export type SourceFormat = "pdf" | "docx" | "html" | "md";
export type TargetFormat = "pdf" | "docx" | "html" | "md";

const SUPPORTED: TargetFormat[] = ["pdf", "docx", "html", "md"];

export function isSupported(fmt: string): fmt is TargetFormat {
  return SUPPORTED.includes(fmt as TargetFormat);
}

function extOf(fmt: TargetFormat): string {
  return { pdf: ".pdf", docx: ".docx", html: ".html", md: ".md" }[fmt];
}

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  const data = await pdfParse(buf);
  return data.text || "";
}

async function docxToHtml(buf: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || "";
}

async function htmlToMd(html: string): Promise<string> {
  const turndown = new TurndownService();
  return turndown.turndown(html);
}

async function mdToHtml(md: string): Promise<string> {
  return marked(md);
}

async function textToPdf(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const lines = text.split("\n");
  let y = 800;
  for (const line of lines) {
    if (y < 50) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(line, { x: 50, y, size: 12 });
    y -= 20;
  }
  const saved = await pdfDoc.save();
  return Buffer.from(saved);
}

async function textToDocx(text: string): Promise<Buffer> {
  const docxMod: any = await import("docx");
  const { Document, Packer, Paragraph, TextRun } = docxMod;
  const lines = text.split("\n").map((l) => new Paragraph({ children: [new TextRun(l)] }));
  const doc = new Document({ sections: [{ children: lines }] });
  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}

export async function convertBuffer(
  sourceBuffer: Buffer,
  sourceFormat: SourceFormat,
  targetFormat: TargetFormat,
): Promise<Buffer> {
  if (!isSupported(targetFormat)) {
    throw new Error(`Unsupported target format: ${targetFormat}`);
  }

  let text = "";

  switch (sourceFormat) {
    case "pdf":
      text = await extractTextFromPdf(sourceBuffer);
      break;
    case "docx":
      text = await docxToHtml(sourceBuffer);
      text = await htmlToMd(text);
      break;
    case "html":
      text = await htmlToMd(sourceBuffer.toString("utf-8"));
      break;
    case "md":
      text = sourceBuffer.toString("utf-8");
      break;
  }

  let outBuf: Buffer;

  switch (targetFormat) {
    case "pdf":
      outBuf = await textToPdf(text);
      break;
    case "docx":
      outBuf = await textToDocx(text);
      break;
    case "html":
      outBuf = Buffer.from(await mdToHtml(text), "utf-8");
      break;
    case "md":
      outBuf = Buffer.from(text, "utf-8");
      break;
    default:
      throw new Error(`Unsupported target format: ${targetFormat}`);
  }

  return outBuf;
}

export function getMimeForFormat(fmt: TargetFormat): string {
  return {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    html: "text/html",
    md: "text/markdown",
  }[fmt];
}
