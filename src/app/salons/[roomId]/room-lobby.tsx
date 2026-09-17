"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_GAMES, publicGameBySlug } from "@/games/registry";
import { DEFAULT_ROOM_CONFIGS } from "@/games/default-configs";
import { postJson } from "@/lib/client-request";
import { parseRoomSnapshot, useResourceNetwork } from "@/lib/network-sync";
import type { RoomView } from "@/server/rooms/schemas";
import {
  roomExpirationLabel,
  roomHasExactlyTwoMembers,
  roomIsHost,
  type RoomViewWithMetadata,
} from "./room-lobby-helpers";

type RoomAction =
  | { type: "SET_READY"; ready: boolean }
  | { type: "START" }
  | { type: "LEAVE" }
  | { type: "SET_CONFIG"; gameSlug: string; config: Record<string, unknown> }
  | { type: "TRANSFER_HOST"; targetUserId: string };

type LobbyDraft = {
  baseConfig: string;
  baseGameSlug: string;
  configText: string;
  selectedGameSlug: string;
  transferTarget: string;
};

type RoomPreview = {
  roomId: string;
  code: string;
  gameSlug: string;
  status: "waiting" | "playing" | "closed";
  expiresAt: string;
  memberCount: number;
  viewerIsMember: boolean;
};

function copyErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Copie impossible. Tu peux sélectionner le code manuellement.";
}

export function RoomLobby({ roomId, roomManagementEnabled }: { roomId: string; roomManagementEnabled: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<LobbyDraft | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ roomId: string; checked: boolean; value: RoomPreview | null }>({
    roomId,
    checked: false,
    value: null,
  });
  const [joining, setJoining] = useState(false);

  const onSnapshotApplied = useCallback((next: RoomView, previous: RoomView | null) => {
    if (previous && next.currentMatchId && next.currentMatchId !== previous.currentMatchId) {
      router.push(`/parties/${next.currentMatchId}`);
    }
  }, [router]);

  const {
    snapshot: room,
    error,
    busy,
    pendingIntent,
    networkStatus,
    refresh,
    send,
  } = useResourceNetwork<RoomView, RoomAction>({
    resourceId: roomId,
    snapshotUrl: `/api/rooms/${roomId}`,
    heartbeatUrl: `/api/rooms/${roomId}/heartbeat`,
    realtimeEvent: "room.updated",
    parseSnapshot: parseRoomSnapshot<RoomView>,
    getResourceId: (snapshot) => snapshot.roomId,
    getPhaseId: (snapshot) => snapshot.currentMatchId ?? snapshot.status,
    isFinished: (snapshot) => snapshot.status === "closed",
    versionConflictRetries: 3,
    buildCommand: ({ commandId, expectedVersion, action }) => {
      if (action.type === "SET_READY") {
        return {
          url: `/api/rooms/${roomId}/ready`,
          body: { commandId, expectedVersion, ready: action.ready },
        };
      }
      if (action.type === "START") {
        return { url: `/api/rooms/${roomId}/start`, body: { commandId } };
      }
      return {
        url: `/salons/${roomId}/actions`,
        body: { commandId, expectedVersion, action },
      };
    },
    onCommandAccepted: (data, action) => {
      if (action.type === "LEAVE" && typeof data.gameSlug === "string") router.push(`/jeux/${data.gameSlug}`);
    },
    onSnapshotApplied,
  });

  useEffect(() => {
    if (!error || room) return;
    let cancelled = false;
    void fetch(`/api/rooms/${roomId}/preview`, { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((data: RoomPreview | null) => {
        if (!cancelled) setPreviewState({ roomId, checked: true, value: data });
      })
      .catch(() => {
        if (!cancelled) setPreviewState({ roomId, checked: true, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [error, room, roomId]);

  const preview = previewState.roomId === roomId ? previewState.value : null;
  const previewChecked = previewState.roomId === roomId && previewState.checked;

  async function copyRoomCode() {
    setCopyStatus(null);
    if (!navigator.clipboard) {
      setCopyStatus("Copie indisponible : sélectionne le code manuellement.");
      return;
    }
    try {
      await navigator.clipboard.writeText(room?.code ?? "");
      setCopyStatus("Code copié.");
    } catch (caught) {
      setCopyStatus(copyErrorMessage(caught));
    }
  }

  async function copyRoomLink() {
    setCopyStatus(null);
    if (!navigator.clipboard) {
      setCopyStatus("Copie indisponible : copie l'adresse de la page manuellement.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/salons/${roomId}`);
      setCopyStatus("Lien copié.");
    } catch (caught) {
      setCopyStatus(copyErrorMessage(caught));
    }
  }

  function sendAction(action: RoomAction) {
    setLocalError(null);
    void send(action);
  }

  function saveConfiguration() {
    if (!room || !selectedGameSlug) return;
    try {
      const parsed: unknown = JSON.parse(configText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setLocalError("La configuration doit être un objet JSON.");
        return;
      }
      sendAction({ type: "SET_CONFIG", gameSlug: selectedGameSlug, config: parsed as Record<string, unknown> });
    } catch {
      setLocalError("La configuration n'est pas un JSON valide.");
    }
  }

  async function leaveWaitingRoom() {
    if (!window.confirm("Quitter ce salon d'attente ? Ta place sera libérée.")) return;
    setLocalError(null);
    const next = await send({ type: "LEAVE" });
    if (next) router.push(`/jeux/${next.gameSlug}`);
  }

  async function joinFromPreview() {
    if (!preview) return;
    setJoining(true);
    setLocalError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms/join", {
        requestId: crypto.randomUUID(),
        code: preview.code,
      });
      if (!result.ok || !result.data?.roomId) {
        setLocalError(result.ok ? "Impossible de rejoindre ce salon." : result.message);
        return;
      }
      await refresh({ force: true });
    } finally {
      setJoining(false);
    }
  }

  const backToGames = (
    <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 font-bold">Retour aux jeux</Link>
  );

  if (!room) {
    if (error && preview && !preview.viewerIsMember) {
      if (preview.status === "closed") {
        return (
          <div className="geo-panel geo-lobby-panel mt-10">
            <h1 className="geo-lobby-title">Salon fermé</h1>
            <p className="geo-panel-note mt-3">Ce salon n&apos;accepte plus de joueurs. Demande un nouveau code à ton partenaire.</p>
            <div className="mt-4">{backToGames}</div>
          </div>
        );
      }
      if (preview.status === "playing" || preview.memberCount >= 2) {
        return (
          <div className="geo-panel geo-lobby-panel mt-10">
            <h1 className="geo-lobby-title">Salon complet</h1>
            <p className="geo-panel-note mt-3">Deux joueurs occupent déjà ce salon. Demande un nouveau code pour créer une autre table.</p>
            <div className="mt-4">{backToGames}</div>
          </div>
        );
      }
      return (
        <div className="geo-panel geo-lobby-panel mt-10">
          <p className="geo-kicker geo-kicker-warm">Salon {publicGameBySlug(preview.gameSlug)?.displayName ?? preview.gameSlug}</p>
          <h1 className="geo-lobby-title">Code <span>{preview.code}</span></h1>
          <p className="geo-panel-note mt-3">Tu as reçu ce lien : rejoins le salon pour prendre la seconde place.</p>
          {localError && <p role="alert" className="geo-error mt-3">{localError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={joining} onClick={() => void joinFromPreview()} className="geo-primary-button">{joining ? "Connexion…" : "Rejoindre le salon"}</button>
            {backToGames}
          </div>
        </div>
      );
    }
    if (error && !previewChecked) {
      return <div className="mt-10 rounded-3xl border border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Vérification du salon…</div>;
    }
    if (error) {
      return (
        <div role="alert" className="mt-10 rounded-2xl bg-red-50 p-5 text-red-700">
          <p>{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh({ force: true })} className="rounded-full bg-white px-4 py-2 font-bold text-[var(--ink)]">Réessayer</button>
            {backToGames}
          </div>
        </div>
      );
    }
    return <div className="mt-10 rounded-3xl border border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Chargement du salon…</div>;
  }

  if (room.status === "closed") {
    return (
      <section className="geo-room-lobby">
        <div className="geo-panel geo-lobby-panel">
          <p className="geo-kicker geo-kicker-warm">Salon {publicGameBySlug(room.gameSlug)?.displayName ?? room.gameSlug}</p>
          <h1 className="geo-lobby-title">Salon fermé</h1>
          <p className="geo-panel-note mt-3">Ce salon a expiré ou a été fermé par ses joueurs. Crée une nouvelle table pour rejouer.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/jeux/${room.gameSlug}`} className="geo-primary-button">Créer une nouvelle table</Link>
            {backToGames}
          </div>
        </div>
      </section>
    );
  }

  if (room.currentMatchId) {
    return (
      <section className="geo-room-lobby">
        <div className="geo-panel geo-lobby-panel">
          <p className="geo-kicker geo-kicker-warm">Salon {publicGameBySlug(room.gameSlug)?.displayName ?? room.gameSlug}</p>
          <h1 className="geo-lobby-title">Partie en cours</h1>
          <p className="geo-panel-note mt-3">Une partie est déjà lancée dans ce salon. Reprends-la pour continuer, ou reviens ici une fois terminée pour préparer la revanche.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/parties/${room.currentMatchId}`} className="geo-primary-button">Reprendre la partie</Link>
            {backToGames}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{networkStatus === "RECONNECTING" ? "Reconnexion…" : "Salon synchronisé"}</p>
        </div>
      </section>
    );
  }

  const metadataRoom = room as RoomViewWithMetadata;
  const isHost = roomIsHost(metadataRoom);
  const hasTwoMembers = roomHasExactlyTwoMembers(room);
  const me = room.members.find((member) => member.id === room.viewerId);
  const canStart = room.status === "waiting" && isHost && hasTwoMembers && room.members.every((member) => member.ready);
  const game = publicGameBySlug(room.gameSlug);
  const expiration = roomExpirationLabel(metadataRoom);
  const otherMembers = room.members.filter((member) => member.id !== room.viewerId);
  const serverConfigText = JSON.stringify(room.config);
  const roomDraft = draft && draft.baseConfig === serverConfigText && draft.baseGameSlug === room.gameSlug ? draft : null;
  const configText = roomDraft?.configText ?? JSON.stringify(room.config, null, 2);
  const selectedGameSlug = roomDraft?.selectedGameSlug ?? room.gameSlug;
  const transferTarget = roomDraft?.transferTarget ?? otherMembers[0]?.id ?? "";
  const updateDraft = (changes: Partial<Omit<LobbyDraft, "baseConfig" | "baseGameSlug">>) => {
    const current = roomDraft ?? {
      baseConfig: serverConfigText,
      baseGameSlug: room.gameSlug,
      configText,
      selectedGameSlug,
      transferTarget,
    };
    setDraft({ ...current, ...changes });
  };

  return (
    <section className="geo-room-lobby">
      <div className="geo-panel geo-lobby-panel">
        <div className="geo-lobby-heading">
          <div>
            <p className="geo-kicker geo-kicker-warm">Salon {game?.displayName ?? room.gameSlug}</p>
            <h1 className="geo-lobby-title">Code <span>{room.code}</span></h1>
            <p className="geo-panel-note">Partage ce code ou le lien du salon à ton partenaire.</p>
            {expiration && <p className="mt-2 text-sm font-bold text-[var(--muted)]">{expiration}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyRoomCode()} className="geo-secondary-button geo-copy-button">Copier le code</button>
            <button type="button" onClick={() => void copyRoomLink()} className="geo-secondary-button geo-copy-button">Copier le lien</button>
          </div>
        </div>

        <div className="geo-members-grid">
          {[0, 1].map((seat) => {
            const player = room.members.find((member) => member.seat === seat);
            return <div key={seat} className="geo-member-card"><div><p className="geo-member-seat">Place {seat + 1}{player?.id === room.viewerId ? " · toi" : ""}</p><p className="geo-member-name">{player?.pseudo ?? "En attente…"}</p></div>{player && <span className="geo-ready-badge" data-ready={player.ready}>{player.ready ? "Prêt" : "Pas prêt"}</span>}</div>;
          })}
        </div>

        <div className="geo-lobby-footer">
          <div>
            <p className="geo-panel-note">{room.members.length === 1 ? "En attente du deuxième joueur…" : canStart ? "Tout le monde est prêt." : "Chaque joueur doit se déclarer prêt."}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{networkStatus === "RECONNECTING" ? "Reconnexion…" : pendingIntent ? "Commande en attente de confirmation" : "Salon synchronisé"}</p>
          </div>
          <div className="geo-lobby-actions">
            {me && <button type="button" disabled={busy} onClick={() => sendAction({ type: "SET_READY", ready: !me.ready })} className="geo-secondary-button">{me.ready ? "Ne plus être prêt" : "Je suis prêt"}</button>}
            {isHost && <button type="button" disabled={busy || !canStart} onClick={() => sendAction({ type: "START" })} className="geo-primary-button geo-start-button">Lancer</button>}
          </div>
        </div>

        {pendingIntent && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>Commande non confirmée par le serveur.</span>
            <button type="button" disabled={busy} onClick={() => sendAction(pendingIntent.action as RoomAction)} className="rounded-full bg-white px-3 py-1 font-bold">Réessayer</button>
          </div>
        )}
        {copyStatus && <p role="status" className="mt-4 text-sm font-bold text-[var(--muted)]">{copyStatus}</p>}
        {error && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => void refresh({ force: true })} className="rounded-full bg-white px-3 py-1 font-bold">Actualiser</button></div>}
        {localError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{localError}</p>}
      </div>

      {roomManagementEnabled ? (
        <section className="mt-5 grid gap-5 md:grid-cols-2">
          {isHost && room.status === "waiting" && (
            <div className="geo-panel p-5">
              <p className="geo-kicker geo-kicker-warm">Réglages du salon</p>
              <h2 className="mt-2 text-2xl font-black">Jeu et configuration</h2>
              <label htmlFor="room-game" className="mt-4 block text-sm font-bold">Jeu</label>
              <select
                id="room-game"
                value={selectedGameSlug}
                onChange={(event) => {
                  const slug = event.target.value;
                  updateDraft({
                    selectedGameSlug: slug,
                    configText: JSON.stringify(DEFAULT_ROOM_CONFIGS[slug] ?? {}, null, 2),
                  });
                }}
                disabled={busy}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-bold"
              >
                {PUBLIC_GAMES.map((item) => <option key={item.slug} value={item.slug}>{item.displayName}</option>)}
              </select>
              <label htmlFor="room-config" className="mt-4 block text-sm font-bold">Configuration JSON</label>
              <textarea id="room-config" value={configText} onChange={(event) => updateDraft({ configText: event.target.value })} disabled={busy} rows={8} spellCheck={false} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm" />
              <button type="button" disabled={busy} onClick={saveConfiguration} className="mt-4 min-h-11 rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Enregistrer les réglages</button>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Le serveur valide le jeu, les options, les versions de contenu et remet les deux joueurs à « pas prêt » après un changement.</p>
            </div>
          )}

          {isHost && hasTwoMembers && room.status === "waiting" && (
            <div className="geo-panel p-5">
              <p className="geo-kicker geo-kicker-warm">Droits du salon</p>
              <h2 className="mt-2 text-2xl font-black">Transférer l&apos;hôte</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Le transfert est atomique et ne change pas les sièges ni la confidentialité de la projection.</p>
              <label htmlFor="room-host" className="mt-4 block text-sm font-bold">Nouvel hôte</label>
              <select id="room-host" value={transferTarget} onChange={(event) => updateDraft({ transferTarget: event.target.value })} disabled={busy} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-bold">
                <option value="">Choisir un joueur</option>
                {otherMembers.map((member) => <option key={member.id} value={member.id}>{member.pseudo}</option>)}
              </select>
              <button type="button" disabled={busy || !transferTarget} onClick={() => sendAction({ type: "TRANSFER_HOST", targetUserId: transferTarget })} className="mt-4 min-h-11 rounded-full border border-[var(--green)] px-5 py-3 font-bold text-[var(--green)]">Transférer l&apos;hôte</button>
            </div>
          )}

          {room.status === "waiting" && (
            <div className="geo-panel p-5">
              <p className="geo-kicker geo-kicker-warm">Sortir du salon</p>
              <h2 className="mt-2 text-2xl font-black">Quitter l&apos;attente</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Ta ligne de membre sera retirée de façon atomique. Si tu es l&apos;hôte, l&apos;autre joueur devient hôte ; si tu es seul, le salon est fermé.</p>
              <button type="button" disabled={busy} onClick={() => void leaveWaitingRoom()} className="mt-4 min-h-11 rounded-full border border-red-200 bg-white px-5 py-3 font-bold text-red-700">Quitter le salon</button>
            </div>
          )}
        </section>
      ) : (
        <p className="geo-helper-text">La gestion avancée du salon sera disponible après activation de la transaction serveur de configuration, sortie et transfert d&apos;hôte. Les boutons affichés ici restent limités aux commandes actuellement disponibles.</p>
      )}
    </section>
  );
}
