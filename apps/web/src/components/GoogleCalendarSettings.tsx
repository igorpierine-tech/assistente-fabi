"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./GoogleCalendarSettings.module.css";

export function GoogleCalendarSettings() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/google-calendar/status");
      const data = await res.json();
      setConnected(data.connected);
      setEmail(data.email);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await apiFetch("/auth/google-calendar/disconnect", { method: "POST" });
      setConnected(false);
      setEmail(null);
    } catch {
      // ignore
    }
    setDisconnecting(false);
  }

  async function handleConnect() {
    try {
      const res = await apiFetch("/auth/google-calendar");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // ignore
    }
  }

  if (loading) return <div className={styles.wrap}><p className={styles.loading}>Carregando...</p></div>;

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Google Calendar</h3>
      <p className={styles.desc}>
        Conecte sua conta Google para sincronizar agendamentos com o Google Calendar.
      </p>

      {connected ? (
        <div className={styles.statusRow}>
          <div className={styles.connectedBadge}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="10" fill="#34A853" />
              <path d="M6 10.5L8.5 13L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Conectado</span>
            {email && <span className={styles.email}>({email})</span>}
          </div>
          <button
            type="button"
            className={styles.disconnectBtn}
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.connectBtn} onClick={handleConnect}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.33Z" fill="#4285F4" />
            <path d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H1.07v2.6A9.99 9.99 0 0 0 10 20Z" fill="#34A853" />
            <path d="M4.42 11.9a6.02 6.02 0 0 1 0-3.8V5.5H1.07a9.99 9.99 0 0 0 0 9l3.35-2.6Z" fill="#FBBC05" />
            <path d="M10 3.98a5.42 5.42 0 0 1 3.84 1.5l2.88-2.87A9.64 9.64 0 0 0 10 0 9.99 9.99 0 0 0 1.07 5.5l3.35 2.6C5.2 5.74 7.4 3.98 10 3.98Z" fill="#EA4335" />
          </svg>
          Conectar Google Calendar
        </button>
      )}
    </div>
  );
}
