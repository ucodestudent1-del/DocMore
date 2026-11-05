import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import cookieSession from "cookie-session";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import healthRouter from "./routes/health";
import documentsRouter from "./routes/documents";
import templatesRouter from "./routes/templates";
import convertRouter from "./routes/convert";
import exportRouter from "./routes/export";
import authRouter from "./routes/auth";
import billingRouter from "./routes/billing";
import usageRouter from "./routes/usage";
import { requireUser } from "./middleware/auth";
import { requireTier } from "./middleware/billing";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.use(cookieSession({
    name: "session",
    keys: [config.SESSION_SECRET || "dev-secret-change-me"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: config.NODE_ENV === "production",
    httpOnly: true,
    sameSite: config.NODE_ENV === "production" ? "lax" : "lax",
  }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "everydoc-backend" });
  });
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/billing", billingRouter);
  app.use("/api/v1/usage", usageRouter);
  app.use("/api/v1/documents", requireUser, documentsRouter);
  app.use("/api/v1/templates", requireUser, templatesRouter);
  app.use("/api/v1/convert", requireUser, convertRouter);
  app.use("/api/v1/export", requireUser, exportRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found", status: 404 });
  });

  app.use(errorHandler);

  return app;
}
