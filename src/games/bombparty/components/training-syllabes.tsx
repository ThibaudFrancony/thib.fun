"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { word: string; length: number };

const REASON_LABELS: Record<string, string> = {
  INVALID: "Mot invalide : 2 à 30 lettres, sans chiffre ni ponctuation.",
  MISSING_SEQUENCE: "Ce mot ne contient pas la séquence.",
  UNKNOWN: "Mot absent du dictionnaire.",
  ALREADY_USED: "Mot déjà proposé pendant cette session.",
};

export function TrainingSyllabes() {
  const [difficulty, setDifficulty] = useState("normal");
  const [sequence, setSequence] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<"free" | "timed">("free");
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
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function drawSequence() {
    setBusy(true);
    setError(null);
    setFeedback(null);
    setHint(null);
    setSuggestions([]);
    setNextCursor(null);
    setRevealed(null);
    stopTimer();
    const response = await fetch(`/api/games/bombparty/training/sequence?difficulty=${difficulty}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { sequence?: string; count?: number; error?: { message?: string } } | null;
    if (!response.ok || !data?.sequence) {
      setError(data?.error?.message ?? "Impossible de tirer une séquence.");
      setBusy(false);
      return;
    }
    setSequence(data.sequence);
    setCount(data.count ?? null);
    if (mode === "timed") {
      setRemaining(seconds);
      timerRef.current = window.setInterval(() => {
        setRemaining((current) => {
          if (current === null) return null;
          if (current <= 1) {
            stopTimer();
            if (data.sequence) void onExpire(data.sequence);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    }
    setBusy(false);
  }

  async function onExpire(currentSequence: string) {
    if (!revealAfterExpiry) return;
    const response = await fetch(`/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(currentSequence)}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { examples?: Suggestion[] } | null;
    const first = data?.examples?.[0];
    if (first) setRevealed(`Temps écoulé — exemple : ${first.word}`);
    else setRevealed("Temps écoulé — aucun exemple disponible.");
  }

  async function checkWord() {
    if (!sequence || word.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/games/bombparty/training/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sequence, word, usedWords: trackUsed ? usedWords : [] }),
    });
    const data = (await response.json().catch(() => null)) as { valid?: boolean; reason?: string; normalized?: string; error?: { message?: string } } | null;
    if (!response.ok) {
      setError(data?.error?.message ?? "Vérification impossible.");
      setBusy(false);
      return;
    }
    setAttempts((value) => value + 1);
    if (data?.valid) {
      setSuccesses((value) => value + 1);
      setFeedback({ ok: true, text: `Valide : ${word.trim()} contient « ${sequence} ».` });
      if (trackUsed && data.normalized) setUsedWords((current) => (current.includes(data.normalized as string) ? current : [...current, data.normalized as string]));
      setWord("");
    } else {
      setFeedback({ ok: false, text: REASON_LABELS[data?.reason ?? ""] ?? "Mot refusé." });
    }
    setBusy(false);
  }

  async function loadHint() {
    if (!sequence) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(sequence)}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { examples?: Suggestion[]; error?: { message?: string } } | null;
    if (!response.ok || !data?.examples?.[0]) {
      setError(data?.error?.message ?? "Aucun indice disponible.");
      setBusy(false);
      return;
    }
    const first = data.examples[0];
    setHint(`Indice : ${first.length} lettres, commence par « ${first.word[0]} »`);
    setBusy(false);
  }

  async function loadSuggestions(cursor?: string | null) {
    if (!sequence) return;
    setBusy(true);
    setError(null);
    const url = `/api/games/bombparty/training/suggestions?sequence=${encodeURIComponent(sequence)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { examples?: Suggestion[]; count?: number; nextCursor?: string | null; error?: { message?: string } } | null;
    if (!response.ok || !data?.examples) {
      setError(data?.error?.message ?? "Suggestions indisponibles.");
      setBusy(false);
      return;
    }
    setSuggestions((current) => (cursor ? [...current, ...(data.examples ?? [])] : (data.examples ?? [])));
    setNextCursor(data.nextCursor ?? null);
    if (typeof data.count === "number") setCount(data.count);
    setBusy(false);
  }

  function resetSession() {
    stopTimer();
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
  }

  const accuracy = attempts > 0 ? Math.round((successes / attempts) * 100) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold" htmlFor="training-mode">Mode</label>
            <select id="training-mode" value={mode} onChange={(event) => setMode(event.target.value as "free" | "timed")} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <option value="free">Libre · sans chrono</option>
              <option value="timed">Chrono solo · contre la montre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold" htmlFor="training-difficulty">Difficulté</label>
            <select id="training-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3">
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
          Session : {successes}/{attempts} réussis{accuracy !== null ? ` · ${accuracy} %` : ""}{trackUsed ? ` · ${usedWords.length} mot${usedWords.length > 1 ? "s" : ""} proposé${usedWords.length > 1 ? "s" : ""}` : ""}
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
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
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
        L&apos;entraînement est indisponible pendant une partie Syllabe Express en cours : termine-la avant de revenir t&apos;échauffer.
      </p>
    </div>
  );
}
