"use client";

import { useEffect, useRef } from "react";

type GuestWarningDialogProps = {
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GuestWarningDialog({ busy = false, onCancel, onConfirm }: GuestWarningDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    focusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
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
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-warning-title"
        aria-describedby="guest-warning-description"
        className="w-full max-w-md rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-2xl sm:p-8"
      >
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p>
        <h2 id="guest-warning-title" className="mt-3 text-3xl font-black tracking-[-0.05em]">Jouer sans créer de compte&nbsp;?</h2>
        <p id="guest-warning-description" className="mt-4 leading-7 text-[var(--muted)]">
          Ton pseudo et ta progression ne seront pas conservés dans un compte. Si tu quittes cette session ou effaces les données de navigation, tu ne pourras pas retrouver cet invité.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-full border border-[var(--line)] px-4 py-3 font-bold text-[var(--ink)] hover:bg-[var(--paper-deep)]">Retour à l&apos;inscription</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-full bg-[var(--green)] px-4 py-3 font-bold text-white hover:bg-[var(--green-dark)]">{busy ? "Connexion…" : "Continuer comme invité"}</button>
        </div>
      </div>
    </div>
  );
}
