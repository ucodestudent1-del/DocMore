import { Request, Response, NextFunction } from "express";
import { query } from "../db/pool";

interface User {
  id: string;
  email: string;
  name: string | null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    session?: { userId?: string; destroy?: (cb?: (err?: any) => void) => void };
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required", status: 401 });
  }

  query("SELECT id, email, name FROM users WHERE id = $1", [userId]).then((result) => {
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found", status: 401 });
    }
    req.user = result.rows[0] as User;
    next();
  }).catch(() => {
    res.status(500).json({ error: "Database error", status: 500 });
  });
}
