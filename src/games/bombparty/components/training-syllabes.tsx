"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boundTrainingUsedWords, isCurrentTrainingResponse, TRAINING_USED_WORD_LIMIT } from "@/games/bombparty/training";

type Suggestion = { word: string; length: number };
type TrainingMode = "free" | "timed";
type Difficulty = "easy" | "normal" | "hard";
type ApiPayload = {
  sequence?: string;
  count?: number;
  examples?: Suggestion[];
  nextCursor?: string | null;
  valid?: boolean;
  reason?: string;
  normalized?: string;
  error?: { message?: string };
};

const REASON_LABELS: Record<string, string> = {
  INVALID: "Mot invalide : 2 à 30 lettres, sans chiffre ni ponctuation.",
  MISSING_SEQUENCE: "Ce mot ne contient pas la séquence.",
  UNKNOWN: "Mot absent du dictionnaire.",
  ALREADY_USED: "Mot déjà proposé pendant cette session.",
};

const SESSION_KEY = "tibo.fun:bombparty-training:v1";

type PersistedTrainingSession = {
  difficulty: Difficulty;
  sequence: string | null;
  count: number | null;
  word: string;
  feedback: { ok: boolean; text: string } | null;
  hint: string | null;
  suggestions: Suggestion[];
  nextCursor: string | null;
  mode: TrainingMode;
  seconds: number;
  remaining: number | null;
  revealAfterExpiry: boolean;
  revealed: string | null;
  trackUsed: boolean;
  usedWords: string[];
  attempts: number;
  successes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

function isMode(value: unknown): value is TrainingMode {
  return value === "free" || value === "timed";
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function parsePersistedSession(value: unknown): PersistedTrainingSession | null {
  if (!isRecord(value) || !isDifficulty(value.difficulty) || !isMode(value.mode)) return null;
  if (value.sequence !== null && (typeof value.sequence !== "string" || !/^[a-z]{2,3}$/u.test(value.sequence))) return null;
  if (value.count !== null && !isSafeInteger(value.count)) return null;
  if (typeof value.word !== "string" || value.word.length > 60) return null;
  if (value.feedback !== null && (!isRecord(value.feedback) || typeof value.feedback.ok !== "boolean" || typeof value.feedback.text !== "string")) return null;
  if (value.hint !== null && typeof value.hint !== "string") return null;
  if (!Array.isArray(value.suggestions) || value.suggestions.length > 100) return null;
  const suggestions = value.suggestions.filter((item): item is Suggestion => isRecord(item) && typeof item.word === "string" && item.word.length <= 60 && isSafeInteger(item.length, 1));
  if (suggestions.length !== value.suggestions.length) return null;
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") return null;
  if (!isSafeInteger(value.seconds, 5) || value.seconds > 30) return null;
  if (value.remaining !== null && (!isSafeInteger(value.remaining) || value.remaining > 30)) return null;
  if (typeof value.revealAfterExpiry !== "boolean" || typeof value.trackUsed !== "boolean") return null;
  if (!Array.isArray(value.usedWords) || !value.usedWords.every((item) => typeof item === "string")) return null;
  if (!isSafeInteger(value.attempts) || !isSafeInteger(value.successes) || value.successes > value.attempts) return null;
  return {
    difficulty: value.difficulty,
    sequence: value.sequence,
    count: value.count,
    word: value.word,
    feedback: value.feedback as PersistedTrainingSession["feedback"],
    hint: value.hint,
    suggestions,
    nextCursor: value.nextCursor,
    mode: value.mode,
    seconds: value.seconds,
    remaining: value.remaining,
    revealAfterExpiry: value.revealAfterExpiry,
    revealed: typeof value.revealed === "string" ? value.revealed : null,
    trackUsed: value.trackUsed,
    usedWords: boundTrainingUsedWords(value.usedWords),
    attempts: value.attempts,
    successes: value.successes,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function messageFrom(data: ApiPayload | null, fallback: string): string {
  return data?.error?.message ?? fallback;
}

export function TrainingSyllabes() {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [sequence, setSequence] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<TrainingMode>("free");
  const [seconds, setSeconds] = useState(15);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [revealAfterExpiry, setRevealAfterExpiry] = useState(true);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [trackUsed, setTrackUsed] = useState(true);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);
  const timerSequenceRef = useRef<string | null>(null);
  const expiredSequenceRef = useRef<string | null>(null);
  const sequenceRef = useRef<string | null>(null);
  const requestTokenRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const revealAfterExpiryRef = useRef(revealAfterExpiry);

  useEffect(() => {
    let disposed = false;
    const restoreTimer = window.setTimeout(() => {
      if (disposed) return;
      try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        const saved = raw ? parsePersistedSession(JSON.parse(raw)) : null;
        if (saved) {
          setDifficulty(saved.difficulty);
          setSequence(saved.sequence);
          setCount(saved.count);
          setWord(saved.word);
          setFeedback(saved.feedback);
          setHint(saved.hint);
          setSuggestions(saved.suggestions);
          setNextCursor(saved.nextCursor);
          setMode(saved.mode);
          setSeconds(saved.seconds);
          setRemaining(saved.mode === "timed" ? saved.remaining : null);
          setRevealAfterExpiry(saved.revealAfterExpiry);
          setRevealed(saved.revealed);
          setTrackUsed(saved.trackUsed);
          setUsedWords(saved.usedWords);
          setAttempts(saved.attempts);
          setSuccesses(saved.successes);
        }
      } catch {
        // Une session de navigation privée ou un JSON ancien ne doit pas bloquer l'exercice.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saved: PersistedTrainingSession = {
      difficulty,
      sequence,
      count,
      word,
      feedback,
      hint,
      suggestions: suggestions.slice(0, 100),
      nextCursor,
      mode,
      seconds,
      remaining: mode === "timed" ? remaining : null,
      revealAfterExpiry,
      revealed,
      trackUsed,
      usedWords: boundTrainingUsedWords(usedWords),
      attempts,
      successes,
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
    } catch {
      // La session reste fonctionnelle sans persistance locale.
    }
  }, [attempts, count, difficulty, feedback, hydrated, hint, mode, nextCursor, remaining, revealAfterExpiry, revealed, seconds, sequence, suggestions, successes, trackUsed, usedWords, word]);

  useEffect(() => () => {
    requestControllerRef.current?.abort();
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const beginRequest = useCallback((): { token: number; controller: AbortController } => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestTokenRef.current += 1;
    return { token: requestTokenRef.current, controller };
  }, []);

  const isCurrent = useCallback((token: number, requestSequence: string | null): boolean => {
    return isCurrentTrainingResponse(token, requestTokenRef.current, requestSequence, sequenceRef.current);
  }, []);

  const onExpire = useCallback(async (currentSequence: string) => {
    if (!revealAfterExpiryRef.current || sequenceRef.current !== currentSequence) return;
    const { token, controller } = beginRequest();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(currentSequence)}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!isCurrent(token, currentSequence)) return;
      const first = response.ok ? data?.examples?.[0] : undefined;
      setRevealed(first ? `Temps écoulé — exemple : ${first.word}` : "Temps écoulé — aucun exemple disponible.");
    } catch (caught) {
      if (!isAbortError(caught) && isCurrent(token, currentSequence)) setError("L'exemple après expiration n'est pas disponible.");
    } finally {
      if (isCurrent(token, currentSequence)) {
        setBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  }, [beginRequest, isCurrent]);

  useEffect(() => {
    revealAfterExpiryRef.current = revealAfterExpiry;
    sequenceRef.current = sequence;
  }, [revealAfterExpiry, sequence]);

  useEffect(() => {
    if (!hydrated || mode !== "timed" || !sequence || remaining === null || remaining <= 0) {
      stopTimer();
      if (!sequence) timerSequenceRef.current = null;
      return;
    }
    if (timerSequenceRef.current === sequence && timerRef.current !== null) return;
    stopTimer();
    timerSequenceRef.current = sequence;
    expiredSequenceRef.current = null;
    timerRef.current = window.setInterval(() => {
      if (sequenceRef.current !== sequence) {
        stopTimer();
        return;
      }
      setRemaining((current) => {
        if (current === null || current <= 0) return current;
        if (current <= 1) {
          stopTimer();
          if (expiredSequenceRef.current !== sequence) {
            expiredSequenceRef.current = sequence;
            void onExpire(sequence);
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      if (sequenceRef.current !== sequence) stopTimer();
    };
  }, [hydrated, mode, onExpire, remaining, sequence]);

  async function drawSequence() {
    if (busy) return;
    const { token, controller } = beginRequest();
    setBusy(true);
    setError(null);
    setFeedback(null);
    setHint(null);
    setSuggestions([]);
    setNextCursor(null);
    setRevealed(null);
    stopTimer();
    timerSequenceRef.current = null;
    try {
      const response = await fetch(`/api/games/bombparty/training/sequence?difficulty=${difficulty}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!isCurrent(token, null)) return;
      if (!response.ok || !data?.sequence) {
        setError(messageFrom(data, "Impossible de tirer une séquence."));
        return;
      }
      sequenceRef.current = data.sequence;
      setSequence(data.sequence);
      setCount(data.count ?? null);
      setRemaining(mode === "timed" ? seconds : null);
    } catch (caught) {
      if (!isAbortError(caught) && isCurrent(token, null)) setError("Impossible de tirer une séquence. Vérifie ta connexion puis réessaie.");
    } finally {
      if (requestTokenRef.current === token) {
        setBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  }

  async function checkWord() {
    const currentSequence = sequenceRef.current;
    const submittedWord = word;
    if (!currentSequence || submittedWord.trim().length === 0 || busy || (mode === "timed" && remaining === 0)) return;
    const { token, controller } = beginRequest();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/games/bombparty/training/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sequence: currentSequence, word: submittedWord, usedWords: trackUsed ? boundTrainingUsedWords(usedWords) : [] }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!isCurrent(token, currentSequence)) return;
      if (!response.ok) {
        setError(messageFrom(data, "Vérification impossible."));
        return;
      }
      setAttempts((value) => value + 1);
      if (data?.valid) {
        setSuccesses((value) => value + 1);
        setFeedback({ ok: true, text: `Valide : ${submittedWord.trim()} contient « ${currentSequence} ».` });
        if (trackUsed && data.normalized) setUsedWords((current) => boundTrainingUsedWords([...current, data.normalized!]));
        setWord("");
      } else {
        setFeedback({ ok: false, text: REASON_LABELS[data?.reason ?? ""] ?? "Mot refusé." });
      }
    } catch (caught) {
      if (!isAbortError(caught) && isCurrent(token, currentSequence)) setError("Vérification impossible. Ton mot est conservé, réessaie.");
    } finally {
      if (isCurrent(token, currentSequence)) {
        setBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  }

  async function loadHint() {
    const currentSequence = sequenceRef.current;
    if (!currentSequence || busy) return;
    const { token, controller } = beginRequest();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(currentSequence)}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!isCurrent(token, currentSequence)) return;
      if (!response.ok || !data?.examples?.[0]) {
        setError(messageFrom(data, "Aucun indice disponible."));
        return;
      }
      const first = data.examples[0];
      setHint(`Indice : ${first.length} lettres, commence par « ${first.word[0]} »`);
    } catch (caught) {
      if (!isAbortError(caught) && isCurrent(token, currentSequence)) setError("Aucun indice disponible. Réessaie.");
    } finally {
      if (isCurrent(token, currentSequence)) {
        setBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  }

  async function loadSuggestions(cursor?: string | null) {
    const currentSequence = sequenceRef.current;
    if (!currentSequence || busy) return;
    const { token, controller } = beginRequest();
    setBusy(true);
    setError(null);
    const url = `/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(currentSequence)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => null) as ApiPayload | null;
      if (!isCurrent(token, currentSequence)) return;
      if (!response.ok || !data?.examples) {
        setError(messageFrom(data, "Suggestions indisponibles."));
        return;
      }
      setSuggestions((current) => (cursor ? [...current, ...data.examples!].slice(0, 100) : data.examples!.slice(0, 100)));
      setNextCursor(data.nextCursor ?? null);
      if (typeof data.count === "number") setCount(data.count);
    } catch (caught) {
      if (!isAbortError(caught) && isCurrent(token, currentSequence)) setError("Suggestions indisponibles. Réessaie.");
    } finally {
      if (isCurrent(token, currentSequence)) {
        setBusy(false);
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
      }
    }
  }

  function resetSession() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestTokenRef.current += 1;
    stopTimer();
    timerSequenceRef.current = null;
    expiredSequenceRef.current = null;
    sequenceRef.current = null;
    setWord("");
    setFeedback(null);
    setHint(null);
    setSuggestions([]);
    setNextCursor(null);
    setRevealed(null);
    setRemaining(null);
    setUsedWords([]);
    setAttempts(0);
    setSuccesses(0);
    setSequence(null);
    setCount(null);
    setError(null);
    setBusy(false);
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Nettoyage best effort.
    }
  }

  function changeMode(nextMode: TrainingMode) {
    setMode(nextMode);
    if (nextMode === "free") {
      stopTimer();
      setRemaining(null);
    } else if (sequence) {
      setRemaining(seconds);
    }
  }

  const accuracy = attempts > 0 ? Math.round((successes / attempts) * 100) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold" htmlFor="training-mode">Mode</label>
            <select id="training-mode" value={mode} onChange={(event) => changeMode(event.target.value as TrainingMode)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <option value="free">Libre · sans chrono</option>
              <option value="timed">Chrono solo · contre la montre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold" htmlFor="training-difficulty">Difficulté</label>
            <select id="training-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <option value="easy">Facile</option>
              <option value="normal">Normal</option>
              <option value="hard">Difficile</option>
            </select>
          </div>
        </div>
        {mode === "timed" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold" htmlFor="training-seconds">Secondes par tirage (5 à 30)</label>
              <input id="training-seconds" type="number" min={5} max={30} value={seconds} onChange={(event) => setSeconds(Math.min(30, Math.max(5, Number(event.target.value) || 15)))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3" />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={revealAfterExpiry} onChange={(event) => setRevealAfterExpiry(event.target.checked)} />
              Révéler un exemple après expiration
            </label>
          </div>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={trackUsed} onChange={(event) => setTrackUsed(event.target.checked)} />
          Signaler les mots déjà proposés pendant la session
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void drawSequence()} className="rounded-full bg-[#6d28d9] px-5 py-3 font-bold text-white hover:bg-[#5b21b6]">
            {busy ? "Tirage…" : "Tirer une séquence"}
          </button>
          <button type="button" onClick={resetSession} className="rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Réinitialiser la session</button>
        </div>
        <p className="mt-4 text-sm font-bold text-[var(--muted)]">
          Session : {successes}/{attempts} réussis{accuracy !== null ? ` · ${accuracy} %` : ""}{trackUsed ? ` · ${usedWords.length}/${TRAINING_USED_WORD_LIMIT} mot${usedWords.length > 1 ? "s" : ""} proposé${usedWords.length > 1 ? "s" : ""}` : ""}
        </p>
      </section>

      {sequence && (
        <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6d28d9]">
            Séquence{count !== null ? ` · ${count} mot${count > 1 ? "s" : ""}` : ""}
            {remaining !== null && mode === "timed" ? ` · ${remaining}s` : ""}
          </p>
          <p aria-live="polite" className="mt-2 text-6xl font-black uppercase">{sequence}</p>
          {revealed && <p role="status" className="mt-3 rounded-2xl bg-[#f1eafe] px-4 py-3 text-sm font-bold text-[#4c1d95]">{revealed}</p>}
          <form
            className="mx-auto mt-5 max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              void checkWord();
            }}
          >
            <label htmlFor="training-word" className="sr-only">Ton mot contenant {sequence}</label>
            <input
              id="training-word"
              type="text"
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder={`Un mot avec « ${sequence} »…`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={60}
              disabled={busy || (mode === "timed" && remaining === 0)}
              className="w-full rounded-2xl border-2 border-[#6d28d9] px-4 py-3 text-lg font-bold"
            />
            <button type="submit" disabled={busy || word.trim().length === 0} className="mt-3 w-full rounded-full bg-[#6d28d9] px-4 py-3 font-bold text-white hover:bg-[#5b21b6] disabled:opacity-50">
              Vérifier
            </button>
          </form>
          {feedback && (
            <p role="status" className={`mx-auto mt-4 max-w-md rounded-xl px-3 py-2 text-sm font-bold ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              {feedback.text}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={busy} onClick={() => void loadHint()} className="rounded-full border border-[#6d28d9]/30 bg-white px-4 py-2 text-sm font-bold text-[#5b21b6]">Indice</button>
            <button type="button" disabled={busy} onClick={() => void loadSuggestions(null)} className="rounded-full border border-[#6d28d9]/30 bg-white px-4 py-2 text-sm font-bold text-[#5b21b6]">Suggestions</button>
          </div>
          {hint && <p role="status" className="mt-3 text-sm font-bold text-[#4c1d95]">{hint}</p>}
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-5">
          <h2 className="font-black">Exemples pour « {sequence} »</h2>
          <ul className="mt-3 grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
            {suggestions.map((item) => (
              <li key={item.word} className="rounded-xl bg-[var(--paper)] px-3 py-2 text-sm font-bold">{item.word} <span className="text-xs font-bold text-[var(--muted)]">· {item.length} lettres</span></li>
            ))}
          </ul>
          {nextCursor && (
            <button type="button" disabled={busy} onClick={() => void loadSuggestions(nextCursor)} className="mt-4 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold">
              Voir plus
            </button>
          )}
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm leading-6 text-[var(--muted)]">
        L&apos;entraînement est indisponible pendant une partie Syllabe Express en cours : termine-la avant de revenir t&apos;échauffer. La reprise locale est limitée à cette session de navigation.
      </p>
    </div>
  );
}
