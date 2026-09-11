import { randomUUID } from "node:crypto";
import { z } from "zod";
import { geoConfigSchema } from "@/games/geographie/config";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, reduceGeo } from "@/games/geographie/engine";
import { projectGeo } from "@/games/geographie/projection";
import { geoActionSchema as actionSchema } from "@/games/geographie/types";
import { trouNoirConfigSchema } from "@/games/trou-noir/config";
import { reduceTrouNoir, TROU_NOIR_ENGINE_VERSION, TROU_NOIR_RULES_VERSION } from "@/games/trou-noir/engine";
import { projectTrouNoir } from "@/games/trou-noir/projection";
import { trouNoirActionSchema, trouNoirStateSchema } from "@/games/trou-noir/types";
import { ttmcConfigSchema } from "@/games/ttmc/config";
import { reduceTtmc, TTMC_ENGINE_VERSION, TTMC_RULES_VERSION } from "@/games/ttmc/engine";
import { projectTtmc } from "@/games/ttmc/projection";
import { ttmcActionSchema, ttmcStateSchema } from "@/games/ttmc/types";
import { unoActionSchema, type UnoAction } from "@/games/uno/types";
import { unoConfigSchema } from "@/games/uno/config";
import { reduceUno, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
import { skyjoActionSchema } from "@/games/skyjo/types";
import { bombpartyActionSchema } from "@/games/bombparty/types";
import { bombpartyConfigSchema } from "@/games/bombparty/config";
import { reduceBombparty, BOMBPARTY_ENGINE_VERSION, BOMBPARTY_RULES_VERSION } from "@/games/bombparty/engine";
import { projectBombparty } from "@/games/bombparty/projection";
import { skyjoConfigSchema } from "@/games/skyjo/config";
import { reduceSkyjo, SKYJO_ENGINE_VERSION, SKYJO_RULES_VERSION } from "@/games/skyjo/engine";
import { projectSkyjo } from "@/games/skyjo/projection";
import { navalActionSchema } from "@/games/bataille-navale/types";
import { navalConfigSchema } from "@/games/bataille-navale/config";
import { reduceNaval, NAVAL_ENGINE_VERSION, NAVAL_RULES_VERSION } from "@/games/bataille-navale/engine";
import { projectNaval } from "@/games/bataille-navale/projection";
import { compatibiliteActionSchema } from "@/games/compatibilite/types";
import { compatibiliteConfigSchema } from "@/games/compatibilite/config";
import { COMPATIBILITE_ENGINE_VERSION, COMPATIBILITE_RULES_VERSION, reduceCompatibilite } from "@/games/compatibilite/engine";
import { projectCompatibilite } from "@/games/compatibilite/projection";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { entropyValues, hashCommand } from "@/server/hash";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { loadGeoContent } from "@/server/geo/content";
import { loadBombpartyContent } from "@/server/bombparty/content";
import { loadTrouNoirContent } from "@/server/quiz/content";
import { loadTtmcContent } from "@/server/ttmc/content";
import { loadCompatibiliteContent } from "@/server/compatibilite/content";
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
    } else if (snapshot.gameSlug === "trou-noir") {
      const parsedAction = trouNoirActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      if (parsedAction.data.type === "SUBMIT_ANSWER" && parsedAction.data.answer.length > 240) {
        return jsonError("INVALID_REQUEST", 400, "La réponse ne doit pas dépasser 240 caractères.");
      }
      const config = trouNoirConfigSchema.parse(snapshot.config);
      const content = await loadTrouNoirContent();
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceTrouNoir(snapshot.state, parsedAction.data, config, context);
      const parsedState = trouNoirStateSchema.parse(transition.state);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectTrouNoir(parsedState, config, content, viewerId, participants, identities, config, parsedState) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: TROU_NOIR_RULES_VERSION, engineVersion: TROU_NOIR_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "ttmc") {
      const parsedAction = ttmcActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      if (parsedAction.data.type === "SUBMIT_ANSWER" && parsedAction.data.answer.length > 240) {
        return jsonError("INVALID_REQUEST", 400, "La réponse ne doit pas dépasser 240 caractères.");
      }
      const config = ttmcConfigSchema.parse(snapshot.config);
      const content = await loadTtmcContent();
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceTtmc(snapshot.state, parsedAction.data, config, context);
      const parsedState = ttmcStateSchema.parse(transition.state);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectTtmc(parsedState, config, content, viewerId, participants, identities, config, parsedState) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: TTMC_RULES_VERSION, engineVersion: TTMC_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "skyjo") {
      const parsedAction = skyjoActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      const config = skyjoConfigSchema.parse(snapshot.config);
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content: null, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceSkyjo(snapshot.state, parsedAction.data, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectSkyjo(transition.state, config, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: SKYJO_RULES_VERSION, engineVersion: SKYJO_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "bombparty") {
      const parsedAction = bombpartyActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      if (parsedAction.data.type === "SUBMIT_WORD" && parsedAction.data.word.length > 60) {
        return jsonError("INVALID_REQUEST", 400, "Le mot ne doit pas dépasser 60 caractères.");
      }
      const config = bombpartyConfigSchema.parse(snapshot.config);
      const content = await loadBombpartyContent();
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceBombparty(snapshot.state, parsedAction.data, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectBombparty(transition.state, config, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: BOMBPARTY_RULES_VERSION, engineVersion: BOMBPARTY_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "bataille-navale") {
      const parsedAction = navalActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      const config = navalConfigSchema.parse(snapshot.config);
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content: null, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceNaval(snapshot.state, parsedAction.data, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectNaval(transition.state, config, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: NAVAL_RULES_VERSION, engineVersion: NAVAL_ENGINE_VERSION });
    } else if (snapshot.gameSlug === "compatibilite") {
      const parsedAction = compatibiliteActionSchema.safeParse(body.data.action);
      if (!parsedAction.success) return jsonError("INVALID_REQUEST", 400, "La commande de jeu est invalide.");
      const config = compatibiliteConfigSchema.parse(snapshot.config);
      const content = await loadCompatibiliteContent();
      const context = { nowMs: Date.parse(snapshot.serverNow), actorId: member.id, matchId, participants, content, entropy: entropyValues(), phaseId: snapshot.phaseId, nextPhaseId, currentDeadlineAt: snapshot.deadlineAt, currentDeadlineKind: snapshot.deadlineKind };
      const transition = reduceCompatibilite(snapshot.state, parsedAction.data, config, context);
      const views = participants.map((viewerId) => ({ viewerId, payload: projectCompatibilite(transition.state, config, content, viewerId, participants, identities) }));
      response = await commitMatch({ matchId, expectedVersion: body.data.expectedVersion, actorId: member.id, commandId: body.data.commandId, commandHash: hashCommand(matchId, member.id, parsedAction.data.type, parsedAction.data), source: "player", previousPhaseId: snapshot.phaseId, next: { state: transition.state, phaseId: transition.phaseId, deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind }, views, jobsToUpsert: transition.jobs, jobsToCancel: [], roundRecords: transition.roundRecords, event: transition.event, result: transition.result, rulesVersion: COMPATIBILITE_RULES_VERSION, engineVersion: COMPATIBILITE_ENGINE_VERSION });
    } else {
      throw new Error("GAME_NOT_READY");
    }
    return jsonOk(response);
  } catch (error) {
    return mapServerError(error);
  }
}
