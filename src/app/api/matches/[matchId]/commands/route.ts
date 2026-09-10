import { randomUUID } from "node:crypto";
import { z } from "zod";
import { geoConfigSchema } from "@/games/geographie/config";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, reduceGeo } from "@/games/geographie/engine";
import { projectGeo } from "@/games/geographie/projection";
import { geoActionSchema as actionSchema } from "@/games/geographie/types";
import { unoActionSchema, type UnoAction } from "@/games/uno/types";
import { unoConfigSchema } from "@/games/uno/config";
import { reduceUno, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { entropyValues, hashCommand } from "@/server/hash";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { loadGeoContent } from "@/server/geo/content";
import { commitMatch, getMatchSnapshot } from "@/server/matches/repository";

const commandSchema = z.object({
  commandId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  action: z.unknown(),
});

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const originError = assertMutationOrigin(request);
  if (originError) return originError;
  if (!getSupabaseServerConfig()) return jsonError("CONFIGURATION_REQUIRED", 503, "Le serveur de données n'est pas configuré.");
  const member = await getAuthenticatedMember();
  if (!member) return jsonError("UNAUTHORIZED", 401, "Connecte-toi pour jouer.");
  const { matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) return jsonError("MATCH_NOT_FOUND", 404, "Partie introuvable.");
  const body = commandSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
  try {
    const snapshot = await getMatchSnapshot(member.id, matchId);
    const identities = snapshot.players.map((player) => ({ id: player.id, pseudo: player.pseudo })) as [{ id: string; pseudo: string }, { id: string; pseudo: string }];
    const participants = [snapshot.players[0].id, snapshot.players[1].id] as const;
    const nextPhaseId = randomUUID();
    let response: Record<string, unknown>;
    if (snapshot.gameSlug === "geographie") {
      const parsedAction = actionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      const config = geoConfigSchema.parse(snapshot.config);
      const content = await loadGeoContent();
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceGeo(snapshot.state, parsedAction.data, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectGeo(transition.state, config, content, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: GEO_RULES_VERSION, engineVersion: GEO_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "uno") {
      const parsedAction = unoActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      const config = unoConfigSchema.parse(snapshot.config);
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content: null, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceUno(snapshot.state, parsedAction.data as UnoAction, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectUno(transition.state, config, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: UNO_RULES_VERSION, engineVersion: UNO_ENGINE_VERSION });
    } else {
      throw new Error("GAME_NOT_READY");
    }
    return jsonOk(response);
  } catch (error) {
    return mapServerError(error);
  }
}
