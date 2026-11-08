"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";
import { TenantSelector } from "@/components/TenantSelector";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user, loading, pendingTenants, login, selectTenant } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated && !pendingTenants) {
      const dest = user?.platformRole === "super_admin" ? "/admin" : "/app";
      router.replace(dest);
    }
  }, [loading, isAuthenticated, pendingTenants, user, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "var(--primary)" }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (isAuthenticated && pendingTenants) {
    return (
      <TenantSelector
        userName={user?.name || ""}
        tenants={pendingTenants}
        onSelect={async (slug) => {
          const err = await selectTenant(slug);
          if (err) alert(err);
        }}
        loading={false}
      />
    );
  }

  return (
    <LoginScreen
      onPasswordLogin={login}
      onAdminLogin={async (email, password) => {
        const err = await login(email, password);
        return err;
      }}
    />
  );
}
