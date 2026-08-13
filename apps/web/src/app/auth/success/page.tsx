"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthSuccess() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const userId = searchParams.get("userId");
    const name = searchParams.get("name");

    if (userId) {
      localStorage.setItem("fabi_userId", userId);
      if (name) localStorage.setItem("fabi_userName", name);
      window.location.href = `/?userId=${userId}&name=${encodeURIComponent(name || "")}`;
    }
  }, [searchParams]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "var(--bg)",
      fontFamily: "var(--font-heading)",
      fontSize: "1.25rem",
      color: "var(--primary)",
    }}>
      Conectado com sucesso! Redirecionando...
    </div>
  );
}
