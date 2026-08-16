"use client";

import dynamic from "next/dynamic";

const AuthSuccessContent = dynamic(() => import("./AuthSuccessContent"), {
  ssr: false,
  loading: () => (
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
      Carregando...
    </div>
  ),
});

export default function AuthSuccess() {
  return <AuthSuccessContent />;
}
