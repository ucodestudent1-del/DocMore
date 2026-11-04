import { writeFileSync, readFileSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { storagePath } from "../services/storage";

export function saveFile(filename: string, data: Buffer): string {
  const p = storagePath(filename);
  writeFileSync(p, data);
  return p;
}

export function readFile(filename: string): Buffer {
  const p = storagePath(filename);
  if (!existsSync(p)) {
    throw new Error(`File not found: ${filename}`);
  }
  return readFileSync(p);
}

export function deleteFile(filename: string): void {
  const p = storagePath(filename);
  if (existsSync(p)) {
    unlinkSync(p);
  }
}

export function listFiles(dir: string = ""): string[] {
  const p = dir ? storagePath(dir) : storagePath(".");
  if (!existsSync(p)) return [];
  return readdirSync(p);
}

export { join, storagePath };
