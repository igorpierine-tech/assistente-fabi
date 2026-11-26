"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  BookOpen,
  Video,
  Radio,
  FileText,
  ClipboardCheck,
  Clock,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface Lesson {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT";
  videoDuration: number | null;
  xpReward: number;
  sortOrder: number;
}

interface Module {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: Lesson[];
  _count: { lessons: number };
}

interface Program {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  modules: Module[];
  _count: { enrollments: number };
}

interface Progress {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  totalXp: number;
}

const LESSON_ICONS = {
  VIDEO: Video,
  LIVE: Radio,
  TEXT: FileText,
  ASSESSMENT: ClipboardCheck,
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export default function ProgramDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { tokens } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens || !slug) return;

    async function load() {
      try {
        const p = await api<Program>(`/programs/by-slug/${slug}`, {
          token: tokens!.accessToken,
        });
        setProgram(p);

        const prog = await api<Progress>(`/lessons/progress/${p.id}`, {
          token: tokens!.accessToken,
        });
        setProgress(prog);
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-muted-foreground">Programa não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gold-dark font-semibold mb-2">
          Programa
        </p>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          {program.title}
        </h1>
        {program.subtitle && (
          <p className="mt-1 text-muted-foreground">{program.subtitle}</p>
        )}
        {program.description && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {program.description}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-muted-foreground">Seu progresso</span>
            <span className="font-semibold text-foreground">
              {progress.completedLessons} / {progress.totalLessons} aulas · {progress.totalXp} XP
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold transition-all"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="space-y-6">
        {program.modules.map((mod, idx) => (
          <section key={mod.id}>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-xs font-semibold text-gold-dark uppercase tracking-wider">
                Módulo {idx + 1}
              </span>
              <h2 className="font-serif text-lg font-semibold text-foreground">
                {mod.title}
              </h2>
            </div>
            {mod.description && (
              <p className="text-sm text-muted-foreground mb-3">{mod.description}</p>
            )}
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {mod.lessons.map((lesson) => {
                const Icon = LESSON_ICONS[lesson.type] || BookOpen;
                return (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 group-hover:bg-gold/15 transition-colors">
                      <Icon className="h-4 w-4 text-primary group-hover:text-gold-dark transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {lesson.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{lesson.type.toLowerCase()}</span>
                        {lesson.videoDuration && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(lesson.videoDuration)}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{lesson.xpReward} XP</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-gold-dark transition-colors" />
                  </Link>
                );
              })}
              {mod.lessons.length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma aula publicada neste módulo.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
