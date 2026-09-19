import { randomUUID } from "node:crypto";
import { z } from "zod";
import { navalConfigSchema } from "@/games/bataille-navale/config";
import { initializeNaval, NAVAL_ENGINE_VERSION, NAVAL_RULES_VERSION } from "@/games/bataille-navale/engine";
import { projectNaval } from "@/games/bataille-navale/projection";
import { compatibiliteConfigSchema } from "@/games/compatibilite/config";
import { COMPATIBILITE_ENGINE_VERSION, COMPATIBILITE_RULES_VERSION, initializeCompatibilite } from "@/games/compatibilite/engine";
import { projectCompatibilite } from "@/games/compatibilite/projection";
import { bombpartyConfigSchema } from "@/games/bombparty/config";
import { initializeBombparty, BOMBPARTY_ENGINE_VERSION, BOMBPARTY_RULES_VERSION } from "@/games/bombparty/engine";
import { projectBombparty } from "@/games/bombparty/projection";
import { geoConfigSchema } from "@/games/geographie/config";
import { GEO_ENGINE_VERSION, GEO_RULES_VERSION, initializeGeo } from "@/games/geographie/engine";
import { projectGeo } from "@/games/geographie/projection";
import { trouNoirConfigSchema } from "@/games/trou-noir/config";
import { initializeTrouNoir, TROU_NOIR_ENGINE_VERSION, TROU_NOIR_RULES_VERSION } from "@/games/trou-noir/engine";
import { projectTrouNoir } from "@/games/trou-noir/projection";
import { trouNoirStateSchema } from "@/games/trou-noir/types";
import { ttmcConfigSchema } from "@/games/ttmc/config";
import { initializeTtmc, TTMC_ENGINE_VERSION, TTMC_RULES_VERSION } from "@/games/ttmc/engine";
import { projectTtmc } from "@/games/ttmc/projection";
import { ttmcStateSchema } from "@/games/ttmc/types";
import { unoConfigSchema } from "@/games/uno/config";
import { initializeUno, UNO_ENGINE_VERSION, UNO_RULES_VERSION } from "@/games/uno/engine";
import { projectUno } from "@/games/uno/projection";
import { skyjoConfigSchema } from "@/games/skyjo/config";
import { initializeSkyjo, SKYJO_ENGINE_VERSION, SKYJO_RULES_VERSION } from "@/games/skyjo/engine";
import { projectSkyjo } from "@/games/skyjo/projection";
import { getAuthenticatedMember } from "@/server/auth";
import { getSupabaseServerConfig } from "@/server/config";
import { entropyValues, newCommandId } from "@/server/hash";
import { assertMutationOrigin, jsonError, jsonOk, mapServerError } from "@/server/http";
import { loadGeoContent } from "@/server/geo/content";
import { loadBombpartyContent, bombpartyContentManifest } from "@/server/bombparty/content";
import { loadTrouNoirContent } from "@/server/quiz/content";
import { getQuizAiConfiguration } from "@/server/quiz/config";
import { loadTtmcContent } from "@/server/ttmc/content";
import { loadCompatibiliteContent } from "@/server/compatibilite/content";
import { longueurOndeConfigSchema } from "@/games/longueur-onde/config";
import { initializeLongueurOnde, LONGUEUR_ONDE_ENGINE_VERSION, LONGUEUR_ONDE_RULES_VERSION } from "@/games/longueur-onde/engine";
import { projectLongueurOnde } from "@/games/longueur-onde/projection";
import { loadLongueurOndeContent } from "@/server/longueur-onde/content";
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
    if (!room.gameSlug) throw new Error("GAME_NOT_READY");
    if (["trou-noir", "ttmc"].includes(room.gameSlug) && !getQuizAiConfiguration()) {
      throw new Error("AI_CONFIGURATION_REQUIRED");
    }
    const participants = [room.members[0].id, room.members[1].id] as const;
    const matchId = randomUUID();
    const phaseId = randomUUID();
    const identities = room.members.map((item) => ({ id: item.id, pseudo: item.pseudo, avatarPreset: item.avatarPreset ?? "avatar-1" })) as [{ id: string; pseudo: string; avatarPreset: string }, { id: string; pseudo: string; avatarPreset: string }];
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
    } else if (room.gameSlug === "trou-noir") {
      const config = trouNoirConfigSchema.parse(room.config);
      const content = await loadTrouNoirContent();
      const transition = initializeTrouNoir(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const parsedState = trouNoirStateSchema.parse(transition.state);
      const views = participants.map((viewerId) => ({
        viewerId,
        payload: projectTrouNoir(parsedState, config, content, viewerId, participants, identities, config, parsedState),
      }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: { packId: content.packId, packVersion: content.packVersion },
        rulesVersion: TROU_NOIR_RULES_VERSION, engineVersion: TROU_NOIR_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "ttmc") {
      const config = ttmcConfigSchema.parse(room.config);
      const content = await loadTtmcContent();
      const transition = initializeTtmc(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const parsedState = ttmcStateSchema.parse(transition.state);
      const views = participants.map((viewerId) => ({
        viewerId,
        payload: projectTtmc(parsedState, config, content, viewerId, participants, identities, config, parsedState),
      }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: { packId: content.packId, packVersion: content.packVersion },
        rulesVersion: TTMC_RULES_VERSION, engineVersion: TTMC_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "skyjo") {
      const config = skyjoConfigSchema.parse(room.config);
      const transition = initializeSkyjo(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content: null,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectSkyjo(transition.state, config, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: {}, rulesVersion: SKYJO_RULES_VERSION, engineVersion: SKYJO_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "bombparty") {
      const config = bombpartyConfigSchema.parse(room.config);
      const content = await loadBombpartyContent();
      const transition = initializeBombparty(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectBombparty(transition.state, config, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: bombpartyContentManifest(content), rulesVersion: BOMBPARTY_RULES_VERSION, engineVersion: BOMBPARTY_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "bataille-navale") {
      const config = navalConfigSchema.parse(room.config);
      const transition = initializeNaval(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content: null,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectNaval(transition.state, config, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: {}, rulesVersion: NAVAL_RULES_VERSION, engineVersion: NAVAL_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "compatibilite") {
      const config = compatibiliteConfigSchema.parse(room.config);
      const content = await loadCompatibiliteContent();
      const transition = initializeCompatibilite(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectCompatibilite(transition.state, config, content, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: { packId: content.packId, packVersion: content.packVersion },
        rulesVersion: COMPATIBILITE_RULES_VERSION, engineVersion: COMPATIBILITE_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else if (room.gameSlug === "longueur-onde") {
      const config = longueurOndeConfigSchema.parse(room.config);
      const content = await loadLongueurOndeContent();
      const transition = initializeLongueurOnde(config, {
        nowMs: Date.now(), actorId: member.id, matchId, participants, content,
        entropy: entropyValues(), phaseId, nextPhaseId: phaseId,
      });
      const views = participants.map((viewerId) => ({ viewerId, payload: projectLongueurOnde(transition.state, config, content, viewerId, participants, identities) }));
      result = await startMatch({
        actorId: member.id, commandId: body.data.commandId ?? newCommandId(), roomId, expectedVersion: room.version,
        matchId, mode: "random", config, state: transition.state, phaseId: transition.phaseId,
        deadlineAt: transition.deadlineAt, deadlineKind: transition.deadlineKind, views, jobs: transition.jobs,
        contentManifest: { packId: content.packId, packVersion: content.packVersion },
        rulesVersion: LONGUEUR_ONDE_RULES_VERSION, engineVersion: LONGUEUR_ONDE_ENGINE_VERSION, stateSchemaVersion: 1,
      });
    } else {
      throw new Error("GAME_NOT_READY");
    }
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return mapServerError(error);
  }
}
