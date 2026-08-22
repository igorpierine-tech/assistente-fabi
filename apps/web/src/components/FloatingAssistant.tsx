"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChatPanel } from "./ChatPanel";
import styles from "./FloatingAssistant.module.css";

interface FloatingAssistantProps {
  userId: string;
}

export function FloatingAssistant({ userId }: FloatingAssistantProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className={styles.drawer} role="dialog" aria-label="Assistente da Fabi">
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitle}>
              <span className={styles.drawerDot} />
              Assistente da Fabi
            </div>
            <button
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              type="button"
              aria-label="Fechar assistente"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className={styles.drawerBody}>
            <ChatPanel userId={userId} />
          </div>
        </div>
      )}

      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label={open ? "Fechar assistente" : "Abrir assistente da Fabi"}
        title={open ? "Fechar assistente" : "Falar com a assistente"}
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <Image
            src="/logo-icon.png"
            alt=""
            width={44}
            height={44}
            className={styles.fabLogo}
            priority
          />
        )}
        <span className={styles.fabPing} aria-hidden />
      </button>
    </>
  );
}
