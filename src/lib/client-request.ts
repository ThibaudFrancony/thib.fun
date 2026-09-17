"use client";

export type JsonRequestResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; message: string };

export const CLIENT_NETWORK_ERROR = "Connexion interrompue. Vérifie ta connexion puis réessaie.";
export const CLIENT_INVALID_RESPONSE_ERROR = "La réponse du serveur est invalide. Réessaie dans un instant.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(data: unknown): string {
  if (isRecord(data) && isRecord(data.error) && typeof data.error.message === "string" && data.error.message.trim()) {
    return data.error.message;
  }
  return "La commande n'a pas été acceptée.";
}

export async function postJson<T>(url: string, payload: unknown): Promise<JsonRequestResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, status: 0, message: CLIENT_NETWORK_ERROR };
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, message: errorMessage(data) };
  if (data === null || typeof data !== "object") return { ok: false, status: response.status, message: CLIENT_INVALID_RESPONSE_ERROR };
  return { ok: true, status: response.status, data: data as T };
}
