import { Router, Request, Response } from "express";
import { query } from "../db/pool";
import bcrypt from "bcryptjs";
import { requireUser } from "../middleware/auth";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required", status: 400 });
  }

  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered", status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, passwordHash, name || null],
    );

    req.session!.userId = rows[0].id;
    res.status(201).json({ id: rows[0].id, email: rows[0].email, name: rows[0].name });
  } catch (err) {
    res.status(500).json({ error: "Registration failed", status: 500 });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required", status: 400 });
  }

  try {
    const { rows } = await query("SELECT id, email, name, password_hash FROM users WHERE email = $1", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password", status: 401 });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password", status: 401 });
    }

    req.session!.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    res.status(500).json({ error: "Login failed", status: 500 });
  }
});

router.post("/logout", requireUser, async (_req: Request, res: Response) => {
  _req.session!.destroy?.(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireUser, (req: Request, res: Response) => {
  res.json({ id: req.user!.id, email: req.user!.email, name: req.user!.name });
});

export default router;
