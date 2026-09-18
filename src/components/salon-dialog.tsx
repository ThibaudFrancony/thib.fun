"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PUBLIC_GAMES } from "@/games/registry";
import { postJson } from "@/lib/client-request";
import { useGroupRoom, type GroupRoomState } from "@/lib/group-room";
import type { RoomView } from "@/server/rooms/schemas";

type Step = "loading" | "choice" | "join" | "group";

function SalonDoor({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="salon-door" disabled={disabled} onClick={onClick} aria-label="Quitter le groupe" title="Quitter le groupe">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
        <path d="M10 12h9" />
        <path d="m13 8 4 4-4 4" />
      </svg>
    </button>
  );
}

export function SalonLauncher({ connected }: { connected: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="home-auth-link salon-trigger" onClick={() => setOpen(true)}>
        Salon
      </button>
      {open && connected && createPortal(<SalonDialog onClose={() => setOpen(false)} />, document.body)}
      {open && !connected && createPortal(
        <div className="salon-overlay" role="presentation">
          <div className="salon-dialog" role="dialog" aria-modal="true" aria-labelledby="salon-auth-title">
            <h2 id="salon-auth-title" className="salon-title">Connecte-toi pour créer un salon</h2>
            <p className="salon-text">Les salons d&apos;accueil sont réservés aux comptes connectés. Tu peux te connecter ou créer un compte gratuitement.</p>
            <div className="salon-actions">
              <button type="button" className="salon-button salon-button-ghost" onClick={() => setOpen(false)}>Fermer</button>
              <Link href="/connexion" className="salon-button salon-button-primary">Se connecter</Link>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function SalonDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("loading");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    window.setTimeout(() => focusable()[0]?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/lobbies/active", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((data: { lobby?: RoomView | null } | null) => {
        if (cancelled) return;
        const lobby = data?.lobby ?? null;
        if (lobby) {
          setRoomId(lobby.roomId);
          setStep("group");
        } else {
          setStep("choice");
        }
      })
      .catch(() => {
        if (!cancelled) setStep("choice");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createLobby() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ roomId?: string }>("/api/lobbies", { requestId: crypto.randomUUID() });
      if (!result.ok || !result.data?.roomId) {
        setError(result.ok ? "Impossible de créer le salon." : result.message);
        return;
      }
      setRoomId(result.data.roomId);
      setStep("group");
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
      setRoomId(result.data.roomId);
      setStep("group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="salon-overlay" role="presentation">
      <div ref={dialogRef} className="salon-dialog salon-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="salon-title">
        <button type="button" className="salon-close" onClick={onClose} aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {step === "loading" && <p className="salon-text">Ouverture…</p>}

        {step === "choice" && (
          <>
            <p className="salon-kicker">Salon</p>
            <h2 id="salon-title" className="salon-title">Invite ton adversaire</h2>
            <p className="salon-text">Crée un salon et partage le code, ou rejoins le salon d&apos;un ami. Vous choisirez le jeu juste après.</p>
            {error && <p role="alert" className="salon-error">{error}</p>}
            <div className="salon-choice-grid">
              <button type="button" className="salon-choice" disabled={busy} onClick={() => void createLobby()}>
                <strong>Créer un salon</strong>
                <small>Un code à partager</small>
              </button>
              <button type="button" className="salon-choice" disabled={busy} onClick={() => { setError(null); setStep("join"); }}>
                <strong>Rejoindre</strong>
                <small>J&apos;ai un code</small>
              </button>
            </div>
          </>
        )}

        {step === "join" && (
          <>
            <p className="salon-kicker">Rejoindre</p>
            <h2 id="salon-title" className="salon-title">Entre le code</h2>
            <label className="salon-label" htmlFor="salon-code-input">Code du salon</label>
            <input
              id="salon-code-input"
              className="salon-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => { if (event.key === "Enter") void joinLobby(); }}
              maxLength={6}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
            />
            {error && <p role="alert" className="salon-error">{error}</p>}
            <div className="salon-actions">
              <button type="button" className="salon-button salon-button-ghost" disabled={busy} onClick={() => { setError(null); setStep("choice"); }}>Retour</button>
              <button type="button" className="salon-button salon-button-primary" disabled={busy} onClick={() => void joinLobby()}>{busy ? "Connexion…" : "Rejoindre"}</button>
            </div>
          </>
        )}

        {step === "group" && roomId && <SalonGroupView roomId={roomId} onExit={onClose} />}
      </div>
    </div>
  );
}

function SalonGroupView({ roomId, onExit }: { roomId: string; onExit: () => void }) {
  const group: GroupRoomState = useGroupRoom(roomId);
  const room = group.room;
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const members = room?.members ?? [];
  const seat0 = members.find((member) => member.seat === 0);
  const seat1 = members.find((member) => member.seat === 1);
  const full = members.length === 2;

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyStatus("Code copié.");
    } catch {
      setCopyStatus("Sélectionne le code manuellement.");
    }
  }

  async function leave() {
    if (!room) return;
    setLeaving(true);
    try {
      const result = await postJson(`/salons/${roomId}/actions`, {
        commandId: crypto.randomUUID(),
        expectedVersion: room.version,
        action: { type: "LEAVE" },
      });
      if (result.ok) onExit();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <>
      <div className="salon-group-head">
        <div>
          <p className="salon-kicker">Groupe</p>
          <h2 id="salon-title" className="salon-title">{full ? "Vous êtes deux" : "En attente de ton adversaire"}</h2>
        </div>
        <SalonDoor disabled={leaving || !room} onClick={() => void leave()} />
      </div>

      <div className="salon-slots">
        <SalonSlot member={seat0?.pseudo ?? null} label={seat0?.id === room?.viewerId ? "Toi" : "Joueur 1"} />
        <SalonSlot member={seat1?.pseudo ?? null} label={seat1?.id === room?.viewerId ? "Toi" : "Joueur 2"} />
      </div>

      {room && group.isHost && (
        <div className="salon-code-row">
          <span className="salon-code">{room.code}</span>
          <button type="button" className="salon-button salon-button-ghost" onClick={() => void copyCode()}>Copier</button>
        </div>
      )}
      {copyStatus && <p role="status" className="salon-status">{copyStatus}</p>}
      {!full && <p className="salon-text">{group.isHost ? "Partage le code ou le lien du salon à ton adversaire." : "Attends que l'hôte lance une partie."}</p>}

      {full && (
        <>
          <p className="salon-label">Choisis le jeu</p>
          <div className="salon-games">
            {PUBLIC_GAMES.filter((game) => game.availability !== "coming_soon").map((game) => (
              <Link key={game.slug} href={`/jeux/${game.slug}`} className="salon-game">{game.cardName}</Link>
            ))}
          </div>
          <p className="salon-text">Tu arriveras sur la page du jeu pour régler les options, sans recréer de salon.</p>
        </>
      )}

      {group.error && <p role="alert" className="salon-error">{group.error}</p>}
      {room?.status === "closed" && <p role="alert" className="salon-error">Ce salon a été fermé.</p>}
    </>
  );
}

function SalonSlot({ member, label }: { member: string | null; label: string }) {
  return (
    <div className="salon-slot" data-filled={Boolean(member)}>
      <span className="salon-avatar" aria-hidden="true">{member ? member.slice(0, 1).toUpperCase() : ""}</span>
      <span className="salon-slot-text">
        <strong>{member ?? "En attente…"}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}
