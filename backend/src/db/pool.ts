import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  // noop
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
  process.exit(-1);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.NODE_ENV === "development") {
    console.log("Executed query", { text: text.substring(0, 60), duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient() {
  return pool.connect();
}
