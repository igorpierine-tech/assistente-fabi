"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  slug: string;
  modules: string[];
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  started_at: string;
  blocked_at: string | null;
  blocked_reason: string | null;
  cancelled_at: string | null;
  tenantName: string;
  planName: string;
}

const STATUS_LABELS: Record<string, string> = {
  trial: "Trial",
  ativo: "Ativo",
  bloqueado: "Bloqueado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  trial: "#d9b268",
  ativo: "#6bcf7f",
  bloqueado: "#e87171",
  cancelado: "#8a7f6a",
};

export default function AssinaturasPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  const load = useCallback(async () => {
    try {
      const [subsRes, plansRes, tenantsRes] = await Promise.all([
        apiFetch("/system/subscriptions"),
        apiFetch("/system/plans"),
        apiFetch("/system/tenants"),
      ]);
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (plansRes.ok) setPlans((await plansRes.json()).map((p: Plan & { modules: string[] }) => p));
      if (tenantsRes.ok) setTenants(await tenantsRes.json());
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tenantsWithoutSub = tenants.filter(t => !subscriptions.some(s => s.tenant_id === t.id));

  if (loading) return <div style={{ color: "var(--text, #f4ede0)" }}>Carregando assinaturas...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, color: "var(--primary, #d9b268)", margin: 0 }}>
          Assinaturas
        </h1>
        {tenantsWithoutSub.length > 0 && (
          <button
            onClick={() => { setCreating(true); setEditingSub(null); }}
            style={{
              background: "var(--primary, #d9b268)",
              color: "#12160f",
              border: "none",
              padding: "8px 20px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            + Nova Assinatura
          </button>
        )}
      </div>

      {creating && (
        <CreateSubForm
          tenants={tenantsWithoutSub}
          plans={plans}
          onClose={() => setCreating(false)}
          onSaved={load}
        />
      )}

      {editingSub && (
        <EditSubForm
          sub={editingSub}
          plans={plans}
          onClose={() => setEditingSub(null)}
          onSaved={load}
        />
      )}

      <div style={{
        background: "rgba(253,250,243,.04)",
        border: "1px solid rgba(217,178,104,.15)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(217,178,104,.1)" }}>
              <th style={thStyle}>Empresa</th>
              <th style={thStyle}>Plano</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Início</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--text-muted, #8a7f6a)", fontSize: 14 }}>
                  Nenhuma assinatura encontrada. Crie uma para vincular um plano a uma empresa.
                </td>
              </tr>
            )}
            {subscriptions.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid rgba(217,178,104,.06)" }}>
                <td style={tdStyle}>{s.tenantName}</td>
                <td style={tdStyle}>{s.planName}</td>
                <td style={tdStyle}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: `${STATUS_COLORS[s.status] || "#8a7f6a"}22`,
                    color: STATUS_COLORS[s.status] || "#8a7f6a",
                  }}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  {s.blocked_reason && (
                    <span style={{ display: "block", fontSize: 11, color: "#e87171", marginTop: 2 }}>{s.blocked_reason}</span>
                  )}
                </td>
                <td style={tdStyle}>{new Date(s.started_at).toLocaleDateString("pt-BR")}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <button
                    onClick={() => { setEditingSub(s); setCreating(false); }}
                    style={{
                      background: "none",
                      border: "1px solid rgba(217,178,104,.2)",
                      color: "var(--text, #f4ede0)",
                      padding: "4px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Gerenciar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 13, color: "var(--text-muted, #8a7f6a)", fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 14, color: "var(--text, #f4ede0)" };

function CreateSubForm({ tenants, plans, onClose, onSaved }: {
  tenants: Tenant[];
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [status, setStatus] = useState("trial");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    const res = await apiFetch("/system/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, planId, status }),
    });
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Erro"); }
    setSaving(false);
  }

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(253,250,243,.06)",
    border: "1px solid rgba(217,178,104,.2)",
    borderRadius: 8,
    color: "var(--text, #f4ede0)",
    fontSize: 14,
  };

  return (
    <div style={{ background: "rgba(253,250,243,.06)", border: "1px solid rgba(217,178,104,.2)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text, #f4ede0)" }}>Nova Assinatura</h3>
      {error && <div style={{ color: "#e87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Empresa</span>
          <select style={selectStyle} value={tenantId} onChange={e => setTenantId(e.target.value)}>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Plano</span>
          <select style={selectStyle} value={planId} onChange={e => setPlanId(e.target.value)}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Status</span>
          <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="trial">Trial</option>
            <option value="ativo">Ativo</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{ background: "var(--primary, #d9b268)", color: "#12160f", border: "none", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          {saving ? "Salvando..." : "Criar"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(217,178,104,.2)", color: "var(--text, #f4ede0)", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function EditSubForm({ sub, plans, onClose, onSaved }: {
  sub: Subscription;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(sub.plan_id);
  const [status, setStatus] = useState(sub.status);
  const [blockedReason, setBlockedReason] = useState(sub.blocked_reason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    const body: Record<string, string | undefined> = {};
    if (planId !== sub.plan_id) body.planId = planId;
    if (status !== sub.status) body.status = status;
    if (status === "bloqueado" && blockedReason) body.blockedReason = blockedReason;
    const res = await apiFetch(`/system/subscriptions/${sub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Erro"); }
    setSaving(false);
  }

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(253,250,243,.06)",
    border: "1px solid rgba(217,178,104,.2)",
    borderRadius: 8,
    color: "var(--text, #f4ede0)",
    fontSize: 14,
  };

  return (
    <div style={{ background: "rgba(253,250,243,.06)", border: "1px solid rgba(217,178,104,.2)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text, #f4ede0)" }}>
        Gerenciar — {sub.tenantName}
      </h3>
      {error && <div style={{ color: "#e87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Plano</span>
          <select style={selectStyle} value={planId} onChange={e => setPlanId(e.target.value)}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Status</span>
          <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="trial">Trial</option>
            <option value="ativo">Ativo</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      {status === "bloqueado" && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 }}>Motivo do bloqueio</span>
          <input
            style={{ ...selectStyle }}
            value={blockedReason}
            onChange={e => setBlockedReason(e.target.value)}
            placeholder="Ex: Inadimplência"
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{ background: "var(--primary, #d9b268)", color: "#12160f", border: "none", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(217,178,104,.2)", color: "var(--text, #f4ede0)", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
