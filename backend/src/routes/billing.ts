import { Router, Request, Response } from "express";
import { getTier, formatPrice, PRICING_TIERS, PricingTier, Tier } from "../config/pricing";
import { requireUser } from "../middleware/auth";
import { query } from "../db/pool";

const router = Router();

// Stub: returns the user's current tier (free by default until Stripe is wired)
router.get("/tier", requireUser, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      "SELECT subscription_tier FROM users WHERE id = $1",
      [req.user!.id],
    );
    const tier = rows[0]?.subscription_tier || "free";
    res.json({ tier, ...getTier(tier) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tier", status: 500 });
  }
});

// Stub: returns all pricing tiers with prices
router.get("/tiers", (_req: Request, res: Response) => {
  res.json(
    PRICING_TIERS.map((t: PricingTier) => ({
      id: t.id,
      name: t.name,
      priceMonthly: formatPrice(t.priceMonthly),
      priceYearly: formatPrice(t.priceYearly),
      documentsPerMonth: t.documentsPerMonth,
      conversionsPerMonth: t.conversionsPerMonth,
      storageGB: t.storageGB,
      aiCreditsPerMonth: t.aiCreditsPerMonth,
      features: t.features,
      stripePriceIdMonthly: t.stripePriceIdMonthly,
      stripePriceIdYearly: t.stripePriceIdYearly,
    })),
  );
});

// Stub: checkout session creation (requires STRIPE_SECRET_KEY)
router.post("/checkout", requireUser, async (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY env vars.",
    status: 501,
  });
});

// Stub: customer portal (requires STRIPE_SECRET_KEY)
router.post("/portal", requireUser, async (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Stripe not configured. Set STRIPE_SECRET_KEY env var.",
    status: 501,
  });
});

// Stub: webhook handler (requires STRIPE_WEBHOOK_SECRET)
router.post("/webhook", (_req: Request, res: Response) => {
  res.status(501).json({
    error: "Stripe webhook not configured. Set STRIPE_WEBHOOK_SECRET env var.",
    status: 501,
  });
});

export default router;
