import type { EngineContext, JobSpec, ResultSpec, RoundRecord, Seat } from "@/games/contracts";
import {
  BOMBPARTY_MAX_TURNS,
  bombpartyConfigSchema,
  bombpartyRuntimeConfigSchema,
  turnSecondsFor,
  type BombpartyConfig,
} from "@/games/bombparty/config";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import {
  bombpartyActionSchema,
  bombpartyContentSchema,
  bombpartyStateSchema,
  type BombpartyAction,
  type BombpartyContent,
  type BombpartyState,
} from "@/games/bombparty/types";

export const BOMBPARTY_RULES_VERSION = "bombparty-1";
export const BOMBPARTY_ENGINE_VERSION = "bombparty-engine-1";

export type BombpartyEngineContext = EngineContext<BombpartyContent>;

export type BombpartyTransition = {
  state: BombpartyState;
  phaseId: string;
  deadlineAt: string | null;
  deadlineKind: string | null;
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
  event: { type: string; payload: Record<string, unknown> };
};

export class BombpartyRuleError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "BombpartyRuleError";
    this.code = code;
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function seatForActor(ctx: BombpartyEngineContext): Seat {
  const seat = ctx.participants.indexOf(ctx.actorId ?? "");
  if (seat !== 0 && seat !== 1) throw new BombpartyRuleError("NOT_A_PARTICIPANT");
  return seat;
}

function entropyUnit(entropy: readonly number[], index: number): number {
  const value = entropy[index];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
    throw new BombpartyRuleError("INVALID_ENTROPY");
  }
  return value;
}

function deadlineJob(ctx: BombpartyEngineContext, phaseId: string, runAt: string): JobSpec {
  return {
    kind: "turn_timeout",
    phaseId,
    runAt,
    dedupeKey: `${ctx.matchId}:${phaseId}:turn_timeout`,
    payload: { matchId: ctx.matchId, phaseId, kind: "turn_timeout" },
  };
}

function transition(
  ctx: BombpartyEngineContext,
  state: BombpartyState,
  options: {
    phaseId?: string;
    deadlineAt: string | null;
    deadlineKind: string | null;
    jobs?: JobSpec[];
    roundRecords?: RoundRecord[];
    result?: ResultSpec | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
  },
): BombpartyTransition {
  return {
    state,
    phaseId: options.phaseId ?? ctx.phaseId,
    deadlineAt: options.deadlineAt,
    deadlineKind: options.deadlineKind,
    jobs: options.jobs ?? [],
    roundRecords: options.roundRecords ?? [],
    result: options.result ?? null,
    event: { type: options.eventType, payload: options.eventPayload ?? {} },
  };
}

function turnTransition(
  ctx: BombpartyEngineContext,
  state: BombpartyState,
  config: BombpartyConfig,
  eventType: string,
  eventPayload?: Record<string, unknown>,
): BombpartyTransition {
  const seconds = turnSecondsFor(state.validWordsTotal, config.initialSeconds);
  const deadlineAt = iso(ctx.nowMs + seconds * 1000);
  const phaseId = ctx.nextPhaseId;
  return transition(ctx, state, {
    phaseId,
    deadlineAt,
    deadlineKind: "turn_timeout",
    jobs: [deadlineJob(ctx, phaseId, deadlineAt)],
    eventType,
    eventPayload,
  });
}

export type BombpartyDifficulty = "easy" | "normal" | "hard";

function categoryOf(totalWords: number): BombpartyDifficulty | null {
  if (totalWords >= 200) return "easy";
  if (totalWords >= 50) return "normal";
  if (totalWords >= 10) return "hard";
  return null;
}

function unusedCount(wordIds: readonly string[], wordById: ReadonlyMap<string, string>, used: ReadonlySet<string>): number {
  let count = 0;
  for (const id of wordIds) {
    const normalized = wordById.get(id);
    if (normalized !== undefined && !used.has(normalized)) {
      count += 1;
      // Les seuils de tirage sont 5 puis 1 : inutile de parcourir les centaines
      // de milliers de formes d'une syllabe fréquente.
      if (count >= 5) return count;
    }
  }
  return count;
}

const wordIdsByContent = new WeakMap<BombpartyContent, Map<string, string>>();

function wordIdsFor(content: BombpartyContent): Map<string, string> {
  const cached = wordIdsByContent.get(content);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const entry of content.words) map.set(entry.id, entry.normalizedForm);
  wordIdsByContent.set(content, map);
  return map;
}

/** Évite de revalider tout l'index à chaque coup : le chargeur l'a déjà fait. */
function contentFromContext(value: unknown): BombpartyContent {
  if (
    typeof value === "object" &&
    value !== null &&
    "packId" in value &&
    "packChecksum" in value &&
    "words" in value &&
    "bySequence" in value &&
    Array.isArray((value as BombpartyContent).words) &&
    typeof (value as BombpartyContent).bySequence === "object" &&
    (value as BombpartyContent).bySequence !== null
  ) {
    return value as BombpartyContent;
  }
  return bombpartyContentSchema.parse(value);
}

/**
 * Choix d'une séquence selon la fiche : catégorie de difficulté exigée avec
 * au moins 5 mots encore inutilisés (en évitant les 5 dernières si possible),
 * élargissement au pool easy/normal/hard avec >= 5, puis >= 1 mot restant,
 * sinon null (épuisement du dictionnaire).
 */
export function chooseBombpartySequence(
  content: BombpartyContent,
  options: { usedWords: ReadonlySet<string>; recentSequences: readonly string[]; difficulty: BombpartyDifficulty; entropyValue: number },
): string | null {
  const wordById = wordIdsFor(content);
  const sequences = Object.keys(content.bySequence).sort();
  const stats = sequences.map((sequence) => {
    const ids = content.bySequence[sequence] ?? [];
    return { sequence, total: ids.length, category: categoryOf(ids.length), unused: unusedCount(ids, wordById, options.usedWords) };
  });
  const recent = new Set(options.recentSequences);
  const avoidRecent = (pool: typeof stats): typeof stats => {
    const filtered = pool.filter((item) => !recent.has(item.sequence));
    return filtered.length > 0 ? filtered : pool;
  };
  const pick = (pool: typeof stats): string | null => {
    if (pool.length === 0) return null;
    const index = Math.floor(options.entropyValue * pool.length);
    const item = pool[Math.min(index, pool.length - 1)];
    return item ? item.sequence : null;
  };
  const inDifficulty = avoidRecent(stats.filter((item) => item.category === options.difficulty && item.unused >= 5));
  const pickedDifficulty = pick(inDifficulty);
  if (pickedDifficulty !== null) return pickedDifficulty;
  const widened = avoidRecent(stats.filter((item) => item.category !== null && item.unused >= 5));
  const pickedWidened = pick(widened);
  if (pickedWidened !== null) return pickedWidened;
  return pick(avoidRecent(stats.filter((item) => item.unused >= 1)));
}

const wordsByNormalized = new WeakMap<BombpartyContent, Map<string, BombpartyContent["words"][number]>>();

function wordByNormalized(content: BombpartyContent): Map<string, BombpartyContent["words"][number]> {
  const cached = wordsByNormalized.get(content);
  if (cached) return cached;
  const map = new Map<string, BombpartyContent["words"][number]>();
  for (const entry of content.words) {
    if (!map.has(entry.normalizedForm)) map.set(entry.normalizedForm, entry);
  }
  wordsByNormalized.set(content, map);
  return map;
}

function metricsFor(state: BombpartyState, seat: Seat): Record<string, unknown> {
  return {
    validWords: state.correctCounts[seat],
    timeouts: state.timeoutCounts[seat],
    responseTotalMs: state.sumResponseMs[seat],
    responseCount: state.responseCount[seat],
    livesRemaining: state.lives[seat],
    longestWordLength: state.longestWordLength[seat],
    meanAcceptedResponseMs: state.responseCount[seat] > 0 ? Math.round(state.sumResponseMs[seat] / state.responseCount[seat]) : null,
  };
}

function resultFor(
  state: BombpartyState,
  ctx: BombpartyEngineContext,
  reason: ResultSpec["reason"],
  outcome: ResultSpec["outcome"],
  winnerSeat: Seat | null,
): ResultSpec {
  return {
    kind: "competitive",
    outcome,
    winnerId: winnerSeat === null ? null : ctx.participants[winnerSeat],
    reason,
    sharedScore: null,
    players: [
      { userId: ctx.participants[0], score: state.correctCounts[0], metrics: metricsFor(state, 0) },
      { userId: ctx.participants[1], score: state.correctCounts[1], metrics: metricsFor(state, 1) },
    ],
    summary: {
      lives: state.lives,
      validWordsTotal: state.validWordsTotal,
      turnsPlayed: state.turn - 1,
      packId: state.packId,
    },
  };
}

function finishedState(state: BombpartyState, result: ResultSpec): BombpartyState {
  return {
    ...state,
    phase: "finished",
    finishedOutcome: result.outcome === "win" ? "win" : result.outcome === "draw" ? "draw" : "abandoned",
    finishedReason: result.reason,
    winnerId: result.winnerId,
  };
}

/** Départage de la limite de 200 tours : vies restantes, puis mots valides, sinon égalité. */
function decideTurnLimit(state: BombpartyState, ctx: BombpartyEngineContext): ResultSpec {
  const [livesA, livesB] = state.lives;
  if (livesA !== livesB) {
    const winner = (livesA > livesB ? 0 : 1) as Seat;
    return resultFor(state, ctx, "turn_limit", "win", winner);
  }
  const [wordsA, wordsB] = state.correctCounts;
  if (wordsA !== wordsB) {
    const winner = (wordsA > wordsB ? 0 : 1) as Seat;
    return resultFor(state, ctx, "turn_limit", "win", winner);
  }
  return resultFor(state, ctx, "turn_limit", "draw", null);
}

function roundRecord(
  ctx: BombpartyEngineContext,
  turn: number,
  summary: Record<string, unknown>,
): RoundRecord {
  return { roundNo: turn, summary, completedAt: iso(ctx.nowMs) };
}

export function initializeBombparty(configInput: unknown, ctx: BombpartyEngineContext): BombpartyTransition {
  const config = bombpartyRuntimeConfigSchema.parse(configInput);
  const content = contentFromContext(ctx.content);
  const firstSeat = config.firstSeat ?? ((entropyUnit(ctx.entropy, 0) < 0.5 ? 0 : 1) as Seat);
  const sequence = chooseBombpartySequence(content, {
    usedWords: new Set(),
    recentSequences: [],
    difficulty: config.sequenceDifficulty,
    entropyValue: entropyUnit(ctx.entropy, 1),
  });
  if (sequence === null) throw new BombpartyRuleError("CONTENT_UNAVAILABLE");
  const state: BombpartyState = {
    schemaVersion: 1,
    phase: "playing",
    activeSeat: firstSeat,
    lives: [config.lives, config.lives],
    turn: 1,
    validWordsTotal: 0,
    sequence,
    recentSequences: [],
    usedWords: [],
    acceptedWords: [],
    packId: content.packId,
    packChecksum: content.packChecksum,
    correctCounts: [0, 0],
    timeoutCounts: [0, 0],
    sumResponseMs: [0, 0],
    responseCount: [0, 0],
    longestWordLength: [0, 0],
    turnStartedAt: iso(ctx.nowMs),
    finishedOutcome: null,
    finishedReason: null,
    winnerId: null,
  };
  return turnTransition({ ...ctx, nextPhaseId: ctx.phaseId }, state, config, "MATCH_STARTED", {
    firstSeat,
    sequence,
  });
}

export function reduceBombparty(
  stateInput: unknown,
  actionInput: BombpartyAction,
  configInput: unknown,
  ctx: BombpartyEngineContext,
): BombpartyTransition {
  const state = bombpartyStateSchema.parse(stateInput);
  const action = bombpartyActionSchema.parse(actionInput);
  const config = bombpartyConfigSchema.parse(configInput);
  const content = contentFromContext(ctx.content);
  if (state.phase === "finished") throw new BombpartyRuleError("MATCH_FINISHED");
  const actorSeat = seatForActor(ctx);

  switch (action.type) {
    case "SUBMIT_WORD":
      return applySubmitWord(ctx, state, action.word, config, content, actorSeat);
    case "RESIGN":
      return abandonTransition(ctx, state, actorSeat, "resign");
  }
}

/**
 * Un refus (mot invalide, inconnu, hors séquence ou déjà utilisé) lève une
 * erreur sans muter l'état : la route ne commit rien, la version et
 * l'échéance du tour restent inchangées.
 */
function applySubmitWord(
  ctx: BombpartyEngineContext,
  state: BombpartyState,
  rawWord: string,
  config: BombpartyConfig,
  content: BombpartyContent,
  actorSeat: Seat,
): BombpartyTransition {
  if (state.phase !== "playing") throw new BombpartyRuleError("WRONG_PHASE");
  // Échéance dépassée : refus avant toute mutation, même si le worker
  // turn_timeout n'a pas encore appliqué la perte de vie (fiche §3).
  if (ctx.currentDeadlineAt !== null && ctx.currentDeadlineAt !== undefined) {
    const deadlineMs = Date.parse(ctx.currentDeadlineAt);
    if (!Number.isNaN(deadlineMs) && ctx.nowMs >= deadlineMs) throw new BombpartyRuleError("DEADLINE_EXPIRED");
  }
  if (state.activeSeat !== actorSeat) throw new BombpartyRuleError("NOT_YOUR_TURN");
  const normalized = normalizeBombpartyWord(rawWord);
  if (normalized === null) throw new BombpartyRuleError("WORD_INVALID");
  if (!normalized.includes(state.sequence)) throw new BombpartyRuleError("WORD_MISSING_SEQUENCE");
  const entry = wordByNormalized(content).get(normalized);
  if (!entry) throw new BombpartyRuleError("WORD_UNKNOWN");
  if (state.usedWords.includes(normalized)) throw new BombpartyRuleError("WORD_ALREADY_USED");

  const responseMs = Math.max(0, ctx.nowMs - Date.parse(state.turnStartedAt));
  const correctCounts: [number, number] = [...state.correctCounts] as [number, number];
  correctCounts[actorSeat] += 1;
  const sumResponseMs: [number, number] = [...state.sumResponseMs] as [number, number];
  sumResponseMs[actorSeat] += responseMs;
  const responseCount: [number, number] = [...state.responseCount] as [number, number];
  responseCount[actorSeat] += 1;
  const longestWordLength: [number, number] = [...state.longestWordLength] as [number, number];
  longestWordLength[actorSeat] = Math.max(longestWordLength[actorSeat], normalized.length);
  const closedTurn = state.turn;
  const validWordsTotal = state.validWordsTotal + 1;
  const accepted = {
    playerId: ctx.actorId ?? "",
    word: entry.displayForm,
    sequence: state.sequence,
    turn: closedTurn,
  };
  let next: BombpartyState = {
    ...state,
    turn: closedTurn + 1,
    validWordsTotal,
    usedWords: [...state.usedWords, normalized],
    acceptedWords: [...state.acceptedWords, accepted],
    correctCounts,
    sumResponseMs,
    responseCount,
    longestWordLength,
    recentSequences: [...state.recentSequences, state.sequence].slice(-5),
  };
  const record = roundRecord(ctx, closedTurn, {
    turn: closedTurn,
    sequence: state.sequence,
    word: entry.displayForm,
    actorSeat,
    outcome: "accepted",
    responseMs,
    livesAfter: next.lives,
  });
  if (closedTurn >= BOMBPARTY_MAX_TURNS) {
    const result = decideTurnLimit(next, ctx);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "turn_limit" },
    });
  }
  const nextSequence = chooseBombpartySequence(content, {
    usedWords: new Set(next.usedWords),
    recentSequences: next.recentSequences,
    difficulty: config.sequenceDifficulty,
    entropyValue: entropyUnit(ctx.entropy, 0),
  });
  if (nextSequence === null) {
    const result = resultFor(next, ctx, "dictionary_exhausted", "draw", null);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "dictionary_exhausted" },
    });
  }
  next = {
    ...next,
    activeSeat: ((1 - actorSeat) as Seat),
    sequence: nextSequence,
    turnStartedAt: iso(ctx.nowMs),
  };
  const opened = turnTransition(ctx, next, config, "WORD_ACCEPTED", {
    actorSeat,
    word: entry.displayForm,
    sequence: state.sequence,
    nextSequence,
    responseMs,
  });
  return { ...opened, roundRecords: [record] };
}

function abandonTransition(
  ctx: BombpartyEngineContext,
  state: BombpartyState,
  actorSeat: Seat,
  reason: "resign" | "claimed_forfeit",
): BombpartyTransition {
  const beforeFirstTurn = state.turn === 1 && state.validWordsTotal === 0;
  if (beforeFirstTurn) {
    const result = resultFor(state, ctx, reason, "abandoned", null);
    return transition(ctx, finishedState(state, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      result,
      eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
      eventPayload: { actorId: ctx.actorId },
    });
  }
  const winner = reason === "claimed_forfeit" ? actorSeat : ((1 - actorSeat) as Seat);
  const result = resultFor(state, ctx, reason, "win", winner);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: reason === "resign" ? "PLAYER_RESIGNED" : "FORFEIT_CLAIMED",
    eventPayload: { actorId: ctx.actorId },
  });
}

export function onBombpartyDeadline(
  stateInput: unknown,
  kind: string,
  configInput: unknown,
  ctx: BombpartyEngineContext,
): BombpartyTransition {
  const state = bombpartyStateSchema.parse(stateInput);
  const config = bombpartyConfigSchema.parse(configInput);
  const content = contentFromContext(ctx.content);
  if (state.phase === "finished") throw new BombpartyRuleError("MATCH_FINISHED");
  if (state.phase !== "playing" || kind !== "turn_timeout") throw new BombpartyRuleError("STALE_DEADLINE");

  const seat = state.activeSeat;
  const lives: [number, number] = [...state.lives] as [number, number];
  lives[seat] = Math.max(0, lives[seat] - 1);
  const timeoutCounts: [number, number] = [...state.timeoutCounts] as [number, number];
  timeoutCounts[seat] += 1;
  const closedTurn = state.turn;
  const next: BombpartyState = {
    ...state,
    lives,
    timeoutCounts,
    turn: closedTurn + 1,
    recentSequences: [...state.recentSequences, state.sequence].slice(-5),
  };
  const record = roundRecord(ctx, closedTurn, {
    turn: closedTurn,
    sequence: state.sequence,
    actorSeat: seat,
    outcome: "timeout",
    livesAfter: lives,
  });
  if (lives[seat] <= 0) {
    const winner = (1 - seat) as Seat;
    const result = resultFor(next, ctx, "normal", "win", winner);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "normal", winnerSeat: winner },
    });
  }
  if (closedTurn >= BOMBPARTY_MAX_TURNS) {
    const result = decideTurnLimit(next, ctx);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "turn_limit" },
    });
  }
  const nextSequence = chooseBombpartySequence(content, {
    usedWords: new Set(next.usedWords),
    recentSequences: next.recentSequences,
    difficulty: config.sequenceDifficulty,
    entropyValue: entropyUnit(ctx.entropy, 0),
  });
  if (nextSequence === null) {
    const result = resultFor(next, ctx, "dictionary_exhausted", "draw", null);
    return transition(ctx, finishedState(next, result), {
      phaseId: ctx.nextPhaseId,
      deadlineAt: null,
      deadlineKind: null,
      roundRecords: [record],
      result,
      eventType: "MATCH_FINISHED",
      eventPayload: { reason: "dictionary_exhausted" },
    });
  }
  const opened = turnTransition(
    ctx,
    { ...next, activeSeat: ((1 - seat) as Seat), sequence: nextSequence, turnStartedAt: iso(ctx.nowMs) },
    config,
    "TURN_TIMED_OUT",
    { actorSeat: seat, sequence: state.sequence, nextSequence },
  );
  return { ...opened, roundRecords: [record] };
}

export function shouldAbandonForBombpartyAbsence(lastSeenAt: readonly [string, string], nowMs: number): boolean {
  const ages = lastSeenAt.map((value) => nowMs - Date.parse(value));
  return ages.some((age) => age >= 30_000);
}

export function onBombpartyAbsence(
  stateInput: unknown,
  configInput: unknown,
  ctx: BombpartyEngineContext,
): BombpartyTransition {
  const state = bombpartyStateSchema.parse(stateInput);
  bombpartyConfigSchema.parse(configInput);
  if (state.phase === "finished") throw new BombpartyRuleError("MATCH_FINISHED");
  const leaverSeat = ctx.actorId ? seatForActor(ctx) : null;
  const winnerSeat = leaverSeat === null ? null : ((1 - leaverSeat) as Seat);
  const result = resultFor(state, ctx, "absence", winnerSeat === null ? "abandoned" : "win", winnerSeat);
  return transition(ctx, finishedState(state, result), {
    phaseId: ctx.nextPhaseId,
    deadlineAt: null,
    deadlineKind: null,
    result,
    eventType: "MATCH_ABANDONED",
    eventPayload: { reason: "absence" },
  });
}

/**
 * Garde anti-rejeu : un job turn_timeout créé pour un tour ne doit jamais
 * muter un tour ultérieur. Les vieux jobs sont déjà annulés au commit, cette
 * garde verrouille le worker avant toute transition.
 */
export function isBombpartyDeadlineJobStale(jobPhaseId: string | null | undefined, currentPhaseId: string): boolean {
  if (!jobPhaseId) return false;
  return jobPhaseId !== currentPhaseId;
}
