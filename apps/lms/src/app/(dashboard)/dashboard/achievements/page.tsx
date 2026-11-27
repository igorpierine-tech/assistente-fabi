"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Trophy,
  Star,
  Medal,
  Zap,
  BookOpen,
  Award,
  Loader2,
  Crown,
  Flame,
} from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  GESTORA_AUREA: "Gestora Áurea",
  LIDER_ESTRATEGICA: "Líder Estratégica",
  EXECUTIVA_ALTO_IMPACTO: "Executiva de Alto Impacto",
};

interface Badge {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  xpReward: number;
  criteria: { type: string; threshold: number } | null;
}

interface UserBadge {
  id: string;
  earnedAt: string;
  badge: Badge;
}

interface GamificationProfile {
  totalXp: number;
  currentTier: string;
  currentStreak: number;
  longestStreak: number;
}

interface XpSummary {
  totalXp: number;
  badgeCount: number;
  lessonsCompleted: number;
  recentEntries: {
    id: string;
    points: number;
    reason: string;
    createdAt: string;
  }[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  totalXp: number;
}

const BADGE_ICONS: Record<string, typeof Trophy> = {
  lessons_completed: BookOpen,
  xp_total: Zap,
  assessments_passed: Award,
  streak_days: Star,
};

function BadgeIcon({ criteria }: { criteria: Badge["criteria"] }) {
  const Icon = (criteria?.type && BADGE_ICONS[criteria.type]) || Medal;
  return <Icon className="h-8 w-8" />;
}

export default function AchievementsPage() {
  const { tokens, user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [xpSummary, setXpSummary] = useState<XpSummary | null>(null);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;

    async function load() {
      try {
        const [allBadges, myBadges, xp, lb, profileData] = await Promise.all([
          api<Badge[]>("/gamification/badges", { token: tokens!.accessToken }),
          api<UserBadge[]>("/gamification/badges/my", { token: tokens!.accessToken }),
          api<XpSummary>("/gamification/xp", { token: tokens!.accessToken }),
          api<LeaderboardEntry[]>("/gamification/leaderboard", { token: tokens!.accessToken }),
          api<GamificationProfile>("/gamification/profile", { token: tokens!.accessToken }).catch(() => null),
        ]);
        setBadges(allBadges);
        setUserBadges(myBadges);
        setXpSummary(xp);
        setProfile(profileData);
        setLeaderboard(lb);
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

  const earnedIds = new Set(userBadges.map((ub) => ub.badge.id));

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Conquistas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas badges, XP acumulado e posição no ranking.
        </p>
      </div>

      {/* Stats row */}
      {xpSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {profile && (
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 text-center">
              <Crown className="mx-auto h-6 w-6 text-gold-dark mb-2" />
              <p className="text-sm font-bold text-foreground">
                {TIER_LABELS[profile.currentTier] || profile.currentTier}
              </p>
              <p className="text-xs text-muted-foreground">Nível Atual</p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <Zap className="mx-auto h-6 w-6 text-gold-dark mb-2" />
            <p className="text-2xl font-bold text-foreground">{xpSummary.totalXp}</p>
            <p className="text-xs text-muted-foreground">XP Total</p>
          </div>
          {profile && (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <Flame className="mx-auto h-6 w-6 text-orange-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{profile.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Streak (recorde: {profile.longestStreak})</p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <Medal className="mx-auto h-6 w-6 text-gold-dark mb-2" />
            <p className="text-2xl font-bold text-foreground">{xpSummary.badgeCount}</p>
            <p className="text-xs text-muted-foreground">Badges</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <BookOpen className="mx-auto h-6 w-6 text-gold-dark mb-2" />
            <p className="text-2xl font-bold text-foreground">{xpSummary.lessonsCompleted}</p>
            <p className="text-xs text-muted-foreground">Aulas Concluídas</p>
          </div>
        </div>
      )}

      {/* Badges grid */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Badges</h2>
        {badges.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Medal className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma badge disponível ainda.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => {
              const earned = earnedIds.has(badge.id);
              const ub = userBadges.find((u) => u.badge.id === badge.id);
              return (
                <div
                  key={badge.id}
                  className={`rounded-xl border p-5 transition-all ${
                    earned
                      ? "border-gold/40 bg-gold/5"
                      : "border-border bg-card opacity-60 grayscale"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                        earned ? "bg-gold/20 text-gold-dark" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <BadgeIcon criteria={badge.criteria as Badge["criteria"]} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">{badge.title}</h3>
                      {badge.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {badge.description}
                        </p>
                      )}
                      {badge.xpReward > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-gold-dark mt-1">
                          <Zap className="h-3 w-3" /> +{badge.xpReward} XP
                        </span>
                      )}
                      {earned && ub && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Conquistada em{" "}
                          {new Date(ub.earnedAt).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
          Ranking
        </h2>
        {leaderboard.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              O ranking será exibido quando houver participantes.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {leaderboard.map((entry) => {
              const isMe = entry.userId === user?.id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    isMe ? "bg-gold/5" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {entry.rank <= 3 ? (
                      <Crown
                        className={`h-5 w-5 ${
                          entry.rank === 1
                            ? "text-amber-500"
                            : entry.rank === 2
                            ? "text-zinc-400"
                            : "text-amber-700"
                        }`}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {entry.rank}
                      </span>
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary uppercase">
                    {entry.firstName.charAt(0)}
                    {entry.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-gold-dark" : "text-foreground"}`}>
                      {entry.firstName} {entry.lastName}
                      {isMe && " (você)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Zap className="h-3.5 w-3.5 text-gold-dark" />
                    {entry.totalXp}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent XP */}
      {xpSummary && xpSummary.recentEntries.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
            Últimos XP Ganhos
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {xpSummary.recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-foreground">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gold-dark">+{entry.points} XP</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
