"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { PUBLIC_GAMES } from "@/games/registry";
import { postJson } from "@/lib/client-request";
import { useActiveRoomDiscovery, useGroupRoom, type GroupRoomState } from "@/lib/group-room";
import { useRoomAvatars } from "@/lib/room-avatars";
import { Avatar } from "@/components/avatar";
import type { RoomView } from "@/server/rooms/schemas";

type Panel = "choice" | "join" | "group" | null;

function SalonDoor({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="salon-door" disabled={disabled} onClick={onClick} aria-label="Quitter le groupe" title="Quitter le groupe">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
        <path d="M10 12h9" />
        <path d="m13 8 4 4-4 4" />
      </svg>
    </button>
  );
}

/**
 * Bouton « Salon » du header d'accueil. Une petite fenêtre ancrée au bouton
 * (sans voile ni flou) permet de créer ou rejoindre un salon. Une fois le
 * groupe formé, le bouton laisse place à un badge inline (ronds, code, porte).
 */
export function SalonLauncher({ connected, triggerClassName = "home-auth-link", icon = null, triggerLabel = "Salon" }: { connected: boolean; triggerClassName?: string; icon?: ReactNode; triggerLabel?: string }) {
  const discovery = useActiveRoomDiscovery(connected);
  const [panel, setPanel] = useState<Panel>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const group = useGroupRoom(discovery.roomId);
  const lobbyId = discovery.roomId;
  const loaded = !discovery.loading;

  useEffect(() => {
    if (!panel) return;
    function onPointerDown(event: PointerEvent) {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) setPanel(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  async function leaveGroup() {
    if (!group.room) return;
    if (!window.confirm("Quitter le groupe ? Ta place sera libérée.")) return;
    const ok = await group.leave();
    if (ok) {
      setPanel(null);
      discovery.remember(null);
    }
  }

  const room = group.room;
  const seat0 = room?.members.find((member) => member.seat === 0);
  const seat1 = room?.members.find((member) => member.seat === 1);
  const full = (room?.members.length ?? 0) === 2;
  const avatars = useRoomAvatars(room?.roomId ?? lobbyId, room?.members.map((member) => member.id) ?? []);

  return (
    <div className="salon-anchor" ref={anchorRef} data-salon-ready={loaded ? "true" : "false"}>
      {loaded && lobbyId ? (
        <div className="salon-chip">
          <button
            type="button"
            className="salon-chip-main"
            onClick={() => setPanel(panel === "group" ? null : "group")}
            aria-expanded={panel === "group"}
            aria-label="Salon du groupe"
          >
            <span className="salon-chip-avatars" aria-hidden="true">
              {seat0 ? <Avatar name={seat0.pseudo} preset={seat0.avatarPreset} imageUrl={avatars[seat0.id] ?? null} size={24} /> : <span className="salon-chip-avatar" data-filled={false} />}
              {seat1 ? <Avatar name={seat1.pseudo} preset={seat1.avatarPreset} imageUrl={avatars[seat1.id] ?? null} size={24} /> : <span className="salon-chip-avatar" data-filled={false} />}
            </span>
            {group.isHost && <span className="salon-chip-code">{room?.code ?? "…"}</span>}
          </button>
          <SalonDoor disabled={!room} onClick={() => void leaveGroup()} />
        </div>
      ) : (
        <button
          type="button"
          className={`${triggerClassName} salon-trigger`}
          onClick={() => setPanel(panel ? null : "choice")}
          aria-expanded={panel !== null}
          aria-label={icon ? triggerLabel : undefined}
        >
          {icon ?? "Salon"}
        </button>
      )}

      {panel && (
        <div className="salon-popover" role="dialog" aria-label="Salon">
          {!connected ? (
            <SalonAuthPrompt onClose={() => setPanel(null)} />
          ) : panel === "group" ? (
            <SalonGroupBody group={group} room={room} seat0={seat0} seat1={seat1} full={full} avatars={avatars} onDoor={() => void leaveGroup()} onClose={() => setPanel(null)} />
          ) : (
            <SalonChoice
              step={panel}
              onStep={setPanel}
              onCreated={(roomId) => {
                discovery.remember(roomId);
                setPanel(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SalonAuthPrompt({ onClose }: { onClose: () => void }) {
  return (
    <>
      <p className="salon-kicker">Salon</p>
      <h2 className="salon-title">Connecte-toi</h2>
      <p className="salon-text">Les salons d&apos;accueil sont réservés aux comptes connectés.</p>
      <div className="salon-actions">
        <button type="button" className="salon-button salon-button-ghost" onClick={onClose}>Fermer</button>
        <Link href="/connexion" className="salon-button salon-button-primary">Se connecter</Link>
      </div>
    </>
  );
}

function SalonChoice({ step, onStep, onCreated }: { step: "choice" | "join"; onStep: (panel: Panel) => void; onCreated: (roomId: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLobby() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/lobbies", { requestId: crypto.randomUUID() });
      if (!result.ok || !result.data?.roomId) {
        setError(result.ok ? "Impossible de créer le salon." : result.message);
        return;
      }
      onCreated(result.data.roomId);
    } finally {
      setBusy(false);
    }
  }

  async function joinLobby() {
    const value = code.trim().toUpperCase();
    if (value.length !== 6) {
      setError("Le code doit contenir 6 caractères.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/rooms/join", { requestId: crypto.randomUUID(), code: value });
      if (!result.ok || !result.data?.roomId) {
        setError(result.ok ? "Impossible de rejoindre ce salon." : result.message);
        return;
      }
      onCreated(result.data.roomId);
    } finally {
      setBusy(false);
    }
  }

  if (step === "join") {
    return (
      <>
        <p className="salon-kicker">Rejoindre</p>
        <h2 className="salon-title">Entre le code</h2>
        <input
          className="salon-input"
          aria-label="Code du salon"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => { if (event.key === "Enter") void joinLobby(); }}
          maxLength={6}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
        />
        {error && <p role="alert" className="salon-error">{error}</p>}
        <div className="salon-actions">
          <button type="button" className="salon-button salon-button-ghost" disabled={busy} onClick={() => { setError(null); onStep("choice"); }}>Retour</button>
          <button type="button" className="salon-button salon-button-primary" disabled={busy} onClick={() => void joinLobby()}>{busy ? "Connexion…" : "Rejoindre"}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="salon-kicker">Salon</p>
      <h2 className="salon-title">Invite ton adversaire</h2>
      <p className="salon-text">Crée un salon et partage le code, ou rejoins le salon d&apos;un ami.</p>
      {error && <p role="alert" className="salon-error">{error}</p>}
      <div className="salon-choice-grid">
        <button type="button" className="salon-choice" disabled={busy} onClick={() => void createLobby()}>
          <strong>Créer un salon</strong>
          <small>Un code à partager</small>
        </button>
        <button type="button" className="salon-choice" disabled={busy} onClick={() => { setError(null); onStep("join"); }}>
          <strong>Rejoindre</strong>
          <small>J&apos;ai un code</small>
        </button>
      </div>
    </>
  );
}

function SalonGroupBody({
  group,
  room,
  seat0,
  seat1,
  full,
  avatars,
  onDoor,
  onClose,
}: {
  group: GroupRoomState;
  room: RoomView | null;
  seat0: RoomView["members"][number] | undefined;
  seat1: RoomView["members"][number] | undefined;
  full: boolean;
  avatars: Record<string, string>;
  onDoor: () => void;
  onClose: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyStatus("Code copié.");
    } catch {
      setCopyStatus("Sélectionne le code manuellement.");
    }
  }

  if (!room) {
    return (
      <>
        <p className="salon-kicker">Groupe</p>
        <h2 className="salon-title">Connexion…</h2>
        <p className="salon-text">Ouverture du salon.</p>
        <button type="button" className="salon-link-danger" onClick={onDoor}>Quitter le groupe</button>
      </>
    );
  }

  return (
    <>
      <div className="salon-group-head">
        <div>
          <p className="salon-kicker">Groupe</p>
          <h2 className="salon-title">{room.currentMatchId ? "Partie en cours" : full ? "Vous êtes deux" : "En attente"}</h2>
        </div>
      </div>

      <div className="salon-slots">
        <SalonSlot member={seat0?.pseudo ?? null} label={seat0?.id === room?.viewerId ? "Toi" : "Joueur 1"} preset={seat0?.avatarPreset ?? "avatar-1"} imageUrl={seat0 ? avatars[seat0.id] ?? null : null} />
        <SalonSlot member={seat1?.pseudo ?? null} label={seat1?.id === room?.viewerId ? "Toi" : "Joueur 2"} preset={seat1?.avatarPreset ?? "avatar-1"} imageUrl={seat1 ? avatars[seat1.id] ?? null : null} />
      </div>

      {room && group.isHost && (
        <div className="salon-code-row">
          <span className="salon-code">{room.code}</span>
          <button type="button" className="salon-button salon-button-ghost" onClick={() => void copyCode()}>Copier</button>
        </div>
      )}
      {copyStatus && <p role="status" className="salon-status">{copyStatus}</p>}
      {!full && <p className="salon-text">{group.isHost ? "Partage le code à ton adversaire, ou clique un jeu dès qu'il rejoint." : "Attends l'hôte."}</p>}

      {full && room.currentMatchId && (
        <>
          <p className="salon-label">Partie en cours</p>
          <Link href={`/parties/${room.currentMatchId}`} className="salon-button salon-button-primary" onClick={onClose}>
            Reprendre
          </Link>
        </>
      )}

      {full && !room.currentMatchId && (
        <>
          <p className="salon-label">Choisis le jeu</p>
          <div className="salon-games">
            {PUBLIC_GAMES.filter((game) => game.availability !== "coming_soon").map((game) => (
              <Link key={game.slug} href={`/jeux/${game.slug}`} className="salon-game">{game.cardName}</Link>
            ))}
          </div>
          <p className="salon-text">Tu régleras les options sur la page du jeu, sans recréer de salon.</p>
        </>
      )}

      {group.error && <p role="alert" className="salon-error">{group.error}</p>}
      <button type="button" className="salon-link-danger" onClick={onDoor}>Quitter le groupe</button>
    </>
  );
}

function SalonSlot({ member, label, preset, imageUrl }: { member: string | null; label: string; preset: string; imageUrl: string | null }) {
  return (
    <div className="salon-slot" data-filled={Boolean(member)}>
      <Avatar name={member ?? label} preset={preset} imageUrl={imageUrl} size={36} />
      <span className="salon-slot-text">
        <strong>{member ?? "En attente…"}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}
