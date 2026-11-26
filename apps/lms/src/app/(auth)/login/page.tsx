"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, tenantSlug);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Mobile header */}
      <div className="mb-10 lg:hidden text-center">
        <span className="text-primary font-serif text-3xl font-bold italic">Líder</span>
        <span className="text-gold-dark font-serif text-3xl font-light ml-1">Áurea</span>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse sua plataforma de formação executiva.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tenant">Organização</Label>
          <Input
            id="tenant"
            type="text"
            placeholder="slug-da-organizacao"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
            autoComplete="organization"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-gold-dark hover:text-gold font-medium"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/signup" className="text-gold-dark hover:text-gold font-medium">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
