"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Link inválido
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O link de redefinição de senha é inválido ou expirou. Solicite um novo.
        </p>
        <Link href="/forgot-password">
          <Button variant="gold" className="mt-8">
            Solicitar novo link
          </Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Senha redefinida!
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Sua senha foi atualizada com sucesso. Use a nova senha para acessar a plataforma.
        </p>
        <Link href="/login">
          <Button variant="gold" size="lg" className="mt-8">
            Ir para o login
          </Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro ao redefinir senha. O link pode ter expirado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-10 lg:hidden text-center">
        <span className="text-primary font-serif text-3xl font-bold italic">Líder</span>
        <span className="text-gold-dark font-serif text-3xl font-light ml-1">Áurea</span>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Nova senha
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma senha forte para sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres, com maiúscula, minúscula e número.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Redefinir senha
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-gold-dark hover:text-gold font-medium">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
