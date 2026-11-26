"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Token de verificação não encontrado.");
      return;
    }

    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err instanceof ApiError
            ? err.message
            : "Erro ao verificar e-mail. Tente novamente."
        );
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
        <p className="mt-4 text-sm text-muted-foreground">Verificando seu e-mail...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          E-mail verificado!
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Sua conta foi ativada com sucesso. Agora você pode acessar a plataforma.
        </p>
        <Link href="/login">
          <Button variant="gold" size="lg" className="mt-8">
            Ir para o login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="font-serif text-2xl font-semibold text-foreground">
        Verificação falhou
      </h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {errorMsg}
      </p>
      <Link href="/login">
        <Button variant="outline" className="mt-8">
          Voltar ao login
        </Button>
      </Link>
    </div>
  );
}
