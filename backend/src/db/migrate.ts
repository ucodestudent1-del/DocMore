import { readFileSync } from "fs";
import { join } from "path";
import { query } from "./pool";

export async function migrate() {
  const schemaPath = join(__dirname, "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");
  await query(sql);
  console.log("Database schema applied successfully.");
}
