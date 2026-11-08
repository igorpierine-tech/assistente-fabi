"use client";

import { useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { API_URL } from "@/lib/api";
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
  | "dashboards"
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
  admin: ["inicio", "agenda", "agendamentos", "clientes", "empresa", "produtos", "usuarios", "vendas", "contratos", "financeiro", "dashboards", "configuracoes"],
  gestor: ["inicio", "agenda", "agendamentos", "clientes", "empresa", "produtos", "vendas", "contratos", "financeiro", "dashboards"],
  colaborador: ["inicio", "agenda", "clientes", "agendamentos"],
  visualizador: ["inicio", "financeiro", "contratos", "dashboards"],
};

interface NavItem {
  id: View;
  label: string;
  icon: string;
}

const TOP_ITEMS: NavItem[] = [
  { id: "inicio", label: "Início", icon: "home" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "agendamentos", label: "Agendamentos", icon: "clock-check" },
  { id: "dashboards", label: "Dashboards", icon: "chart" },
];

const CADASTROS_ITEMS: NavItem[] = [
  { id: "clientes", label: "Clientes", icon: "people" },
  { id: "empresa", label: "Empresa", icon: "building" },
  { id: "produtos", label: "Produtos e Serviços", icon: "catalog" },
  { id: "usuarios", label: "Usuários", icon: "users" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "configuracoes", label: "Configurações", icon: "gear" },
  { id: "contratos", label: "Contratos", icon: "file-signature" },
  { id: "financeiro", label: "Financeiro", icon: "wallet" },
  { id: "vendas", label: "Vendas", icon: "cart" },
];

const CADASTROS_IDS = new Set(CADASTROS_ITEMS.map((i) => i.id));

function NavIcon({ name }: { name: string }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };

  switch (name) {
    case "home":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l9-8 9 8" />
          <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      );
    case "clock-check":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
          <path d="M17 17l2 2 4-4" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "people":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2" />
          <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "gear":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
    case "cart":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
        </svg>
      );
    case "file-signature":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6" />
          <path d="M8 17s1-1.5 2-1.5 1.5 1.5 2.5 1.5 2-1.5 2-1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="3" />
          <circle cx="17" cy="8" r="2.5" />
          <path d="M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6" />
          <path d="M16 21c0-2.2 1.8-4 3.5-4S23 18.8 23 21" />
        </svg>
      );
    case "building":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21V7l9-5 9 5v14" />
          <line x1="3" y1="21" x2="21" y2="21" />
          <rect x="7" y="10" width="3" height="3" rx="0.5" />
          <rect x="14" y="10" width="3" height="3" rx="0.5" />
          <rect x="10" y="16" width="4" height="5" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 16l4-6 4 4 5-8" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...props} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
      );
    default:
      return null;
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
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
        {tenant.logoUrl ? (
          <div className={styles.avatarWithLogo}>
            <img
              src={`${API_URL}${tenant.logoUrl}`}
              alt={brandName}
              className={styles.avatarLogo}
            />
          </div>
        ) : (
          <div className={styles.avatar}>
            <span className={styles.avatarLetter}>{brandName[0]?.toUpperCase() || "A"}</span>
          </div>
        )}
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
            <path d="M10 17l-5-5 5-5M5 12h12" />
          </svg>
          Sair
        </button>
      )}
    </aside>
    </>
  );
}
