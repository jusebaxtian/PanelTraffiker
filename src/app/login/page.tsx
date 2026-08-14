"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (signInError) {
      setError("Correo o contraseña incorrectos, o el usuario está inactivo.");
      setLoading(false);
      return;
    }

    fetch("/api/auth/record-login", { method: "POST" }).catch(() => {});

    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--page)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-6 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            PT
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            PanelTraffiker
          </span>
        </div>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Correo
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />

        {error && (
          <p className="mb-4 text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--brand)", color: "#ffffff" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
