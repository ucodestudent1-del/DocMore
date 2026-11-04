export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, _req: any, res: any, _next: any) {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: message, status });
}

export function asyncHandler(fn: any) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
