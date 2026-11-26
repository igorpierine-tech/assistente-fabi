"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  GraduationCap,
  Lock,
  Users,
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

interface Enrollment {
  id: string;
  program: { id: string };
}

export default function ProgramDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { tokens } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens || !slug) return;

    async function load() {
      try {
        const [p, myEnrollments] = await Promise.all([
          api<Program>(`/programs/by-slug/${slug}`, {
            token: tokens!.accessToken,
          }),
          api<Enrollment[]>("/programs/my", { token: tokens!.accessToken }),
        ]);
        setProgram(p);

        const enrolled = myEnrollments.some((e) => e.program.id === p.id);
        setIsEnrolled(enrolled);

        if (enrolled) {
          const prog = await api<Progress>(`/lessons/progress/${p.id}`, {
            token: tokens!.accessToken,
          });
          setProgress(prog);
        }
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, slug]);

  async function handleEnroll() {
    if (!tokens || !program) return;
    setEnrolling(true);
    try {
      await api(`/programs/${program.id}/enroll`, {
        method: "POST",
        token: tokens.accessToken,
      });
      setIsEnrolled(true);
      const prog = await api<Progress>(`/lessons/progress/${program.id}`, {
        token: tokens.accessToken,
      });
      setProgress(prog);
    } catch {
      // already enrolled or error
    } finally {
      setEnrolling(false);
    }
  }

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

      {/* Enrollment CTA */}
      {!isEnrolled && (
        <div className="rounded-xl border-2 border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-8 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 mx-auto">
            <GraduationCap className="h-7 w-7 text-gold-dark" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Matricule-se neste programa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {program.modules.length} módulos ·{" "}
              {program.modules.reduce((sum, m) => sum + m.lessons.length, 0)} aulas ·{" "}
              {program._count.enrollments} alunos matriculados
            </p>
          </div>
          <Button
            variant="gold"
            size="lg"
            onClick={handleEnroll}
            disabled={enrolling}
            className="px-8"
          >
            {enrolling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="mr-2 h-4 w-4" />
            )}
            {enrolling ? "Matriculando..." : "Matricular-se"}
          </Button>
        </div>
      )}

      {/* Progress bar */}
      {isEnrolled && progress && (
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
                const content = (
                  <>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${isEnrolled ? "bg-primary/5 group-hover:bg-gold/15" : "bg-muted/50"}`}>
                      {isEnrolled ? (
                        <Icon className="h-4 w-4 text-primary group-hover:text-gold-dark transition-colors" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium truncate ${isEnrolled ? "text-foreground" : "text-muted-foreground"}`}>
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
                    {isEnrolled ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-gold-dark transition-colors" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                    )}
                  </>
                );

                return isEnrolled ? (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-4 px-5 py-4 opacity-60"
                  >
                    {content}
                  </div>
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
