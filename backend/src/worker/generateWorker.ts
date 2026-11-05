import { Worker } from "bullmq";
import { query } from "../db/pool";
import { downloadFile, uploadFile, getSignedDownloadUrl, isConfigured } from "../services/storage";
import { generateDocument, OutputFormat } from "../services/template";
import { incrementUsage } from "../services/usage";
import { enqueueDelivery } from "../services/webhooks";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function processJob(job: any) {
  const { jobId, userId, workspaceId, templateId, inputData, outputFormat } = job.data;
  const fmt = outputFormat as OutputFormat;

  await query(
    `UPDATE generation_jobs SET status = 'processing', started_at = NOW(), attempts = attempts + 1 WHERE id = $1`,
    [jobId],
  );

  let outputKey: string | null = null;
  let error: string | null = null;

  try {
    let templateContent: string | undefined;
    if (templateId) {
      const { rows } = await query(
        `SELECT t.content FROM templates t JOIN workspaces w ON w.id = t.workspace_id
         WHERE t.id = $1 AND w.id = $2`,
        [templateId, workspaceId],
      );
      templateContent = rows[0]?.content?.html ?? rows[0]?.content;
    }

    const outBuf = await generateDocument(templateContent, inputData || {}, fmt);

    const ext = { pdf: ".pdf", docx: ".docx", html: ".html", md: ".md" }[fmt] ?? ".bin";
    const mime = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      html: "text/html",
      md: "text/markdown",
    }[fmt] ?? "application/octet-stream";

    outputKey = `generations/${userId}/${jobId}_${Date.now()}${ext}`;
    await uploadFile(outputKey, outBuf, mime);

    await query(
      `UPDATE generation_jobs SET status = 'completed', output_path = $1, completed_at = NOW() WHERE id = $2`,
      [outputKey, jobId],
    );

    // Link to a document record if one was pre-created
    await query(
      `UPDATE documents SET status = 'generated', format = $1, output_path = $2, generated_at = NOW()
       WHERE id = (SELECT document_id FROM generation_jobs WHERE id = $3)`,
      [fmt, outputKey, jobId],
    );

    console.log(`Generation job ${jobId} completed: ${outputKey}`);
    await incrementUsage(userId, "doc_generated");

    // Fire webhook
    const { rows: whRows } = await query(
      `SELECT w.id, w.url, w.secret FROM webhooks w WHERE w.workspace_id = $1 AND w.active = true`,
      [workspaceId],
    );
    for (const wh of whRows) {
      await enqueueDelivery(wh.id, "document.generated", {
        jobId, userId, workspaceId, templateId, outputFormat: fmt,
        outputKey, downloadUrl: `/api/v1/generate/${jobId}/download`,
      });
    }
  } catch (err: any) {
    error = String(err);
    console.error(`Generation job ${jobId} failed:`, err);
    await query(
      `UPDATE generation_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [error, jobId],
    );

    const { rows: whRows } = await query(
      `SELECT w.id, w.url, w.secret FROM webhooks w WHERE w.workspace_id = $1 AND w.active = true`,
      [workspaceId],
    );
    for (const wh of whRows) {
      await enqueueDelivery(wh.id, "document.failed", {
        jobId, userId, workspaceId, templateId, outputFormat: fmt, error,
      });
    }

    const { rows: gj } = await query("SELECT attempts, max_attempts FROM generation_jobs WHERE id = $1", [jobId]);
    const attempt = gj[0]?.attempts ?? 0;
    const maxAttempts = gj[0]?.max_attempts ?? 3;
    if (attempt < maxAttempts) {
      throw err;
    }
  }

  return { jobId, status: error ? "failed" : "completed", outputPath: outputKey, error };
}

const worker = new Worker("document-generation", processJob, {
  connection: parseRedisUrl(REDIS_URL),
  concurrency: 4,
});

worker.on("completed", (job) => {
  console.log(`Generation job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Generation job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Generation worker error:", err);
});

console.log("Generation worker started");
