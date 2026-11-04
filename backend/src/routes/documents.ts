import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const docSchema = z.object({
  title: z.string().min(1),
  templateId: z.string().optional(),
  content: z.any().optional(),
});

router.get("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT d.id, d.workspace_id, d.template_id, d.title, d.content, d.status, d.created_at, d.updated_at
     FROM documents d
     JOIN workspaces w ON w.id = d.workspace_id
     WHERE w.owner_id = $1
     ORDER BY d.updated_at DESC`,
    [userId],
  );
  res.json(rows);
}));

router.post("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const { title, templateId, content } = parsed.data;
  const userId = req.user.id;

  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) {
    return res.status(400).json({ error: "No workspace found for user", status: 400 });
  }
  const workspaceId = ws[0].id;

  const { rows } = await query(
    `INSERT INTO documents (workspace_id, template_id, title, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, workspace_id, template_id, title, content, status, created_at, updated_at`,
    [workspaceId, templateId ?? null, title, content ?? {}],
  );
  res.status(201).json(rows[0]);
}));

router.get("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT d.id, d.workspace_id, d.template_id, d.title, d.content, d.status, d.created_at, d.updated_at
     FROM documents d
     JOIN workspaces w ON w.id = d.workspace_id
     WHERE d.id = $1 AND w.owner_id = $2`,
    [id, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found", status: 404 });
  res.json(rows[0]);
}));

router.put("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;
  const parsed = docSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const { title, templateId, content } = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (title !== undefined) { sets.push(`title = $${i++}`); vals.push(title); }
  if (templateId !== undefined) { sets.push(`template_id = $${i++}`); vals.push(templateId); }
  if (content !== undefined) { sets.push(`content = $${i++}`); vals.push(content); }
  sets.push(`updated_at = NOW()`);
  vals.push(id, userId);

  const { rows } = await query(
    `UPDATE documents SET ${sets.join(", ")}
     WHERE id = $${i++}
     AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $${i++})
     RETURNING id, workspace_id, template_id, title, content, status, created_at, updated_at`,
    vals,
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found", status: 404 });
  res.json(rows[0]);
}));

router.delete("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { rowCount } = await query(
    `DELETE FROM documents
     WHERE id = $1
     AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $2)`,
    [id, userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: "Document not found", status: 404 });
  res.status(204).send();
}));

export default router;
