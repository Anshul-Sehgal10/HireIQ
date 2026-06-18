// USELESS FOR NOW
export function getAccessToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="));

  return cookie?.split("=")[1] ?? null;
}