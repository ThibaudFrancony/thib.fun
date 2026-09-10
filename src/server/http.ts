import "server-only";

import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function jsonError(code: string, status: number, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function assertMutationOrigin(request: Request): NextResponse | null {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin) {
    return process.env.NODE_ENV === "production"
      ? jsonError("CONFIGURATION_REQUIRED", 503, "L'origine de l'application n'est pas configurée.")
      : null;
  }
  if (request.headers.get("origin") !== configuredOrigin) return jsonError("ORIGIN_NOT_ALLOWED", 403, "Origine non autorisée.");
  return null;
}

export function mapServerError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "SERVER_ERROR";
  const known: Record<string, { status: number; message: string }> = {
    MEMBER_REQUIRED: { status: 403, message: "Ce compte n'est pas encore admis." },
    GAME_NOT_READY: { status: 409, message: "Ce jeu n'est pas encore disponible." },
    ROOM_NOT_FOUND: { status: 404, message: "Salon introuvable." },
    ROOM_CLOSED: { status: 409, message: "Ce salon est fermé ou expiré." },
    ROOM_FULL: { status: 409, message: "Ce salon est déjà complet." },
    VERSION_CONFLICT: { status: 409, message: "L'état a changé. Recharge la partie." },
    PHASE_CONFLICT: { status: 409, message: "La phase a changé. Recharge la partie." },
    DEADLINE_EXPIRED: { status: 409, message: "Temps écoulé, validation en cours." },
    FORFEIT_NOT_AVAILABLE: { status: 409, message: "Le forfait n'est disponible qu'après 90 secondes d'absence." },
    NOT_YOUR_TURN: { status: 409, message: "Ce n'est pas ton tour." },
    CITY_ALREADY_SELECTED: { status: 409, message: "Une ville est déjà retenue, choisis-en une autre." },
    INVALID_CITY_SELECTION: { status: 400, message: "La sélection de villes n'est pas valide." },
    POINT_OUT_OF_BOUNDS: { status: 400, message: "Le point doit rester dans la zone de jeu." },
    MATCH_NOT_FOUND: { status: 404, message: "Partie introuvable." },
    MATCH_NOT_ACTIVE: { status: 409, message: "Cette partie est terminée." },
    NOT_A_PARTICIPANT: { status: 403, message: "Tu ne participes pas à cette partie." },
    HISTORY_UNAVAILABLE: { status: 503, message: "L'historique est momentanément indisponible." },
  };
  const resolved = known[message] ?? { status: 500, message: "Une erreur serveur est survenue." };
  return jsonError(message, resolved.status, resolved.message);
}
