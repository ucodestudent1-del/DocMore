import { Request, Response, NextFunction } from "express";
import { getTier, Tier } from "../config/pricing";
import { query } from "../db/pool";

export interface AuthorizedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string | null;
    tier: Tier;
  };
  session?: { userId?: string };
}

// Checks the user's subscription tier and enforces a minimum tier.
// Usage: requireTier("professional") or requireTier(["professional", "business"])
export function requireTier(allowed: Tier | Tier[]) {
  const allowedSet = new Set(Array.isArray(allowed) ? allowed : [allowed]);
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required", status: 401 });
    }

    try {
      const { rows } = await query(
        "SELECT subscription_tier FROM users WHERE id = $1",
        [userId],
      );
      const tier: Tier = (rows[0]?.subscription_tier || "free") as Tier;

      if (!allowedSet.has(tier)) {
        return res.status(403).json({
          error: `This feature requires the ${Array.from(allowedSet).join(" / ")} plan`,
          requiredTier: Array.from(allowedSet),
          currentTier: tier,
          status: 403,
        });
      }

      req.user = { ...req.user, tier };
      next();
    } catch (err) {
      res.status(500).json({ error: "Database error", status: 500 });
    }
  };
}
