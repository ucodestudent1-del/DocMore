import { Router } from "express";
import multer from "multer";
import { copyFileSync, unlinkSync } from "fs";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { convertFile, isSupported, getMimeForFormat } from "../services/conversion";
import { storagePath, readFile } from "../services/filesystem";
import { z } from "zod";

const router = Router();
const upload = multer({ dest: "/tmp" });

const convertSchema = z.object({
  targetFormat: z.enum(["pdf", "docx", "html", "md"]),
});

router.post("/", requireUser, upload.single("file"), asyncHandler(async (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded", status: 400 });
  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid targetFormat", status: 400 });
  const { targetFormat } = parsed.data;
  const userId = req.user.id;

  const originalName = req.file.originalname;
  const sourceExt = originalName.split(".").pop()?.toLowerCase() ?? "";

  let sourceFormat: "pdf" | "docx" | "html" | "md";
  switch (sourceExt) {
    case "pdf": sourceFormat = "pdf"; break;
    case "docx": sourceFormat = "docx"; break;
    case "html": sourceFormat = "html"; break;
    case "md": case "markdown": sourceFormat = "md"; break;
    default:
      unlinkSync(req.file.path);
      return res.status(400).json({ error: `Unsupported source format: .${sourceExt}`, status: 400 });
  }

  const sourceFilename = req.file.filename;
  // Multer writes to /tmp; copy into persistent storage so convertFile can read it
  copyFileSync(req.file.path, storagePath(sourceFilename));
  unlinkSync(req.file.path);

  const { rows } = await query(
    `INSERT INTO conversion_jobs (user_id, source_filename, source_path, target_format, status)
     VALUES ($1, $2, $3, $4, 'queued')
     RETURNING id, user_id, source_filename, target_format, status, created_at`,
    [userId, originalName, sourceFilename, targetFormat],
  );
  const job = rows[0];

  // Process synchronously for MVP
  try {
    const { outputFilename, mimeType } = await convertFile(sourceFilename, sourceFormat, targetFormat);
    await query(
      `UPDATE conversion_jobs SET status = 'completed', output_path = $1, completed_at = NOW() WHERE id = $2`,
      [outputFilename, job.id],
    );
    res.json({
      id: job.id,
      status: "completed",
      targetFormat,
      outputFilename,
      mimeType,
      downloadUrl: `/api/v1/convert/${job.id}/download`,
    });
  } catch (err) {
    await query(
      `UPDATE conversion_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [String(err), job.id],
    );
    res.status(500).json({ error: "Conversion failed", status: 500 });
  }
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
    response.outputFilename = job.output_path;
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
  const buf = readFile(job.output_path);
  res.set("Content-Disposition", `attachment; filename="${job.output_path}"`);
  res.set("Content-Type", getMimeForFormat(job.target_format));
  res.send(buf);
}));

export default router;
