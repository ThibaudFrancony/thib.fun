import { randomUUID } from "node:crypto";
import { getAuthenticatedMember, getAuthenticatedPermanentMember } from "@/server/auth";
import { CHAT_IMAGE_MAX_INPUT_BYTES, optimizeChatImage } from "@/server/chat/image";
import { getChatMessages, sendChatMessage } from "@/server/chat/repository";
import { chatMessagesQuerySchema, sendChatMessageInputSchema, uuidSchema } from "@/server/chat/schemas";
import { getSupabaseServerConfig } from "@/server/config";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { ALLOWED_IMAGE_CONTENT_TYPES } from "@/server/images/optimizer";
import { createAdminClient } from "@/server/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour lire cette conversation.");
  const values = await params;
  if (!uuidSchema.safeParse(values.conversationId).success) {
    return jsonError("CONVERSATION_NOT_FOUND", 404, "Cette conversation est introuvable.");
  }
  const url = new URL(request.url);
  const query = chatMessagesQuerySchema.safeParse({
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!query.success) return jsonError("INVALID_REQUEST", 400, "La pagination demandée est invalide.");
  try {
    return jsonOk(
      await getChatMessages(member.id, values.conversationId, {
        before: query.data.before,
        limit: query.data.limit,
      }),
    );
  } catch (error) {
    return mapServerError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedPermanentMember();
  if (!member) return jsonError("ACCOUNT_REQUIRED", 403, "Crée un compte pour écrire dans le chat.");
  const values = await params;
  if (!uuidSchema.safeParse(values.conversationId).success) {
    return jsonError("CONVERSATION_NOT_FOUND", 404, "Cette conversation est introuvable.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > CHAT_IMAGE_MAX_INPUT_BYTES + 512 * 1024) {
    return jsonError("IMAGE_TOO_LARGE", 413, "La photo ne doit pas dépasser 4 Mo.");
  }

  const admin = createAdminClient();
  let uploadedPath: string | null = null;
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return jsonError("INVALID_REQUEST", 400, "Le message est invalide.");
    const input = sendChatMessageInputSchema.safeParse({
      requestId: typeof form.get("requestId") === "string" ? form.get("requestId") : null,
      body: typeof form.get("body") === "string" ? form.get("body") : undefined,
    });
    if (!input.success) return jsonError("INVALID_REQUEST", 400, "Le message est invalide.");

    const body = input.data.body?.trim() ? input.data.body.trim() : null;
    const candidate = form.get("file");

    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    if (candidate instanceof File && candidate.size > 0) {
      if (candidate.size > CHAT_IMAGE_MAX_INPUT_BYTES) {
        return jsonError("IMAGE_TOO_LARGE", 413, "La photo ne doit pas dépasser 4 Mo.");
      }
      if (!ALLOWED_IMAGE_CONTENT_TYPES.has(candidate.type)) {
        return jsonError("IMAGE_INVALID", 400, "Utilise une photo JPEG, PNG ou WebP.");
      }
      const optimized = await optimizeChatImage(Buffer.from(await candidate.arrayBuffer()));
      imageWidth = optimized.width;
      imageHeight = optimized.height;
      uploadedPath = `${member.id}/${randomUUID()}.webp`;
      const upload = await admin.storage.from("chat-images").upload(uploadedPath, optimized.data, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upload.error) throw new Error("IMAGE_UNAVAILABLE");
    }

    if (!body && !uploadedPath) return jsonError("MESSAGE_EMPTY", 422, "Écris un message ou joins une photo.");

    const message = await sendChatMessage(member.id, {
      requestId: input.data.requestId,
      conversationId: values.conversationId,
      body,
      imagePath: uploadedPath,
      imageWidth,
      imageHeight,
    });
    return jsonOk({ message });
  } catch (error) {
    if (uploadedPath) {
      await admin.storage.from("chat-images").remove([uploadedPath]).catch(() => undefined);
    }
    if (error instanceof TypeError) return jsonError("INVALID_REQUEST", 400, "Le message est invalide.");
    return mapServerError(error);
  }
}
