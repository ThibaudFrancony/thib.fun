"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AVATAR_PRESETS, AVATAR_PRESET_LABELS, avatarPresetImage, type AvatarPreset } from "./profile-helpers";

type ApiPayload = {
  displayName?: string | null;
  avatarPreset?: AvatarPreset;
  avatarPath?: string | null;
  error?: { message?: string };
};

/**
 * Carte profil : photo (clic = upload), champ Nom unique (nom affiché),
 * grille 5×2 des presets PNG, bouton Enregistrer.
 * Logique serveur inchangée : POST /profil/profile {displayName, avatarPreset},
 * POST /profil/avatar (FormData), DELETE /profil/avatar.
 */
export function ProfileEditor({
  initialName,
  avatarPreset: initialPreset,
  avatarPath: initialAvatarPath,
}: {
  initialName: string;
  avatarPreset: string;
  avatarPath: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(
    AVATAR_PRESETS.includes(initialPreset as AvatarPreset) ? (initialPreset as AvatarPreset) : AVATAR_PRESETS[0],
  );
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [presetBroken, setPresetBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const presetImage = presetBroken ? null : avatarPresetImage(avatarPreset);

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
      const trimmed = name.trim();
      const response = await fetch("/profil/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: trimmed === "" ? null : trimmed, avatarPreset }),
      });
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "Le profil n'a pas pu être enregistré."));
        return;
      }
      if (data?.displayName !== undefined) setName(data.displayName ?? "");
      if (data?.avatarPreset) setAvatarPreset(data.avatarPreset);
      setNotice("Profil enregistré.");
    } catch {
      setError("Enregistrement impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (busy || uploadBusy) return;
    setUploadBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/profil/avatar", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(messageFrom(data, "L'image doit être un JPEG, PNG ou WebP de 2 Mo maximum."));
        return;
      }
      setAvatarPath(data?.avatarPath ?? null);
      setNotice("Photo enregistrée.");
    } catch {
      setError("Envoi impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (busy || uploadBusy || !avatarPath) return;
    setUploadBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/profil/avatar", { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ApiPayload | null;
        setError(messageFrom(data, "La photo n'a pas pu être supprimée."));
        return;
      }
      setAvatarPath(null);
      setAvatarUrl(null);
      setNotice("Photo supprimée.");
    } catch {
      setError("Suppression impossible. Vérifie ta connexion puis réessaie.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <form onSubmit={saveProfile} className="pf-card" aria-label="Mon profil">
      <p className="pf-kicker">Mon profil</p>
      <h1 className="pf-title">
        C&apos;est <span className="pf-title-accent">toi !</span>
      </h1>
      <p className="pf-subtitle">Personnalise ton profil et rejoins la partie !</p>

      <div className="pf-photo-wrap">
        <button
          type="button"
          className="pf-photo-button"
          onClick={() => fileRef.current?.click()}
          aria-label="Changer ma photo de profil"
          disabled={uploadBusy}
        >
          {effectiveAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={effectiveAvatarUrl} alt="Ma photo de profil" />
          ) : presetImage ? (
            <Image
              src={presetImage}
              alt="Mon avatar"
              width={160}
              height={160}
              className="pf-photo-preset"
              onError={() => setPresetBroken(true)}
            />
          ) : (
            <span className="pf-photo-initial" aria-hidden="true">
              {name.trim().slice(0, 1).toLocaleUpperCase("fr-FR") || "?"}
            </span>
          )}
        </button>
        <button
          type="button"
          className="pf-camera"
          onClick={() => fileRef.current?.click()}
          aria-label="Changer ma photo de profil"
          disabled={uploadBusy}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
      </div>
      <p className="pf-photo-hint">{uploadBusy ? "Envoi de la photo…" : "Cliquer pour changer ma photo"}</p>
      {avatarPath && (
        <button type="button" className="pf-photo-remove" onClick={() => void removeAvatar()} disabled={busy || uploadBusy}>
          Supprimer ma photo
        </button>
      )}

      <div className="pf-field">
        <label className="pf-label" htmlFor="profile-name">Nom</label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={24}
          required
          autoComplete="nickname"
          className="pf-input"
        />
        <p className="pf-hint">C&apos;est le nom qui s&apos;affiche pour les autres joueurs.</p>
      </div>

      <fieldset className="pf-avatars" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="pf-label">Choisis un avatar</legend>
        <div className="pf-grid" role="radiogroup" aria-label="Choisis un avatar">
          {AVATAR_PRESETS.map((preset) => {
            const selected = avatarPreset === preset;
            const image = presetBroken ? null : avatarPresetImage(preset);
            return (
              <label key={preset} className="pf-avatar-option" data-selected={selected} title={AVATAR_PRESET_LABELS[preset]}>
                <input
                  type="radio"
                  name="avatar-preset"
                  value={preset}
                  checked={selected}
                  onChange={() => {
                    setAvatarPreset(preset);
                    setPresetBroken(false);
                  }}
                  className="sr-only"
                  aria-label={AVATAR_PRESET_LABELS[preset]}
                />
                <span className="pf-avatar-circle" aria-hidden="true">
                  {image ? (
                    <Image src={image} alt="" width={72} height={72} onError={() => setPresetBroken(true)} />
                  ) : (
                    <span style={{ color: "#fff", fontWeight: 900 }}>{AVATAR_PRESET_LABELS[preset].slice(0, 1)}</span>
                  )}
                </span>
                <span className="pf-avatar-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                    <path d="m3 8.5 3.2 3.2L13 5" />
                  </svg>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="pf-status" role="status" data-tone={error ? "error" : "ok"}>{error ?? notice ?? ""}</p>

      <button type="submit" disabled={busy || uploadBusy} className="pf-cta">
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
