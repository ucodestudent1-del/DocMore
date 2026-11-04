export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function headers(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const userId = typeof localStorage !== "undefined" ? localStorage.getItem("ed_user_id") : null;
  if (userId) h["X-User-Id"] = userId;
  return h;
}

export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...headers(opts.headers as Record<string, string>), ...(opts.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function setUserId(id: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem("ed_user_id", id);
}

export function getUserId() {
  if (typeof localStorage !== "undefined") return localStorage.getItem("ed_user_id");
  return null;
}

export async function downloadFile(path: string, filename?: string) {
  const userId = typeof localStorage !== "undefined" ? localStorage.getItem("ed_user_id") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: userId ? { "X-User-Id": userId } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Download failed ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

