import { type ClassValue, clsx as clsxFn } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsxFn(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function iconForExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "pdf") return "FileText";
  if (e === "docx" || e === "doc") return "File";
  if (e === "xlsx" || e === "xls" || e === "csv") return "FileSpreadsheet";
  if (e === "pptx" || e === "ppt") return "FilePresentation";
  if (e === "jpg" || e === "jpeg" || e === "png" || e === "webp" || e === "gif") return "Image";
  if (e === "md") return "File";
  if (e === "html" || e === "htm") return "Code";
  if (e === "txt") return "FileText";
  return "File";
}
