"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type SecurityProps = {
  email: string | null;
  authenticated: boolean;
  isGuest: boolean;
};

export function AccountSecurity({ email: initialEmail, authenticated, isGuest }: SecurityProps) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState<"reset" | "resend" | "password" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    if (authenticated || isGuest) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (active && data.session?.user) setRecoveryReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (active && session?.user && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setRecoveryReady(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [authenticated, isGuest]);

  function clearMessages() {
    setNotice(null);
    setError(null);
  }

  async function sendReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy("reset");
    clearMessages();
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Le service de compte n'est pas configuré.");
        return;
      }
      // Les liens de récupération peuvent revenir avec un token dans le
      // fragment URL. Une page directe laisse le client Supabase le consommer;
      // le callback serveur ne reçoit jamais ce fragment.
      const redirectTo = `${window.location.origin}/profil/mot-de-passe`;
      const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (result.error) {
        setError("Le lien n'a pas pu être envoyé. Vérifie l'adresse puis réessaie.");
        return;
      }
      setNotice("Si cette adresse correspond à un compte, un lien de réinitialisation vient d'être envoyé.");
    } catch {
      setError("Le lien n'a pas pu être envoyé. Vérifie ta connexion puis réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function resendConfirmation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy("resend");
    clearMessages();
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Le service de compte n'est pas configuré.");
        return;
      }
      const result = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2F` },
      });
      if (result.error) {
        setError("Le message de confirmation n'a pas pu être renvoyé. Réessaie plus tard.");
        return;
      }
      setNotice("Si cette adresse attend une confirmation, un nouveau message vient d'être envoyé.");
    } catch {
      setError("Le message de confirmation n'a pas pu être renvoyé. Réessaie plus tard.");
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || password.length < 8 || password !== passwordConfirmation) return;
    setBusy("password");
    clearMessages();
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Le service de compte n'est pas configuré.");
        return;
      }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        setError("Le mot de passe n'a pas pu être changé. Le lien peut avoir expiré.");
        return;
      }
      setPassword("");
      setPasswordConfirmation("");
      setNotice("Ton mot de passe a été changé.");
    } catch {
      setError("Le mot de passe n'a pas pu être changé. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <h2 className="text-xl font-black">Mot de passe oublié</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Reçois un lien sécurisé pour définir un nouveau mot de passe. La réponse reste volontairement la même que l&apos;adresse existe ou non.</p>
        <form onSubmit={sendReset} className="mt-5">
          <label htmlFor="security-email" className="block text-sm font-bold">E-mail du compte</label>
          <input id="security-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3" />
          <button type="submit" disabled={busy !== null || !email.trim()} className="mt-4 min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50">{busy === "reset" ? "Envoi…" : "Envoyer le lien"}</button>
        </form>
        <form onSubmit={resendConfirmation} className="mt-6 border-t border-[var(--line)] pt-5">
          <p className="text-sm font-bold">E-mail de confirmation</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Tu peux demander un nouvel e-mail si le précédent est expiré.</p>
          <button type="submit" disabled={busy !== null || !email.trim()} className="mt-4 min-h-11 rounded-full border border-[var(--green)] px-5 py-3 font-bold text-[var(--green)] disabled:opacity-50">{busy === "resend" ? "Envoi…" : "Renvoyer la confirmation"}</button>
        </form>
      </section>

      <section className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <h2 className="text-xl font-black">Changer le mot de passe</h2>
        {isGuest ? (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Une session invitée n&apos;a pas de mot de passe ni d&apos;adresse à réinitialiser. Crée un compte permanent pour protéger ta progression.</p>
        ) : authenticated || recoveryReady ? (
          <form onSubmit={changePassword} className="mt-5">
            <label htmlFor="new-password" className="block text-sm font-bold">Nouveau mot de passe</label>
            <input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3" />
            <label htmlFor="new-password-confirm" className="mt-4 block text-sm font-bold">Confirmation</label>
            <input id="new-password-confirm" type="password" minLength={8} required autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3" />
            {passwordConfirmation && password !== passwordConfirmation && <p role="alert" className="mt-3 text-sm text-red-700">Les deux mots de passe ne correspondent pas.</p>}
            <button type="submit" disabled={busy !== null || password.length < 8 || password !== passwordConfirmation} className="mt-5 min-h-11 rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold disabled:opacity-50">{busy === "password" ? "Enregistrement…" : "Changer le mot de passe"}</button>
          </form>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Utilise le lien reçu par e-mail pour définir ton nouveau mot de passe.</p>
        )}
      </section>

      {error && <p role="alert" className="md:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="md:col-span-2 rounded-xl bg-[var(--green)]/10 px-3 py-2 text-sm font-bold text-[var(--green-dark)]">{notice}</p>}
    </div>
  );
}
