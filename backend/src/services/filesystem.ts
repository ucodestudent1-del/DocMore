import { writeFileSync, readFileSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "/app/storage";

export function ensureStorageDir() {
  if (!existsSync(STORAGE_PATH)) {
    import("fs").then((fs) => fs.mkdirSync(STORAGE_PATH, { recursive: true }));
  }
}

export function storagePath(filename: string): string {
  return join(STORAGE_PATH, filename);
}

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

export { join };
