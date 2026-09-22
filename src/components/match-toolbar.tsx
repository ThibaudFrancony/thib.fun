"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type MatchToolbarProps = {
  title: string;
  progress?: string;
  busy: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onResign?: () => void;
  children?: ReactNode;
};

/** Secondary actions and scores stay available without occupying the board. */
export function MatchToolbar({ title, progress, busy, onBack, onRefresh, onResign, children }: MatchToolbarProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const screen = header.current?.closest<HTMLElement>(".play-screen");
    const viewport = window.visualViewport;
    if (!screen || !viewport) return;
    const resize = () => {
      // Zoom retains native panning. Only adapt to the keyboard at normal scale.
      screen.style.setProperty("--play-height", `${viewport.scale === 1 ? viewport.height : window.innerHeight}px`);
      screen.toggleAttribute("data-keyboard", viewport.scale === 1 && viewport.height < window.innerHeight * 0.75);
    };
    resize();
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
  }, []);

  return (
    <header ref={header} className="play-toolbar">
      <button type="button" onClick={onBack} aria-label="Retour au salon" title="Salon">←</button>
      <h1>{title}{progress && <span>{progress}</span>}</h1>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Options de la partie" title="Options">•••</button>
      <dialog ref={dialog} className="play-dialog" aria-labelledby={titleId}>
        <div className="play-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Fermer les options">✕</button></div>
        {children}
        <div className="play-dialog-actions">
          <button type="button" onClick={() => { dialog.current?.close(); onRefresh(); }}>Actualiser</button>
          {onResign && <button type="button" disabled={busy} onClick={() => {
            if (window.confirm("Abandonner cette partie ?")) { dialog.current?.close(); onResign(); }
          }}>Abandonner</button>}
        </div>
      </dialog>
    </header>
  );
}

export function MatchDetails({ label = "Détails", children }: { label?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <><button type="button" className="play-details-button" onClick={() => dialog.current?.showModal()}>{label}</button><dialog ref={dialog} className="play-dialog" aria-labelledby={titleId}><div className="play-dialog-heading"><h2 id={titleId}>{label}</h2><button type="button" aria-label="Fermer les détails" onClick={() => dialog.current?.close()}>✕</button></div>{children}</dialog></>;
}
