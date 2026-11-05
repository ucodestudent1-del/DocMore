import { Router } from "express";
import multer from "multer";
import { readFileSync } from "fs";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { conversionQueue } from "../services/queue";
import { uploadFile, isConfigured, getSignedDownloadUrl } from "../services/storage";
import { getMimeForFormat } from "../services/conversion";
import { z } from "zod";

const router = Router();
const upload = multer({ dest: "/tmp" });

const convertSchema = z.object({
  targetFormat: z.enum(["pdf", "docx", "html", "md"]),
});

const SOURCE_EXT_TO_FORMAT: Record<string, "pdf" | "docx" | "html" | "md"> = {
  pdf: "pdf",
  docx: "docx",
  html: "html",
  md: "md",
  markdown: "md",
};

router.post("/", requireUser, upload.single("file"), asyncHandler(async (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded", status: 400 });
  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid targetFormat", status: 400 });
  const { targetFormat } = parsed.data;
  const userId = req.user.id;

  const originalName = req.file.originalname;
  const sourceExt = originalName.split(".").pop()?.toLowerCase() ?? "";

  const sourceFormat = SOURCE_EXT_TO_FORMAT[sourceExt];
  if (!sourceFormat) {
    return res.status(400).json({ error: `Unsupported source format: .${sourceExt}`, status: 400 });
  }

  // Upload source to S3
  const sourceBuffer = readFileSync(req.file.path);
  const sourceKey = `uploads/${userId}/${req.file.filename}_${originalName}`;
  await uploadFile(sourceKey, sourceBuffer, req.file.mimetype);

  // Create conversion job
  const { rows } = await query(
    `INSERT INTO conversion_jobs (user_id, source_filename, source_path, target_format, status)
     VALUES ($1, $2, $3, $4, 'queued')
     RETURNING id, user_id, source_filename, target_format, status, created_at`,
    [userId, originalName, sourceKey, targetFormat],
  );
  const job = rows[0];

  // Enqueue async conversion
  await conversionQueue.add(
    "convert",
    {
      jobId: job.id,
      userId,
      sourceKey,
      sourceFormat,
      targetFormat,
      originalName,
    },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  );

  res.json({
    id: job.id,
    status: "queued",
    targetFormat,
    downloadUrl: `/api/v1/convert/${job.id}/download`,
  });
}));

router.get("/:jobId", requireUser, asyncHandler(async (req: any, res: any) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT id, user_id, source_filename, target_format, status, output_path, error, created_at, completed_at
     FROM conversion_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Job not found", status: 404 });
  const job = rows[0];
  const response: any = {
    id: job.id,
    status: job.status,
    targetFormat: job.target_format,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  };
  if (job.output_path) {
    response.downloadUrl = `/api/v1/convert/${job.id}/download`;
    response.mimeType = getMimeForFormat(job.target_format);
  }
  if (job.error) response.error = job.error;
  res.json(response);
}));

router.get("/:jobId/download", requireUser, asyncHandler(async (req: any, res: any) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT output_path, target_format FROM conversion_jobs WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
    [jobId, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Job not found or not completed", status: 404 });
  const job = rows[0];

  if (isConfigured()) {
    const url = await getSignedDownloadUrl(job.output_path, 300);
    return res.redirect(url);
  }

  // Fallback: read from S3 via storage service
  const buf = await require("../services/storage").downloadFile(job.output_path);
  res.set("Content-Disposition", `attachment; filename="${job.output_path.split("/").pop()}"`);
  res.set("Content-Type", getMimeForFormat(job.target_format));
  res.send(buf);
}));

export default router;
