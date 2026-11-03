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

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing) return refreshPromise ?? null;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include", // sends httpOnly refresh_token cookie
      });
      if (res.ok) {
        const data = await res.json();
        return data.access_token as string | null;
      }
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise ?? null;
}

export async function apiRequest(input: RequestInfo | URL, init?: RequestInit) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(init?.headers || {}),
  };
  let res = await fetch(input, { ...init, headers, credentials: "include" });
  if (res.status === 401) {
    // Try refreshing the access token once.
    const newToken = await refreshAccessToken();
    if (newToken) {
      setToken(newToken);
      const newHeaders: HeadersInit = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(input, { ...init, headers: newHeaders, credentials: "include" });
    }
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Authentication required");
    }
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
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: fd,
    headers: authHeaders(),
    credentials: "include",
  });
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

export async function downloadFile(fileId: string) {
  // Request a signed/download URL from the backend, then fetch it.
  const urlRes: any = await apiRequest(`${API_BASE}/files/${encodeURIComponent(fileId)}/download`);
  const downloadUrl = urlRes?.url || `${API_BASE}/download/${encodeURIComponent(fileId)}`;
  const token = getToken();
  const res = await fetch(downloadUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Download failed ${res.status}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  a.download = match ? match[1].replace(/['"]/g, "") : fileId;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
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

export async function generateBatch(template: string, rows: any[], format: string, pageSize = "letter", orientation = "portrait", margins?: any) {
  return apiRequest(`${API_BASE}/generate/batch`, {
    method: "POST",
    body: JSON.stringify({ template, rows, format, page_size: pageSize, orientation, margins }),
  });
}

export async function generateBatchCsv(template: string, csv: string, format: string, pageSize = "letter", orientation = "portrait", margins?: any) {
  return apiRequest(`${API_BASE}/generate/batch/csv`, {
    method: "POST",
    body: JSON.stringify({ template, csv, format, page_size: pageSize, orientation, margins }),
  });
}

export async function generateBatchJson(template: string, json: string, format: string, pageSize = "letter", orientation = "portrait", margins?: any) {
  return apiRequest(`${API_BASE}/generate/batch/json`, {
    method: "POST",
    body: JSON.stringify({ template, json, format, page_size: pageSize, orientation, margins }),
  });
}

export async function listTemplates() {
  return apiRequest(`${API_BASE}/templates`);
}

export async function templatePlaceholders(name: string) {
  return apiRequest(`${API_BASE}/templates/${encodeURIComponent(name)}/placeholders`);
}

export async function generateJobStatus(jobId: string) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
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

export async function forgotPassword(username: string) {
  return apiRequest(`${API_BASE}/auth/request-password-reset`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function fetchMe() {
  return apiRequest(`${API_BASE}/auth/me`);
}

export async function refreshToken() {
  return apiRequest(`${API_BASE}/auth/refresh`, { method: "POST" });
}

export async function logout() {
  clearToken();
  try {
    await apiRequest(`${API_BASE}/auth/logout`, { method: "POST" });
  } catch {
    // Ignore errors during logout
  }
}

export async function logoutAll() {
  clearToken();
  try {
    await apiRequest(`${API_BASE}/auth/logout-all`, { method: "POST" });
  } catch {
    // Ignore errors during logout
  }
}

/* ---- File & folder endpoints ---- */

export async function listFiles(limit = 100, userId?: string) {
  const url = userId
    ? `${API_BASE}/files?limit=${limit}&user_id=${encodeURIComponent(userId)}`
    : `${API_BASE}/files?limit=${limit}`;
  return apiRequest(url);
}

export async function getFile(fileId: string) {
  return apiRequest(`${API_BASE}/files/${encodeURIComponent(fileId)}`);
}

export async function downloadFileUrl(fileId: string) {
  return `${API_BASE}/files/${encodeURIComponent(fileId)}/download`;
}

export async function deleteFile(fileId: string) {
  return apiRequest(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

export async function listFolders() {
  return apiRequest(`${API_BASE}/folders`);
}

export async function createFolder(name: string, parentId?: string) {
  return apiRequest(`${API_BASE}/folders`, {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parentId }),
  });
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
  const outId = job.result;
  // Resolve the real extension and display name from history so result cards
  // show the correct format (e.g. .txt after a txt conversion) rather than
  // always defaulting to PDF / "result".
  try {
    const history = await listHistory(25);
    const entries: any[] = history?.history || [];
    const entry = entries.find((e: any) => e.id === outId);
    if (entry) {
      return { id: outId, ext: entry.ext, name: entry.original_name || outId };
    }
  } catch {
    // fall through to defaults below
  }
  return { id: outId, ext: "pdf", name: res.name ?? "result" };
}