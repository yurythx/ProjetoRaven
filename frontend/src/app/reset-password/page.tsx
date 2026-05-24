"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { jsonFetch } from "@/lib/fetch";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Redefinir senha</h1>
      <p className="mt-1 text-sm text-foreground/80">Use o código recebido por e-mail para definir uma nova senha.</p>

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
          if (password.length === 0) {
            setError("Informe a nova senha.");
            return;
          }
          if (password !== passwordConfirm) {
            setError("As senhas não coincidem.");
            return;
          }
          setIsSubmitting(true);
          const result = await jsonFetch("/api/auth/password-reset/confirm", {
            method: "POST",
            json: { email: eMail, code: c, new_password: password, new_password_confirm: passwordConfirm },
          });
          setIsSubmitting(false);
          if (!result.ok) {
            setError("Código inválido ou expirado.");
            return;
          }
          router.push("/login");
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Nova senha</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="h-11 rounded-xl border border-foreground/15 bg-background px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Confirmar nova senha</span>
          <input
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            type="password"
            required
            className="h-11 rounded-xl border border-foreground/15 bg-background px-3 text-foreground"
          />
        </label>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

