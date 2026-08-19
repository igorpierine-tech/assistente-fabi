"use client";

import styles from "./Sidebar.module.css";

export type View = "inicio" | "agenda" | "assistente" | "clientes" | "financeiro" | "configuracoes";

interface SidebarProps {
  activeView: View;
  onChangeView: (view: View) => void;
  userName: string;
  clientCount: number;
  isDemo?: boolean;
}

const BRAND_NAME = "Raízes e Riquezas";

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: "inicio", label: "Início", icon: "home" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "assistente", label: "Assistente IA", icon: "sparkle" },
  { id: "clientes", label: "Clientes", icon: "people" },
  { id: "financeiro", label: "Financeiro", icon: "dollar" },
  { id: "configuracoes", label: "Configurações", icon: "gear" },
];

function NavIcon({ name }: { name: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6 };

  switch (name) {
    case "home":
      return (
        <svg {...props} strokeLinejoin="round">
          <path d="M3 10l7-7 7 7M5 8v8a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <line x1="3" y1="9" x2="17" y2="9" />
          <line x1="7" y1="2" x2="7" y2="5" strokeLinecap="round" />
          <line x1="13" y1="2" x2="13" y2="5" strokeLinecap="round" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" />
          <path d="M15 13l.75 2.25L18 16l-2.25.75L15 19l-.75-2.25L12 16l2.25-.75L15 13z" />
        </svg>
      );
    case "people":
      return (
        <svg {...props} strokeLinecap="round">
          <circle cx="10" cy="6" r="3" />
          <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      );
    case "dollar":
      return (
        <svg {...props} strokeLinecap="round">
          <line x1="10" y1="2" x2="10" y2="18" />
          <path d="M6 6c0-1.1 1.8-2 4-2s4 .9 4 2-1.8 2-4 2-4 .9-4 2 1.8 2 4 2 4 .9 4 2" />
        </svg>
      );
    case "gear":
      return (
        <svg {...props} strokeLinejoin="round">
          <circle cx="10" cy="10" r="3" />
          <path d="M10 1.5l1.3 2.3 2.6.4-1.9 1.8.5 2.6L10 7.4 7.5 8.6l.5-2.6L6.1 4.2l2.6-.4L10 1.5zM10 18.5l-1.3-2.3-2.6-.4 1.9-1.8-.5-2.6L10 12.6l2.5-1.2-.5 2.6 1.9 1.8-2.6.4L10 18.5zM1.5 10l2.3-1.3.4-2.6 1.8 1.9 2.6-.5L7.4 10l1.2 2.5-2.6-.5-1.8 1.9-.4-2.6L1.5 10zM18.5 10l-2.3 1.3-.4 2.6-1.8-1.9-2.6.5L12.6 10l-1.2-2.5 2.6.5 1.8-1.9.4 2.6L18.5 10z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar({ activeView, onChangeView, userName, clientCount, isDemo }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.avatar}>
          <span className={styles.avatarLetter}>R</span>
        </div>
        <div className={styles.brandInfo}>
          <div className={styles.brandName}>{BRAND_NAME}</div>
          <div className={styles.brandSub}>{userName} · {isDemo ? "demo" : "admin"}</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeView === item.id ? styles.navItemActive : ""}`}
            onClick={() => onChangeView(item.id)}
          >
            <span className={styles.navIcon}>
              <NavIcon name={item.icon} />
            </span>
            {item.label}
            {item.id === "clientes" && clientCount > 0 && (
              <span className={styles.navBadge}>{clientCount}</span>
            )}
          </button>
        ))}
      </nav>

    </aside>
  );
}
