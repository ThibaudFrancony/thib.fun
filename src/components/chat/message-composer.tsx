"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeChatImage } from "@/lib/chat-client";

export function MessageComposer({
  canWrite,
  active,
  notice,
  placeholder = "Écrire un message…",
  onSend,
}: {
  canWrite: boolean;
  active: boolean;
  notice?: string;
  placeholder?: string;
  onSend: (body: string | null, file: File | null) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentRef = useRef(attachment);
  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (attachmentRef.current) URL.revokeObjectURL(attachmentRef.current.previewUrl);
    };
  }, []);

  useEffect(() => {
    if (!canWrite || !active) return;
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = [...items].find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      void attachFile(file);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [canWrite, active]);

  async function attachFile(raw: File) {
    setError(null);
    setOptimizing(true);
    try {
      const optimized = await optimizeChatImage(raw);
      setAttachment((previous) => {
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        return { file: optimized, previewUrl: URL.createObjectURL(optimized) };
      });
    } catch {
      setError("Cette image n'a pas pu être préparée. Essaie une autre photo.");
    } finally {
      setOptimizing(false);
    }
  }

  function clearAttachment() {
    setAttachment((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(Math.max(textarea.scrollHeight, 42), 132);
    textarea.style.height = `${next}px`;
  }

  async function submit() {
    if (busy || optimizing) return;
    const body = text.trim() ? text.trim() : null;
    if (!body && !attachment) return;
    setBusy(true);
    setError(null);
    const result = await onSend(body, attachment?.file ?? null);
    setBusy(false);
    if (result.ok) {
      setText("");
      clearAttachment();
      requestAnimationFrame(() => {
        resizeTextarea();
        textareaRef.current?.focus();
      });
    } else {
      setError(result.message);
    }
  }

  if (!canWrite) {
    return (
      <div className="chat-composer chat-composer-locked">
        <p>{notice ?? "Crée un compte pour écrire dans le chat."}</p>
      </div>
    );
  }

  const disabled = busy || optimizing || (!text.trim() && !attachment);

  return (
    <div className="chat-composer">
      {attachment ? (
        <div className="chat-attachment">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.previewUrl} alt="Aperçu de la photo" />
          <button type="button" className="chat-attachment-remove" onClick={clearAttachment} aria-label="Retirer la photo">
            ×
          </button>
        </div>
      ) : null}
      {error ? <p className="chat-composer-error" role="alert">{error}</p> : null}
      <div className="chat-composer-row">
        <button
          type="button"
          className="chat-composer-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={optimizing}
          aria-label="Joindre une photo"
          title="Joindre une photo"
        >
          {optimizing ? (
            <span className="chat-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m5 17 4.5-4.5L13 16l3-3 3 3" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="chat-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attachFile(file);
          }}
        />
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={text}
          rows={1}
          maxLength={1000}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => {
            setText(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          className="chat-send"
          onClick={() => void submit()}
          disabled={disabled}
          aria-label="Envoyer"
          title="Envoyer"
        >
          {busy ? (
            <span className="chat-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12 20 4.5 15 20l-3.5-6.5L4.5 12Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
