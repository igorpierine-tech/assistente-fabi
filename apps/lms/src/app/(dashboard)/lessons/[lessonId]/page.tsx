"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Video,
  Radio,
  FileText,
  ClipboardCheck,
  Download,
  Loader2,
} from "lucide-react";

interface Material {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
}

interface Lesson {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT";
  videoUrl: string | null;
  videoDuration: number | null;
  liveUrl: string | null;
  liveStartsAt: string | null;
  content: string | null;
  xpReward: number;
  materials: Material[];
  module: {
    id: string;
    slug: string;
    title: string;
    programId: string;
    program: { slug: string; title: string };
  };
}

interface Progress {
  completed: boolean;
  completedAt: string | null;
  watchTime: number;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const { tokens } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens || !lessonId) return;

    async function load() {
      try {
        const l = await api<Lesson>(`/lessons/${lessonId}`, {
          token: tokens!.accessToken,
        });
        setLesson(l);

        try {
          const p = await api<Progress>(`/lessons/${lessonId}/progress`, {
            token: tokens!.accessToken,
          });
          setProgress(p);
        } catch {
          // no progress yet
        }
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, lessonId]);

  const markComplete = useCallback(async () => {
    if (!tokens || !lessonId) return;
    setCompleting(true);
    try {
      const p = await api<Progress>(`/lessons/${lessonId}/complete`, {
        method: "POST",
        token: tokens.accessToken,
      });
      setProgress(p);
    } catch {
      // handle
    } finally {
      setCompleting(false);
    }
  }, [tokens, lessonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">Aula não encontrada.</p>
      </div>
    );
  }

  const ICONS = { VIDEO: Video, LIVE: Radio, TEXT: FileText, ASSESSMENT: ClipboardCheck };
  const TypeIcon = ICONS[lesson.type] || Video;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/programs/${lesson.module.program.slug}`}
          className="hover:text-gold-dark transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {lesson.module.program.title}
        </Link>
        <span>/</span>
        <span>{lesson.module.title}</span>
      </div>

      {/* Lesson header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TypeIcon className="h-4 w-4 text-gold-dark" />
            <span className="text-xs uppercase tracking-wider text-gold-dark font-semibold">
              {lesson.type.toLowerCase()}
            </span>
            <span className="text-xs text-muted-foreground">· {lesson.xpReward} XP</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {lesson.description}
            </p>
          )}
        </div>
        {progress?.completed && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluída
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {lesson.type === "VIDEO" && lesson.videoUrl && (
          <div className="aspect-video bg-black">
            <iframe
              src={lesson.videoUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {lesson.type === "LIVE" && (
          <div className="p-8 text-center">
            <Radio className="mx-auto h-12 w-12 text-gold-dark mb-3" />
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
              Encontro ao Vivo
            </h3>
            {lesson.liveStartsAt && (
              <p className="text-sm text-muted-foreground mb-4">
                {new Date(lesson.liveStartsAt).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            {lesson.liveUrl && (
              <a
                href={lesson.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-primary hover:bg-gold-dark transition-colors"
              >
                Entrar na Sala
              </a>
            )}
          </div>
        )}

        {(lesson.type === "TEXT" || lesson.type === "ASSESSMENT") && lesson.content && (
          <div className="p-6 prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </div>
        )}

        {!lesson.videoUrl && !lesson.liveUrl && !lesson.content && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Conteúdo em breve.
          </div>
        )}
      </div>

      {/* Materials */}
      {lesson.materials.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
            Materiais de Apoio
          </h2>
          <div className="space-y-2">
            {lesson.materials.map((mat) => (
              <a
                key={mat.id}
                href={mat.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-gold/30 transition-colors"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{mat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {mat.fileType}
                    {mat.fileSize ? ` · ${(mat.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Complete button */}
      {!progress?.completed && (
        <div className="flex justify-center pt-4">
          <Button
            variant="gold"
            size="lg"
            onClick={markComplete}
            disabled={completing}
          >
            {completing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Marcar como Concluída
          </Button>
        </div>
      )}
    </div>
  );
}
