import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config/env";

const SESSION_KEY = "assistente-fabi.session";

type AuthUser = { id: string; name: string; email?: string };
type ExchangeResponse = { token: string; user: AuthUser };

export async function exchangeLoginCode(code: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/mobile/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error("Não foi possível concluir o login");

  const data = (await response.json()) as ExchangeResponse;
  if (!data.token || !data.user?.id) throw new Error("Resposta de login inválida");
  await SecureStore.setItemAsync(SESSION_KEY, data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return data.user;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
