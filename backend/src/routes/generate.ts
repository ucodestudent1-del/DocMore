import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { requireUsageLimit, incrementUsageAfter } from "../middleware/usage";
import { generationQueue } from "../services/queue";
import { generateDocument, OutputFormat } from "../services/template";
import { uploadFile, isConfigured, getSignedDownloadUrl } from "../services/storage";
import { z } from "zod";

const router = Router();

const generateSchema = z.object({
  templateId: z.string().optional(),
  inputData: z.record(z.any()).optional().default({}),
  outputFormat: z.enum(["pdf", "docx", "html", "md"]).default("pdf"),
});

router.post("/", requireUser, requireUsageLimit("doc_generated"), asyncHandler(async (req: any, res: any) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const { templateId, inputData, outputFormat } = parsed.data;
  const userId = req.user.id;

  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(400).json({ error: "No workspace found for user", status: 400 });
  const workspaceId = ws[0].id;

  const { rows: docRows } = await query(
    `INSERT INTO documents (workspace_id, title, content, status, format)
     VALUES ($1, $2, $3, 'generating', $4)
     RETURNING id`,
    [workspaceId, `Document ${new Date().toISOString()}`, JSON.stringify(inputData), outputFormat],
  );
  const documentId = docRows[0].id;

  const { rows } = await query(
    `INSERT INTO generation_jobs (user_id, workspace_id, template_id, document_id, input_data, output_format, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued')
     RETURNING id, user_id, workspace_id, template_id, document_id, output_format, status, created_at`,
    [userId, workspaceId, templateId ?? null, documentId, JSON.stringify(inputData), outputFormat],
  );
  const job = rows[0];

  await generationQueue.add(
    "generate",
    {
      jobId: job.id,
      userId,
      workspaceId,
      templateId,
      inputData,
      outputFormat,
    },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  );

  await incrementUsageAfter(req);

  res.status(202).json({
    id: job.id,
    documentId,
    status: "queued",
    outputFormat,
    statusUrl: `/api/v1/generate/${job.id}`,
    downloadUrl: `/api/v1/generate/${job.id}/download`,
  });
}));

router.get("/:jobId", requireUser, asyncHandler(async (req: any, res: any) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT id, user_id, workspace_id, template_id, document_id, input_data, output_format, status, output_path, error, attempts, created_at, started_at, completed_at
     FROM generation_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Job not found", status: 404 });
  const job = rows[0];
  const response: any = {
    id: job.id,
    status: job.status,
    outputFormat: job.output_format,
    documentId: job.document_id,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    attempts: job.attempts,
  };
  if (job.output_path) {
    response.downloadUrl = `/api/v1/generate/${job.id}/download`;
  }
  if (job.error) response.error = job.error;
  res.json(response);
}));

router.get("/:jobId/download", requireUser, asyncHandler(async (req: any, res: any) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT output_path, output_format FROM generation_jobs WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
    [jobId, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Job not found or not completed", status: 404 });
  const job = rows[0];

  if (isConfigured()) {
    const url = await getSignedDownloadUrl(job.output_path, 300);
    return res.redirect(url);
  }
  const { downloadFile } = require("../services/storage");
  const buf = await downloadFile(job.output_path);
  const MIME: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    html: "text/html",
    md: "text/markdown",
  };
  res.set("Content-Disposition", `attachment; filename="${job.output_path.split("/").pop()}"`);
  res.set("Content-Type", MIME[job.output_format] ?? "application/octet-stream");
  res.send(buf);
}));

export default router;
