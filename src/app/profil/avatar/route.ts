import { randomUUID } from "node:crypto";
import { getAuthenticatedAccount } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { ALLOWED_IMAGE_CONTENT_TYPES, imageOptimizerTools } from "@/server/images/optimizer";
import { createAdminClient } from "@/server/supabase/admin";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const SIGNED_URL_SECONDS = 5 * 60;
const ALLOWED_CONTENT_TYPES = ALLOWED_IMAGE_CONTENT_TYPES;

function isOwnAvatarPath(path: string, memberId: string): boolean {
  return path.startsWith(`${memberId}/`) && !path.includes("..") && path.endsWith(".webp");
}

export async function GET() {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour voir ton avatar.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Les avatars personnalisés sont réservés aux comptes permanents.");
  const path = account.member.avatarPath;
  if (!path) return jsonOk({ url: null, expiresIn: SIGNED_URL_SECONDS });
  if (!isOwnAvatarPath(path, account.member.id)) return jsonError("DATABASE_UNAVAILABLE", 503, "L'avatar enregistré est indisponible.");
  try {
    const { data, error } = await createAdminClient().storage.from("avatars").createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw new Error("DATABASE_UNAVAILABLE");
    return jsonOk({ url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS });
  } catch (error) {
    return mapServerError(error);
  }
}

export async function DELETE(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ton avatar.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte permanent pour modifier ton avatar.");
  const path = account.member.avatarPath;
  if (!path) return jsonOk({ avatarPath: null });
  if (!isOwnAvatarPath(path, account.member.id)) return jsonError("DATABASE_UNAVAILABLE", 503, "L'avatar enregistré est indisponible.");
  try {
    const admin = createAdminClient();
    const updated = await admin.from("profiles").update({ avatar_path: null }).eq("id", account.member.id);
    if (updated.error) throw new Error("DATABASE_UNAVAILABLE");
    await admin.storage.from("avatars").remove([path]);
    return jsonOk({ avatarPath: null });
  } catch (error) {
    return mapServerError(error);
  }
}

export async function POST(request: Request) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const account = await getAuthenticatedAccount();
  if (!account) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour modifier ton avatar.");
  if (account.isGuest) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte permanent pour téléverser un avatar.");

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES + 128 * 1024) {
    return jsonError("INVALID_REQUEST", 413, "L'image ne doit pas dépasser 2 Mo.");
  }

  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File) || candidate.size === 0 || candidate.size > MAX_BYTES) {
      return jsonError("INVALID_REQUEST", 413, "L'image doit être un fichier de 2 Mo maximum.");
    }
    if (!ALLOWED_CONTENT_TYPES.has(candidate.type)) return jsonError("INVALID_REQUEST", 400, "Utilise une image JPEG, PNG ou WebP.");

    const input = Buffer.from(await candidate.arrayBuffer());
    const { detectContentType, getSharp } = imageOptimizerTools();
    const detected = await detectContentType(input);
    if (!detected || detected !== candidate.type || !ALLOWED_CONTENT_TYPES.has(detected)) {
      return jsonError("INVALID_REQUEST", 400, "Le contenu réel de l'image ne correspond pas à son type.");
    }

    const sharp = getSharp();
    const metadata = await sharp(input, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return jsonError("INVALID_REQUEST", 400, "Les dimensions maximales sont de 4096 × 4096 pixels.");
    }
    const output = await sharp(input, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
      .rotate()
      .resize({ width: 256, height: 256, fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    const path = `${account.member.id}/${randomUUID()}.webp`;
    const admin = createAdminClient();
    const upload = await admin.storage.from("avatars").upload(path, output, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (upload.error) throw new Error("DATABASE_UNAVAILABLE");
    const previous = account.member.avatarPath;
    const updated = await admin.from("profiles").update({ avatar_path: path }).eq("id", account.member.id);
    if (updated.error) {
      await admin.storage.from("avatars").remove([path]);
      throw new Error("DATABASE_UNAVAILABLE");
    }
    // Hygiène de stockage : un seul avatar actif par compte. L'ancien fichier
    // est supprimé en best-effort, sans faire échouer la requête.
    if (previous && previous !== path && isOwnAvatarPath(previous, account.member.id)) {
      await admin.storage.from("avatars").remove([previous]).catch(() => undefined);
    }
    return jsonOk({ avatarPath: path, width: 256, height: 256 });
  } catch (error) {
    if (error instanceof TypeError) return jsonError("INVALID_REQUEST", 400, "Le fichier image est invalide.");
    return mapServerError(error);
  }
}
