import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/server/supabase/admin";

export type MatchPlayerSnapshot = {
  id: string;
  seat: 0 | 1;
  pseudo: string;
  avatar: Record<string, unknown>;
  isGuest: boolean;
  lastSeenAt?: string;
};

export type MatchSnapshot = {
  matchId: string;
  roomId: string;
  gameSlug: string;
  status: "active" | "completed" | "abandoned";
  mode: "random" | "challenge";
  config: Record<string, unknown>;
  rulesVersion: string;
  engineVersion: string;
  stateSchemaVersion: number;
  version: number;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  startedAt: string;
  players: [MatchPlayerSnapshot, MatchPlayerSnapshot];
  state: unknown;
  view: unknown;
  serverNow: string;
};

export type JobContext = {
  jobId: string;
  jobKind: string;
  jobPhaseId: string | null;
  jobPayload: Record<string, unknown>;
  jobAttempts: number;
  matchId: string;
  roomId: string;
  gameSlug: string;
  status: "active" | "completed" | "abandoned";
  mode: "random" | "challenge";
  config: Record<string, unknown>;
  rulesVersion: string;
  engineVersion: string;
  stateSchemaVersion: number;
  version: number;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  startedAt: string;
  players: MatchPlayerSnapshot[];
  state: unknown;
  serverNow: string;
};

export type HistoryEntry = {
  matchId: string;
  opponentId: string;
  gameSlug: string;
  startedAt: string;
  endedAt: string;
  outcome: "win" | "loss" | "draw" | "cooperative" | "abandoned";
  score: number | null;
  opponentScore: number | null;
  sharedScore: number | null;
  payload: Record<string, unknown>;
};

export type PairHistory = {
  stats: Record<string, unknown> | null;
  entries: HistoryEntry[];
};

function adminClient(client?: SupabaseClient): SupabaseClient {
  return client ?? createAdminClient();
}

export async function getMatchSnapshot(actorId: string, matchId: string, client?: SupabaseClient): Promise<MatchSnapshot> {
  const response = await adminClient(client).rpc("server_get_match", { p_actor: actorId, p_match_id: matchId });
  if (response.error || !response.data) throw new Error("MATCH_NOT_FOUND");
  return response.data as MatchSnapshot;
}

export async function getJobContext(jobId: string, leaseToken: string): Promise<JobContext> {
  const response = await createAdminClient().rpc("server_get_job_context", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (response.error || !response.data) throw new Error("JOB_LEASE_INVALID");
  return response.data as JobContext;
}

export async function matchHeartbeat(actorId: string, matchId: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_match_heartbeat", {
    p_actor: actorId,
    p_match_id: matchId,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function roomHeartbeat(actorId: string, roomId: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_room_heartbeat", {
    p_actor: actorId,
    p_room_id: roomId,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function finishJob(jobId: string, leaseToken: string, status: "done" | "cancelled", errorCode?: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_finish_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_status: status,
    p_error_code: errorCode ?? null,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function failJob(jobId: string, leaseToken: string, errorCode: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_fail_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error_code: errorCode,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function getRoomView(actorId: string, roomId: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_get_room", { p_actor: actorId, p_room_id: roomId });
  if (response.error || !response.data) throw new Error("ROOM_NOT_FOUND");
  return response.data as Record<string, unknown>;
}

function mapHistoryEntry(row: Record<string, unknown>): HistoryEntry {
  return {
    matchId: String(row.match_id),
    opponentId: String(row.opponent_id),
    gameSlug: String(row.game_slug),
    startedAt: String(row.started_at),
    endedAt: String(row.ended_at),
    outcome: row.outcome as HistoryEntry["outcome"],
    score: typeof row.score === "number" ? row.score : row.score === null ? null : Number(row.score),
    opponentScore: typeof row.opponent_score === "number" ? row.opponent_score : row.opponent_score === null ? null : Number(row.opponent_score),
    sharedScore: typeof row.shared_score === "number" ? row.shared_score : row.shared_score === null ? null : Number(row.shared_score),
    payload: (row.payload as Record<string, unknown>) ?? {},
  };
}

function encodeHistoryCursor(entry: HistoryEntry): string {
  return Buffer.from(JSON.stringify({ endedAt: entry.endedAt, matchId: entry.matchId }), "utf8").toString("base64url");
}

function decodeHistoryCursor(cursor: string | undefined): { endedAt: string; matchId: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { endedAt?: unknown; matchId?: unknown };
    if (typeof value.endedAt !== "string" || typeof value.matchId !== "string") return null;
    return { endedAt: value.endedAt, matchId: value.matchId };
  } catch {
    return null;
  }
}

export async function getHistory(actorId: string, options: { cursor?: string; game?: string; outcome?: string } = {}): Promise<{ entries: HistoryEntry[]; nextCursor: string | null }> {
  const client = createAdminClient();
  let query = client
    .from("history_entries")
    .select("match_id,opponent_id,game_slug,started_at,ended_at,outcome,score,opponent_score,shared_score,payload")
    .eq("viewer_id", actorId)
    .order("ended_at", { ascending: false })
    .order("match_id", { ascending: false })
    .limit(21);
  if (options.game) query = query.eq("game_slug", options.game);
  if (options.outcome) query = query.eq("outcome", options.outcome);
  const cursor = decodeHistoryCursor(options.cursor);
  if (cursor) query = query.or(`ended_at.lt.${cursor.endedAt},and(ended_at.eq.${cursor.endedAt},match_id.lt.${cursor.matchId})`);
  const response = await query;
  if (response.error) throw new Error("HISTORY_UNAVAILABLE");
  const rows = (response.data ?? []) as unknown as Record<string, unknown>[];
  const entries = rows.slice(0, 20).map(mapHistoryEntry);
  return { entries, nextCursor: rows.length > 20 && entries.length > 0 ? encodeHistoryCursor(entries[entries.length - 1]) : null };
}

export async function getHistoryEntry(actorId: string, matchId: string): Promise<HistoryEntry | null> {
  const response = await createAdminClient()
    .from("history_entries")
    .select("match_id,opponent_id,game_slug,started_at,ended_at,outcome,score,opponent_score,shared_score,payload")
    .eq("viewer_id", actorId)
    .eq("match_id", matchId)
    .maybeSingle();
  if (response.error) throw new Error("HISTORY_UNAVAILABLE");
  return response.data ? mapHistoryEntry(response.data as unknown as Record<string, unknown>) : null;
}

export async function getPairHistory(actorId: string, opponentId: string, game?: string): Promise<PairHistory> {
  const response = await createAdminClient().rpc("server_get_pair_history", {
    p_actor: actorId,
    p_opponent: opponentId,
    p_game: game ?? null,
  });
  if (response.error || !response.data) throw new Error("HISTORY_UNAVAILABLE");
  const data = response.data as { stats?: Record<string, unknown>[]; entries?: Record<string, unknown>[] };
  return {
    stats: data.stats?.length === 1 ? data.stats[0] ?? null : { games: data.stats ?? [] },
    entries: (data.entries ?? []).map((entry) => mapHistoryEntry({
      match_id: entry.matchId,
      opponent_id: entry.opponentId,
      game_slug: entry.gameSlug,
      started_at: entry.startedAt,
      ended_at: entry.endedAt,
      outcome: entry.outcome,
      score: entry.score,
      opponent_score: entry.opponentScore,
      shared_score: entry.sharedScore,
      payload: entry.payload,
    })),
  };
}

export async function createRoom(actorId: string, requestId: string, gameSlug: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_create_room", {
    p_actor: actorId,
    p_request_id: requestId,
    p_game_slug: gameSlug,
    p_config: config,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function joinRoom(actorId: string, requestId: string, code: string): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_join_room", {
    p_actor: actorId,
    p_request_id: requestId,
    p_code: code,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function setRoomReady(actorId: string, commandId: string, roomId: string, expectedVersion: number, ready: boolean): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_set_room_ready", {
    p_actor: actorId,
    p_command_id: commandId,
    p_room_id: roomId,
    p_expected_version: expectedVersion,
    p_ready: ready,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function startMatch(args: {
  actorId: string;
  commandId: string;
  roomId: string;
  expectedVersion: number;
  matchId: string;
  mode: "random" | "challenge";
  config: Record<string, unknown>;
  state: unknown;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  views: Array<{ viewerId: string; payload: unknown }>;
  jobs: Array<Record<string, unknown>>;
  contentManifest: Record<string, unknown>;
  rulesVersion: string;
  engineVersion: string;
  stateSchemaVersion: number;
}): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_start_match", {
    p_actor: args.actorId,
    p_command_id: args.commandId,
    p_room_id: args.roomId,
    p_expected_version: args.expectedVersion,
    p_match_id: args.matchId,
    p_mode: args.mode,
    p_config: args.config,
    p_state: args.state,
    p_phase_id: args.phaseId,
    p_deadline_at: args.deadlineAt,
    p_deadline_kind: args.deadlineKind,
    p_views: args.views,
    p_jobs: args.jobs,
    p_content_manifest: args.contentManifest,
    p_rules_version: args.rulesVersion,
    p_engine_version: args.engineVersion,
    p_state_schema_version: args.stateSchemaVersion,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}

export async function commitMatch(envelope: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await createAdminClient().rpc("server_commit_match", { p_envelope: envelope });
  if (response.error) throw new Error(response.error.message);
  return response.data as Record<string, unknown>;
}
