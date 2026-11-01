const TOKEN_KEY = "ud_auth_token";

const rawBase =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE
    ? process.env.NEXT_PUBLIC_API_BASE
    : "/api";

// Ensure the base always ends with /api so endpoints resolve correctly
const API_BASE = rawBase.replace(/\/+$/, "") + (rawBase.endsWith("/api") ? "" : "/api");

export { API_BASE };

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest(input: RequestInfo | URL, init?: RequestInit) {
  const mergedHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {}),
    ...authHeaders(),
  };
  const res = await fetch(input, { ...init, headers: mergedHeaders });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Authentication required");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd, headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed ${res.status}`);
  }
  return res.json();
}

export async function convertFile(fileId: string, target: string, options: Record<string, unknown> = {}) {
  return apiRequest(`${API_BASE}/convert`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, target, options }),
  });
}

export function downloadFile(fileId: string) {
  return `${API_BASE}/download/${encodeURIComponent(fileId)}`;
}

export async function listHistory(limit = 50) {
  return apiRequest(`${API_BASE}/history?limit=${limit}`);
}

export async function listFormats() {
  return apiRequest(`${API_BASE}/formats`);
}

export async function convertOptions(source: string, target: string) {
  return apiRequest(`${API_BASE}/convert-options/${encodeURIComponent(source)}/${encodeURIComponent(target)}`);
}

export async function conversionsForSource(source: string) {
  return apiRequest(`${API_BASE}/conversions/${encodeURIComponent(source)}`);
}

export async function pdfMerge(fileIds: string[]) {
  return apiRequest(`${API_BASE}/pdf/merge`, {
    method: "POST",
    body: JSON.stringify({ file_ids: fileIds }),
  });
}

export async function pdfSplit(fileId: string, pages?: number[], ranges?: string) {
  return apiRequest(`${API_BASE}/pdf/split`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, pages, ranges }),
  });
}

export async function pdfWatermark(fileId: string, text: string) {
  return apiRequest(`${API_BASE}/pdf/watermark`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, text }),
  });
}

export async function pdfPageNumbers(fileId: string, position: string) {
  return apiRequest(`${API_BASE}/pdf/page-numbers`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, position }),
  });
}

export async function pdfCompress(fileId: string) {
  return apiRequest(`${API_BASE}/pdf/compress`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function pdfMetadata(fileId: string, metadata: Record<string, string>) {
  return apiRequest(`${API_BASE}/pdf/metadata`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, metadata }),
  });
}

export async function pdfGetMetadata(fileId: string) {
  return apiRequest(`${API_BASE}/pdf/metadata/${encodeURIComponent(fileId)}`);
}

export async function pdfIsEncrypted(fileId: string) {
  return apiRequest(`${API_BASE}/pdf/encrypted/${encodeURIComponent(fileId)}`);
}

export async function pdfProtect(fileId: string, password: string) {
  return apiRequest(`${API_BASE}/pdf/protect`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, password }),
  });
}

export async function pdfOcr(fileId: string, lang: string = "eng") {
  return apiRequest(`${API_BASE}/pdf/ocr`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, lang }),
  });
}

export async function pdfUnlock(fileId: string, password: string) {
  return apiRequest(`${API_BASE}/pdf/unlock`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, password }),
  });
}

export async function pdfExtractText(fileId: string) {
  return apiRequest(`${API_BASE}/pdf/extract-text`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function generateDocument(blocks: any[], format: string, data?: Record<string, any>, pageSize = "letter", orientation = "portrait", margins?: any) {
  return apiRequest(`${API_BASE}/generate`, {
    method: "POST",
    body: JSON.stringify({ blocks, format, data, page_size: pageSize, orientation, margins }),
  });
}

export async function generateTemplate(name: string, data?: Record<string, any>, format = "pdf") {
  return apiRequest(`${API_BASE}/generate/template`, {
    method: "POST",
    body: JSON.stringify({ name, data: { ...(data || {}), format }, format }),
  });
}

export async function listTemplates() {
  return apiRequest(`${API_BASE}/templates`);
}

export async function imagesToPdf(files: File[]) {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await fetch(`${API_BASE}/pdf/images-to-pdf`, { method: "POST", body: fd, headers: authHeaders() });
  if (!res.ok) throw new Error("Images to PDF failed");
  return res.json();
}

export async function pdfEncryptCheck(fileId: string) {
  return apiRequest(`${API_BASE}/pdf/encrypted/${encodeURIComponent(fileId)}`);
}

/* ---- Auth helpers ---- */

export async function registerUser(username: string, email: string, password: string) {
  return apiRequest(`${API_BASE}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginUser(username: string, password: string) {
  const res = await apiRequest(`${API_BASE}/auth/token`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.access_token) {
    setToken(res.access_token);
  }
  return res;
}

export async function fetchMe() {
  return apiRequest(`${API_BASE}/auth/me`);
}

export function logout() {
  clearToken();
}

/* ---- Async job helpers ---- */

export async function pollJob(jobId: string, opts: { intervalMs?: number; timeoutMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 60000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job: any = await apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
    const status = job?.status;
    if (status === "success") return { status, result: job.result, error: job.error };
    if (status === "failure") return { status, result: job.result, error: job.error };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "timeout", result: null, error: "Job timed out" };
}

/* Run an async endpoint and poll until done, returning the result id. */
export async function runAsyncJob(requestFn: () => Promise<any>) {
  const res: any = await requestFn();
  const jobId = res?.job_id;
  if (!jobId) return res; // synchronous response
  const job = await pollJob(jobId);
  if (job.status !== "success") throw new Error(job.error || "Job failed");
  return { id: job.result, ext: "pdf", name: res.name ?? "result" };
}
