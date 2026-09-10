"use client";
/* eslint-disable react/no-unescaped-entities */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeographyMap } from "@/games/geographie/components/geography-map";
import type { GeoAction } from "@/games/geographie/types";
import type { GeoPoint } from "@/games/geographie/scoring";
import type { GeoView } from "@/games/geographie/types";
import { useUserRealtime } from "@/lib/realtime";

type MatchResponse = { matchId: string; roomId: string; status: string; mode: string; version: number; phaseId: string; deadlineAt: string | null; deadlineKind: string | null; serverNow: string; view: GeoView };

export function GeographyMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<GeoPoint | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [opponentLastSeenAt, setOpponentLastSeenAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; departmentName: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cityLabels, setCityLabels] = useState<Record<string, { id: string; name: string; departmentName: string }>>({});
  const selectionDirtyRef = useRef(false);

  const refresh = useCallback(async (): Promise<MatchResponse | null> => {
    const response = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as MatchResponse | { error?: { message?: string } } | null;
    if (!response.ok) { setError((data as { error?: { message?: string } } | null)?.error?.message ?? "Partie introuvable."); return null; }
    const next = data as MatchResponse;
    setMatch(next);
    setServerOffset(Date.parse(next.serverNow) - Date.now());
    if (next.view.phase !== "placing") setPendingPoint(null);
    if (next.view.phase !== "select_cities") selectionDirtyRef.current = false;
    if (next.view.challenge) {
      setCityLabels((current) => ({
        ...current,
        ...Object.fromEntries(next.view.challenge?.mySelection.map((city) => [city.id, city]) ?? []),
      }));
      if (!selectionDirtyRef.current) setSelectedIds(next.view.challenge.mySelection.map((city) => city.id));
    }
    return next;
  }, [matchId]);

  const heartbeat = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}/heartbeat`, { method: "POST", headers: { "content-type": "application/json" } });
    const data = await response.json().catch(() => null) as { opponentLastSeenAt?: string | null; serverNow?: string } | null;
    if (!response.ok) return;
    if (data?.serverNow) setServerOffset(Date.parse(data.serverNow) - Date.now());
    setOpponentLastSeenAt(data?.opponentLastSeenAt ? Date.parse(data.opponentLastSeenAt) : null);
  }, [matchId]);

  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const refreshTimer = window.setInterval(() => void refresh(), 2500); const clockTimer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearTimeout(initial); window.clearInterval(refreshTimer); window.clearInterval(clockTimer); }; }, [refresh]);
  useEffect(() => { const initial = window.setTimeout(() => void heartbeat(), 0); const timer = window.setInterval(() => void heartbeat(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [heartbeat]);
  useUserRealtime([{ event: "match.updated", id: matchId, onInvalidate: () => void refresh() }]);

  useEffect(() => {
    if (!match || match.view.phase !== "select_cities" || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void fetch(`/api/games/geographie/cities?q=${encodeURIComponent(query)}&difficulty=${match.view.difficulty}`, { signal: controller.signal }).then((response) => response.json()).then((data: { cities?: Array<{ id: string; name: string; departmentName: string }> }) => { const cities = data.cities ?? []; setSearchResults(cities); setCityLabels((current) => ({ ...current, ...Object.fromEntries(cities.map((city) => [city.id, city])) })); }).catch(() => undefined); }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [match, query]);

  async function send(action: GeoAction, snapshot: MatchResponse | null = match): Promise<MatchResponse | null> {
    if (!snapshot || busy) return null;
    setBusy(true); setError(null);
    const response = await fetch(`/api/matches/${matchId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedVersion: snapshot.version, action }) });
    const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) { setError(data?.error?.message ?? "La commande n'a pas été acceptée."); setBusy(false); return null; }
    if (action.type === "SET_CITY_SELECTION") selectionDirtyRef.current = false;
    const next = await refresh();
    setBusy(false);
    return next;
  }

  async function confirmSelection() {
    if (!match?.view.challenge || selectedIds.length !== match.view.challenge.required || busy) return;
    const saved = await send({ type: "SET_CITY_SELECTION", cityIds: selectedIds });
    if (!saved) return;
    await send({ type: "CONFIRM_CITY_SELECTION" }, saved);
  }

  const remaining = match?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(match.deadlineAt) - (now + serverOffset)) / 1000)) : null;
  if (error && !match) return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  if (!match) return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
  const view = match.view;
  const me = view.players[view.mySeat];
  const isMyTurn = me.active;
  const opponentAbsent = opponentLastSeenAt !== null && now + serverOffset - opponentLastSeenAt >= 90_000;
  return <main className="min-h-screen pb-10"><div className="mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-7"><header className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="rounded-full px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-white">← Salon</button><div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--orange)]">HexaPoint</p><p className="font-black">Manche {Math.min(view.round, view.rounds)} / {view.rounds}</p></div><button type="button" onClick={() => void refresh()} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">Actualiser</button></header><div className="mt-5 grid gap-3 sm:grid-cols-2">{view.players.map((player) => <div key={player.id} className={`rounded-2xl border p-4 ${player.seat === view.mySeat ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--line)] bg-white/70"}`}><div className="flex items-center justify-between gap-3"><span className="font-black">{player.pseudo}{player.seat === view.mySeat ? " · toi" : ""}</span><span className="text-2xl font-black">{player.score}</span></div><p className="mt-1 text-xs font-bold text-[var(--muted)]">{player.active ? "À toi" : player.submitted ? "Placement reçu" : "En attente"}</p></div>)}</div><div aria-live="polite" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white"><span>{phaseLabel(view, isMyTurn)}</span>{remaining !== null && <span className={remaining <= 10 ? "text-[var(--yellow)]" : "text-white"}>{remaining}s</span>}</div>{view.phase === "select_cities" && <ChallengeSelection view={view} query={query} setQuery={setQuery} results={searchResults} selectedIds={selectedIds} toggle={(id) => { selectionDirtyRef.current = true; setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }} labels={cityLabels} onSave={() => void send({ type: "SET_CITY_SELECTION", cityIds: selectedIds })} onConfirm={() => void confirmSelection()} busy={busy} />}{(view.phase === "placing" || view.phase === "reveal") && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start"><div><GeographyMap view={view} interactive={view.phase === "placing" && isMyTurn && !busy} pendingPoint={pendingPoint} onPendingPointChange={setPendingPoint} /><p className="mt-2 text-center text-xs text-[var(--muted)]" aria-live="polite">{pendingPoint ? `${pendingPoint.latitude.toFixed(4)}, ${pendingPoint.longitude.toFixed(4)} · point local, pas encore envoyé` : "Aucun point confirmé"}</p></div><aside className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-5">{view.phase === "placing" && <PlacingPanel view={view} isMyTurn={isMyTurn} pendingPoint={pendingPoint} busy={busy} confirm={() => { if (pendingPoint) void send({ type: "PLACE_CITY", latitude: pendingPoint.latitude, longitude: pendingPoint.longitude }); }} resign={() => { if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" }); }} />}{view.phase === "reveal" && <RevealPanel view={view} busy={busy} next={() => void send({ type: "NEXT" })} />}</aside></div>}{view.phase !== "finished" && <ForfeitControl available={opponentAbsent} busy={busy} claim={() => void send({ type: "CLAIM_FORFEIT" })} />}{view.phase === "finished" && <FinishedPanel view={view} back={() => router.push(`/salons/${match.roomId}`)} />}{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</div></main>;
}

function phaseLabel(view: GeoView, isMyTurn: boolean): string { if (view.phase === "select_cities") return view.challenge?.myConfirmed ? "Ta sélection est verrouillée" : "Prépare tes villes"; if (view.phase === "placing") return isMyTurn ? "À toi de placer le point" : "Au tour de ton partenaire"; if (view.phase === "reveal") return "Résultats de la manche"; return "Partie terminée"; }

function ChallengeSelection({ view, query, setQuery, results, selectedIds, toggle, labels, onSave, onConfirm, busy }: { view: GeoView; query: string; setQuery: (value: string) => void; results: Array<{ id: string; name: string; departmentName: string }>; selectedIds: string[]; toggle: (id: string) => void; labels: Record<string, { id: string; name: string; departmentName: string }>; onSave: () => void; onConfirm: () => void; busy: boolean }) {
  const challenge = view.challenge;
  if (!challenge) return null;
  const selectedCities = selectedIds.map((id) => labels[id] ?? results.find((city) => city.id === id)).filter((city): city is { id: string; name: string; departmentName: string } => Boolean(city));
  return <section className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--green)]">Mode défi</p><h2 className="mt-1 text-2xl font-black">Propose {challenge.required} ville{challenge.required > 1 ? "s" : ""}</h2></div><span className="rounded-full bg-[var(--paper-deep)] px-3 py-1 text-xs font-bold">{selectedIds.length} / {challenge.required}</span></div><p className="mt-3 text-sm leading-6 text-[var(--muted)]">La liste de l'autre joueur reste invisible. Une ville déjà confirmée devra être remplacée.</p><input disabled={challenge.myConfirmed} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une ville ou un département" className="mt-5 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3" aria-label="Rechercher une ville" /><div className="mt-2 grid gap-2 sm:grid-cols-2">{results.map((city) => <button type="button" key={city.id} disabled={challenge.myConfirmed} onClick={() => toggle(city.id)} className={`rounded-xl border px-3 py-3 text-left text-sm ${selectedIds.includes(city.id) ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--line)] bg-white"}`}><span className="font-bold">{city.name}</span><span className="block text-xs text-[var(--muted)]">{city.departmentName}</span></button>)}</div>{selectedCities.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{selectedCities.map((city) => <span key={city.id} className="rounded-full bg-[var(--green)]/10 px-3 py-1 text-xs font-bold text-[var(--green-dark)]">{city.name} · {city.departmentName}</span>)}</div>}<div className="mt-5 flex flex-wrap gap-2"><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onSave} className="rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold">Enregistrer la liste</button><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onConfirm} className="rounded-full bg-[var(--green)] px-4 py-3 text-sm font-bold">Confirmer</button></div></section>;
}

function PlacingPanel({ view, isMyTurn, pendingPoint, busy, confirm, resign }: { view: GeoView; isMyTurn: boolean; pendingPoint: GeoPoint | null; busy: boolean; confirm: () => void; resign: () => void }) {
  return <><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--orange)]">Ville cible</p><h2 className="mt-2 text-3xl font-black leading-tight">{view.target?.name ?? "…"}</h2><p className="mt-1 text-sm font-semibold text-[var(--muted)]">{view.target?.departmentName}</p><p className="mt-5 text-sm leading-6 text-[var(--muted)]">{isMyTurn ? "Place le point au meilleur endroit, puis confirme. Un simple clic ne valide jamais l'envoi." : "Ton partenaire prépare son placement. Ta position exacte restera cachée jusqu'à la révélation."}</p><button disabled={!isMyTurn || !pendingPoint || busy} onClick={confirm} className="mt-6 w-full rounded-full bg-[var(--green)] px-4 py-3 font-bold text-white">{busy ? "Envoi…" : "Confirmer le placement"}</button><button disabled={busy} onClick={resign} className="mt-3 w-full rounded-full px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-700">Abandonner</button></>;
}

function RevealPanel({ view, busy, next }: { view: GeoView; busy: boolean; next: () => void }) {
  return <><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--orange)]">Révélation</p><h2 className="mt-2 text-2xl font-black">{view.lastRound?.target.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{view.lastRound?.target.departmentName}</p><div className="mt-5 space-y-3">{view.players.map((player) => <div key={player.id} className="rounded-xl bg-[var(--paper)] p-3"><div className="flex justify-between gap-3 text-sm font-bold"><span>{player.pseudo}</span><span>{view.lastRound?.placements[player.seat]?.points ?? 0} pts</span></div><p className="mt-1 text-xs text-[var(--muted)]">{view.lastRound?.placements[player.seat] ? `${view.lastRound.placements[player.seat]?.distanceKm.toFixed(1)} km` : "Temps écoulé · 0 point"}</p></div>)}</div><button disabled={busy} onClick={next} className="mt-6 w-full rounded-full bg-[var(--ink)] px-4 py-3 font-bold text-white">{busy ? "Actualisation…" : "Continuer"}</button></>;
}

function FinishedPanel({ view, back }: { view: GeoView; back: () => void }) {
  const result = view.result;
  const label = result?.outcome === "draw" ? "Égalité" : result?.winnerId === view.players[view.mySeat].id ? "Victoire" : "Défaite";
  return <section className="mt-8 rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-7 text-center"><p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--orange)]">Résultats</p><h1 className="mt-3 text-5xl font-black tracking-[-0.05em]">{label}</h1><div className="mx-auto mt-7 grid max-w-md grid-cols-2 gap-3">{view.players.map((player) => <div key={player.id} className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-sm font-bold">{player.pseudo}</p><p className="mt-1 text-3xl font-black">{player.score}</p></div>)}</div><button onClick={back} className="mt-7 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Retour au salon</button></section>;
}

function ForfeitControl({ available, busy, claim }: { available: boolean; busy: boolean; claim: () => void }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm"><p className="font-bold">Partenaire absent ?</p><p className="mt-1 text-[var(--muted)]">Le forfait devient disponible après 90 secondes sans signal.</p><button type="button" disabled={!available || busy} onClick={claim} className="mt-3 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">{available ? "Réclamer le forfait" : "Forfait indisponible"}</button></div>;
}
