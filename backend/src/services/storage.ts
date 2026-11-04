import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { config } from "../config";

export function ensureStorageDir() {
  if (!existsSync(config.STORAGE_PATH)) {
    mkdirSync(config.STORAGE_PATH, { recursive: true });
  }
}

export function storagePath(filename: string): string {
  return join(config.STORAGE_PATH, filename);
}
