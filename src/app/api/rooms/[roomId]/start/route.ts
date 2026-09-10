import { randomUUID } from "node:crypto";
import { z } from "zod";
import { geoConfigSchema } from "@/games/geographie/config";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, initializeGeo } from "@/games/geographie/engine";
import { projectGeo } from "@/games/geographie/projection";
import { unoConfigSchema } from "@/games/uno/config";
import { initializeUno, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { entropyValues, newCommandId } from "@/server/hash";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { loadGeoContent } from "@/server/geo/content";
import { startMatch, getRoomView } from "@/server/matches/repository";
import { roomViewSchema } from "@/server/rooms/schemas";

const bodySchema = z.object({ commandId: z.string().uuid().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour lancer une partie.");
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) return jsonError("ROOM_NOT_FOUND", 404, "Salon introuvable.");
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La demande de lancement est invalide.");
  try {
    const room = roomViewSchema.parse(await getRoomView(member.id, roomId));
    if (room.members.length !== 2) throw new Error("TWO_PLAYERS_REQUIRED");
    const participants = [room.members[0].id, room.members[1].id] as const;
    const matchId = randomUUID();
    const phaseId = randomUUID();
    const identities = room.members.map((item) => ({ id: item.id, pseudo: item.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
    let result: Record<string, unknown>;
    if (room.gameSlug === "geographie") {
      const config = geoConfigSchema.parse(room.config);
      const content = await loadGeoContent();
      const transition = initializeGeo(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectGeo(transition.state, config, content, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: config.selection, config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: { packId: content.packId, packVersion: content.packVersion },
        rulesVersion: GEO_RULES_VERSION, engineVersion: GEO_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "uno") {
      const config = unoConfigSchema.parse(room.config);
      const transition = initializeUno(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content: null,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectUno(transition.state, config, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: {}, rulesVersion: UNO_RULES_VERSION, engineVersion: UNO_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else {
      throw new Error("GAME_NOT_READY");
    }
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return mapServerError(error);
  }
}
