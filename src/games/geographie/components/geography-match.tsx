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
  if (error && !match) return <main className="geo-page geo-state-page"><div role="alert" className="geo-error geo-state-message">{error}</div></main>;
  if (!match) return <main className="geo-page geo-state-page"><div className="geo-panel geo-loading-panel">Chargement de la partie…</div></main>;
  const view = match.view;
  const me = view.players[view.mySeat];
  const isMyTurn = me.active;
  const opponentAbsent = opponentLastSeenAt !== null && now + serverOffset - opponentLastSeenAt >= 90_000;
  return <main className="geo-page geo-match-page"><div className="geo-content geo-match-content"><header className="geo-match-header"><button type="button" onClick={() => router.push(`/salons/${match.roomId}`)} className="geo-back-link">← Salon</button><div className="geo-match-heading"><p className="geo-kicker geo-kicker-accent">HexaPoint</p><p>Manche {Math.min(view.round, view.rounds)} / {view.rounds}</p></div><button type="button" onClick={() => void refresh()} className="geo-secondary-button geo-refresh-button">Actualiser</button></header><div className="geo-scoreboard">{view.players.map((player) => <div key={player.id} className="geo-score-card" data-self={player.seat === view.mySeat} data-active={player.active}><div className="geo-score-topline"><span className="geo-player-name">{player.pseudo}{player.seat === view.mySeat ? " · toi" : ""}</span><span className="geo-player-score">{player.score}</span></div><p className="geo-score-status">{player.active ? "À toi" : player.submitted ? "Placement reçu" : "En attente"}</p></div>)}</div><div aria-live="polite" aria-atomic="true" className="geo-status-bar" data-urgent={remaining !== null && remaining <= 10}><span>{phaseLabel(view, isMyTurn)}</span>{remaining !== null && <span className="geo-timer">{remaining}s</span>}</div>{view.phase === "select_cities" && <ChallengeSelection view={view} query={query} setQuery={setQuery} results={searchResults} selectedIds={selectedIds} toggle={(id) => { selectionDirtyRef.current = true; setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }} labels={cityLabels} onSave={() => void send({ type: "SET_CITY_SELECTION", cityIds: selectedIds })} onConfirm={() => void confirmSelection()} busy={busy} />}{(view.phase === "placing" || view.phase === "reveal") && <div className="geo-game-layout"><div className="geo-map-column"><GeographyMap view={view} interactive={view.phase === "placing" && isMyTurn && !busy} pendingPoint={pendingPoint} onPendingPointChange={setPendingPoint} /><p className="geo-map-caption" aria-live="polite">{pendingPoint ? `${pendingPoint.latitude.toFixed(4)}, ${pendingPoint.longitude.toFixed(4)} · point local, pas encore envoyé` : "Aucun point confirmé"}</p></div><aside className="geo-panel geo-side-panel">{view.phase === "placing" && <PlacingPanel view={view} isMyTurn={isMyTurn} pendingPoint={pendingPoint} busy={busy} confirm={() => { if (pendingPoint) void send({ type: "PLACE_CITY", latitude: pendingPoint.latitude, longitude: pendingPoint.longitude }); }} resign={() => { if (window.confirm("Abandonner cette partie ?")) void send({ type: "RESIGN" }); }} />}{view.phase === "reveal" && <RevealPanel view={view} busy={busy} next={() => void send({ type: "NEXT" })} />}</aside></div>}{view.phase !== "finished" && <ForfeitControl available={opponentAbsent} busy={busy} claim={() => void send({ type: "CLAIM_FORFEIT" })} />}{view.phase === "finished" && <FinishedPanel view={view} back={() => router.push(`/salons/${match.roomId}`)} />}{error && <p role="alert" className="geo-error">{error}</p>}</div></main>;
}

function phaseLabel(view: GeoView, isMyTurn: boolean): string { if (view.phase === "select_cities") return view.challenge?.myConfirmed ? "Ta sélection est verrouillée" : "Prépare tes villes"; if (view.phase === "placing") return isMyTurn ? "À toi de placer le point" : "Au tour de ton partenaire"; if (view.phase === "reveal") return "Résultats de la manche"; return "Partie terminée"; }

function ChallengeSelection({ view, query, setQuery, results, selectedIds, toggle, labels, onSave, onConfirm, busy }: { view: GeoView; query: string; setQuery: (value: string) => void; results: Array<{ id: string; name: string; departmentName: string }>; selectedIds: string[]; toggle: (id: string) => void; labels: Record<string, { id: string; name: string; departmentName: string }>; onSave: () => void; onConfirm: () => void; busy: boolean }) {
  const challenge = view.challenge;
  if (!challenge) return null;
  const selectedCities = selectedIds.map((id) => labels[id] ?? results.find((city) => city.id === id)).filter((city): city is { id: string; name: string; departmentName: string } => Boolean(city));
  return <section className="geo-panel geo-challenge-panel"><div className="geo-panel-heading geo-challenge-heading"><div><p className="geo-kicker geo-kicker-accent">Mode défi</p><h2 className="geo-panel-title">Propose {challenge.required} ville{challenge.required > 1 ? "s" : ""}</h2></div><span className="geo-count-badge">{selectedIds.length} / {challenge.required}</span></div><p className="geo-panel-note">La liste de l'autre joueur reste invisible. Une ville déjà confirmée devra être remplacée.</p><input disabled={challenge.myConfirmed} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une ville ou un département" className="geo-input" aria-label="Rechercher une ville" /><div className="geo-city-results">{results.map((city) => <button type="button" key={city.id} disabled={challenge.myConfirmed} onClick={() => toggle(city.id)} className="geo-city-option" data-selected={selectedIds.includes(city.id)}><span>{city.name}</span><small>{city.departmentName}</small></button>)}</div>{selectedCities.length > 0 && <div className="geo-selected-cities">{selectedCities.map((city) => <span key={city.id} className="geo-city-chip">{city.name} · {city.departmentName}</span>)}</div>}<div className="geo-form-actions"><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onSave} className="geo-secondary-button">Enregistrer la liste</button><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onConfirm} className="geo-primary-button">Confirmer</button></div></section>;
}

function PlacingPanel({ view, isMyTurn, pendingPoint, busy, confirm, resign }: { view: GeoView; isMyTurn: boolean; pendingPoint: GeoPoint | null; busy: boolean; confirm: () => void; resign: () => void }) {
  return <div className="geo-side-content"><p className="geo-kicker geo-kicker-warm">Ville cible</p><h2 className="geo-target-title">{view.target?.name ?? "…"}</h2><p className="geo-target-department">{view.target?.departmentName}</p><p className="geo-panel-note geo-instruction">{isMyTurn ? "Place le point au meilleur endroit, puis confirme. Un simple clic ne valide jamais l'envoi." : "Ton partenaire prépare son placement. Ta position exacte restera cachée jusqu'à la révélation."}</p><button disabled={!isMyTurn || !pendingPoint || busy} onClick={confirm} className="geo-primary-button">{busy ? "Envoi…" : "Confirmer le placement"}</button><button disabled={busy} onClick={resign} className="geo-danger-button">Abandonner</button></div>;
}

function RevealPanel({ view, busy, next }: { view: GeoView; busy: boolean; next: () => void }) {
  return <div className="geo-side-content"><p className="geo-kicker geo-kicker-warm">Révélation</p><h2 className="geo-panel-title">{view.lastRound?.target.name}</h2><p className="geo-target-department">{view.lastRound?.target.departmentName}</p><div className="geo-round-results">{view.players.map((player) => <div key={player.id} className="geo-round-result"><div><span>{player.pseudo}</span><small>{view.lastRound?.placements[player.seat] ? `${view.lastRound.placements[player.seat]?.distanceKm.toFixed(1)} km` : "Temps écoulé · 0 point"}</small></div><strong>{view.lastRound?.placements[player.seat]?.points ?? 0} pts</strong></div>)}</div><button disabled={busy} onClick={next} className="geo-primary-button">{busy ? "Actualisation…" : "Continuer"}</button></div>;
}

function FinishedPanel({ view, back }: { view: GeoView; back: () => void }) {
  const result = view.result;
  const label = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : result?.winnerId === view.players[view.mySeat].id ? "Victoire" : "Défaite";
  return <section className="geo-panel geo-finish-panel"><p className="geo-kicker geo-kicker-accent">Résultats</p><h1 className="geo-finish-title">{label}</h1>{result?.outcome === "abandoned" && <p className="geo-panel-note">Aucun joueur n&apos;est déclaré vainqueur. La partie a été interrompue ({result.reason}).</p>}<div className="geo-final-scores">{view.players.map((player) => <div key={player.id} className="geo-final-score"><p>{player.pseudo}</p><strong>{player.score}</strong><span>points</span></div>)}</div><button onClick={back} className="geo-primary-button geo-finish-button">Retour au salon</button></section>;
}

function ForfeitControl({ available, busy, claim }: { available: boolean; busy: boolean; claim: () => void }) {
  return <div className="geo-forfeit-panel"><p>Partenaire absent ?</p><span>Le forfait devient disponible après 90 secondes sans signal.</span><button type="button" disabled={!available || busy} onClick={claim} className="geo-secondary-button">{available ? "Réclamer le forfait" : "Forfait indisponible"}</button></div>;
}
