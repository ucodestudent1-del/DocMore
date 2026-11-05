import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { z } from "zod";
import { inferMapping, applyMapping, saveMappingProfile, listMappingProfiles, getMappingProfile } from "../services/mapping";

const router = Router();

const inferSchema = z.object({
  sampleData: z.record(z.any()).optional().default({}),
  templateVariables: z.array(z.string()).optional().default([]),
});

const applySchema = z.object({
  mapping: z.array(z.object({ source: z.string(), target: z.string() })),
  sourceData: z.record(z.any()).optional().default({}),
});

const profileSchema = z.object({
  templateId: z.string().optional(),
  name: z.string().min(1),
  sourceSchema: z.record(z.any()).optional().default({}),
  fieldMapping: z.array(z.object({ source: z.string(), target: z.string() })),
});

router.post("/infer", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = inferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const result = inferMapping(parsed.data.sampleData, parsed.data.templateVariables);
  res.json(result);
}));

router.post("/apply", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const resolved = applyMapping(parsed.data.mapping, parsed.data.sourceData);
  res.json(resolved);
}));

router.post("/profiles", requireUser, asyncHandler(async (req: any, res: any) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", status: 400 });
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(400).json({ error: "No workspace found for user", status: 400 });
  const profile = await saveMappingProfile(ws[0].id, {
    templateId: parsed.data.templateId,
    name: parsed.data.name,
    sourceSchema: parsed.data.sourceSchema,
    fieldMapping: parsed.data.fieldMapping,
  });
  res.status(201).json(profile);
}));

router.get("/profiles", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.json([]);
  const profiles = await listMappingProfiles(ws[0].id);
  res.json(profiles);
}));

router.get("/profiles/:id", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { rows: ws } = await query("SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1", [userId]);
  if (ws.length === 0) return res.status(404).json({ error: "Not found", status: 404 });
  const profile = await getMappingProfile(req.params.id, ws[0].id);
  if (!profile) return res.status(404).json({ error: "Profile not found", status: 404 });
  res.json(profile);
}));

export default router;
