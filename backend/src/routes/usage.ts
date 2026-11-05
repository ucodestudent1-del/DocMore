import { Router } from "express";
import { query } from "../db/pool";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { getUsage } from "../services/usage";

const router = Router();

router.get("/usage", requireUser, asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;

  const [docUsage, convUsage] = await Promise.all([
    getUsage(userId, "doc_generated"),
    getUsage(userId, "conversion"),
  ]);

  res.json({
    documents: docUsage,
    conversions: convUsage,
  });
}));

export default router;
