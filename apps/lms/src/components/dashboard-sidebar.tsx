"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  CreditCard,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const studentNav = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/programs", label: "Meus Programas", icon: BookOpen },
  { href: "/dashboard/plans", label: "Planos", icon: Crown },
  { href: "/dashboard/achievements", label: "Conquistas", icon: Trophy },
  { href: "/dashboard/materials", label: "Materiais", icon: FileText },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

const adminNav = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/programs", label: "Programas", icon: BookOpen },
  { href: "/admin/programs", label: "Gerenciar Conteúdo", icon: FileText },
  { href: "/admin/plans", label: "Gestão de Planos", icon: Crown },
  { href: "/dashboard/achievements", label: "Conquistas", icon: Trophy },
  { href: "/dashboard/users", label: "Usuários", icon: Users },
  { href: "/dashboard/analytics", label: "Métricas", icon: BarChart3 },
  { href: "/dashboard/settings/billing", label: "Plano & Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "MENTOR";
  const nav = isAdmin ? adminNav : studentNav;

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold italic text-primary">Líder</span>
            <span className="font-serif text-lg font-light text-gold-dark">Áurea</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary transition-colors",
            collapsed ? "mx-auto" : "ml-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span className="uppercase tracking-widest">Raízes e Riquezas</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}
    </aside>
  );
}
