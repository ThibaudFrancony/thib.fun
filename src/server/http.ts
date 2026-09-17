import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

type PublicErrorDefinition = {
  status: number;
  message: string;
};

const PUBLIC_ERROR_DEFINITIONS: Readonly<Record<string, PublicErrorDefinition>> = {
  INTERNAL_ERROR: { status: 500, message: "Une erreur serveur est survenue." },
  CONFIGURATION_REQUIRED: { status: 503, message: "Le serveur de données n'est pas configuré." },
  ORIGIN_NOT_ALLOWED: { status: 403, message: "Origine non autorisée." },
  UNAUTHORIZED: { status: 401, message: "Authentification requise." },
  UNAUTHENTICATED: { status: 401, message: "Authentification requise." },
  INVALID_REQUEST: { status: 400, message: "La demande est invalide." },
  NOT_FOUND: { status: 404, message: "Ressource introuvable." },
  ACCOUNT_DISABLED: { status: 403, message: "Ce compte est désactivé." },
  ACCOUNT_REQUIRED: { status: 403, message: "Crée un compte pour conserver cette progression." },
  ACCOUNT_PROVISIONING_FAILED: { status: 503, message: "Ton compte n'a pas pu être finalisé. Réessaie dans un instant." },
  HISTORY_UNAVAILABLE: { status: 503, message: "L'historique est momentanément indisponible." },
  MEMBER_REQUIRED: { status: 403, message: "Ce compte n'est pas encore admis." },
  TWO_PLAYERS_REQUIRED: { status: 409, message: "Deux joueurs sont nécessaires pour lancer cette partie." },
  HOST_REQUIRED: { status: 403, message: "Seul le créateur du salon peut effectuer cette action." },
  PLAYERS_NOT_READY: { status: 409, message: "Les deux joueurs doivent être prêts." },
  ROOM_NOT_WAITING: { status: 409, message: "Ce salon n'attend plus de joueurs." },
  GAME_NOT_READY: { status: 409, message: "Ce jeu n'est pas encore disponible." },
  TTMC_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
  COMPATIBILITY_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
  LONGUEUR_ONDE_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
  GEOGRAPHY_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
  QUIZ_CONTENT_UNAVAILABLE: { status: 503, message: "Le corpus de questions est momentanément indisponible." },
  BOMBPARTY_CONTENT_MISMATCH: { status: 503, message: "Le dictionnaire de la partie est invalide." },
  BOMBPARTY_CONTENT_UNAVAILABLE: { status: 503, message: "Le dictionnaire de la partie est momentanément indisponible." },
  QUESTION_NOT_IN_PACK: { status: 503, message: "La question de cette partie est indisponible." },
  AXIS_NOT_IN_PACK: { status: 503, message: "L'axe de cette partie est indisponible." },
  CITY_NOT_IN_PACK: { status: 503, message: "La ville de cette partie est indisponible." },
  CITY_NOT_IN_POOL: { status: 422, message: "Cette ville ne fait pas partie du tirage autorisé." },
  CONTENT_UNAVAILABLE: { status: 422, message: "Le corpus de questions est insuffisant pour ces options. Ajoute des catégories ou raccourcis la partie." },
  INSUFFICIENT_CONTENT: { status: 422, message: "Le contenu disponible est insuffisant pour ces options." },
  ROOM_NOT_FOUND: { status: 404, message: "Salon introuvable." },
  ROOM_CLOSED: { status: 409, message: "Ce salon est fermé ou expiré." },
  ROOM_EXPIRED: { status: 409, message: "Ce salon est fermé ou expiré." },
  NOT_A_ROOM_MEMBER: { status: 403, message: "Tu ne participes pas à ce salon." },
  ROOM_FULL: { status: 409, message: "Ce salon est déjà complet." },
  ROOM_TARGET_NOT_MEMBER: { status: 422, message: "Choisis un autre participant du salon." },
  INVALID_ROOM_ACTION: { status: 400, message: "L'action du salon est invalide." },
  MATCH_NOT_FOUND: { status: 404, message: "Partie introuvable." },
  MATCH_NOT_ACTIVE: { status: 409, message: "Cette partie est terminée." },
  NOT_A_PARTICIPANT: { status: 403, message: "Tu ne participes pas à cette partie." },
  VERSION_CONFLICT: { status: 409, message: "L'état a changé. Recharge la partie." },
  CONTENT_VERSION_MISMATCH: { status: 409, message: "La version de contenu de cette partie n'est plus disponible." },
  CONTENT_MANIFEST_MISMATCH: { status: 503, message: "Le manifeste du contenu est invalide." },
  PHASE_CONFLICT: { status: 409, message: "La phase a changé. Recharge la partie." },
  DEADLINE_EXPIRED: { status: 409, message: "Temps écoulé, validation en cours." },
  FORFEIT_NOT_AVAILABLE: { status: 409, message: "Le forfait n'est disponible qu'après 90 secondes d'absence." },
  COMMAND_ID_REUSED: { status: 409, message: "Cet identifiant de commande a déjà été utilisé pour une autre action." },
  JOB_LEASE_INVALID: { status: 409, message: "Le bail de la tâche est invalide ou expiré." },
  JOB_NOT_DUE: { status: 409, message: "Cette tâche n'est pas encore échue." },
  STALE_JOB: { status: 409, message: "Cette tâche n'est plus d'actualité." },
  DATABASE_UNAVAILABLE: { status: 503, message: "Le service de données est temporairement indisponible." },
  SUPABASE_SERVER_CONFIGURATION_MISSING: { status: 503, message: "Le serveur de données n'est pas configuré." },
  AI_CONFIGURATION_REQUIRED: { status: 503, message: "La correction des réponses quiz n'est pas configurée." },
  INVALID_COMMIT_SOURCE: { status: 400, message: "La source de commit est invalide." },
  INVALID_COMMAND_TYPE: { status: 400, message: "Le type de commande est invalide." },
  INVALID_JOB_COMMAND: { status: 400, message: "La commande système est invalide." },
  INVALID_JOB_DATA: { status: 422, message: "Les données de la tâche sont invalides." },
  INVALID_JOB_TYPE: { status: 422, message: "Le type de tâche est invalide." },
  INVALID_ENVELOPE: { status: 400, message: "La transaction reçue est invalide." },
  INVALID_NEXT: { status: 422, message: "L'état suivant de la partie est invalide." },
  INVALID_RESULT: { status: 422, message: "Le résultat de la partie est invalide." },
  INVALID_ROUND: { status: 422, message: "Le résultat de manche est invalide." },
  INVALID_VIEWS: { status: 422, message: "Les projections de la partie sont invalides." },
  INVALID_VIEW: { status: 422, message: "Une projection de la partie est invalide." },
  INVALID_VIEWER: { status: 403, message: "Une projection vise un joueur non autorisé." },
  MISSING_ACTOR_VIEW: { status: 422, message: "La projection du joueur est manquante." },
  INVALID_MATCH_DATA: { status: 503, message: "Les données de la partie sont indisponibles." },
  INVALID_MATCH_PLAYERS: { status: 503, message: "Les joueurs de la partie sont invalides." },
  RESULT_ALREADY_FINALIZED: { status: 409, message: "Le résultat de la partie est déjà finalisé." },
  NOT_YOUR_TURN: { status: 409, message: "Ce n'est pas ton tour." },
  MATCH_FINISHED: { status: 409, message: "Cette partie est terminée." },
  NOT_PLAYING: { status: 409, message: "Cette action n'est pas disponible maintenant." },
  NOT_AFTER_DRAW: { status: 409, message: "Cette carte piochée n'est plus en attente." },
  CARD_NOT_IN_HAND: { status: 422, message: "Cette carte n'est pas dans ta main." },
  CARD_NOT_PLAYABLE: { status: 422, message: "Cette carte ne peut pas être jouée maintenant." },
  WILD4_NOT_ALLOWED: { status: 422, message: "Le +4 n'est jouable que sans carte de la couleur active." },
  WILD_COLOR_REQUIRED: { status: 422, message: "Choisis une couleur pour ce joker." },
  CHOSEN_COLOR_NOT_ALLOWED: { status: 422, message: "Cette carte ne permet pas de choisir une couleur." },
  EMPTY_DISCARD: { status: 503, message: "La défausse de cette partie est indisponible." },
  NO_NUMERIC_START_CARD: { status: 503, message: "La pioche de cette partie est invalide." },
  CITY_ALREADY_SELECTED: { status: 409, message: "Une ville est déjà retenue, choisis-en une autre." },
  INVALID_CITY_SELECTION: { status: 400, message: "La sélection de villes n'est pas valide." },
  INVALID_ANSWER: { status: 400, message: "Ta réponse doit contenir entre 1 et 240 caractères." },
  WRONG_PHASE: { status: 409, message: "Cette action n'est pas disponible dans cette phase." },
  ALREADY_SUBMITTED: { status: 409, message: "Ta réponse est déjà enregistrée." },
  ALREADY_ACKNOWLEDGED: { status: 409, message: "Tu as déjà confirmé cette révélation." },
  INVALID_OPTION: { status: 422, message: "Cette option n'existe pas pour la question actuelle." },
  SKIP_LIMIT_REACHED: { status: 409, message: "Les trois passages de la partie ont déjà été utilisés." },
  NO_RESERVE_AVAILABLE: { status: 409, message: "Il n'y a plus de question de remplacement disponible." },
  INCOMPLETE_REVEAL: { status: 409, message: "La révélation ne peut pas encore être clôturée." },
  INVALID_CLUE: { status: 422, message: "L'indice doit être une phrase courte, sans chiffre, lien ni retour à la ligne." },
  CONTEST_NOT_ALLOWED: { status: 409, message: "Cette tentative ne peut pas être contestée." },
  CONTEST_ALREADY_OPEN: { status: 409, message: "Une contestation est déjà en cours." },
  CONTEST_PENDING: { status: 409, message: "Une contestation est en cours : attends sa résolution." },
  NO_CONTEST_PENDING: { status: 409, message: "Aucune contestation n'est en cours." },
  ILLEGAL_MOVE: { status: 422, message: "Cette action est impossible dans l'état actuel." },
  INVALID_SLOTS: { status: 400, message: "Choisis deux cases différentes valides." },
  SLOT_EMPTY: { status: 422, message: "Cette case est vide : choisis une case encore en jeu." },
  SLOT_NOT_HIDDEN: { status: 422, message: "Cette carte est déjà visible : remplace-la au lieu de la révéler." },
  SLOT_ALREADY_REVEALED: { status: 422, message: "Cette carte est déjà révélée." },
  DRAW_UNAVAILABLE: { status: 422, message: "La pioche est vide : prends la carte de la défausse." },
  DECK_TOO_SMALL: { status: 503, message: "La pioche de cette partie est insuffisante." },
  UNKNOWN_SHIP: { status: 400, message: "Ce bateau est inconnu : choisis parmi les cinq bateaux de la flotte." },
  DUPLICATE_SHIP: { status: 422, message: "Ce bateau est déjà placé : chaque bateau n'est placé qu'une fois." },
  INCOMPLETE_FLEET: { status: 409, message: "Ta flotte est incomplète : place les cinq bateaux avant de valider." },
  SHIP_OUT_OF_BOUNDS: { status: 422, message: "Ce bateau dépasse de la grille : déplace-le ou pivote-le." },
  SHIPS_OVERLAP: { status: 422, message: "Ces bateaux se chevauchent : sépare-les sur la grille." },
  WORD_INVALID: { status: 422, message: "Mot invalide : 2 à 30 lettres, sans chiffre ni ponctuation." },
  WORD_MISSING_SEQUENCE: { status: 422, message: "Ce mot ne contient pas la séquence demandée." },
  WORD_UNKNOWN: { status: 422, message: "Mot absent du dictionnaire de la partie." },
  WORD_ALREADY_USED: { status: 422, message: "Mot déjà utilisé dans cette partie." },
  TRAINING_UNAVAILABLE: { status: 503, message: "L'entraînement est momentanément indisponible." },
  TRAINING_BLOCKED_DURING_MATCH: { status: 409, message: "Termine ta partie Syllabe Express en cours avant de t'entraîner." },
  REPLACE_NOT_ALLOWED: { status: 409, message: "Cette action n'est pas disponible après une prise en défausse." },
  MATCH_BLOCKED: { status: 503, message: "La partie est bloquée : incident technique, elle sera interrompue." },
  STALE_DEADLINE: { status: 409, message: "Cette échéance n'est plus d'actualité. Recharge la partie." },
  POINT_OUT_OF_BOUNDS: { status: 400, message: "Le point doit rester dans la zone de jeu." },
  INVALID_DISTANCE: { status: 422, message: "La distance calculée est invalide." },
  INVALID_ENTROPY: { status: 503, message: "Le hasard serveur est momentanément indisponible." },
  ENTROPY_UNAVAILABLE: { status: 503, message: "Le hasard serveur est momentanément indisponible." },
  NOT_PLACING: { status: 409, message: "Le placement n'est pas disponible maintenant." },
  NOT_REVEAL: { status: 409, message: "La révélation n'est pas disponible maintenant." },
  PLACEMENT_ALREADY_SUBMITTED: { status: 409, message: "Ton placement est déjà enregistré." },
  SELECTION_ALREADY_CONFIRMED: { status: 409, message: "Ta sélection est déjà confirmée." },
  SELECTION_CLOSED: { status: 409, message: "La sélection est fermée." },
  DEEPSEEK_FIXTURE_ERROR: { status: 503, message: "La correction automatique est momentanément indisponible." },
  DEEPSEEK_INVALID_JSON: { status: 503, message: "La correction automatique a renvoyé une réponse invalide." },
};

const NO_STORE = "private, no-store";

function noStoreInit(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", NO_STORE);
  headers.set("pragma", "no-cache");
  const vary = new Set((headers.get("vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  vary.add("Cookie");
  headers.set("vary", [...vary].join(", "));
  return { ...init, headers };
}

function diagnosticResponse(code: string, status: number, message: string, diagnosticId?: string): NextResponse {
  const response = NextResponse.json({ error: { code, message, retryable: status >= 500 || status === 429 } }, noStoreInit({ status }));
  if (diagnosticId) response.headers.set("x-diagnostic-id", diagnosticId);
  return response;
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, noStoreInit(init));
}

export function jsonError(code: string, status: number, message: string): NextResponse {
  const definition = PUBLIC_ERROR_DEFINITIONS[code];
  if (!definition) return diagnosticResponse("INTERNAL_ERROR", 500, PUBLIC_ERROR_DEFINITIONS.INTERNAL_ERROR.message, randomUUID());
  return diagnosticResponse(code, status, message);
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
  const rawCode = error instanceof Error ? error.message : null;
  const resolved = rawCode ? PUBLIC_ERROR_DEFINITIONS[rawCode] : undefined;
  if (resolved && rawCode) return diagnosticResponse(rawCode, resolved.status, resolved.message);

  const diagnosticId = randomUUID();
  console.error("Unexpected server error", {
    diagnosticId,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
  });
  return diagnosticResponse("INTERNAL_ERROR", 500, PUBLIC_ERROR_DEFINITIONS.INTERNAL_ERROR.message, diagnosticId);
}
