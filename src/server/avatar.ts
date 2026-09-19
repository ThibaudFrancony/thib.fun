import "server-only";

import { createHash } from "node:crypto";

/**
 * Empreinte stable et non réversible du chemin de l'avatar. Elle sert de clé de
 * cache au navigateur sans exposer le chemin brut du bucket privé, et change
 * automatiquement quand la photo est remplacée (nouveau chemin).
 */
export function avatarCacheVersion(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null;
  return createHash("sha256").update(avatarPath).digest("hex").slice(0, 24);
}

/** Un chemin d'avatar est valide s'il appartient au membre et pointe un WebP. */
export function isOwnAvatarPath(path: string, memberId: string): boolean {
  return path.startsWith(`${memberId}/`) && !path.includes("..") && path.endsWith(".webp");
}
