"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BarChart3, Users, BookOpen, GraduationCap, Loader2 } from "lucide-react";

interface Program {
  id: string;
  title: string;
  published: boolean;
  _count: { modules: number; enrollments: number };
}

interface Member {
  id: string;
  role: string;
}

interface Stats {
  totalPrograms: number;
  publishedPrograms: number;
  totalModules: number;
  totalEnrollments: number;
  totalMembers: number;
  membersByRole: Record<string, number>;
}

export default function AnalyticsPage() {
  const { tokens } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = useCallback(async () => {
    if (!tokens) return;
    try {
      const [programs, members] = await Promise.all([
        api<Program[]>("/programs", { token: tokens.accessToken }),
        api<Member[]>("/tenant/members", { token: tokens.accessToken }),
      ]);

      const membersByRole: Record<string, number> = {};
      for (const m of members) {
        membersByRole[m.role] = (membersByRole[m.role] || 0) + 1;
      }

      setStats({
        totalPrograms: programs.length,
        publishedPrograms: programs.filter((p) => p.published).length,
        totalModules: programs.reduce((sum, p) => sum + p._count.modules, 0),
        totalEnrollments: programs.reduce((sum, p) => sum + p._count.enrollments, 0),
        totalMembers: members.length,
        membersByRole,
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-sm text-red-800">
            Erro ao carregar métricas. Tente recarregar a página.
          </p>
        </div>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: "Proprietários",
    ADMIN: "Administradores",
    MENTOR: "Mentores",
    STUDENT: "Alunos",
  };

  const cards = [
    {
      label: "Programas",
      value: stats.totalPrograms,
      sub: `${stats.publishedPrograms} publicados`,
      icon: BookOpen,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Módulos",
      value: stats.totalModules,
      sub: "total de módulos",
      icon: GraduationCap,
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Matrículas",
      value: stats.totalEnrollments,
      sub: "alunos matriculados",
      icon: Users,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Membros",
      value: stats.totalMembers,
      sub: "na organização",
      icon: BarChart3,
      color: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Métricas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da sua plataforma de ensino.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-5 hover:border-gold/30 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {card.label}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold text-foreground mb-4">
          Membros por Função
        </h2>
        <div className="space-y-3">
          {Object.entries(stats.membersByRole).map(([role, count]) => {
            const pct =
              stats.totalMembers > 0
                ? Math.round((count / stats.totalMembers) * 100)
                : 0;
            return (
              <div key={role}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {ROLE_LABELS[role] || role}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-gold transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold text-foreground mb-2">
          Em Breve
        </h2>
        <p className="text-sm text-muted-foreground">
          Métricas avançadas como taxa de conclusão, tempo médio por aula,
          progresso dos alunos e relatórios detalhados serão adicionadas em
          breve.
        </p>
      </div>
    </div>
  );
}
