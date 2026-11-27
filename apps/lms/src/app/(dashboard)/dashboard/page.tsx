"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  BookOpen,
  Trophy,
  Zap,
  TrendingUp,
  ChevronRight,
  Medal,
  Loader2,
  Flame,
  Crown,
} from "lucide-react";

interface XpSummary {
  totalXp: number;
  badgeCount: number;
  lessonsCompleted: number;
}

interface GamificationProfile {
  totalXp: number;
  currentTier: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string | null;
}

const TIER_LABELS: Record<string, string> = {
  GESTORA_AUREA: "Gestora Áurea",
  LIDER_ESTRATEGICA: "Líder Estratégica",
  EXECUTIVA_ALTO_IMPACTO: "Executiva de Alto Impacto",
};

const TIER_COLORS: Record<string, string> = {
  GESTORA_AUREA: "from-amber-600 to-amber-400",
  LIDER_ESTRATEGICA: "from-violet-600 to-violet-400",
  EXECUTIVA_ALTO_IMPACTO: "from-gold-dark to-gold",
};

interface Enrollment {
  id: string;
  enrolledAt: string;
  program: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    _count: { modules: number };
  };
}

interface Progress {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  totalXp: number;
}

interface UserBadge {
  id: string;
  earnedAt: string;
  badge: { title: string; description: string | null; xpReward: number };
}

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
  const { user, tokens } = useAuth();
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progresses, setProgresses] = useState<Record<string, Progress>>({});
  const [recentBadges, setRecentBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;

    async function load() {
      try {
        const [xpData, enrolled, badges, profileData] = await Promise.all([
          api<XpSummary>("/gamification/xp", { token: tokens!.accessToken }),
          api<Enrollment[]>("/programs/my", { token: tokens!.accessToken }),
          api<UserBadge[]>("/gamification/badges/my", { token: tokens!.accessToken }),
          api<GamificationProfile>("/gamification/profile", { token: tokens!.accessToken }).catch(() => null),
        ]);
        setXp(xpData);
        setProfile(profileData);
        setEnrollments(enrolled);
        setRecentBadges(badges.slice(0, 3));

        const progs: Record<string, Progress> = {};
        await Promise.all(
          enrolled.map(async (e) => {
            try {
              progs[e.program.id] = await api<Progress>(
                `/lessons/progress/${e.program.id}`,
                { token: tokens!.accessToken }
              );
            } catch {
              // skip
            }
          })
        );
        setProgresses(progs);
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

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

      {/* Profile Widget */}
      {profile && (
        <div className="rounded-xl border border-gold/20 bg-card overflow-hidden">
          <div className={`bg-gradient-to-r ${TIER_COLORS[profile.currentTier] || "from-amber-600 to-amber-400"} px-6 py-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-white" />
                <div>
                  <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Seu Nível</p>
                  <p className="text-lg font-serif font-semibold text-white">
                    {TIER_LABELS[profile.currentTier] || profile.currentTier}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-white" />
                    <span className="text-lg font-bold text-white">{profile.currentStreak}</span>
                  </div>
                  <p className="text-xs text-white/70">dias seguidos</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-white" />
                    <span className="text-lg font-bold text-white">{profile.totalXp}</span>
                  </div>
                  <p className="text-xs text-white/70">XP total</p>
                </div>
              </div>
            </div>
          </div>
          {profile.currentTier !== "EXECUTIVA_ALTO_IMPACTO" && (
            <div className="px-6 py-3 bg-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Progresso para próximo nível</span>
                <span>
                  {profile.currentTier === "GESTORA_AUREA"
                    ? `${profile.totalXp} / 2.000 XP`
                    : `${profile.totalXp} / 5.000 XP`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${TIER_COLORS[profile.currentTier] || "from-amber-600 to-amber-400"} transition-all`}
                  style={{
                    width: `${Math.min(
                      100,
                      profile.currentTier === "GESTORA_AUREA"
                        ? (profile.totalXp / 2000) * 100
                        : (profile.totalXp / 5000) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Programas Ativos"
          value={String(enrollments.length)}
          accent
        />
        <StatCard
          icon={TrendingUp}
          label="Aulas Concluídas"
          value={String(xp?.lessonsCompleted ?? 0)}
        />
        <StatCard
          icon={Trophy}
          label="Conquistas"
          value={String(xp?.badgeCount ?? 0)}
          accent
        />
        <StatCard
          icon={Zap}
          label="XP Total"
          value={String(xp?.totalXp ?? 0)}
        />
      </div>

      {/* Current programs */}
      {enrollments.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
            Continuar Aprendendo
          </h2>
          <div className="space-y-4">
            {enrollments.map((e) => {
              const prog = progresses[e.program.id];
              return (
                <Link
                  key={e.id}
                  href={`/programs/${e.program.slug}`}
                  className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-gold/30 transition-all"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gold-dark font-semibold mb-1">
                          {e.program.title}
                        </p>
                        {e.program.subtitle && (
                          <h3 className="font-serif text-lg font-semibold text-foreground">
                            {e.program.subtitle}
                          </h3>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {e.program._count.modules} módulos
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {prog && (
                          <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-dark">
                            {prog.percentComplete}% concluído
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-gold-dark transition-colors" />
                      </div>
                    </div>
                    {prog && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          <span>Progresso</span>
                          <span>
                            {prog.completedLessons} / {prog.totalLessons} aulas · {prog.totalXp} XP
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold transition-all"
                            style={{ width: `${prog.percentComplete}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {enrollments.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não está matriculado em nenhum programa.
          </p>
        </div>
      )}

      {/* Recent badges */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Últimas Conquistas
          </h2>
          <Link
            href="/dashboard/achievements"
            className="text-sm text-gold-dark hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {recentBadges.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {recentBadges.map((ub) => (
              <div
                key={ub.id}
                className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-center gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/20">
                  <Medal className="h-5 w-5 text-gold-dark" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ub.badge.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ub.earnedAt).toLocaleDateString("pt-BR")}
                    {ub.badge.xpReward > 0 && ` · +${ub.badge.xpReward} XP`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Complete aulas e atividades para ganhar conquistas e XP.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
