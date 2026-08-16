import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL = __DEV__ ? "http://10.0.2.2:3001" : "http://localhost:3001";

let sessionCookie: string | null = null;

export async function initSession() {
  sessionCookie = await AsyncStorage.getItem("fabi_session");
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (sessionCookie) {
    h["Cookie"] = sessionCookie;
  }
  return h;
}

async function saveCookie(res: Response) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/fabi\.sid=[^;]+/);
    if (match) {
      sessionCookie = match[0];
      await AsyncStorage.setItem("fabi_session", sessionCookie);
    }
  }
}

export async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  await saveCookie(res);
  return res;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: headers(),
  });
  await saveCookie(res);
  return res;
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  return res;
}

export async function apiPut(path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function authenticateWithToken(accessToken: string) {
  const res = await apiPost("/auth/token", { accessToken });
  if (!res.ok) return null;
  return res.json();
}

export async function checkAuth() {
  try {
    const res = await apiGet("/auth/status");
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

export async function logout() {
  await apiPost("/auth/logout");
  sessionCookie = null;
  await AsyncStorage.removeItem("fabi_session");
}
