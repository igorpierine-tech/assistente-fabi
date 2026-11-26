"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Loader2,
  Trophy,
} from "lucide-react";

interface QuizOption {
  key: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correctKey: string;
}

interface Assessment {
  id: string;
  title: string;
  type: "QUIZ" | "DIAGNOSTIC" | "ACTION_PLAN" | "SELF_EVALUATION";
  description: string | null;
  questions: QuizQuestion[] | null;
  xpReward: number;
  lesson: {
    id: string;
    title: string;
    module: {
      title: string;
      program: { slug: string; title: string };
    };
  };
}

interface Submission {
  id: string;
  answers: { questionId: string; selectedKey: string }[] | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string;
}

export default function AssessmentPage() {
  const params = useParams();
  const assessmentId = typeof params.assessmentId === "string" ? params.assessmentId : "";
  const { tokens } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens || !assessmentId) return;

    async function load() {
      try {
        const a = await api<Assessment>(`/assessments/${assessmentId}`, {
          token: tokens!.accessToken,
        });
        setAssessment(a);

        try {
          const s = await api<Submission | null>(`/assessments/${assessmentId}/submission`, {
            token: tokens!.accessToken,
          });
          if (s) setSubmission(s);
        } catch {
          // no submission yet
        }
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, assessmentId]);

  function selectAnswer(questionId: string, key: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
  }

  const handleSubmit = useCallback(async () => {
    if (!tokens || !assessment) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedKey]) => ({
          questionId,
          selectedKey,
        })),
      };
      const s = await api<Submission>(`/assessments/${assessmentId}/submit`, {
        method: "POST",
        token: tokens.accessToken,
        body: payload,
      });
      setSubmission(s);

      // Check for new badges after assessment
      await api("/gamification/badges/check", {
        method: "POST",
        token: tokens.accessToken,
      });
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  }, [tokens, assessment, assessmentId, answers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">Avaliação não encontrada.</p>
      </div>
    );
  }

  const questions = assessment.questions || [];
  const hasSubmitted = !!submission;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/lessons/${assessment.lesson.id}`}
          className="hover:text-gold-dark transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {assessment.lesson.title}
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="h-5 w-5 text-gold-dark" />
          <span className="text-xs uppercase tracking-wider text-gold-dark font-semibold">
            {assessment.type.replace("_", " ").toLowerCase()}
          </span>
          <span className="text-xs text-muted-foreground">· {assessment.xpReward} XP</span>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {assessment.title}
        </h1>
        {assessment.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {assessment.description}
          </p>
        )}
      </div>

      {/* Score result */}
      {hasSubmitted && submission.score !== null && (
        <div
          className={`rounded-xl border p-6 text-center ${
            submission.score >= 70
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <Trophy
            className={`mx-auto h-10 w-10 mb-2 ${
              submission.score >= 70 ? "text-emerald-600" : "text-amber-600"
            }`}
          />
          <p className="text-2xl font-bold text-foreground">{submission.score}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            {submission.score >= 70 ? "Parabéns! Você passou!" : "Tente novamente para melhorar."}
          </p>
          {submission.feedback && (
            <p className="mt-3 text-sm text-muted-foreground italic">{submission.feedback}</p>
          )}
        </div>
      )}

      {/* Questions */}
      {assessment.type === "QUIZ" && questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, idx) => {
            const submittedAnswer = hasSubmitted && submission.answers
              ? (submission.answers as { questionId: string; selectedKey: string }[]).find(
                  (a) => a.questionId === q.id
                )?.selectedKey
              : undefined;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card p-6 space-y-4"
              >
                <p className="font-medium text-foreground">
                  <span className="text-gold-dark mr-2">{idx + 1}.</span>
                  {q.text}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isSelected = hasSubmitted
                      ? submittedAnswer === opt.key
                      : answers[q.id] === opt.key;
                    const isCorrect = hasSubmitted && opt.key === q.correctKey;
                    const isWrong = hasSubmitted && isSelected && opt.key !== q.correctKey;

                    return (
                      <button
                        key={opt.key}
                        onClick={() => !hasSubmitted && selectAnswer(q.id, opt.key)}
                        disabled={hasSubmitted}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : isWrong
                            ? "border-red-300 bg-red-50 text-red-800"
                            : isSelected
                            ? "border-gold bg-gold/10 text-foreground"
                            : "border-border bg-background text-foreground hover:border-gold/30"
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                        {isWrong && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!hasSubmitted && (
            <div className="flex justify-center pt-4">
              <Button
                variant="gold"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || Object.keys(answers).length < questions.length}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                )}
                Enviar Respostas
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Non-quiz types */}
      {assessment.type !== "QUIZ" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasSubmitted
              ? "Sua resposta foi enviada e está em análise."
              : "Esta avaliação será disponibilizada em breve."}
          </p>
        </div>
      )}
    </div>
  );
}
