import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const tmplSchema = z.object({
  name: z.string().min(1),
  content: z.any().optional(),
  variables: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

router.get("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT t.id, t.workspace_id, t.name, t.content, t.variables, t.is_public, t.created_at, t.updated_at
     FROM templates t
     JOIN workspaces w ON w.id = t.workspace_id
     WHERE w.owner_id = $1
     ORDER BY t.updated_at DESC`,
    [userId],
  );
  res.json(rows);
}));

router.post("/", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = tmplSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const { name, content, variables, isPublic } = parsed.data;
  const userId = req.user.id;

  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(400).json({ error: "No workspace found for user", status: 400 });

  const { rows } = await query(
    `INSERT INTO templates (workspace_id, name, content, variables, is_public)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, name, content, variables, is_public, created_at, updated_at`,
    [ws[0].id, name, content ?? {}, variables ?? [], isPublic ?? false],
  );
  res.status(201).json(rows[0]);
}));

router.get("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT t.id, t.workspace_id, t.name, t.content, t.variables, t.is_public, t.created_at, t.updated_at
     FROM templates t
     JOIN workspaces w ON w.id = t.workspace_id
     WHERE t.id = $1 AND w.owner_id = $2`,
    [id, userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: "Template not found", status: 404 });
  res.json(rows[0]);
}));

router.delete("/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { rowCount } = await query(
    `DELETE FROM templates
     WHERE id = $1
     AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $2)`,
    [id, userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: "Template not found", status: 404 });
  res.status(204).send();
}));

export default router;
