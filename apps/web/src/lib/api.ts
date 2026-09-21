const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const AUTH_TOKEN_KEY = "fabi_auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_URL}${path}`;
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });
}

export async function exchangeAuthCode(code: string): Promise<{ token: string; user: { id: string; name: string; email?: string } } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/mobile/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export { API_URL };
