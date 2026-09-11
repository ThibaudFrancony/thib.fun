import { describe, expect, it } from "vitest";
import { turnSecondsFor } from "@/games/bombparty/config";
import {
  chooseBombpartySequence,
  initializeBombparty,
  isBombpartyDeadlineJobStale,
  onBombpartyAbsence,
  onBombpartyDeadline,
  reduceBombparty,
  shouldAbandonForBombpartyAbsence,
  type BombpartyEngineContext,
} from "@/games/bombparty/engine";
import { normalizeBombpartyWord } from "@/games/bombparty/normalize";
import type { BombpartyContent, BombpartyState } from "@/games/bombparty/types";

const PARTICIPANTS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] as const;
const MATCH_ID = "33333333-3333-4333-8333-333333333333";

const FIXTURE_WORDS: Array<[string, string]> = [
  ["a", "chat"],
  ["b", "château"],
  ["c", "chien"],
  ["d", "niche"],
  ["e", "arche"],
  ["f", "marcher"],
];

function fixtureContent(): BombpartyContent {
  const words = FIXTURE_WORDS.map(([id, displayForm]) => ({
    id,
    displayForm,
    normalizedForm: normalizeBombpartyWord(displayForm) ?? displayForm,
  }));
  const index = new Map<string, string[]>();
  for (const entry of words) {
    const seen = new Set<string>();
    for (let length = 2; length <= 3; length += 1) {
      for (let start = 0; start + length <= entry.normalizedForm.length; start += 1) {
        const sequence = entry.normalizedForm.slice(start, start + length);
        if (seen.has(sequence)) continue;
        seen.add(sequence);
        const list = index.get(sequence) ?? [];
        list.push(entry.id);
        index.set(sequence, list);
      }
    }
  }
  const bySequence: Record<string, string[]> = {};
  for (const key of [...index.keys()].sort()) bySequence[key] = (index.get(key) ?? []).sort();
  return { packId: "bombparty-test", packChecksum: "checksum-test", words, bySequence };
}

function contextFor(overrides: Partial<BombpartyEngineContext> = {}): BombpartyEngineContext {
  return {
    nowMs: Date.parse("2026-09-11T12:00:00.000Z"),
    actorId: PARTICIPANTS[0],
    matchId: MATCH_ID,
    participants: [PARTICIPANTS[0], PARTICIPANTS[1]],
    content: fixtureContent(),
    entropy: [0.1, 0.4, 0.7],
    phaseId: "phase-1",
    nextPhaseId: "phase-2",
    currentDeadlineAt: null,
    currentDeadlineKind: null,
    ...overrides,
  };
}

function wordContaining(sequence: string, exclude: readonly string[] = []): string {
  const content = fixtureContent();
  const entry = content.words.find((item) => item.normalizedForm.includes(sequence) && !exclude.includes(item.normalizedForm));
  if (!entry) throw new Error(`aucun mot de fixture pour la séquence ${sequence}`);
  return entry.displayForm;
}

describe("durée des tours", () => {
  it("vaut initialSeconds puis décroît aux multiples exacts de 6, plancher 5", () => {
    expect(turnSecondsFor(0, 15)).toBe(15);
    expect(turnSecondsFor(5, 15)).toBe(15);
    expect(turnSecondsFor(6, 15)).toBe(14);
    expect(turnSecondsFor(12, 15)).toBe(13);
    expect(turnSecondsFor(60, 15)).toBe(5);
    expect(turnSecondsFor(600, 10)).toBe(5);
    expect(turnSecondsFor(0, 10)).toBe(10);
    expect(turnSecondsFor(0, 20)).toBe(20);
  });
});

describe("initialisation", () => {
  it("tire le premier siège et une séquence avec une deadline complète", () => {
    const transition = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    expect(transition.state.phase).toBe("playing");
    expect(transition.state.activeSeat).toBe(0);
    expect(transition.state.lives).toEqual([3, 3]);
    expect(transition.state.sequence).toMatch(/^[a-z]{2,3}$/);
    expect(transition.deadlineKind).toBe("turn_timeout");
    expect(transition.deadlineAt).toBe("2026-09-11T12:00:15.000Z");
    expect(transition.jobs).toHaveLength(1);
    expect(transition.jobs[0]?.dedupeKey).toBe(`${MATCH_ID}:phase-1:turn_timeout`);
  });

  it("refuse un contenu sans séquence jouable", () => {
    const empty: BombpartyContent = { packId: "x", packChecksum: "y", words: [], bySequence: {} };
    expect(() => initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor({ content: empty }))).toThrowError(
      "CONTENT_UNAVAILABLE",
    );
  });
});

describe("mot accepté", () => {
  it("passe la main, tire une nouvelle séquence et enregistre le tour", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const word = wordContaining(started.state.sequence);
    const transition = reduceBombparty(
      started.state,
      { type: "SUBMIT_WORD", word },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ nowMs: Date.parse("2026-09-11T12:00:04.000Z"), entropy: [0.9] }),
    );
    expect(transition.state.activeSeat).toBe(1);
    expect(transition.state.turn).toBe(2);
    expect(transition.state.validWordsTotal).toBe(1);
    expect(transition.state.correctCounts).toEqual([1, 0]);
    expect(transition.state.acceptedWords).toHaveLength(1);
    expect(transition.state.usedWords).toHaveLength(1);
    expect(transition.event.type).toBe("WORD_ACCEPTED");
    expect(transition.roundRecords).toHaveLength(1);
    expect(transition.roundRecords[0]?.summary).toMatchObject({ turn: 1, outcome: "accepted", responseMs: 4000 });
    // Nouveau tour : durée complète depuis le commit, pas depuis l'ancienne échéance.
    expect(transition.deadlineAt).toBe("2026-09-11T12:00:19.000Z");
  });

  it("compte les accents comme leur forme normalisée", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const state = { ...started.state, sequence: "tea", activeSeat: 0 as const };
    const transition = reduceBombparty(
      state,
      { type: "SUBMIT_WORD", word: "CHÂTEAU" },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ entropy: [0.2] }),
    );
    expect(transition.state.validWordsTotal).toBe(1);
    expect(transition.state.usedWords).toEqual(["chateau"]);
  });
});

describe("refus sans changement de deadline", () => {
  function playingWithSequence(sequence: string): BombpartyState {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    return { ...started.state, sequence, activeSeat: 0 };
  }

  it.each([
    ["WORD_INVALID", "a-b"],
    ["WORD_MISSING_SEQUENCE", "marcher"],
    ["WORD_UNKNOWN", "chateletzz"],
  ])("refuse %s sans muter le tour", (code, word) => {
    const state = playingWithSequence("cha");
    const ctx = contextFor({ nowMs: Date.parse("2026-09-11T12:00:01.000Z") });
    expect(() => reduceBombparty(state, { type: "SUBMIT_WORD", word }, { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, ctx)).toThrowError(
      code,
    );
    expect(state.turn).toBe(1);
    expect(state.turnStartedAt).toBe("2026-09-11T12:00:00.000Z");
  });

  it("refuse un mot déjà utilisé dans la partie, même par l'adversaire", () => {
    const state = playingWithSequence("cha");
    const ctx = contextFor({ entropy: [0.2] });
    const first = reduceBombparty(state, { type: "SUBMIT_WORD", word: "chat" }, { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, ctx);
    const replay = { ...first.state, sequence: "cha", activeSeat: 1 as const };
    expect(() =>
      reduceBombparty(replay, { type: "SUBMIT_WORD", word: "chat" }, { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor({ actorId: PARTICIPANTS[1], entropy: [0.2] })),
    ).toThrowError("WORD_ALREADY_USED");
  });

  it("un refus ne réinitialise pas le chrono du tour", () => {
    const state = playingWithSequence("cha");
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    expect(() =>
      reduceBombparty(state, { type: "SUBMIT_WORD", word: "zzz" }, config, contextFor({ nowMs: Date.parse("2026-09-11T12:00:01.000Z") })),
    ).toThrowError("WORD_MISSING_SEQUENCE");
    const transition = reduceBombparty(
      state,
      { type: "SUBMIT_WORD", word: "chat" },
      config,
      contextFor({ nowMs: Date.parse("2026-09-11T12:00:03.000Z"), entropy: [0.2] }),
    );
    expect(transition.roundRecords[0]?.summary).toMatchObject({ responseMs: 3000 });
  });

  it("refuse le mot du joueur qui n'a pas la main", () => {
    const state = playingWithSequence("cha");
    expect(() =>
      reduceBombparty(
        state,
        { type: "SUBMIT_WORD", word: "chat" },
        { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
        contextFor({ actorId: PARTICIPANTS[1] }),
      ),
    ).toThrowError("NOT_YOUR_TURN");
  });
});

describe("timeout du tour", () => {
  it("retire une vie, change de joueur et ouvre un tour complet", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const transition = onBombpartyDeadline(
      started.state,
      "turn_timeout",
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: null, nowMs: Date.parse("2026-09-11T12:00:16.000Z"), entropy: [0.5] }),
    );
    expect(transition.state.lives).toEqual([2, 3]);
    expect(transition.state.timeoutCounts).toEqual([1, 0]);
    expect(transition.state.activeSeat).toBe(1);
    expect(transition.state.turn).toBe(2);
    expect(transition.deadlineAt).toBe("2026-09-11T12:00:31.000Z");
    expect(transition.event.type).toBe("TURN_TIMED_OUT");
    expect(transition.roundRecords[0]?.summary).toMatchObject({ turn: 1, outcome: "timeout" });
  });

  it("termine la partie quand le joueur tombe à zéro vie", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const state: BombpartyState = { ...started.state, lives: [1, 3], activeSeat: 0 };
    const transition = onBombpartyDeadline(
      state,
      "turn_timeout",
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: null, entropy: [0.5] }),
    );
    expect(transition.state.phase).toBe("finished");
    expect(transition.result).toMatchObject({ outcome: "win", reason: "normal", winnerId: PARTICIPANTS[1] });
    expect(transition.result?.players[0]?.score).toBe(0);
  });

  it("rejette les jobs d'une autre échéance et les phases terminées", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    expect(() =>
      onBombpartyDeadline(started.state, "advance_reveal", { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor({ actorId: null })),
    ).toThrowError("STALE_DEADLINE");
    const finished: BombpartyState = { ...started.state, phase: "finished" };
    expect(() =>
      onBombpartyDeadline(finished, "turn_timeout", { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor({ actorId: null })),
    ).toThrowError("MATCH_FINISHED");
  });
});

describe("limite de 200 tours et départage", () => {
  function stateAtTurn200(overrides: Partial<BombpartyState>): BombpartyState {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    return { ...started.state, turn: 200, activeSeat: 0, ...overrides };
  }

  it("compare les vies restantes puis les mots valides", () => {
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    const byLives = reduceBombparty(
      stateAtTurn200({ lives: [3, 2], correctCounts: [0, 9] }),
      { type: "SUBMIT_WORD", word: wordContaining(stateAtTurn200({}).sequence) },
      config,
      contextFor({ entropy: [0.3] }),
    );
    // Mot valide au 200e tour : les vies (3 contre 2) départagent malgré les mots.
    expect(byLives.result).toMatchObject({ outcome: "win", reason: "turn_limit", winnerId: PARTICIPANTS[0] });

    const wordsState = stateAtTurn200({});
    const byWords = reduceBombparty(
      { ...wordsState, lives: [2, 2], correctCounts: [4, 6], sequence: wordsState.sequence },
      { type: "SUBMIT_WORD", word: wordContaining(wordsState.sequence) },
      config,
      contextFor({ entropy: [0.3] }),
    );
    // Le mot du siège 0 le fait passer à 5 contre 6 : le siège 1 gagne aux mots.
    expect(byWords.result).toMatchObject({ outcome: "win", reason: "turn_limit", winnerId: PARTICIPANTS[1] });
  });

  it("déclare draw à égalité parfaite", () => {
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    const state = stateAtTurn200({ lives: [2, 3], correctCounts: [5, 5], activeSeat: 1 });
    const transition = onBombpartyDeadline(
      state,
      "turn_timeout",
      config,
      contextFor({ actorId: null, entropy: [0.3] }),
    );
    // Vies après timeout : [2, 2], mots : [5, 5] → égalité.
    expect(transition.result).toMatchObject({ outcome: "draw", reason: "turn_limit", winnerId: null });
  });

  it("timeout au 200e tour : les vies restantes départagent après décrément", () => {
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    const state = stateAtTurn200({ lives: [3, 3], correctCounts: [9, 0], activeSeat: 0 });
    const transition = onBombpartyDeadline(state, "turn_timeout", config, contextFor({ actorId: null, entropy: [0.3] }));
    // Vies après timeout : [2, 3] → le siège 1 gagne aux vies malgré ses 0 mot.
    expect(transition.result).toMatchObject({ outcome: "win", reason: "turn_limit", winnerId: PARTICIPANTS[1] });
    expect(transition.result?.players[0]?.score).toBe(9);
    expect(transition.result?.players[1]?.score).toBe(0);
  });
});

describe("épuisement du dictionnaire", () => {
  it("chooseBombpartySequence retourne null quand tout est utilisé", () => {
    const content = fixtureContent();
    const used = new Set(content.words.map((entry) => entry.normalizedForm));
    expect(chooseBombpartySequence(content, { usedWords: used, recentSequences: [], difficulty: "normal", entropyValue: 0.5 })).toBeNull();
  });
  it("termine en draw dictionary_exhausted sur acceptation sans séquence suivante", () => {
    const single: BombpartyContent = {
      packId: "single",
      packChecksum: "single",
      words: [{ id: "w", displayForm: "ab", normalizedForm: "ab" }],
      bySequence: { ab: ["w"] },
    };
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    const started = initializeBombparty(config, contextFor({ content: single }));
    expect(started.state.sequence).toBe("ab");
    const transition = reduceBombparty(
      started.state,
      { type: "SUBMIT_WORD", word: "ab" },
      config,
      contextFor({ content: single, entropy: [0.5] }),
    );
    expect(transition.state.phase).toBe("finished");
    expect(transition.result).toMatchObject({ outcome: "draw", reason: "dictionary_exhausted", winnerId: null });
    expect(transition.roundRecords).toHaveLength(1);
  });
  it("termine en draw dictionary_exhausted au timeout sans séquence restante", () => {
    const single: BombpartyContent = {
      packId: "single",
      packChecksum: "single",
      words: [{ id: "w", displayForm: "ab", normalizedForm: "ab" }],
      bySequence: { ab: ["w"] },
    };
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor({ content: single }));
    const state: BombpartyState = { ...started.state, usedWords: ["ab"], activeSeat: 0 };
    const transition = onBombpartyDeadline(
      state,
      "turn_timeout",
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: null, content: single, entropy: [0.5] }),
    );
    expect(transition.state.phase).toBe("finished");
    expect(transition.result).toMatchObject({ outcome: "draw", reason: "dictionary_exhausted" });
  });
});

describe("sélection des séquences : 5 candidats, recent, élargissement", () => {
  function syntheticContent(): BombpartyContent {
    // Deux séquences normales (>= 50 mots) : "aa" avec 60 mots, "bb" avec 55 mots.
    const words: BombpartyContent["words"] = [];
    const aaIds: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      const suffix = String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26));
      const normalizedForm = `aa${suffix}`;
      words.push({ id: `aa-${i}`, displayForm: normalizedForm, normalizedForm });
      aaIds.push(`aa-${i}`);
    }
    const bbIds: string[] = [];
    for (let i = 0; i < 55; i += 1) {
      const suffix = String.fromCharCode(97 + (i % 26)) + String.fromCharCode(98 + Math.floor(i / 26));
      const normalizedForm = `bb${suffix}`;
      words.push({ id: `bb-${i}`, displayForm: normalizedForm, normalizedForm });
      bbIds.push(`bb-${i}`);
    }
    return { packId: "synthetic", packChecksum: "synthetic", words, bySequence: { aa: [...aaIds].sort(), bb: [...bbIds].sort() } };
  }

  it("ignore une séquence de la difficulté avec moins de 5 mots inutilisés et élargit", () => {
    const content = syntheticContent();
    // "aa" n'a plus que 3 mots inutilisés : la sélection doit élargir vers "bb".
    const usedAa = new Set(content.words.filter((entry) => entry.id.startsWith("aa-")).slice(0, 57).map((entry) => entry.normalizedForm));
    const picked = chooseBombpartySequence(content, { usedWords: usedAa, recentSequences: [], difficulty: "normal", entropyValue: 0.0 });
    expect(picked).toBe("bb");
  });

  it("évite les 5 dernières séquences quand un autre candidat existe", () => {
    const content = syntheticContent();
    const picked = chooseBombpartySequence(content, { usedWords: new Set(), recentSequences: ["aa"], difficulty: "normal", entropyValue: 0.99 });
    expect(picked).toBe("bb");
  });

  it("rejoue une séquence récente s'il ne reste qu'elle", () => {
    const content = syntheticContent();
    const usedBb = new Set(content.words.filter((entry) => entry.id.startsWith("bb-")).map((entry) => entry.normalizedForm));
    const picked = chooseBombpartySequence(content, { usedWords: usedBb, recentSequences: ["aa"], difficulty: "normal", entropyValue: 0.5 });
    expect(picked).toBe("aa");
  });
});

describe("soumission après échéance", () => {
  const started = () => initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
  const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
  const deadline = "2026-09-11T12:00:15.000Z";

  it("refuse un mot valide à l'échéance exacte, avant toute mutation", () => {
    const initial = started().state;
    const word = wordContaining(initial.sequence);
    const ctx = contextFor({ nowMs: Date.parse(deadline), currentDeadlineAt: deadline, currentDeadlineKind: "turn_timeout" });
    expect(() => reduceBombparty(initial, { type: "SUBMIT_WORD", word }, config, ctx)).toThrowError("DEADLINE_EXPIRED");
    expect(initial.turn).toBe(1);
    expect(initial.validWordsTotal).toBe(0);
    expect(initial.usedWords).toEqual([]);
  });

  it("refuse après l'échéance même si le worker n'a pas encore agi", () => {
    const initial = started().state;
    const word = wordContaining(initial.sequence);
    const ctx = contextFor({ nowMs: Date.parse(deadline) + 30_000, currentDeadlineAt: deadline, currentDeadlineKind: "turn_timeout" });
    expect(() => reduceBombparty(initial, { type: "SUBMIT_WORD", word }, config, ctx)).toThrowError("DEADLINE_EXPIRED");
  });

  it("accepte 1 ms avant l'échéance", () => {
    const initial = started().state;
    const word = wordContaining(initial.sequence);
    const ctx = contextFor({ nowMs: Date.parse(deadline) - 1, currentDeadlineAt: deadline, currentDeadlineKind: "turn_timeout", entropy: [0.2] });
    const transition = reduceBombparty(initial, { type: "SUBMIT_WORD", word }, config, ctx);
    expect(transition.state.validWordsTotal).toBe(1);
  });

  it("laisse RESIGN possible après l'échéance (forfait, pas de cumul)", () => {
    const initial = started().state;
    const ctx = contextFor({ nowMs: Date.parse(deadline) + 1000, currentDeadlineAt: deadline, currentDeadlineKind: "turn_timeout" });
    const transition = reduceBombparty(initial, { type: "RESIGN" }, config, ctx);
    expect(transition.result).toMatchObject({ outcome: "abandoned", reason: "resign" });
  });
});

describe("métriques individuelles par joueur", () => {
  it("longueur maximale et moyenne sont propres à chaque siège", () => {
    const config = { lives: 3 as const, initialSeconds: 15 as const, sequenceDifficulty: "normal" as const };
    const started = initializeBombparty(config, contextFor());
    const firstWord = wordContaining(started.state.sequence);
    const firstLength = (normalizeBombpartyWord(firstWord) ?? firstWord).length;
    const afterFirst = reduceBombparty(
      started.state,
      { type: "SUBMIT_WORD", word: firstWord },
      config,
      contextFor({ nowMs: Date.parse("2026-09-11T12:00:04.000Z"), entropy: [0.2] }),
    );
    const secondWord = wordContaining(afterFirst.state.sequence, [(normalizeBombpartyWord(firstWord) ?? firstWord)]);
    const secondLength = (normalizeBombpartyWord(secondWord) ?? secondWord).length;
    const secondStart = Date.parse(afterFirst.state.turnStartedAt);
    const afterSecond = reduceBombparty(
      afterFirst.state,
      { type: "SUBMIT_WORD", word: secondWord },
      config,
      contextFor({ actorId: PARTICIPANTS[1], nowMs: secondStart + 2000, entropy: [0.7] }),
    );
    const resigned = reduceBombparty(
      afterSecond.state,
      { type: "RESIGN" },
      config,
      contextFor({ actorId: PARTICIPANTS[0] }),
    );
    const metricsA = resigned.result?.players[0]?.metrics as Record<string, unknown>;
    const metricsB = resigned.result?.players[1]?.metrics as Record<string, unknown>;
    expect(metricsA).toMatchObject({ validWords: 1, timeouts: 0, livesRemaining: 3, longestWordLength: firstLength, meanAcceptedResponseMs: 4000 });
    expect(metricsB).toMatchObject({ validWords: 1, timeouts: 0, livesRemaining: 3, longestWordLength: secondLength, meanAcceptedResponseMs: 2000 });
  });
});

describe("abandons et absence", () => {
  it("RESIGN avant le premier tour : abandoned sans vainqueur", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const transition = reduceBombparty(
      started.state,
      { type: "RESIGN" },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor(),
    );
    expect(transition.result).toMatchObject({ outcome: "abandoned", reason: "resign", winnerId: null });
  });

  it("CLAIM_FORFEIT avant le premier tour : abandoned sans vainqueur", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const transition = reduceBombparty(
      started.state,
      { type: "CLAIM_FORFEIT" },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor(),
    );
    expect(transition.result).toMatchObject({ outcome: "abandoned", reason: "claimed_forfeit", winnerId: null });
  });

  it("RESIGN après le premier tour : victoire de l'adversaire", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const word = wordContaining(started.state.sequence);
    const afterFirst = reduceBombparty(
      started.state,
      { type: "SUBMIT_WORD", word },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ entropy: [0.2] }),
    );
    const transition = reduceBombparty(
      afterFirst.state,
      { type: "RESIGN" },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: PARTICIPANTS[1] }),
    );
    expect(transition.result).toMatchObject({ outcome: "win", reason: "resign", winnerId: PARTICIPANTS[0] });
  });

  it("CLAIM_FORFEIT après le premier tour : victoire du demandeur", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const word = wordContaining(started.state.sequence);
    const afterFirst = reduceBombparty(
      started.state,
      { type: "SUBMIT_WORD", word },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ entropy: [0.2] }),
    );
    const transition = reduceBombparty(
      afterFirst.state,
      { type: "CLAIM_FORFEIT" },
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: PARTICIPANTS[1] }),
    );
    expect(transition.result).toMatchObject({ outcome: "win", reason: "claimed_forfeit", winnerId: PARTICIPANTS[1] });
  });

  it("seuils d'absence 120 s à deux / 180 s à un", () => {
    const now = Date.parse("2026-09-11T12:00:00.000Z");
    expect(shouldAbandonForBombpartyAbsence(["2026-09-11T11:57:00.000Z", "2026-09-11T11:57:30.000Z"], now)).toBe(true);
    expect(shouldAbandonForBombpartyAbsence(["2026-09-11T11:59:00.000Z", "2026-09-11T11:57:00.000Z"], now)).toBe(true);
    expect(shouldAbandonForBombpartyAbsence(["2026-09-11T11:59:30.000Z", "2026-09-11T12:00:00.000Z"], now)).toBe(false);
  });

  it("onBombpartyAbsence interrompt sans vainqueur", () => {
    const started = initializeBombparty({ lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" }, contextFor());
    const transition = onBombpartyAbsence(
      started.state,
      { lives: 3, initialSeconds: 15, sequenceDifficulty: "normal" },
      contextFor({ actorId: null }),
    );
    expect(transition.result).toMatchObject({ outcome: "abandoned", reason: "absence", winnerId: null });
  });
});

describe("garde anti-rejeu des jobs", () => {
  it("un job d'un tour précédent est périmé", () => {
    expect(isBombpartyDeadlineJobStale("phase-1", "phase-2")).toBe(true);
    expect(isBombpartyDeadlineJobStale("phase-2", "phase-2")).toBe(false);
    expect(isBombpartyDeadlineJobStale(null, "phase-2")).toBe(false);
  });
});
