"use client";

import { useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import styles from "./Sidebar.module.css";

export type UserRole = "admin" | "gestor" | "colaborador" | "visualizador";

export type View =
  | "inicio"
  | "agenda"
  | "assistente"
  | "clientes"
  | "agendamentos"
  | "vendas"
  | "contratos"
  | "financeiro"
  | "configuracoes"
  | "usuarios"
  | "empresa"
  | "produtos"
  | "admin";

interface SidebarProps {
  activeView: View;
  onChangeView: (view: View) => void;
  userName: string;
  userRole?: UserRole;
  clientCount: number;
  pendingBookingCount?: number;
  onLogout?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  allowedModules?: string[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador",
  visualizador: "Visualizador",
};

const ROLE_NAV_ACCESS: Record<UserRole, View[]> = {
  admin: ["inicio", "agenda", "agendamentos", "clientes", "empresa", "produtos", "usuarios", "vendas", "contratos", "financeiro", "configuracoes"],
  gestor: ["inicio", "agenda", "agendamentos", "clientes", "empresa", "produtos", "vendas", "contratos", "financeiro"],
  colaborador: ["inicio", "agenda", "clientes", "agendamentos"],
  visualizador: ["inicio", "financeiro", "contratos"],
};

interface NavItem {
  id: View;
  label: string;
  icon: string;
}

const TOP_ITEMS: NavItem[] = [
  { id: "inicio", label: "Início", icon: "home" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "agendamentos", label: "Agendamentos", icon: "handshake" },
];

const CADASTROS_ITEMS: NavItem[] = [
  { id: "clientes", label: "Clientes", icon: "people" },
  { id: "empresa", label: "Empresa", icon: "building" },
  { id: "produtos", label: "Produtos e Serviços", icon: "box" },
  { id: "usuarios", label: "Usuários", icon: "users" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "configuracoes", label: "Configurações", icon: "gear" },
  { id: "contratos", label: "Contratos", icon: "contract" },
  { id: "financeiro", label: "Financeiro", icon: "dollar" },
  { id: "vendas", label: "Vendas", icon: "tag" },
];

const CADASTROS_IDS = new Set(CADASTROS_ITEMS.map((i) => i.id));

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
    case "handshake":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 11l4-4 4 3 3-3 5 4M2 11l3 3 4-3M14 11l3 3 3-3" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2H4a2 2 0 00-2 2v6l8 8 8-8-8-8z" />
          <circle cx="6.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "contract":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
          <line x1="8" y1="7" x2="12" y2="7" />
          <line x1="8" y1="10" x2="12" y2="10" />
          <line x1="8" y1="13" x2="10" y2="13" />
        </svg>
      );
    case "users":
      return (
        <svg {...props} strokeLinecap="round">
          <circle cx="7" cy="6" r="2.5" />
          <circle cx="14" cy="7" r="2" />
          <path d="M2 18c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          <path d="M12 18c0-2 1.5-3.5 3-3.5s2.5 1.5 2.5 3.5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L3 6v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V6l-7-4z" />
          <path d="M7 10l2 2 4-4" />
        </svg>
      );
    case "building":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18V6l7-4 7 4v12" />
          <line x1="3" y1="18" x2="17" y2="18" />
          <line x1="7" y1="8" x2="7" y2="8.01" />
          <line x1="10" y1="8" x2="10" y2="8.01" />
          <line x1="13" y1="8" x2="13" y2="8.01" />
          <line x1="7" y1="12" x2="7" y2="12.01" />
          <line x1="10" y1="12" x2="10" y2="12.01" />
          <line x1="13" y1="12" x2="13" y2="12.01" />
          <rect x="8" y="14" width="4" height="4" />
        </svg>
      );
    case "box":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7l8-4 8 4-8 4-8-4z" />
          <path d="M2 7v8l8 4V11" />
          <path d="M18 7v8l-8 4V11" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2" />
          <rect x="7" y="2" width="6" height="3" rx="1" />
          <line x1="7" y1="9" x2="13" y2="9" />
          <line x1="7" y1="12" x2="11" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

export function Sidebar({
  activeView,
  onChangeView,
  userName,
  userRole = "colaborador",
  clientCount,
  pendingBookingCount = 0,
  onLogout,
  mobileOpen = false,
  onMobileClose,
  allowedModules,
}: SidebarProps) {
  const tenant = useTenant();
  const brandName = tenant.businessName;
  const baseViews = allowedModules
    ? allowedModules as View[]
    : (ROLE_NAV_ACCESS[userRole] || ROLE_NAV_ACCESS.colaborador);
  const allowedViews = baseViews.includes("configuracoes")
    ? [...new Set([...baseViews, "empresa" as View, "produtos" as View])]
    : baseViews;

  const cadastrosVisible = CADASTROS_ITEMS.filter((item) => allowedViews.includes(item.id));
  const hasCadastrosActive = CADASTROS_IDS.has(activeView);
  const [cadastrosOpen, setCadastrosOpen] = useState(hasCadastrosActive);

  const topVisible = TOP_ITEMS.filter((item) => allowedViews.includes(item.id));
  const bottomVisible = BOTTOM_ITEMS.filter((item) => allowedViews.includes(item.id));

  function handleNav(view: View) {
    onChangeView(view);
    onMobileClose?.();
  }

  function renderItem(item: NavItem) {
    return (
      <button
        key={item.id}
        className={`${styles.navItem} ${activeView === item.id ? styles.navItemActive : ""}`}
        onClick={() => handleNav(item.id)}
      >
        <span className={styles.navIcon}>
          <NavIcon name={item.icon} />
        </span>
        {item.label}
        {item.id === "clientes" && clientCount > 0 && (
          <span className={styles.navBadge}>{clientCount}</span>
        )}
        {item.id === "agendamentos" && pendingBookingCount > 0 && (
          <span className={styles.navBadge}>{pendingBookingCount}</span>
        )}
      </button>
    );
  }

  return (
    <>
      {mobileOpen && <div className={styles.overlay} onClick={onMobileClose} />}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}>
        <div className={styles.avatar}>
          <span className={styles.avatarLetter}>{brandName[0]?.toUpperCase() || "A"}</span>
        </div>
        <div className={styles.brandInfo}>
          <div className={styles.brandName}>{brandName}</div>
          <div className={styles.brandSub}>{userName} · {ROLE_LABELS[userRole] || userRole}</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {topVisible.map(renderItem)}

        {cadastrosVisible.length > 0 && (
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${styles.navGroupToggle} ${hasCadastrosActive ? styles.navItemActive : ""}`}
              onClick={() => setCadastrosOpen((o) => !o)}
            >
              <span className={styles.navIcon}>
                <NavIcon name="clipboard" />
              </span>
              Cadastros
              <span className={styles.navChevron}>
                <ChevronIcon open={cadastrosOpen} />
              </span>
            </button>
            {cadastrosOpen && (
              <div className={styles.navGroupItems}>
                {cadastrosVisible.map(renderItem)}
              </div>
            )}
          </div>
        )}

        {bottomVisible.map(renderItem)}
      </nav>

      {onLogout && (
        <button className={styles.logoutBtn} onClick={onLogout} type="button">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M13 4h3a1 1 0 011 1v10a1 1 0 01-1 1h-3" />
            <path d="M9 14l-4-4 4-4M5 10h10" />
          </svg>
          Sair
        </button>
      )}
    </aside>
    </>
  );
}
