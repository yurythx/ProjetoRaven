"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { jsonFetch } from "@/lib/fetch";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Recuperar senha</h1>
      <p className="mt-1 text-sm text-foreground/80">Enviaremos um código de 6 dígitos para você redefinir sua senha.</p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setDone(false);
          const eMail = email.trim();
          if (eMail.length === 0) {
            setError("Informe o e-mail.");
            return;
          }
          setIsSubmitting(true);
          const result = await jsonFetch("/api/auth/password-reset/request", { method: "POST", json: { email: eMail } });
          setIsSubmitting(false);
          if (!result.ok) {
            setError("Falha ao solicitar recuperação. Tente novamente.");
            return;
          }
          setDone(true);
          router.push(`/reset-password?email=${encodeURIComponent(eMail)}`);
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

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {done ? <div className="text-sm text-foreground/80">Se o e-mail existir, enviamos um código.</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Enviar código"}
        </button>
      </form>
    </div>
  );
}

