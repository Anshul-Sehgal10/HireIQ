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

function forceLoginRedirect() {
  if (typeof window === "undefined") return;
  // Avoid a redirect loop if we're already on a public auth page.
  if (window.location.pathname.startsWith("/auth/")) return;
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
  window.location.href = "/auth/login";
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const doFetch = () =>
    fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });

  const res = await doFetch();
  if (res.status !== 401) return res;

  const refreshRes = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (!refreshRes.ok) {
    // Session is genuinely dead — don't let callers render a 401 body as
    // if it were valid data. Force a full redirect instead.
    forceLoginRedirect();
    return res;
  }

  return doFetch();
}