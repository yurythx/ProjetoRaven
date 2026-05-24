"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { jsonFetch } from "@/lib/fetch";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshSession } = useAuth();

  const initialEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Confirmar e-mail</h1>
      <p className="mt-1 text-sm text-foreground/80">Informe o código de 6 dígitos que enviamos para seu e-mail.</p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const eMail = email.trim();
          const c = code.trim();
          if (eMail.length === 0) {
            setError("Informe o e-mail.");
            return;
          }
          if (c.length !== 6) {
            setError("Informe o código de 6 dígitos.");
            return;
          }
          setIsSubmitting(true);
          const result = await jsonFetch("/api/auth/verify-email", { method: "POST", json: { email: eMail, code: c } });
          setIsSubmitting(false);
          if (!result.ok) {
            setError("Código inválido ou expirado.");
            return;
          }
          await refreshSession();
          router.push("/me");
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">E-mail</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="h-11 rounded-xl border border-foreground/15 bg-background px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Código</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            pattern="\\d{6}"
            required
            className="h-11 rounded-xl border border-foreground/15 bg-background px-3 text-foreground"
            placeholder="000000"
          />
        </label>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {isSubmitting ? "Confirmando..." : "Confirmar"}
        </button>

        <button
          type="button"
          disabled={isResending}
          className="h-11 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
          onClick={async () => {
            setError(null);
            const eMail = email.trim();
            if (eMail.length === 0) {
              setError("Informe o e-mail.");
              return;
            }
            setIsResending(true);
            const res = await jsonFetch("/api/auth/verify-email/resend", { method: "POST", json: { email: eMail } });
            setIsResending(false);
            if (!res.ok) {
              setError("Falha ao reenviar. Tente novamente.");
              return;
            }
          }}
        >
          {isResending ? "Reenviando..." : "Reenviar código"}
        </button>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}

