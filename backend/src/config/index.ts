import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().transform((v) => parseInt(v, 10)).default("3001"),
  API_BASE_URL: z.string().default("http://localhost:3001"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres URL"),
  STORAGE_PATH: z.string().default("/app/storage"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().default("dev-secret-change-me"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;
