"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, user, loading, pendingTenants } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (pendingTenants) {
      router.replace("/login");
      return;
    }

    router.replace("/app");
  }, [loading, isAuthenticated, user, pendingTenants, router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)" }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "var(--primary)" }}>
        Carregando...
      </div>
    </div>
  );
}
