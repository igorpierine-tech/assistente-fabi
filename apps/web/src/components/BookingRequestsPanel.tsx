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

interface PublicUrl {
  slug: string;
  url: string;
}

type Tab = "pending" | "confirmed";

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
  const [timezone, setTimezone] = useState<string>("America/Cuiaba");
  const [publicUrl, setPublicUrl] = useState<PublicUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, setRes, urlRes] = await Promise.all([
        fetch(`${API_URL}/booking/requests`, { credentials: "include" }),
        fetch(`${API_URL}/booking/settings`, { credentials: "include" }),
        fetch(`${API_URL}/booking/public-url`, { credentials: "include" }),
      ]);
      if (!reqRes.ok || !setRes.ok || !urlRes.ok) {
        throw new Error("load");
      }
      setRequests(await reqRes.json());
      const settings = await setRes.json();
      setTimezone(settings.timezone || "America/Cuiaba");
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
    return requests.filter(
      (r) => r.status === "confirmed" || r.status === "rejected" || r.status === "canceled"
    );
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
      </div>

      {loading && <div className={styles.loading}>Carregando…</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && (
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
