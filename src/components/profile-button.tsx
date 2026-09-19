"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";

/**
 * Bouton « Profil » du header : rond d'avatar (photo privée ou initiale) qui
 * mène directement à la page de gestion du profil. Pastille d'alerte tant que
 * le pseudo unique n'est pas choisi (onboarding).
 */
export function ProfileButton({
  name,
  needsOnboarding,
  preset,
  hasAvatar,
  className = "",
}: {
  name: string;
  needsOnboarding: boolean;
  preset: string;
  hasAvatar: boolean;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAvatar) return;
    const controller = new AbortController();
    void fetch("/profil/avatar", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? (await response.json()) as { url?: string | null } : null))
      .then((data) => setImageUrl(data?.url ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [hasAvatar]);

  return (
    <Link
      href="/profil"
      aria-label={needsOnboarding ? "Profil — choisis ton pseudo" : `Profil — ${name}`}
      className={`relative grid min-h-11 min-w-11 place-items-center rounded-full ${className}`}
    >
      <Avatar name={name} preset={preset} imageUrl={imageUrl} size={36} />
      {needsOnboarding && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[var(--orange)] text-[10px] font-black text-white">
          !
        </span>
      )}
    </Link>
  );
}
