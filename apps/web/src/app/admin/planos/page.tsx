"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface SystemModule {
  id: string;
  label: string;
  description: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  modules: string[];
  max_users: number | null;
  price_cents: number;
  active: number;
}

export default function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plansRes, modsRes] = await Promise.all([
        apiFetch("/system/plans"),
        apiFetch("/system/modules"),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (modsRes.ok) setModules(await modsRes.json());
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: "var(--text, #f4ede0)" }}>Carregando planos...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, color: "var(--primary, #d9b268)", margin: 0 }}>
          Planos
        </h1>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
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
          + Novo Plano
        </button>
      </div>

      {(creating || editing) && (
        <PlanForm
          plan={editing}
          modules={modules}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {plans.map(plan => (
          <div key={plan.id} style={{
            background: "rgba(253,250,243,.04)",
            border: "1px solid rgba(217,178,104,.15)",
            borderRadius: 12,
            padding: 24,
            minWidth: 260,
            flex: 1,
            opacity: plan.active ? 1 : 0.5,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--primary, #d9b268)", fontFamily: "Georgia, serif", fontWeight: 400 }}>{plan.name}</h3>
                <span style={{ fontSize: 12, color: "var(--text-muted, #8a7f6a)" }}>{plan.slug}</span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 600, color: "var(--text, #f4ede0)" }}>
                {plan.price_cents === 0 ? "Grátis" : `R$ ${(plan.price_cents / 100).toFixed(2)}`}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 8 }}>
              {plan.max_users ? `Até ${plan.max_users} usuários` : "Usuários ilimitados"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text, #f4ede0)", marginBottom: 16 }}>
              <strong>Módulos:</strong>{" "}
              {plan.modules.map(m => modules.find(sm => sm.id === m)?.label || m).join(", ")}
            </div>
            <button
              onClick={() => { setEditing(plan); setCreating(false); }}
              style={{
                background: "none",
                border: "1px solid rgba(217,178,104,.2)",
                color: "var(--text, #f4ede0)",
                padding: "6px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanForm({ plan, modules, onClose, onSaved }: {
  plan: Plan | null;
  modules: SystemModule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name || "");
  const [slug, setSlug] = useState(plan?.slug || "");
  const [selectedModules, setSelectedModules] = useState<string[]>(plan?.modules || []);
  const [maxUsers, setMaxUsers] = useState(plan?.max_users?.toString() || "");
  const [priceCents, setPriceCents] = useState(plan ? (plan.price_cents / 100).toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleModule(id: string) {
    setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!name || !slug) { setError("Nome e slug são obrigatórios"); return; }
    setSaving(true);
    setError("");
    const body = {
      name,
      slug,
      modules: selectedModules,
      maxUsers: maxUsers ? parseInt(maxUsers) : null,
      priceCents: priceCents ? Math.round(parseFloat(priceCents) * 100) : 0,
    };
    const res = plan
      ? await apiFetch(`/system/plans/${plan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await apiFetch("/system/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erro ao salvar");
    }
    setSaving(false);
  }

  const formField: React.CSSProperties = { marginBottom: 16 };
  const label: React.CSSProperties = { display: "block", fontSize: 13, color: "var(--text-muted, #8a7f6a)", marginBottom: 4 };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(253,250,243,.06)",
    border: "1px solid rgba(217,178,104,.2)",
    borderRadius: 8,
    color: "var(--text, #f4ede0)",
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background: "rgba(253,250,243,.06)",
      border: "1px solid rgba(217,178,104,.2)",
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text, #f4ede0)" }}>
        {plan ? "Editar Plano" : "Novo Plano"}
      </h3>

      {error && <div style={{ color: "#e87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={formField}>
          <span style={label}>Nome</span>
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Professional" />
        </div>
        <div style={formField}>
          <span style={label}>Slug</span>
          <input style={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="ex: professional" />
        </div>
        <div style={formField}>
          <span style={label}>Preço (R$)</span>
          <input style={input} type="number" step="0.01" value={priceCents} onChange={e => setPriceCents(e.target.value)} placeholder="99.00" />
        </div>
        <div style={formField}>
          <span style={label}>Máx. usuários (vazio = ilimitado)</span>
          <input style={input} type="number" value={maxUsers} onChange={e => setMaxUsers(e.target.value)} placeholder="10" />
        </div>
      </div>

      <div style={formField}>
        <span style={label}>Módulos</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {modules.filter(m => m.id !== "admin").map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleModule(m.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid rgba(217,178,104,.3)",
                background: selectedModules.includes(m.id) ? "rgba(217,178,104,.2)" : "transparent",
                color: selectedModules.includes(m.id) ? "var(--primary, #d9b268)" : "var(--text-muted, #8a7f6a)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "var(--primary, #d9b268)",
            color: "#12160f",
            border: "none",
            padding: "8px 24px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid rgba(217,178,104,.2)",
            color: "var(--text, #f4ede0)",
            padding: "8px 24px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
