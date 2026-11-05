import { query } from "../db/pool";
import { createHmac, timingSafeEqual } from "crypto";

export interface WebhookRow {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: string;
  response_status?: number;
  response_body?: string;
  attempts: number;
  max_attempts: number;
  next_retry_at?: Date;
  created_at: Date;
  delivered_at?: Date;
}

const BACKOFF_MS = [1000, 5000, 25000, 120000, 600000];

export function generateWebhookSecret(): string {
  return `whsec_${Buffer.from(cryptoRandomBytes(24)).toString("hex")}`;
}

function cryptoRandomBytes(size: number): Buffer {
  const { randomBytes } = require("crypto");
  return randomBytes(size);
}

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload);
  const expectedBuf = Buffer.from(expected, "hex");
  const sigBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(expectedBuf, sigBuf);
}

export async function createWebhook(workspaceId: string, data: {
  url: string;
  events: string[];
  active?: boolean;
}) {
  const secret = generateWebhookSecret();
  const { rows } = await query(
    `INSERT INTO webhooks (workspace_id, url, events, secret, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, url, events, secret, active, created_at, updated_at`,
    [workspaceId, data.url, JSON.stringify(data.events), secret, data.active ?? true],
  );
  return rows[0];
}

export async function listWebhooks(workspaceId: string) {
  const { rows } = await query(
    `SELECT id, workspace_id, url, events, active, created_at, updated_at
     FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map((r) => ({ ...r, events: r.events || [] }));
}

export async function getWebhook(id: string, workspaceId: string) {
  const { rows } = await query(
    `SELECT id, workspace_id, url, events, secret, active, created_at, updated_at
     FROM webhooks WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId],
  );
  if (!rows[0]) return null;
  return { ...rows[0], events: rows[0].events || [] };
}

export async function updateWebhook(id: string, workspaceId: string, data: {
  url?: string;
  events?: string[];
  active?: boolean;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.url !== undefined) { sets.push(`url = $${idx++}`); params.push(data.url); }
  if (data.events !== undefined) { sets.push(`events = $${idx++}`); params.push(JSON.stringify(data.events)); }
  if (data.active !== undefined) { sets.push(`active = $${idx++}`); params.push(data.active); }
  if (sets.length === 0) return getWebhook(id, workspaceId);
  sets.push(`updated_at = NOW()`);
  params.push(id, workspaceId);
  const { rows } = await query(
    `UPDATE webhooks SET ${sets.join(", ")} WHERE id = $${idx} AND workspace_id = $${idx + 1}
     RETURNING id, workspace_id, url, events, secret, active, created_at, updated_at`,
    params,
  );
  if (!rows[0]) return null;
  return { ...rows[0], events: rows[0].events || [] };
}

export async function deleteWebhook(id: string, workspaceId: string) {
  const { rowCount } = await query(
    `DELETE FROM webhooks WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId],
  );
  return Number(rowCount ?? 0) > 0;
}

export async function enqueueDelivery(webhookId: string, event: string, payload: any) {
  const { rows } = await query(
    `INSERT INTO webhook_deliveries (webhook_id, event, payload, status, attempts, max_attempts, next_retry_at)
     VALUES ($1, $2, $3, 'pending', 0, 5, NOW())
     RETURNING id`,
    [webhookId, event, JSON.stringify(payload)],
  );
  return rows[0].id;
}

export async function getPendingDeliveries(limit = 50) {
  const { rows } = await query(
    `SELECT d.id, d.webhook_id, d.event, d.payload, d.attempts,
            d.max_attempts as maxAttempts, d.next_retry_at as nextRetryAt,
            w.url, w.secret
     FROM webhook_deliveries d
     JOIN webhooks w ON w.id = d.webhook_id
     WHERE d.status = 'pending' AND w.active = true
       AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
     ORDER BY d.created_at ASC
     LIMIT $1`,
    [limit],
  );
  return rows as Array<{
    id: string; webhook_id: string; event: string; payload: any; attempts: number;
    maxAttempts: number; nextRetryAt?: Date; url: string; secret: string;
  }>;
}

export async function markDelivery(id: string, status: string, opts?: {
  responseStatus?: number;
  responseBody?: string;
  attempts?: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
}) {
  const sets: string[] = [`status = $2`];
  const params: any[] = [id, status];
  let idx = 3;
  if (opts?.responseStatus !== undefined) { sets.push(`response_status = $${idx++}`); params.push(opts.responseStatus); }
  if (opts?.responseBody !== undefined) { sets.push(`response_body = $${idx++}`); params.push(opts.responseBody); }
  if (opts?.attempts !== undefined) { sets.push(`attempts = $${idx++}`); params.push(opts.attempts); }
  if (opts?.nextRetryAt !== undefined) { sets.push(`next_retry_at = $${idx++}`); params.push(opts.nextRetryAt); }
  if (opts?.deliveredAt !== undefined) { sets.push(`delivered_at = NOW()`); }
  if (sets.length > 1) {
    await query(`UPDATE webhook_deliveries SET ${sets.join(", ")} WHERE id = $1`, params);
  }
}

export async function deliverWebhook(delivery: {
  id: string; url: string; secret: string; event: string; payload: any; attempts: number; maxAttempts: number;
}): Promise<{ ok: boolean; status?: number; body?: string; retryAfterMs?: number }> {
  const payloadStr = JSON.stringify(delivery.payload);
  const signature = signPayload(delivery.secret, payloadStr);

  let res: any;
  try {
    res = await fetch(delivery.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "EveryDoc-Signature": signature,
        "EveryDoc-Event-Type": delivery.event,
        "EveryDoc-Delivery-Id": delivery.id,
        "Idempotency-Key": delivery.id,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: any) {
    const attempt = delivery.attempts + 1;
    const retryAfterMs = attempt <= delivery.maxAttempts ? BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] : 0;
    return { ok: false, retryAfterMs };
  }

  let body: string | undefined;
  try { body = await res.text(); } catch { /* no body */ }

  if (res.status >= 200 && res.status < 300) {
    return { ok: true, status: res.status, body };
  }

  const attempt = delivery.attempts + 1;
  const retryAfterMs = attempt <= delivery.maxAttempts ? BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] : 0;
  return { ok: false, status: res.status, body, retryAfterMs };
}
