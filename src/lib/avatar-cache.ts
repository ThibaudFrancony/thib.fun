"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Cache navigateur des photos de profil : la première fois qu'une photo est
 * affichée, ses octets sont convertis en data URL et enregistrés dans
 * `localStorage`, sous une clé opaque (empreinte du chemin fournie par le
 * serveur). Les affichages suivants lisent la data URL de façon synchrone, donc
 * sans requête réseau ni clignotement de l'ancienne image.
 */
const PREFIX = "tibofun.avatar.";
const MAX_ENTRIES = 120;
const MAX_DATA_URL_LENGTH = 1024 * 1024;

type Entry = { dataUrl: string; at: number };

/**
 * Clé stable d'une image signée Supabase : le chemin de l'objet dans le bucket
 * (`avatars/<membre>/<fichier>.webp`), sans le jeton qui expire. Elle change
 * dès que la photo est remplacée (nouveau fichier), donc un joueur qui modifie
 * sa photo voit la nouvelle version, tandis qu'une photo inchangée reste servie
 * depuis le cache sans requête. `null` pour les URL non concernées.
 */
export function avatarUrlCacheKey(url: string | null | undefined): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return null;
  try {
    const marker = "/object/sign/";
    const pathname = new URL(url).pathname;
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    const path = pathname.slice(index + marker.length);
    return path.startsWith("avatars/") ? path : null;
  } catch {
    return null;
  }
}

export function readCachedAvatar(version: string | null | undefined): string | null {
  if (!version || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + version);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Entry>;
    return typeof parsed.dataUrl === "string" && parsed.dataUrl.startsWith("data:image/") ? parsed.dataUrl : null;
  } catch {
    return null;
  }
}

function prune(): void {
  const entries: { key: string; at: number }[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "") as Partial<Entry>;
      entries.push({ key, at: typeof parsed.at === "number" ? parsed.at : 0 });
    } catch {
      window.localStorage.removeItem(key);
    }
  }
  if (entries.length <= MAX_ENTRIES) return;
  entries.sort((a, b) => a.at - b.at);
  for (const entry of entries.slice(0, entries.length - MAX_ENTRIES)) {
    window.localStorage.removeItem(entry.key);
  }
}

export function writeCachedAvatar(version: string, dataUrl: string): void {
  if (typeof window === "undefined") return;
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_DATA_URL_LENGTH) return;
  try {
    window.localStorage.setItem(PREFIX + version, JSON.stringify({ dataUrl, at: Date.now() } satisfies Entry));
    prune();
  } catch {
    // Quota indisponible : la photo sera simplement rechargée plus tard.
  }
}

export function clearCachedAvatar(version: string | null | undefined): void {
  if (!version || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + version);
  } catch {
    // Ignoré : rien à nettoyer si le stockage est inaccessible.
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("INVALID_IMAGE")));
    reader.onerror = () => reject(reader.error ?? new Error("INVALID_IMAGE"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Télécharge une image (même origine), la met en cache et renvoie sa data URL.
 * `null` si l'image est absente ou illisible.
 */
export async function cacheAvatar(version: string, url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "force-cache", signal });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await blobToDataUrl(blob);
    writeCachedAvatar(version, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * `useLayoutEffect` côté navigateur (applique le cache avant le premier
 * rendu peint), `useEffect` au rendu serveur pour éviter l'avertissement React.
 */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
