"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.platformRole !== "super_admin") {
      router.replace("/app");
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !isAuthenticated || user?.platformRole !== "super_admin") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "var(--primary)" }}>Carregando...</div>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/empresas", label: "Empresas", icon: "🏢" },
    { href: "/admin/planos", label: "Planos", icon: "📦" },
    { href: "/admin/assinaturas", label: "Assinaturas", icon: "📋" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg, #12160f)" }}>
      <aside style={{
        width: 240,
        background: "rgba(253,250,243,.04)",
        borderRight: "1px solid rgba(217,178,104,.15)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
      }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(217,178,104,.1)" }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 400, color: "var(--primary, #d9b268)", margin: 0 }}>
            Super Admin
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted, #8a7f6a)", margin: "4px 0 0" }}>{user.name}</p>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navItems.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 14,
                  color: active ? "var(--primary, #d9b268)" : "var(--text, #f4ede0)",
                  background: active ? "rgba(217,178,104,.1)" : "transparent",
                  marginBottom: 4,
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(217,178,104,.1)" }}>
          <Link
            href="/app"
            style={{
              display: "block",
              fontSize: 13,
              color: "var(--text-muted, #8a7f6a)",
              textDecoration: "none",
              marginBottom: 12,
            }}
          >
            ← Voltar ao painel
          </Link>
          <button
            onClick={handleLogout}
            type="button"
            style={{
              background: "none",
              border: "1px solid rgba(217,178,104,.2)",
              color: "var(--text, #f4ede0)",
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              width: "100%",
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
