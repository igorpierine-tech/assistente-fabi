"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar, type View } from "@/components/Sidebar";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { TenantContext, DEFAULT_TENANT_CONFIG, type TenantConfig } from "@/lib/tenant-context";
import { apiFetch } from "@/lib/api";

const PATH_TO_VIEW: Record<string, View> = {
  "/app": "inicio",
  "/app/agenda": "agenda",
  "/app/assistente": "assistente",
  "/app/clientes": "clientes",
  "/app/agendamentos": "agendamentos",
  "/app/vendas": "vendas",
  "/app/contratos": "contratos",
  "/app/financeiro": "financeiro",
  "/app/usuarios": "usuarios",
  "/app/empresa": "empresa",
  "/app/produtos": "produtos",
  "/app/configuracoes": "configuracoes",
  "/app/dashboards": "dashboards",
};

const VIEW_TO_PATH: Record<View, string> = {
  inicio: "/app",
  agenda: "/app/agenda",
  assistente: "/app/assistente",
  clientes: "/app/clientes",
  agendamentos: "/app/agendamentos",
  vendas: "/app/vendas",
  contratos: "/app/contratos",
  financeiro: "/app/financeiro",
  usuarios: "/app/usuarios",
  empresa: "/app/empresa",
  produtos: "/app/produtos",
  configuracoes: "/app/configuracoes",
  dashboards: "/app/dashboards",
  admin: "/admin",
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const CSS_DEFAULTS = {
  primary: "#1a2e18",
  secondary: "#b8873a",
  accent: "#d9b268",
  heading: "'Instrument Serif', serif",
  body: "'Geist', system-ui, sans-serif",
};

function applyBranding(config: TenantConfig) {
  const root = document.documentElement;
  const { colors, fonts } = config;

  if (colors.primary && colors.primary.toLowerCase() !== CSS_DEFAULTS.primary) {
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--primary-light", colors.primary + "cc");
    root.style.setProperty("--text", colors.primary);
    root.style.setProperty("--surface-dark", colors.primary);
  }
  if (colors.secondary && colors.secondary.toLowerCase() !== CSS_DEFAULTS.secondary) {
    root.style.setProperty("--secondary", colors.secondary);
    root.style.setProperty("--secondary-light", `rgba(${hexToRgb(colors.secondary)}, 0.15)`);
    root.style.setProperty("--gold", colors.secondary);
    root.style.setProperty("--gold-light", colors.secondary + "dd");
  }
  if (colors.accent && colors.accent.toLowerCase() !== CSS_DEFAULTS.accent) {
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-light", colors.accent + "dd");
  }
  if (fonts.heading && fonts.heading !== CSS_DEFAULTS.heading) {
    root.style.setProperty("--font-heading", fonts.heading);
  }
  if (fonts.body && fonts.body !== CSS_DEFAULTS.body) {
    root.style.setProperty("--font-body", fonts.body);
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading, allowedModules, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);

  const activeView: View = PATH_TO_VIEW[pathname] || "inicio";

  const fetchTenantConfig = useCallback(async () => {
    try {
      const res = await apiFetch("/tenant/config");
      if (res.ok) {
        const config: TenantConfig = await res.json();
        setTenantConfig(config);
        applyBranding(config);
      }
    } catch { /* silent */ }
  }, []);

  const fetchBookingCount = useCallback(async () => {
    try {
      const res = await apiFetch("/booking/requests/pending-count");
      if (res.ok) {
        const data = await res.json();
        setPendingBookingCount(data.count ?? 0);
      }
    } catch { /* silent */ }
  }, []);

  const fetchClientCount = useCallback(async () => {
    try {
      const res = await apiFetch("/clients");
      if (res.ok) {
        const rows = await res.json();
        setClientCount(Array.isArray(rows) ? rows.length : 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isAuthenticated) {
      fetchTenantConfig();
      fetchBookingCount();
      fetchClientCount();
    }
  }, [loading, isAuthenticated, user, pathname, router, fetchTenantConfig, fetchBookingCount, fetchClientCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchBookingCount, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchBookingCount]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "var(--primary)" }}>Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (tenantConfig && !tenantConfig.onboardingCompleted) {
    return (
      <OnboardingWizard
        userName={user?.name || ""}
        onComplete={() => fetchTenantConfig()}
      />
    );
  }

  function handleChangeView(view: View) {
    const path = VIEW_TO_PATH[view];
    if (path) router.push(path);
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <TenantContext value={tenantConfig || DEFAULT_TENANT_CONFIG}>
      <div className="app-layout">
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="mobile-header-brand">{tenantConfig?.businessName || "Assistente"}</span>
        </div>
        <Sidebar
          activeView={activeView}
          onChangeView={handleChangeView}
          userName={user?.name || ""}
          userRole={user?.role}
          clientCount={clientCount}
          pendingBookingCount={pendingBookingCount}
          onLogout={handleLogout}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          allowedModules={allowedModules.length > 0 ? allowedModules : undefined}
        />
        <main className="app-main">
          {children}
        </main>
        {user && activeView !== "assistente" && (
          <FloatingAssistant userId={user.id} />
        )}
      </div>
    </TenantContext>
  );
}
