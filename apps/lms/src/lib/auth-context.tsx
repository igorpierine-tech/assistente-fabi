"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, ApiError } from "./api";

interface User {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantSlug: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  signup: (data: { email: string; password: string; firstName: string; lastName: string; orgName?: string; lgpdConsent: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKENS_KEY = "lms_tokens";
const USER_KEY = "lms_user";

function loadStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedTokens = loadStored<AuthTokens>(TOKENS_KEY);
    const storedUser = loadStored<User>(USER_KEY);
    if (storedTokens && storedUser) {
      setTokens(storedTokens);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const persistAuth = useCallback((u: User, t: AuthTokens) => {
    setUser(u);
    setTokens(t);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem(TOKENS_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(async (email: string, password: string, tenantSlug: string) => {
    const result = await api<{ tokens: AuthTokens; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password, tenantSlug },
    });
    persistAuth(result.user, result.tokens);
  }, [persistAuth]);

  const signup = useCallback(async (data: { email: string; password: string; firstName: string; lastName: string; orgName?: string; lgpdConsent: boolean }) => {
    const result = await api<{ tokens: AuthTokens; user: User }>("/auth/signup", {
      method: "POST",
      body: data,
    });
    persistAuth(result.user, result.tokens);
  }, [persistAuth]);

  const refreshAuth = useCallback(async (): Promise<string | null> => {
    if (!tokens?.refreshToken) return null;
    try {
      const result = await api<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
      });
      const newTokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
      setTokens(newTokens);
      localStorage.setItem(TOKENS_KEY, JSON.stringify(newTokens));
      return newTokens.accessToken;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
      }
      return null;
    }
  }, [tokens, clearAuth]);

  const logout = useCallback(async () => {
    if (tokens?.refreshToken) {
      try {
        await api("/auth/logout", {
          method: "POST",
          body: { refreshToken: tokens.refreshToken },
          token: tokens.accessToken,
        });
      } catch {
        // best-effort
      }
    }
    clearAuth();
  }, [tokens, clearAuth]);

  return (
    <AuthContext.Provider value={{ user, tokens, loading, login, signup, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
