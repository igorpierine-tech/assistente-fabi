"use client";

import { useEffect } from "react";

export default function AuthSuccessContent() {
  useEffect(() => {
    window.location.replace("/?authenticated=1");
  }, []);

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
