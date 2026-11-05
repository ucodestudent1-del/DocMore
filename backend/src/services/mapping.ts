import { query } from "../db/pool";

export type FieldMapping = { source: string; target: string; confidence: number };

export interface InferResult {
  mappings: FieldMapping[];
  transforms: Record<string, string>;
}

function flattenPaths(obj: any, prefix = ""): Array<{ path: string; sample: any }> {
  const res: Array<{ path: string; sample: any }> = [];
  if (obj == null || typeof obj !== "object") {
    res.push({ path: prefix || "root", sample: obj });
    return res;
  }
  if (Array.isArray(obj)) {
    res.push({ path: prefix || "items", sample: obj[0] });
    if (obj.length > 0 && typeof obj[0] === "object") {
      for (const k of Object.keys(obj[0])) {
        res.push(...flattenPaths(obj[0][k], prefix ? `${prefix}.${k}` : k));
      }
    }
    return res;
  }
  for (const k of Object.keys(obj)) {
    res.push(...flattenPaths(obj[k], prefix ? `${prefix}.${k}` : k));
  }
  return res;
}

function similarity(a: string, b: string): number {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.8;
  const ta = new Set(A.split(/[_\s-]+/).filter(Boolean));
  const tb = new Set(B.split(/[_\s-]+/).filter(Boolean));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}

export function inferMapping(sampleData: any, templateVariables: string[]): InferResult {
  const leaves = flattenPaths(sampleData);
  const mappings: FieldMapping[] = [];
  const transforms: Record<string, string> = {};

  for (const tv of templateVariables) {
    let bestSource = "";
    let bestConf = 0;
    for (const leaf of leaves) {
      const conf = similarity(tv, leaf.path);
      if (conf > bestConf) {
        bestConf = conf;
        bestSource = leaf.path;
      }
    }
    mappings.push({ source: bestSource, target: tv, confidence: bestConf });
    if (tv.includes("date") || tv.includes("amount") || tv.includes("price")) {
      transforms[tv] = "format";
    }
  }

  return { mappings, transforms };
}

function getPath(obj: any, path: string): any {
  let cur: any = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

export function applyMapping(mapping: Array<{ source: string; target: string }>, sourceData: any): any {
  const out: Record<string, any> = {};
  for (const { source, target } of mapping) {
    const val = getPath(sourceData, source);
    if (val !== undefined) out[target] = val;
  }
  return out;
}

export async function saveMappingProfile(workspaceId: string, profile: {
  templateId?: string;
  name: string;
  sourceSchema: any;
  fieldMapping: any;
}) {
  const { rows } = await query(
    `INSERT INTO mapping_profiles (workspace_id, template_id, name, source_schema, field_mapping)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, template_id, name, source_schema, field_mapping, created_at, updated_at`,
    [workspaceId, profile.templateId ?? null, profile.name, JSON.stringify(profile.sourceSchema), JSON.stringify(profile.fieldMapping)],
  );
  return rows[0];
}

export async function listMappingProfiles(workspaceId: string) {
  const { rows } = await query(
    `SELECT id, workspace_id, template_id, name, source_schema, field_mapping, created_at, updated_at
     FROM mapping_profiles WHERE workspace_id = $1 ORDER BY updated_at DESC`,
    [workspaceId],
  );
  return rows;
}

export async function getMappingProfile(id: string, workspaceId: string) {
  const { rows } = await query(
    `SELECT id, workspace_id, template_id, name, source_schema, field_mapping, created_at, updated_at
     FROM mapping_profiles WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId],
  );
  return rows[0];
}
