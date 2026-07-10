const DEFAULT_API_ORIGIN = "http://localhost:8000";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

export function getApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN);
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const doFetch = () =>
    fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });

  const res = await doFetch();
  if (res.status !== 401) return res;

  const refreshRes = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });
  if (!refreshRes.ok) return res; // refresh failed — surface the original 401

  return doFetch();
}