"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";

/**
 * Bouton « Profil » du header : rond d'avatar (photo privée ou initiale) qui
 * ouvre une petite fenêtre ancrée (sans voile) avec l'identité et un lien
 * vers la gestion du profil. Pastille d'alerte tant que le pseudo unique
 * n'est pas choisi (onboarding).
 */
export function ProfileButton({
  name,
  accountName,
  needsOnboarding,
  preset,
  hasAvatar,
  className = "",
}: {
  name: string;
  accountName: string | null;
  needsOnboarding: boolean;
  preset: string;
  hasAvatar: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasAvatar) return;
    const controller = new AbortController();
    void fetch("/profil/avatar", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? (await response.json()) as { url?: string | null } : null))
      .then((data) => setImageUrl(data?.url ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [hasAvatar]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={needsOnboarding ? "Profil — choisis ton pseudo" : `Profil — ${name}`}
        className="relative grid min-h-11 min-w-11 place-items-center rounded-full"
      >
        <Avatar name={name} preset={preset} imageUrl={imageUrl} size={36} />
        {needsOnboarding && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[var(--orange)] text-[10px] font-black text-white">
            !
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Profil" className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <Avatar name={name} preset={preset} imageUrl={imageUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate font-black">{needsOnboarding ? "Bienvenue !" : name}</p>
              {accountName && <p className="truncate text-xs text-[var(--muted)]">Nom de création : {accountName}</p>}
            </div>
          </div>
          {needsOnboarding ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choisis ton pseudo unique : il ne pourra plus être changé.</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Photo, nom affiché et compte.</p>
          )}
          <Link
            href="/profil"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--green)] px-4 py-2 text-sm font-bold text-white"
          >
            Gérer mon profil
          </Link>
        </div>
      )}
    </div>
  );
}
