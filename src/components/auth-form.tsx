"use client";

import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { GuestWarningDialog } from "@/components/guest-warning-dialog";
import { isAnonymousUser } from "@/lib/auth-identity";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const SAFE_ROUTE_PREFIXES = ["/profil", "/salons", "/parties", "/jeux", "/historique", "/entrainement"];
const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function decodeNext(value: string): string | null {
  let decoded = value;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\")) return null;
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return null;
}

function isSafeRoute(pathname: string): boolean {
  return pathname === "/" || SAFE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeNextForOrigin(value: string | null, origin: string, fallback = "/"): string {
  if (!value || value.length > 2048 || CONTROL_CHARACTERS.test(value) || value.includes("\\")) return fallback;
  const decoded = decodeNext(value);
  if (!decoded || !decoded.startsWith("/") || decoded.startsWith("//") || CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\")) return fallback;

  try {
    const resolved = new URL(decoded, origin);
    if (resolved.origin !== new URL(origin).origin || resolved.username || resolved.password || !isSafeRoute(resolved.pathname)) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function safeNext(value: string | null): string {
  return safeNextForOrigin(value, window.location.origin);
}

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
  const searchParams = useSearchParams();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function provisionAccount() {
    const response = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (response.ok) return true;
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    setError(payload?.error?.message ?? "Ton compte n'a pas pu être finalisé. Réessaie dans un instant.");
    return false;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Configure les variables Supabase du navigateur avant de te connecter.");
        return;
      }

      if (mode === "signUp") {
        const session = await supabase.auth.getSession();
        if (isAnonymousUser(session.data.session?.user)) await supabase.auth.signOut({ scope: "local" });
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
          // Full navigation lets SSR consume the auth cookies before rendering.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/profil";
        } else if (!result.data.session) {
          setNotice("Compte créé. Vérifie ton e-mail pour activer ta session, puis reconnecte-toi.");
        }
      } else if (await provisionAccount()) {
        // Full navigation lets SSR consume the auth cookies before rendering.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/profil";
      }
    } catch {
      setError("Connexion impossible pour le moment. Vérifie ta connexion puis réessaie.");
    } finally {
      setBusy(false);
    }
  }

  const closeGuestWarning = useCallback(() => {
    if (!busy) setGuestWarningOpen(false);
  }, [busy]);

  async function continueAsGuest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let supabase: ReturnType<typeof getBrowserSupabase> = null;
    let guestSessionCreated = false;
    try {
      supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Configure les variables Supabase du navigateur avant de jouer en invité.");
        return;
      }
      const result = await supabase.auth.signInAnonymously();
      if (result.error || !result.data.session) {
        setError(result.error?.message ?? "Le mode invité est momentanément indisponible.");
        return;
      }
      guestSessionCreated = true;
      if (!(await provisionAccount())) {
        await supabase.auth.signOut({ scope: "local" });
        guestSessionCreated = false;
        return;
      }
      window.location.href = safeNext(searchParams.get("next"));
    } catch {
      if (guestSessionCreated) await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
      setError("Le mode invité est momentanément indisponible. Réessaie dans un instant.");
    } finally {
      setGuestWarningOpen(false);
      setBusy(false);
    }
  }

  const callbackError = searchParams.get("error") === "confirmation";

  return (
    <form data-auth-hydrated={hydrated} onSubmit={submit} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_12px_30px_rgba(20,33,29,0.06)]">
      <div className="mb-6 flex rounded-full bg-[var(--paper-deep)] p-1 text-sm font-bold"><button type="button" aria-pressed={mode === "signIn"} onClick={() => setMode("signIn")} className={`min-h-11 flex-1 rounded-full px-3 py-2 ${mode === "signIn" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}>Se connecter</button><button type="button" aria-pressed={mode === "signUp"} onClick={() => setMode("signUp")} className={`min-h-11 flex-1 rounded-full px-3 py-2 ${mode === "signUp" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}>Créer un compte</button></div>
      <label className="block text-sm font-bold" htmlFor="email">E-mail</label>
      <input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]" />
      <label className="mt-4 block text-sm font-bold" htmlFor="password">Mot de passe</label>
      <input id="password" required minLength={8} type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]" />
      {callbackError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Le lien de confirmation est invalide ou expiré. Demande un nouvel e-mail puis réessaie.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--green)]/10 px-3 py-2 text-sm text-[var(--green-dark)]">{notice}</p>}
      <button disabled={busy || !hydrated} className="mt-6 w-full rounded-full bg-[var(--green)] px-4 py-3 font-bold text-white hover:bg-[var(--green-dark)]">{busy ? "Un instant…" : mode === "signIn" ? "Entrer à la table" : "Créer le compte"}</button>
      {mode === "signUp" && <div className="mt-6 border-t border-[var(--line)] pt-5 text-center"><p className="text-sm text-[var(--muted)]">Tu veux simplement jouer&nbsp;?</p><button type="button" disabled={busy || !hydrated} onClick={() => setGuestWarningOpen(true)} className="mt-3 min-h-11 rounded-full border border-[var(--green)] px-4 py-3 text-sm font-bold text-[var(--green)] hover:bg-[var(--green)]/10">Continuer en tant qu&apos;invité</button></div>}
      {guestWarningOpen && <GuestWarningDialog busy={busy} onCancel={closeGuestWarning} onConfirm={() => void continueAsGuest()} />}
    </form>
  );
}
