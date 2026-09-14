"use client";

import { useEffect, useState } from "react";
import { AVATAR_PRESETS, type AvatarPreset } from "./profile-helpers";

const PRESET_LABELS: Record<AvatarPreset, string> = {
  "orbit-1": "Étoile verte",
  "orbit-2": "Étoile orange",
  "orbit-3": "Lune violette",
  "orbit-4": "Lune bleue",
  "orbit-5": "Soleil jaune",
  "orbit-6": "Soleil rose",
  "orbit-7": "Comète bleue",
  "orbit-8": "Comète rouge",
};

type ApiPayload = { pseudo?: string; avatarPreset?: AvatarPreset; avatarPath?: string | null; error?: { message?: string } };

export function ProfileEditor({ pseudo: initialPseudo, avatarPreset: initialPreset, avatarPath: initialAvatarPath }: { pseudo: string; avatarPreset: string; avatarPath: string | null }) {
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(AVATAR_PRESETS.includes(initialPreset as AvatarPreset) ? initialPreset as AvatarPreset : AVATAR_PRESETS[0]);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarPreview, setAvatarPreview] = useState<{ path: string; url: string | null } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath) return;
    const controller = new AbortController();
    void fetch("/profil/avatar", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { url?: string | null } : null)
      .then((data) => setAvatarPreview({ path: avatarPath, url: data?.url ?? null }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [avatarPath]);

  const avatarUrl = avatarPreview?.path === avatarPath ? avatarPreview.url : null;

  function messageFrom(data: ApiPayload | null, fallback: string): string {
    return data?.error?.message ?? fallback;
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploadBusy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/profil/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pseudo, avatarPreset }),
      });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "Le profil n'a pas pu être enregistré."));
        return;
      }
      if (data?.pseudo) setPseudo(data.pseudo);
      if (data?.avatarPreset) setAvatarPreset(data.avatarPreset);
      setNotice("Ton profil est à jour.");
    } catch {
      setError("Enregistrement impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || uploadBusy) return;
    setUploadBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/profil/avatar", { method: "POST", body: form });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "L'avatar n'a pas pu être envoyé."));
        return;
      }
      setAvatarPath(data?.avatarPath ?? null);
      setFile(null);
      setNotice("Avatar personnalisé enregistré en privé.");
    } catch {
      setError("Envoi impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <form onSubmit={saveProfile} className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <h2 className="text-xl font-black">Identité</h2>
        <label className="mt-5 block text-sm font-bold" htmlFor="profile-pseudo">Pseudo</label>
        <input id="profile-pseudo" value={pseudo} onChange={(event) => setPseudo(event.target.value)} minLength={2} maxLength={24} required className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]" />
        <fieldset className="mt-5">
          <legend className="text-sm font-bold">Avatar de secours</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {AVATAR_PRESETS.map((preset) => (
              <label key={preset} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${avatarPreset === preset ? "border-[var(--green)] bg-white" : "border-[var(--line)]"}`}>
                <input type="radio" name="avatar-preset" value={preset} checked={avatarPreset === preset} onChange={() => setAvatarPreset(preset)} />
                <span>{PRESET_LABELS[preset]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={busy || uploadBusy} className="mt-6 min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer le profil"}</button>
      </form>

      <div className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <h2 className="text-xl font-black">Avatar personnalisé</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">JPEG, PNG ou WebP, 2 Mo maximum. L&apos;image est vérifiée puis réencodée en WebP 256 × 256 dans un espace privé.</p>
        <form onSubmit={uploadAvatar} className="mt-5">
          <label className="block text-sm font-bold" htmlFor="profile-avatar">Choisir une image</label>
          <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
          <button type="submit" disabled={!file || busy || uploadBusy} className="mt-5 min-h-11 rounded-full border border-[var(--green)] px-5 py-3 font-bold text-[var(--green)] disabled:opacity-50">{uploadBusy ? "Envoi…" : "Téléverser l'avatar"}</button>
        </form>
        {avatarPath && <p className="mt-5 text-sm font-bold text-[var(--muted)]">Un avatar privé est enregistré.{avatarUrl && <>{" "}<a href={avatarUrl} target="_blank" rel="noreferrer" className="text-[var(--green)] underline">Ouvrir l&apos;aperçu signé</a></>}</p>}
      </div>

      {error && <p role="alert" className="md:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="md:col-span-2 rounded-xl bg-[var(--green)]/10 px-3 py-2 text-sm font-bold text-[var(--green-dark)]">{notice}</p>}
    </div>
  );
}
