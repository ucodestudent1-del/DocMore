import { Worker } from "bullmq";
import { query } from "../db/pool";
import { downloadFile, uploadFile, isConfigured } from "../services/storage";
import { convertBuffer, getMimeForFormat, SourceFormat, TargetFormat } from "../services/conversion";

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
  const { jobId, userId, sourceKey, sourceFormat, targetFormat, originalName } = job.data;

  // Update status to processing
  await query(
    `UPDATE conversion_jobs SET status = 'processing' WHERE id = $1`,
    [jobId],
  );

  try {
    // Download source from S3
    const sourceBuffer = await downloadFile(sourceKey);

    // Convert
    const outBuf = await convertBuffer(sourceBuffer, sourceFormat as SourceFormat, targetFormat as TargetFormat);

    // Determine output key
    const base = sourceKey.replace(/\.[^/.]+$/, "");
    const outputKey = `conversions/${userId}/${base}_converted_${Date.now()}${getMimeForFormat(targetFormat as TargetFormat) === "application/pdf" ? ".pdf" : getMimeForFormat(targetFormat as TargetFormat) === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? ".docx" : getMimeForFormat(targetFormat as TargetFormat) === "text/html" ? ".html" : ".md"}`;

    // Upload result to S3
    await uploadFile(outputKey, outBuf, getMimeForFormat(targetFormat as TargetFormat));

    // Mark completed
    await query(
      `UPDATE conversion_jobs SET status = 'completed', output_path = $1, completed_at = NOW() WHERE id = $2`,
      [outputKey, jobId],
    );

    console.log(`Conversion job ${jobId} completed: ${outputKey}`);
  } catch (err: any) {
    console.error(`Conversion job ${jobId} failed:`, err);
    await query(
      `UPDATE conversion_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [String(err), jobId],
    );
    throw err;
  }
}

const worker = new Worker("document-conversion", processJob, {
  connection: parseRedisUrl(REDIS_URL),
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

console.log("Conversion worker started");
