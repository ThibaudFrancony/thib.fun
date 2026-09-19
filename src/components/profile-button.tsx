"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { cacheAvatar, readCachedAvatar, useIsomorphicLayoutEffect } from "@/lib/avatar-cache";

/**
 * Bouton « Profil » du header : rond d'avatar (photo privée ou initiale) qui
 * mène directement à la page de gestion du profil. La photo est mise en cache
 * dans le navigateur dès le premier affichage, puis relue sans réseau : plus de
 * clignotement de l'ancienne image à chaque navigation. Pastille d'alerte tant
 * que le pseudo unique n'est pas choisi (onboarding).
 */
export function ProfileButton({
  name,
  needsOnboarding,
  preset,
  avatarVersion,
  className = "",
}: {
  name: string;
  needsOnboarding: boolean;
  preset: string;
  avatarVersion: string | null;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    setImageUrl(readCachedAvatar(avatarVersion));
  }, [avatarVersion]);

  useEffect(() => {
    if (!avatarVersion || readCachedAvatar(avatarVersion)) return;
    const controller = new AbortController();
    void cacheAvatar(avatarVersion, `/profil/avatar/image?v=${encodeURIComponent(avatarVersion)}`, controller.signal).then((dataUrl) => {
      if (dataUrl) setImageUrl(dataUrl);
    });
    return () => controller.abort();
  }, [avatarVersion]);

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
