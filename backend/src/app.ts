import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import healthRouter from "./routes/health";
import documentsRouter from "./routes/documents";
import templatesRouter from "./routes/templates";
import convertRouter from "./routes/convert";
import exportRouter from "./routes/export";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "everydoc-backend" });
  });
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/documents", documentsRouter);
  app.use("/api/v1/templates", templatesRouter);
  app.use("/api/v1/convert", convertRouter);
  app.use("/api/v1/export", exportRouter);

  if (config.NODE_ENV === "production") {
    const frontendOut = path.join(__dirname, "../../frontend/out");
    app.use(express.static(frontendOut));
    app.get(/^(?!\/api).*$/, (_req, res) => {
      res.sendFile(path.join(frontendOut, "index.html"));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found", status: 404 });
  });

  app.use(errorHandler);

  return app;
}
