"use client";

import { LogoIcon } from "./Logo";
import styles from "./Header.module.css";

interface HeaderProps {
  userName: string;
  onLogout: () => void;
  activeView?: "chat" | "calendario" | "clientes";
  onChangeView?: (view: "chat" | "calendario" | "clientes") => void;
}

export function Header({ userName, onLogout, activeView = "chat", onChangeView }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <LogoIcon size={48} />
        <div>
          <h1 className={styles.title}>Raízes e Riquezas</h1>
          <p className={styles.subtitle}>Assistente da Fabi</p>
        </div>
      </div>

      {onChangeView && (
        <nav className={styles.nav}>
          <button
            className={`${styles.navTab} ${activeView === "chat" ? styles.navTabActive : ""}`}
            onClick={() => onChangeView("chat")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12v8H4l-2 2V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Assistente
          </button>
          <button
            className={`${styles.navTab} ${activeView === "calendario" ? styles.navTabActive : ""}`}
            onClick={() => onChangeView("calendario")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" />
              <line x1="5" y1="1.5" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="11" y1="1.5" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Calendário
          </button>
          <button
            className={`${styles.navTab} ${activeView === "clientes" ? styles.navTabActive : ""}`}
            onClick={() => onChangeView("clientes")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Clientes
          </button>
        </nav>
      )}

      <div className={styles.user}>
        {userName && <span className={styles.userName}>{userName}</span>}
        <button className={styles.logoutBtn} onClick={onLogout}>Sair</button>
      </div>
    </header>
  );
}
