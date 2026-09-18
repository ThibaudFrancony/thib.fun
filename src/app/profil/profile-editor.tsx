"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
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

type ApiPayload = {
  pseudo?: string;
  effectiveName?: string;
  displayName?: string | null;
  avatarPreset?: AvatarPreset;
  avatarPath?: string | null;
  error?: { message?: string };
};

export function ProfileEditor({
  accountName,
  displayName: initialDisplayName,
  avatarPreset: initialPreset,
  avatarPath: initialAvatarPath,
}: {
  accountName: string;
  displayName: string | null;
  avatarPreset: string;
  avatarPath: string | null;
}) {
  const effective = initialDisplayName ?? accountName;
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(AVATAR_PRESETS.includes(initialPreset as AvatarPreset) ? initialPreset as AvatarPreset : AVATAR_PRESETS[0]);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath) return;
    const controller = new AbortController();
    void fetch("/profil/avatar", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? (await response.json()) as { url?: string | null } : null))
      .then((data) => setAvatarUrl(data?.url ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [avatarPath]);

  const effectiveAvatarUrl = avatarPath ? avatarUrl : null;

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
        body: JSON.stringify({ displayName: displayName.trim() === "" ? null : displayName, avatarPreset }),
      });
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "Le profil n'a pas pu être enregistré."));
        return;
      }
      if (data?.displayName !== undefined) setDisplayName(data.displayName ?? "");
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
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "L'avatar n'a pas pu être envoyé."));
        return;
      }
      setAvatarPath(data?.avatarPath ?? null);
      setFile(null);
      setNotice("Photo de profil enregistrée. Elle apparaît dans les groupes et les parties.");
    } catch {
      setError("Envoi impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function removeAvatar() {
    if (busy || uploadBusy) return;
    if (!window.confirm("Supprimer ta photo de profil ? Ton initiale sera affichée à la place.")) return;
    setUploadBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/profil/avatar", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "La photo n'a pas pu être supprimée."));
        return;
      }
      setAvatarPath(null);
      setNotice("Photo supprimée.");
    } catch {
      setError("Suppression impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-5">
      <section aria-labelledby="profile-photo-title" className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <div className="flex items-center gap-4">
          <Avatar name={effective} preset={avatarPreset} imageUrl={effectiveAvatarUrl} size={72} />
          <div>
            <h2 id="profile-photo-title" className="text-xl font-black">Photo de profil</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {avatarPath ? "Visible dans les groupes et les parties." : "Vide pour l'instant : ton initiale est affichée."}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">JPEG, PNG ou WebP, 2 Mo maximum. L&apos;image est recadrée automatiquement puis réduite en WebP 256 × 256 pour un affichage web léger.</p>
        <form onSubmit={uploadAvatar} className="mt-4">
          <label className="block text-sm font-bold" htmlFor="profile-avatar">Choisir une image</label>
          <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={!file || busy || uploadBusy} className="min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50">{uploadBusy ? "Envoi…" : "Téléverser ma photo"}</button>
            {avatarPath && <button type="button" disabled={busy || uploadBusy} onClick={() => void removeAvatar()} className="min-h-11 rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Supprimer</button>}
          </div>
        </form>
      </section>

      <form onSubmit={saveProfile} className="rounded-2xl bg-[var(--paper-deep)] p-5">
        <h2 className="text-xl font-black">Noms</h2>
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Nom de création (figé)</p>
          <p className="mt-1 font-bold">{accountName}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Choisi à la première connexion, il ne peut pas être changé.</p>
        </div>
        <label className="mt-5 block text-sm font-bold" htmlFor="profile-displayname">Nom affiché (optionnel)</label>
        <input
          id="profile-displayname"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          minLength={2}
          maxLength={24}
          placeholder={accountName}
          autoComplete="nickname"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--green)]"
        />
        <p className="mt-2 text-sm text-[var(--muted)]">Laisse vide pour afficher ton nom de création. S&apos;il est rempli, il le remplace partout (groupes, parties, historique).</p>
        <fieldset className="mt-5">
          <legend className="text-sm font-bold">Avatar de secours (sans photo)</legend>
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

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-[var(--green)]/10 px-3 py-2 text-sm font-bold text-[var(--green-dark)]">{notice}</p>}
    </div>
  );
}
