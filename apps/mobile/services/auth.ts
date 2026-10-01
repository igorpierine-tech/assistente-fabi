import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config/env";

const SESSION_KEY = "assistente-fabi.session";
const USER_KEY = "assistente-fabi.user";

export type AuthUser = { id: string; name: string; email?: string; role?: string };
type ExchangeResponse = { token: string; user: AuthUser };

async function storeSession(data: ExchangeResponse): Promise<AuthUser> {
  if (!data.token || !data.user?.id) throw new Error("Resposta de login inválida");
  await SecureStore.setItemAsync(SESSION_KEY, data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "E-mail ou senha incorretos");
  }
  return storeSession(await response.json());
}

export async function exchangeLoginCode(code: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/mobile/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error("Não foi possível concluir o login");
  return storeSession(await response.json());
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(SESSION_KEY));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
