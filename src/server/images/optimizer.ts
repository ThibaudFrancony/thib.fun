import "server-only";

import sharp from "sharp";

/**
 * Import statique : Next trace sharp et ses binaires dans les fonctions
 * déployées. Un require construit dynamiquement les omettait du bundle.
 * La signature ne remplace jamais le décodage/réencodage par sharp.
 */
export function imageOptimizerTools() {
  return { detectContentType, getSharp: () => sharp };
}

function detectContentType(input: Buffer): string | null {
  if (input.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export const ALLOWED_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
