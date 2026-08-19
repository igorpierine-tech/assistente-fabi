"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./BookingRequestsPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BookingRequest {
  id: string;
  session_type_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_notes: string | null;
  requested_start: string;
  requested_end: string;
  status: "pending" | "confirmed" | "rejected" | "canceled";
  responded_reason: string | null;
  created_at: string;
}

interface Settings {
  slug: string;
  title: string;
  intro: string | null;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
}

interface SessionType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  active: number;
}

interface PublicUrl {
  slug: string;
  url: string;
}

type Tab = "pending" | "confirmed" | "settings";

function formatWhen(iso: string, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

export function BookingRequestsPanel() {
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [types, setTypes] = useState<SessionType[]>([]);
  const [publicUrl, setPublicUrl] = useState<PublicUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newType, setNewType] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
  });

  const timezone = settings?.timezone || "America/Cuiaba";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, setRes, typRes, urlRes] = await Promise.all([
        fetch(`${API_URL}/booking/requests`, { credentials: "include" }),
        fetch(`${API_URL}/booking/settings`, { credentials: "include" }),
        fetch(`${API_URL}/booking/types`, { credentials: "include" }),
        fetch(`${API_URL}/booking/public-url`, { credentials: "include" }),
      ]);
      if (!reqRes.ok || !setRes.ok || !typRes.ok || !urlRes.ok) {
        throw new Error("load");
      }
      setRequests(await reqRes.json());
      setSettings(await setRes.json());
      setTypes(await typRes.json());
      setPublicUrl(await urlRes.json());
      setError(null);
    } catch {
      setError("Não foi possível carregar. Verifique se você está logado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (tab === "pending") return requests.filter((r) => r.status === "pending");
    if (tab === "confirmed")
      return requests.filter(
        (r) => r.status === "confirmed" || r.status === "rejected" || r.status === "canceled"
      );
    return [];
  }, [requests, tab]);

  async function handleConfirm(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/booking/requests/${id}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao confirmar");
      } else {
        await fetchAll();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Motivo para o cliente (opcional):", "") ?? undefined;
    setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/booking/requests/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao recusar");
      } else {
        await fetchAll();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    const res = await fetch(`${API_URL}/booking/settings`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Falha ao salvar");
      return;
    }
    await fetchAll();
  }

  async function addType() {
    if (!newType.name.trim()) return;
    const res = await fetch(`${API_URL}/booking/types`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newType),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Falha ao criar tipo");
      return;
    }
    setNewType({ name: "", description: "", durationMinutes: 60 });
    await fetchAll();
  }

  async function toggleType(t: SessionType) {
    await fetch(`${API_URL}/booking/types/${t.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    await fetchAll();
  }

  async function removeType(t: SessionType) {
    if (!confirm(`Remover "${t.name}"?`)) return;
    await fetch(`${API_URL}/booking/types/${t.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await fetchAll();
  }

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Agendamento público</div>
          <h1 className={styles.title}>Solicitações de clientes</h1>
        </div>
        {publicUrl && (
          <div className={styles.linkBox}>
            <div className={styles.linkLabel}>Sua página pública</div>
            <div className={styles.linkRow}>
              <code className={styles.linkText}>{publicUrl.url}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={copyLink}
              >
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`${styles.tab} ${tab === "pending" ? styles.tabActive : ""}`}
        >
          Pendentes
          {pendingCount > 0 && (
            <span className={styles.badge}>{pendingCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("confirmed")}
          className={`${styles.tab} ${tab === "confirmed" ? styles.tabActive : ""}`}
        >
          Histórico
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`${styles.tab} ${tab === "settings" ? styles.tabActive : ""}`}
        >
          Configurações
        </button>
      </div>

      {loading && <div className={styles.loading}>Carregando…</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && tab !== "settings" && (
        <div className={styles.list}>
          {filtered.length === 0 && (
            <div className={styles.empty}>
              {tab === "pending"
                ? "Nenhuma solicitação pendente."
                : "Sem histórico ainda."}
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardName}>{r.client_name}</div>
                  <div className={styles.cardMeta}>
                    {r.session_type_name} · {formatWhen(r.requested_start, timezone)}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.contactRow}>
                  <a href={`mailto:${r.client_email}`}>{r.client_email}</a>
                  {r.client_phone && (
                    <>
                      <span>·</span>
                      <a
                        href={`https://wa.me/${r.client_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.client_phone}
                      </a>
                    </>
                  )}
                </div>
                {r.client_notes && (
                  <div className={styles.notes}>{r.client_notes}</div>
                )}
                {r.responded_reason && (
                  <div className={styles.notes}>Motivo: {r.responded_reason}</div>
                )}
              </div>
              {r.status === "pending" && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    onClick={() => handleReject(r.id)}
                    disabled={busyId === r.id}
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={() => handleConfirm(r.id)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? "Confirmando…" : "Confirmar e criar evento"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === "settings" && settings && (
        <SettingsForm
          settings={settings}
          types={types}
          newType={newType}
          onNewTypeChange={setNewType}
          onAddType={addType}
          onToggleType={toggleType}
          onRemoveType={removeType}
          onSave={saveSettings}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: BookingRequest["status"] }) {
  const map = {
    pending: { label: "Pendente", cls: styles.pillPending },
    confirmed: { label: "Confirmado", cls: styles.pillConfirmed },
    rejected: { label: "Recusado", cls: styles.pillRejected },
    canceled: { label: "Cancelado", cls: styles.pillCanceled },
  } as const;
  const info = map[status];
  return <span className={`${styles.pill} ${info.cls}`}>{info.label}</span>;
}

function SettingsForm({
  settings,
  types,
  newType,
  onNewTypeChange,
  onAddType,
  onToggleType,
  onRemoveType,
  onSave,
}: {
  settings: Settings;
  types: SessionType[];
  newType: { name: string; description: string; durationMinutes: number };
  onNewTypeChange: (v: {
    name: string;
    description: string;
    durationMinutes: number;
  }) => void;
  onAddType: () => void;
  onToggleType: (t: SessionType) => void;
  onRemoveType: (t: SessionType) => void;
  onSave: (patch: Partial<Settings>) => void;
}) {
  const [local, setLocal] = useState<Settings>(settings);
  useEffect(() => setLocal(settings), [settings]);

  function submit() {
    onSave({
      slug: local.slug,
      title: local.title,
      intro: local.intro,
      buffer_minutes: local.buffer_minutes,
      max_advance_days: local.max_advance_days,
      min_notice_hours: local.min_notice_hours,
    });
  }

  return (
    <div className={styles.settingsGrid}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Página pública</h2>
        <label className={styles.field}>
          <span>Endereço (slug)</span>
          <input
            type="text"
            value={local.slug}
            onChange={(e) => setLocal({ ...local, slug: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Título</span>
          <input
            type="text"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Texto de boas-vindas</span>
          <textarea
            rows={3}
            value={local.intro ?? ""}
            onChange={(e) => setLocal({ ...local, intro: e.target.value })}
          />
        </label>
        <div className={styles.row3}>
          <label className={styles.field}>
            <span>Antecedência mínima (h)</span>
            <input
              type="number"
              min={0}
              max={168}
              value={local.min_notice_hours}
              onChange={(e) =>
                setLocal({ ...local, min_notice_hours: Number(e.target.value) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Janela máxima (dias)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={local.max_advance_days}
              onChange={(e) =>
                setLocal({ ...local, max_advance_days: Number(e.target.value) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Intervalo entre sessões (min)</span>
            <input
              type="number"
              min={0}
              max={180}
              value={local.buffer_minutes}
              onChange={(e) =>
                setLocal({ ...local, buffer_minutes: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <button type="button" className={styles.saveBtn} onClick={submit}>
          Salvar
        </button>
      </div>

      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Tipos de sessão</h2>
        {types.length === 0 && (
          <div className={styles.empty}>
            Nenhum tipo cadastrado ainda. Adicione ao lado para começar.
          </div>
        )}
        <div className={styles.typeList}>
          {types.map((t) => (
            <div key={t.id} className={styles.typeRow}>
              <div>
                <div className={styles.typeName}>
                  {t.name}
                  {!t.active && (
                    <span className={styles.typeInactive}>inativo</span>
                  )}
                </div>
                <div className={styles.typeMeta}>
                  {t.duration_minutes} min · /{t.slug}
                </div>
              </div>
              <div className={styles.typeActions}>
                <button type="button" onClick={() => onToggleType(t)}>
                  {t.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className={styles.typeDelete}
                  onClick={() => onRemoveType(t)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.newType}>
          <div className={styles.newTypeTitle}>Novo tipo</div>
          <input
            type="text"
            placeholder="Nome (ex: Consultoria financeira)"
            value={newType.name}
            onChange={(e) =>
              onNewTypeChange({ ...newType, name: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Descrição breve (opcional)"
            value={newType.description}
            onChange={(e) =>
              onNewTypeChange({ ...newType, description: e.target.value })
            }
          />
          <label className={styles.field}>
            <span>Duração (min)</span>
            <input
              type="number"
              min={15}
              max={600}
              value={newType.durationMinutes}
              onChange={(e) =>
                onNewTypeChange({
                  ...newType,
                  durationMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <button type="button" className={styles.saveBtn} onClick={onAddType}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
