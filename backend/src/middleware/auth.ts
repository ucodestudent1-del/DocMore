export function requireUser(req: any, res: any, next: any) {
  const userId = req.header("X-User-Id");
  if (!userId) {
    return res.status(401).json({ error: "Missing X-User-Id header", status: 401 });
  }
  req.user = { id: userId };
  next();
}
