"use client";

import { useAuth } from "@/lib/auth-context";
import { BookOpen, Trophy, Clock, TrendingUp } from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            accent ? "bg-gold/15" : "bg-primary/5"
          }`}
        >
          <Icon className={`h-5 w-5 ${accent ? "text-gold-dark" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-green-mid p-8">
        <p className="text-xs uppercase tracking-widest text-gold/60 font-medium mb-2">
          Plataforma de Formação Executiva
        </p>
        <h1 className="font-serif text-3xl font-semibold text-gold">
          Olá, {user?.firstName}.
        </h1>
        <p className="mt-2 text-sm text-gold/70 max-w-md">
          Continue sua jornada de transformação. Sua próxima aula está esperando.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Programas Ativos" value="1" accent />
        <StatCard icon={Clock} label="Aulas Concluídas" value="0" />
        <StatCard icon={Trophy} label="Conquistas" value="0" accent />
        <StatCard icon={TrendingUp} label="XP Total" value="0" />
      </div>

      {/* Current program */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
          Continuar Aprendendo
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gold-dark font-semibold mb-1">
                  Mentoria Líder Áurea
                </p>
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Módulo 1 — Fundamentos da Liderança Áurea
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Boas-vindas à Mentoria Líder Áurea
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-dark">
                Em andamento
              </span>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Progresso do módulo</span>
                <span>0 / 3 aulas</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold transition-all"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent badges */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
          Últimas Conquistas
        </h2>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Complete aulas e atividades para ganhar conquistas e XP.
          </p>
        </div>
      </section>
    </div>
  );
}
