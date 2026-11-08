"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch, setAuthToken, clearAuthToken, API_URL } from "./api";

export type UserRole = "admin" | "gestor" | "colaborador" | "visualizador";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  platformRole: string;
}

interface TenantOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  allowedModules: string[];
  tenantId: string | null;
  tenantSlug: string | null;
  pendingTenants: TenantOption[] | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  selectTenant: (tenantSlug: string) => Promise<string | null>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setAuthMarker(on: boolean) {
  try {
    document.cookie = on
      ? "fabi.auth=1; path=/; max-age=2592000; SameSite=Lax"
      : "fabi.auth=; path=/; max-age=0; SameSite=Lax";
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    allowedModules: [],
    tenantId: null,
    tenantSlug: null,
    pendingTenants: null,
  });

  const refreshStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/status");
      const data = await res.json();
      if (data.authenticated && data.user?.id) {
        setAuthMarker(true);
        setState({
          user: {
            id: data.user.id,
            name: data.user.name || "",
            email: data.user.email || "",
            role: data.user.role || "colaborador",
            platformRole: data.user.platformRole || "user",
          },
          isAuthenticated: true,
          loading: false,
          allowedModules: data.allowedModules || [],
          tenantId: data.tenantId || null,
          tenantSlug: data.tenantSlug || null,
          pendingTenants: data.requireTenantSelection ? data.tenants : null,
        });
      } else {
        setAuthMarker(false);
        setState(prev => ({ ...prev, isAuthenticated: false, user: null, loading: false }));
      }
    } catch {
      setAuthMarker(false);
      setState(prev => ({ ...prev, isAuthenticated: false, user: null, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Erro ao fazer login";

      if (data.token) setAuthToken(data.token);

      if (data.requireTenantSelection && data.tenants) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user: {
            id: data.user.id,
            name: data.user.name || "",
            email: data.user.email || "",
            role: data.user.role || "colaborador",
            platformRole: data.platformRole || "user",
          },
          pendingTenants: data.tenants,
        }));
        return null;
      }

      await refreshStatus();
      return null;
    } catch {
      return "Não foi possível conectar ao servidor";
    }
  }, [refreshStatus]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearAuthToken();
    setAuthMarker(false);
    setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      allowedModules: [],
      tenantId: null,
      tenantSlug: null,
      pendingTenants: null,
    });
  }, []);

  const selectTenant = useCallback(async (tenantSlug: string): Promise<string | null> => {
    try {
      const res = await apiFetch("/auth/select-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Erro ao selecionar empresa";
      await refreshStatus();
      return null;
    } catch {
      return "Erro de conexão";
    }
  }, [refreshStatus]);

  const contextValue: AuthContextValue = {
    ...state,
    login,
    logout,
    selectTenant,
    refreshStatus,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Provider = AuthContext.Provider as any;

  return (
    <Provider value={contextValue}>
      {children}
    </Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
