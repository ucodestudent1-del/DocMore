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
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Object storage (AWS S3 or Cloudflare R2)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional().default("false"),
  // Redis (for BullMQ job queue)
  REDIS_URL: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;
