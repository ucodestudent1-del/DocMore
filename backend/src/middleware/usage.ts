import { Request, Response, NextFunction } from "express";
import { checkUsageLimit, incrementUsage, UsageInfo } from "../services/usage";

export function requireUsageLimit(metricType: "doc_generated" | "conversion") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required", status: 401 });
    }

    const { allowed, usage } = await checkUsageLimit(userId, metricType);

    if (!allowed) {
      return res.status(403).json({
        error: `Monthly ${metricType} limit reached`,
        usage,
        status: 403,
      });
    }

    // Store usage info for increment after successful operation
    (req as any).usageToIncrement = { userId, metricType };
    next();
  };
}

export async function incrementUsageAfter(req: Request): Promise<void> {
  const { userId, metricType } = (req as any).usageToIncrement || {};
  if (userId && metricType) {
    await incrementUsage(userId, metricType);
  }
}
