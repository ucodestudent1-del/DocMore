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

/* ---- Rental property analysis ---- */

export async function runAnalysis(payload: {
  purchase_price: number;
  rental_income: number;
  down_payment: number;
  loan_term_years: number;
  interest_rate: number;
  property_tax_annual: number;
  insurance_annual: number;
  misc_opex_annual: number;
}) {
  return apiRequest(`${API_BASE}/analyze`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAnalyses() {
  return apiRequest(`${API_BASE}/analyses`);
}

/* ---- Auth helpers ---- */

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

export async function registerUser(username: string, email: string, password: string) {
  return apiRequest(`${API_BASE}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
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
