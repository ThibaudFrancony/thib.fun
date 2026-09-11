"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export function AuthForm() {
  return (
    <Suspense fallback={<p role="status">Chargement du formulaire…</p>}>
      <AuthFormFromUrl />
    </Suspense>
  );
}

function AuthFormFromUrl() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signUp" ? "signUp" : "signIn";
  return <AuthFormFields key={initialMode} initialMode={initialMode} />;
}

function AuthFormFields({ initialMode }: { initialMode: "signIn" | "signUp" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function provisionAccount() {
    const response = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (response.ok) return true;
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setError(payload?.error?.message ?? "Ton compte n'a pas pu être finalisé. Réessaie dans un instant.");
    return false;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Configure les variables Supabase du navigateur avant de te connecter.");
      setBusy(false);
      return;
    }
    const result = mode === "signIn"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/profil`,
          },
        });
    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signUp") {
      if (result.data.session && await provisionAccount()) {
        router.push("/profil");
        router.refresh();
      } else if (!result.data.session) {
        setNotice("Compte créé. Vérifie ton e-mail pour activer ta session, puis reconnecte-toi.");
      }
    } else {
      if (await provisionAccount()) {
        router.push("/profil");
        router.refresh();
      }
    }
    setBusy(false);
  }

  const callbackError = searchParams.get("error") === "confirmation";

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_12px_30px_rgba(20,33,29,0.06)]">
      <div className="mb-6 flex rounded-full bg-[var(--paper-deep)] p-1 text-sm font-bold"><button type="button" aria-pressed={mode === "signIn"} onClick={() => setMode("signIn")} className={`min-h-11 flex-1 rounded-full px-3 py-2 ${mode === "signIn" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}>Se connecter</button><button type="button" aria-pressed={mode === "signUp"} onClick={() => setMode("signUp")} className={`min-h-11 flex-1 rounded-full px-3 py-2 ${mode === "signUp" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}>Créer un compte</button></div>
      <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
      <input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]" />
      <label className="mt-4 block text-sm font-bold" htmlFor="password">Mot de passe</label>
      <input id="password" required minLength={8} type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]" />
      {callbackError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Le lien de confirmation est invalide ou expiré. Demande un nouvel e-mail puis réessaie.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green-dark)]">{notice}</p>}
      <button disabled={busy} className="mt-6 w-full rounded-full bg-[var(--green)] px-4 py-3 font-bold text-white hover:bg-[var(--green-dark)]">{busy ? "Un instant…" : mode === "signIn" ? "Entrer à la table" : "Créer le compte"}</button>
    </form>
  );
}
