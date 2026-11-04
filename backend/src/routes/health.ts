import { Router } from "express";
import { query } from "../db/pool";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", service: "everydoc-backend" });
  } catch (err) {
    res.status(503).json({ status: "degraded", service: "everydoc-backend", error: String(err) });
  }
});

export default router;
