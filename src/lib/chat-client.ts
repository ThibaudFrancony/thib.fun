"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { ChatConversationPayload, ChatMessage, ChatSentMessage, ChatSummary } from "@/lib/chat-types";

export const CHAT_OPEN_PREFERENCE_KEY = "tibo.fun:chat-open";
export const CHAT_SOUND_PREFERENCE_KEY = "tibo.fun:chat-sound";

export const CHAT_IMAGE_MAX_DIMENSION = 1280;
export const CHAT_IMAGE_TARGET_BYTES = 200 * 1024;
const CHAT_IMAGE_QUALITIES = [0.72, 0.6, 0.5];

export async function fetchChatSummary(): Promise<ChatSummary | null> {
  const response = await fetch("/api/chat/summary", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as ChatSummary;
}

export async function fetchChatMessages(
  conversationId: string,
  options: { before?: number; limit?: number } = {},
): Promise<ChatConversationPayload> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", String(options.before));
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("CONVERSATION_NOT_FOUND");
  return (await response.json()) as ChatConversationPayload;
}

export async function markConversationRead(conversationId: string, lastReadSeq: number): Promise<void> {
  await fetch(`/api/chat/conversations/${conversationId}/read`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lastReadSeq }),
  });
}

export async function recordChatActivity(): Promise<void> {
  await fetch("/api/chat/presence", { method: "POST" });
}

function extractError(data: unknown): { code: string | null; message: string } {
  if (data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object") {
    const error = data.error as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" && error.message.trim() ? error.message : "Le message n'a pas pu être envoyé.",
    };
  }
  return { code: null, message: "Le message n'a pas pu être envoyé." };
}

export async function sendChatMessageRequest(
  conversationId: string,
  args: { requestId: string; body: string | null; file: File | null },
): Promise<ChatSentMessage> {
  const form = new FormData();
  form.set("requestId", args.requestId);
  if (args.body) form.set("body", args.body);
  if (args.file) form.set("file", args.file);
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: form,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = extractError(data);
    if (response.status >= 500) {
      // Un 500 inattendu est traçable côté serveur par ce diagnostic.
      console.error("Envoi de message refusé", {
        conversationId,
        code: failure.code,
        diagnosticId: response.headers.get("x-diagnostic-id"),
      });
    }
    throw new Error(failure.message);
  }
  if (!data || typeof data !== "object" || !("message" in data)) throw new Error("Le message n'a pas pu être envoyé.");
  return (data as { message: ChatSentMessage }).message;
}

type ImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Repli HTMLImageElement ci-dessous.
    }
  }
  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("IMAGE_INVALID"));
    element.src = url;
  });
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Compression locale avant envoi : 1280 px maximum, WebP qualité dégradée
 * jusqu'à tenir sous ~200 Ko. Le blob optimisé ne vit qu'en mémoire ; aucune
 * copie n'est conservée en local.
 */
export async function optimizeChatImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("IMAGE_INVALID");
  const loaded = await loadImageSource(file);
  try {
    const scale = Math.min(1, CHAT_IMAGE_MAX_DIMENSION / Math.max(loaded.width, loaded.height));
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_INVALID");
    context.drawImage(loaded.source, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of CHAT_IMAGE_QUALITIES) {
      const candidate = await canvasToBlob(canvas, "image/webp", quality);
      if (candidate && candidate.type === "image/webp") {
        blob = candidate;
        if (candidate.size <= CHAT_IMAGE_TARGET_BYTES) break;
      } else {
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        if (blob && blob.size <= CHAT_IMAGE_TARGET_BYTES) break;
      }
    }
    if (!blob) throw new Error("IMAGE_INVALID");
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `photo.${extension}`, { type: blob.type });
  } finally {
    loaded.release();
  }
}

export type ChatRealtimeEvent =
  | { type: "chat"; conversationId: string }
  | { type: "friend" }
  | { type: "reconnected" };

/** Abonnement testable indépendamment du rendu React. */
export function subscribeChatRealtime(
  supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>,
  userId: string,
  onEvent: (event: ChatRealtimeEvent) => void,
): () => void {
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function retry() {
    if (cancelled || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, 3_000);
  }

  async function connect() {
    if (channel) {
      const previous = channel;
      channel = null;
      await supabase.removeChannel(previous);
    }
    try {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || data.user?.id !== userId) {
        retry();
        return;
      }
      // getUser vérifie la session ; setAuth transmet explicitement le JWT
      // courant à Realtime avant son contrôle d'accès au canal privé.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      const current = supabase
        .channel(`chat:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "chat.updated" }, ({ payload }: { payload: unknown }) => {
          if (cancelled || channel !== current) return;
          const candidate = payload as { id?: unknown } | null;
          if (!candidate || typeof candidate.id !== "string") return;
          onEvent({ type: "chat", conversationId: candidate.id });
        })
        .on("broadcast", { event: "friend.updated" }, () => {
          if (!cancelled && channel === current) onEvent({ type: "friend" });
        });
      channel = current;
      current.subscribe((status: string) => {
        if (cancelled || channel !== current) return;
        if (status === "SUBSCRIBED") {
          if (retryTimer !== null) clearTimeout(retryTimer);
          retryTimer = null;
          // Relire aussi au PREMIER abonnement : un message peut arriver
          // entre le chargement initial et la connexion WebSocket.
          onEvent({ type: "reconnected" });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          retry();
        }
      });
    } catch {
      retry();
    }
  }

  void connect();
  return () => {
    cancelled = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (channel) void supabase.removeChannel(channel);
  };
}

export function useChatRealtime(userId: string | null, onEvent: (event: ChatRealtimeEvent) => void): void {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    if (!userId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    return subscribeChatRealtime(supabase, userId, (event) => handlerRef.current(event));
  }, [userId]);
}

type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const constructor = (window.AudioContext
    ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
    | AudioContextConstructor
    | undefined;
  if (!constructor) return null;
  if (!audioContext) {
    try {
      audioContext = new constructor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

export function unlockChatAudio(): void {
  const context = getAudioContext();
  if (context && context.state === "suspended") void context.resume().catch(() => undefined);
}

/** Notification sonore discrète ; silencieuse tant que l'utilisateur n'a pas interagi. */
export function playChatSound(): void {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;
  const start = context.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const offset = start + index * 0.09;
    gain.gain.setValueAtTime(0.0001, offset);
    gain.gain.linearRampToValueAtTime(0.045, offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, offset + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(offset);
    oscillator.stop(offset + 0.18);
  });
}

/** Débloque l'audio au premier geste utilisateur, sans dépendre d'un clic sur le chat. */
export function useChatAudioUnlock(): void {
  useEffect(() => {
    const unlock = () => unlockChatAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

export function usePersistentChatOpen(): [boolean, (value: boolean) => void] {
  const [open, setOpenState] = useState(() => readBooleanPreference(CHAT_OPEN_PREFERENCE_KEY, false));
  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    try {
      window.localStorage.setItem(CHAT_OPEN_PREFERENCE_KEY, value ? "true" : "false");
    } catch {
      // Stockage indisponible : l'état reste en mémoire.
    }
  }, []);
  return [open, setOpen];
}

export function usePersistentChatSound(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabledState] = useState(() => readBooleanPreference(CHAT_SOUND_PREFERENCE_KEY, true));
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      window.localStorage.setItem(CHAT_SOUND_PREFERENCE_KEY, value ? "true" : "false");
    } catch {
      // Stockage indisponible : le choix reste en mémoire.
    }
  }, []);
  return [enabled, setEnabled];
}

export type { ChatMessage };
