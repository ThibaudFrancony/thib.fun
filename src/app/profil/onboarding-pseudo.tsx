"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiPayload = { effectiveName?: string; error?: { message?: string } };

/**
 * Première connexion d'un compte permanent : choix unique du pseudo.
 * Le nom de création est figé ensuite (contrainte SQL + API).
 */
export function OnboardingPseudo() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/profil/account-name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountName: value }),
      });
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(data?.error?.message ?? "Ce pseudo n'a pas pu être enregistré.");
        return;
      }
      router.refresh();
    } catch {
      setError("Enregistrement impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="onboarding-pseudo-title" className="pf-card" style={{ textAlign: "left" }}>
      <p className="pf-kicker">Première étape</p>
      <h1 id="onboarding-pseudo-title" className="pf-title" style={{ fontSize: "clamp(1.8rem, 4.5vh, 2.6rem)" }}>Choisis ton pseudo.</h1>
      <p className="mt-4 font-bold" style={{ color: "#ff9d9d" }} role="note">Attention : il ne pourra plus être changé.</p>
      <p className="pf-hint">
        C&apos;est le nom que tes partenaires verront dans les groupes et les parties. Tu pourras plus tard ajouter un
        nom affiché qui le remplace à l&apos;écran, mais ce nom de création restera le tien.
      </p>
      <form onSubmit={submit} className="mt-6" style={{ width: "100%" }}>
        <label className="pf-label" htmlFor="onboarding-pseudo">Ton pseudo unique</label>
        <input
          id="onboarding-pseudo"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          minLength={2}
          maxLength={24}
          required
          autoComplete="nickname"
          placeholder="Ex. Tibo le brave"
          className="pf-input"
        />
        <p className="pf-hint">2 à 24 caractères : lettres, chiffres, espaces, tirets ou underscores.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy || value.trim().length < 2} className="pf-cta mt-5">
          {busy ? "Enregistrement…" : "Valider mon pseudo définitif"}
        </button>
      </form>
    </section>
  );
}
