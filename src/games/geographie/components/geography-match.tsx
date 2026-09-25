"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MatchToolbar } from "@/components/match-toolbar";
import { useRouter } from "next/navigation";
import { GeographyMap } from "@/games/geographie/components/geography-map";
import { Avatar } from "@/components/avatar";
import type { GeoAction } from "@/games/geographie/types";
import type { GeoPoint } from "@/games/geographie/scoring";
import type { GeoView } from "@/games/geographie/types";
import { parseMatchSnapshot, useResourceNetwork } from "@/lib/network-sync";
import { useRoomAvatars } from "@/lib/room-avatars";

type MatchResponse = { matchId: string; roomId: string; status: string; mode: string; version: number; phaseId: string; deadlineAt: string | null; deadlineKind: string | null; serverNow: string; view: GeoView };

export function GeographyMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pendingPoint, setPendingPoint] = useState<GeoPoint | null>(null);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; departmentName: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cityLabels, setCityLabels] = useState<Record<string, { id: string; name: string; departmentName: string }>>({});
  const selectionDirtyRef = useRef(false);

  const onSnapshotApplied = useCallback((next: MatchResponse) => {
    if (next.view.phase !== "placing") setPendingPoint(null);
    if (next.view.phase !== "select_cities") selectionDirtyRef.current = false;
    if (next.view.challenge) {
      setCityLabels((current) => ({
        ...current,
        ...Object.fromEntries(next.view.challenge?.mySelection.map((city) => [city.id, city]) ?? []),
      }));
      if (!selectionDirtyRef.current) setSelectedIds(next.view.challenge.mySelection.map((city) => city.id));
    }
  }, []);

  const {
    snapshot: match,
    error,
    busy,
    serverOffset,
    refresh,
    send: networkSend,
  } = useResourceNetwork<MatchResponse, GeoAction>({
    resourceId: matchId,
    snapshotUrl: `/api/matches/${matchId}`,
    heartbeatUrl: `/api/matches/${matchId}/heartbeat`,
    realtimeEvent: "match.updated",
    parseSnapshot: parseMatchSnapshot<MatchResponse>,
    getResourceId: (snapshot) => snapshot.matchId,
    getPhaseId: (snapshot) => snapshot.phaseId,
    isFinished: (snapshot) => snapshot.view.phase === "finished",
    buildCommand: ({ commandId, expectedVersion, action }) => ({
      url: `/api/matches/${matchId}/commands`,
      body: { commandId, expectedVersion, action },
    }),
    onSnapshotApplied,
  });

  const memberIds = match ? match.view.players.map((player) => player.id) : [];
  const avatars = useRoomAvatars(match?.roomId ?? null, memberIds);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!match || match.view.phase !== "select_cities" || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void fetch(`/api/games/geographie/cities?q=${encodeURIComponent(query)}&difficulty=${match.view.difficulty}`, { signal: controller.signal }).then((response) => response.json()).then((data: { cities?: Array<{ id: string; name: string; departmentName: string }> }) => { const cities = data.cities ?? []; setSearchResults(cities); setCityLabels((current) => ({ ...current, ...Object.fromEntries(cities.map((city) => [city.id, city])) })); }).catch(() => undefined); }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [match, query]);

  async function send(action: GeoAction, snapshot: MatchResponse | null = match): Promise<MatchResponse | null> {
    const next = await networkSend(action, snapshot);
    if (next && action.type === "SET_CITY_SELECTION") selectionDirtyRef.current = false;
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
  // Placements simultanés : actif tant que le joueur n'a pas validé.
  const canPlace = view.phase === "placing" && !me.submitted;
  return (
    <main className="geo-page geo-match-page play-screen" data-phase={view.phase}>
      <div className="geo-content geo-match-content play-shell">
        <MatchToolbar title="HexaPoint" progress={`${Math.min(view.round, view.rounds)}/${view.rounds}`} busy={busy} onBack={() => router.push(`/salons/${match.roomId}`)} onRefresh={() => void refresh()} onResign={view.phase === "finished" ? undefined : () => void send({ type: "RESIGN" })}>
          <div className="geo-scoreboard">
          {view.players.map((player) => (
            <div key={player.id} className="geo-score-card" data-self={player.seat === view.mySeat} data-active={player.active}>
              <div className="geo-score-topline">
                <span className="geo-player-identity">
                  <Avatar name={player.pseudo} preset={player.avatarPreset ?? "avatar-1"} imageUrl={avatars[player.id] ?? null} size={28} />
                  <span className="geo-player-name">{player.pseudo}{player.seat === view.mySeat ? " · toi" : ""}</span>
                </span>
                <span className="geo-player-score">{player.score}</span>
              </div>
              <p className="geo-score-status">{player.submitted ? "Placement reçu" : view.phase === "placing" ? "En train de placer…" : "En attente"}</p>
            </div>
          ))}
        </div>
        </MatchToolbar>
        <div aria-live="polite" aria-atomic="true" className="geo-status-bar" data-urgent={remaining !== null && remaining <= 10}>
          <span>{phaseLabel(view, canPlace)}</span>{remaining !== null && <span className="geo-timer">{remaining}s</span>}
        </div>
        {view.phase === "select_cities" && <ChallengeSelection view={view} query={query} setQuery={setQuery} results={searchResults} selectedIds={selectedIds} toggle={(id) => { selectionDirtyRef.current = true; setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }} labels={cityLabels} onSave={() => void send({ type: "SET_CITY_SELECTION", cityIds: selectedIds })} onConfirm={() => void confirmSelection()} busy={busy} />}
        {(view.phase === "placing" || view.phase === "reveal") && (
          <div className="geo-game-layout">
            <div className="geo-map-column">
              <GeographyMap view={view} interactive={canPlace && !busy} pendingPoint={pendingPoint} onPendingPointChange={setPendingPoint} avatars={avatars} />

            </div>
            <aside className="geo-panel geo-side-panel">
              {view.phase === "placing" && <PlacingPanel view={view} canPlace={canPlace} pendingPoint={pendingPoint} busy={busy} confirm={() => { if (pendingPoint) void send({ type: "PLACE_CITY", latitude: pendingPoint.latitude, longitude: pendingPoint.longitude }); }} />}
              {view.phase === "reveal" && <RevealPanel view={view} avatars={avatars} busy={busy} next={() => void send({ type: "NEXT" })} />}
            </aside>
          </div>
        )}
        {view.phase === "finished" && <FinishedPanel view={view} back={() => router.push("/jeux/geographie")} />}
        {error && <p role="alert" className="geo-error">{error}</p>}
      </div>
    </main>
  );
}

function phaseLabel(view: GeoView, canPlace: boolean): string {
  if (view.phase === "select_cities") return view.challenge?.myConfirmed ? "Ta sélection est verrouillée" : "Prépare tes villes";
  if (view.phase === "placing") {
    const me = view.players[view.mySeat];
    if (me.submitted) return "Placement envoyé — en attente de ton partenaire";
    if (canPlace) return "À toi de placer le point";
    return "À toi de placer le point";
  }
  if (view.phase === "reveal") return "Résultats de la manche";
  return "Partie terminée";
}

function ChallengeSelection({ view, query, setQuery, results, selectedIds, toggle, labels, onSave, onConfirm, busy }: { view: GeoView; query: string; setQuery: (value: string) => void; results: Array<{ id: string; name: string; departmentName: string }>; selectedIds: string[]; toggle: (id: string) => void; labels: Record<string, { id: string; name: string; departmentName: string }>; onSave: () => void; onConfirm: () => void; busy: boolean }) {
  const challenge = view.challenge;
  if (!challenge) return null;
  const selectedCities = selectedIds.map((id) => labels[id] ?? results.find((city) => city.id === id)).filter((city): city is { id: string; name: string; departmentName: string } => Boolean(city));
  return <section className="geo-panel geo-challenge-panel"><div className="geo-panel-heading geo-challenge-heading"><div><p className="geo-kicker geo-kicker-accent">Mode défi</p><h2 className="geo-panel-title">Propose {challenge.required} ville{challenge.required > 1 ? "s" : ""}</h2></div><span className="geo-count-badge">{selectedIds.length} / {challenge.required}</span></div><input disabled={challenge.myConfirmed} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une ville ou un département" className="geo-input" aria-label="Rechercher une ville" /><div className="geo-city-results">{results.map((city) => <button type="button" key={city.id} disabled={challenge.myConfirmed} onClick={() => toggle(city.id)} className="geo-city-option" data-selected={selectedIds.includes(city.id)}><span>{city.name}</span><small>{city.departmentName}</small></button>)}</div>{selectedCities.length > 0 && <div className="geo-selected-cities">{selectedCities.map((city) => <span key={city.id} className="geo-city-chip">{city.name} · {city.departmentName}</span>)}</div>}<div className="geo-form-actions"><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onSave} className="geo-secondary-button">Enregistrer</button><button disabled={busy || challenge.myConfirmed || selectedIds.length !== challenge.required} onClick={onConfirm} className="geo-primary-button">Confirmer</button></div></section>;
}

function PlacingPanel({ view, canPlace, pendingPoint, busy, confirm }: { view: GeoView; canPlace: boolean; pendingPoint: GeoPoint | null; busy: boolean; confirm: () => void }) {
  const submitted = view.players[view.mySeat].submitted;
  return <div key={`geo-place-${view.round}`} className="geo-side-content motion-question" data-from={view.round % 2 === 0 ? "right" : "left"}><p className="geo-kicker geo-kicker-warm">Ville cible</p><h2 className="geo-target-title">{view.target?.name ?? "…"}</h2><p className="geo-target-department">{view.target?.departmentName}</p><button disabled={!canPlace || !pendingPoint || busy} onClick={confirm} className="geo-primary-button">{busy ? "Envoi…" : submitted ? "Placement envoyé" : "Valider"}</button></div>;
}

function RevealPanel({ view, avatars, busy, next }: { view: GeoView; avatars: Record<string, string>; busy: boolean; next: () => void }) {
  return <div key={`geo-reveal-${view.round}`} className="geo-side-content motion-reveal"><p className="geo-kicker geo-kicker-warm">Révélation</p><h2 className="geo-panel-title">{view.lastRound?.target.name}</h2><p className="geo-target-department">{view.lastRound?.target.departmentName}</p><div className="geo-round-results">{view.players.map((player) => <div key={player.id} className="geo-round-result"><div className="geo-round-player"><Avatar name={player.pseudo} preset={player.avatarPreset ?? "avatar-1"} imageUrl={avatars[player.id] ?? null} size={28} /><div><span>{player.pseudo}</span><small>{view.lastRound?.placements[player.seat] ? `${view.lastRound.placements[player.seat]?.distanceKm.toFixed(1)} km` : "Temps écoulé · 0 point"}</small></div></div><strong>{view.lastRound?.placements[player.seat]?.points ?? 0} pts</strong></div>)}</div><button disabled={busy} onClick={next} className="geo-primary-button">{busy ? "Actualisation…" : "Continuer"}</button></div>;
}

function FinishedPanel({ view, back }: { view: GeoView; back: () => void }) {
  const result = view.result;
  const label = result?.outcome === "draw" ? "Égalité" : result?.outcome === "abandoned" ? "Partie interrompue" : result?.winnerId === view.players[view.mySeat].id ? "Victoire" : "Défaite";
  return <section className="geo-panel geo-finish-panel motion-finish"><p className="geo-kicker geo-kicker-accent">Résultats</p><h1 className="geo-finish-title">{label}</h1>{result?.outcome === "abandoned" && <p className="geo-panel-note">Aucun joueur n&apos;est déclaré vainqueur. La partie a été interrompue ({result.reason}).</p>}<div className="geo-final-scores">{view.players.map((player) => <div key={player.id} className="geo-final-score"><p>{player.pseudo}</p><strong>{player.score}</strong><span>points</span></div>)}</div><button onClick={back} className="geo-primary-button geo-finish-button">Rejouer</button></section>;
}
