import "server-only";

import { ALLOWED_IMAGE_CONTENT_TYPES, imageOptimizerTools } from "@/server/images/optimizer";

export const CHAT_IMAGE_MAX_INPUT_BYTES = 4 * 1024 * 1024;
export const CHAT_IMAGE_MAX_SOURCE_DIMENSION = 4096;
export const CHAT_IMAGE_MAX_DIMENSION = 1280;
export const CHAT_IMAGE_MAX_OUTPUT_BYTES = 400 * 1024;

const QUALITY_LADDER = [72, 60, 50] as const;

export type OptimizedChatImage = {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Re-encode serveur d'une photo de chat : WebP, 1280 px maximum, qualité
 * dégradée jusqu'à tenir dans un format léger. Le client compresse déjà,
 * mais le serveur ne fait jamais confiance au fichier reçu.
 */
export async function optimizeChatImage(input: Buffer): Promise<OptimizedChatImage> {
  // Une panne de chargement du décodeur est un problème serveur, pas un
  // fichier invalide. Ne pas la masquer par IMAGE_INVALID.
  let tools: ReturnType<typeof imageOptimizerTools>;
  try {
    tools = imageOptimizerTools();
  } catch {
    throw new Error("IMAGE_UNAVAILABLE");
  }
  if (input.byteLength > CHAT_IMAGE_MAX_INPUT_BYTES) throw new Error("IMAGE_TOO_LARGE");
  try {
    const { detectContentType, getSharp } = tools;
    const detected = await detectContentType(input);
    if (!detected || !ALLOWED_IMAGE_CONTENT_TYPES.has(detected)) throw new Error("IMAGE_INVALID");

    const sharp = getSharp();
    const metadata = await sharp(input, {
      limitInputPixels: CHAT_IMAGE_MAX_SOURCE_DIMENSION * CHAT_IMAGE_MAX_SOURCE_DIMENSION,
    }).metadata();
    if (
      !metadata.width
      || !metadata.height
      || metadata.width > CHAT_IMAGE_MAX_SOURCE_DIMENSION
      || metadata.height > CHAT_IMAGE_MAX_SOURCE_DIMENSION
    ) {
      throw new Error("IMAGE_INVALID");
    }

    let last: OptimizedChatImage | null = null;
    for (const quality of QUALITY_LADDER) {
      const { data, info } = await sharp(input, {
        limitInputPixels: CHAT_IMAGE_MAX_SOURCE_DIMENSION * CHAT_IMAGE_MAX_SOURCE_DIMENSION,
      })
        .rotate()
        .resize({
          width: CHAT_IMAGE_MAX_DIMENSION,
          height: CHAT_IMAGE_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
      last = { data, width: info.width, height: info.height, bytes: data.byteLength };
      if (data.byteLength <= 200 * 1024) break;
    }
    if (!last) throw new Error("IMAGE_INVALID");
    if (last.bytes > CHAT_IMAGE_MAX_OUTPUT_BYTES) throw new Error("IMAGE_TOO_LARGE");
    return last;
  } catch (error) {
    // Ne jamais exposer un 500 opaque (binaire sharp absent, format exotique,
    // plantage décodeur) : on journalise la cause puis on renvoie un code
    // d'erreur stable et lisible.
    if (error instanceof Error && (error.message === "IMAGE_INVALID" || error.message === "IMAGE_TOO_LARGE")) {
      throw error;
    }
    console.error("Chat image optimization failed", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    throw new Error("IMAGE_INVALID");
  }
}
