"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface TenantMetric {
  id: string;
  name: string;
  slug: string;
  userCount: number;
}

interface Metrics {
  totalTenants: number;
  totalUsers: number;
  activeUsers: number;
  tenantsWithUsers: TenantMetric[];
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/system/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: "var(--text, #f4ede0)", padding: 32 }}>Carregando métricas...</div>;
  }

  if (!metrics) {
    return <div style={{ color: "var(--text, #f4ede0)", padding: 32 }}>Erro ao carregar métricas.</div>;
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(253,250,243,.04)",
    border: "1px solid rgba(217,178,104,.15)",
    borderRadius: 12,
    padding: "24px 28px",
    flex: 1,
    minWidth: 180,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--text-muted, #8a7f6a)",
    marginBottom: 8,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 32,
    fontWeight: 600,
    color: "var(--primary, #d9b268)",
    fontFamily: "Georgia, serif",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, color: "var(--primary, #d9b268)", margin: "0 0 32px" }}>
        Dashboard da Plataforma
      </h1>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 40 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Empresas</div>
          <div style={valueStyle}>{metrics.totalTenants}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Usuários totais</div>
          <div style={valueStyle}>{metrics.totalUsers}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Usuários ativos</div>
          <div style={valueStyle}>{metrics.activeUsers}</div>
        </div>
      </div>

      <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 400, color: "var(--text, #f4ede0)", margin: "0 0 16px" }}>
        Usuários por Empresa
      </h2>

      <div style={{
        background: "rgba(253,250,243,.04)",
        border: "1px solid rgba(217,178,104,.15)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(217,178,104,.1)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 13, color: "var(--text-muted, #8a7f6a)", fontWeight: 500 }}>Empresa</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 13, color: "var(--text-muted, #8a7f6a)", fontWeight: 500 }}>Slug</th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontSize: 13, color: "var(--text-muted, #8a7f6a)", fontWeight: 500 }}>Usuários</th>
            </tr>
          </thead>
          <tbody>
            {metrics.tenantsWithUsers.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid rgba(217,178,104,.06)" }}>
                <td style={{ padding: "10px 16px", fontSize: 14, color: "var(--text, #f4ede0)" }}>{t.name}</td>
                <td style={{ padding: "10px 16px", fontSize: 14, color: "var(--text-muted, #8a7f6a)" }}>{t.slug}</td>
                <td style={{ padding: "10px 16px", fontSize: 14, color: "var(--primary, #d9b268)", textAlign: "right", fontWeight: 600 }}>{t.userCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
