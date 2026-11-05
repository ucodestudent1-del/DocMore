import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { z } from "zod";
import {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  getPendingDeliveries,
  deliverWebhook,
  markDelivery,
} from "../services/webhooks";

const router = Router();

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  active: z.boolean().optional(),
});

router.post("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(400).json({ error: "No workspace found for user", status: 400 });
  const webhook = await createWebhook(ws[0].id, parsed.data);
  // Never return the signing secret to the client
  const { secret, ...withoutSecret } = webhook;
  res.status(201).json(withoutSecret);
}));

router.get("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.json([]);
  const webhooks = await listWebhooks(ws[0].id);
  res.json(webhooks.map(({ secret, ...rest }) => rest));
}));

router.get("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(404).json({ error: "Not found", status: 404 });
  const webhook = await getWebhook(req.params.id, ws[0].id);
  if (!webhook) return res.status(404).json({ error: "Webhook not found", status: 404 });
  const { secret, ...rest } = webhook;
  res.json(rest);
}));

router.patch("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = webhookSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(404).json({ error: "Not found", status: 404 });
  const webhook = await updateWebhook(req.params.id, ws[0].id, parsed.data);
  if (!webhook) return res.status(404).json({ error: "Webhook not found", status: 404 });
  const { secret, ...rest } = webhook;
  res.json(rest);
}));

router.delete("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(404).json({ error: "Not found", status: 404 });
  const deleted = await deleteWebhook(req.params.id, ws[0].id);
  if (!deleted) return res.status(404).json({ error: "Webhook not found", status: 404 });
  res.status(204).send();
}));

// Process pending webhook deliveries (intended to be polled by a worker/cron)
router.post("/deliver", requireUser, asyncHandler(async (_req: any, res: any) => {
  const pending = await getPendingDeliveries(100);
  const results: any[] = [];
  for (const d of pending) {
    const result = await deliverWebhook(d);
    if (result.ok) {
      await markDelivery(d.id, "delivered", { attempts: d.attempts + 1, deliveredAt: new Date() });
    } else if (result.retryAfterMs) {
      await markDelivery(d.id, "pending", {
        attempts: d.attempts + 1,
        nextRetryAt: new Date(Date.now() + result.retryAfterMs),
        responseStatus: result.status,
        responseBody: result.body,
      });
    } else {
      await markDelivery(d.id, "failed", { attempts: d.attempts + 1 });
    }
    results.push({ id: d.id, ok: result.ok, status: result.status });
  }
  res.json({ processed: results.length, results });
}));

export default router;
