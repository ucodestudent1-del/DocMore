import { query } from "../db/pool";
import { getTier, Tier } from "../config/pricing";

export interface UsageInfo {
  metricType: "doc_generated" | "conversion";
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
}

export async function getUsage(userId: string, metricType: "doc_generated" | "conversion"): Promise<UsageInfo> {
  const tierRow = await query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
  const tier = (tierRow.rows[0]?.subscription_tier || "free") as Tier;
  const tierConfig = getTier(tier);

  const limit = metricType === "doc_generated"
    ? tierConfig?.documentsPerMonth ?? null
    : tierConfig?.conversionsPerMonth ?? null;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const usageRow = await query(
    `SELECT count FROM usage
     WHERE user_id = $1 AND metric_type = $2 AND period_start = $3 AND period_end = $4`,
    [userId, metricType, periodStart, periodEnd],
  );

  const used = usageRow.rows.length > 0 ? usageRow.rows[0].count : 0;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const exceeded = limit !== null && used >= limit;

  return {
    metricType,
    used,
    limit,
    remaining,
    exceeded,
  };
}

export async function incrementUsage(userId: string, metricType: "doc_generated" | "conversion"): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await query(
    `INSERT INTO usage (user_id, metric_type, count, period_start, period_end, updated_at)
     VALUES ($1, $2, 1, $3, $4, NOW())
     ON CONFLICT (user_id, metric_type, period_start)
     DO UPDATE SET count = usage.count + 1, updated_at = NOW()`,
    [userId, metricType, periodStart, periodEnd],
  );

  await query(
    `INSERT INTO usage_events (user_id, metric_type)
     VALUES ($1, $2)`,
    [userId, metricType],
  );
}

export async function checkUsageLimit(userId: string, metricType: "doc_generated" | "conversion"): Promise<{ allowed: boolean; usage: UsageInfo }> {
  const usage = await getUsage(userId, metricType);
  return { allowed: !usage.exceeded, usage };
}
