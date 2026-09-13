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
    TTMC_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
    COMPATIBILITY_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
    LONGUEUR_ONDE_CONTENT_UNAVAILABLE: { status: 503, message: "Le contenu de ce jeu est temporairement indisponible." },
    QUESTION_NOT_IN_PACK: { status: 503, message: "La question de cette partie est indisponible." },
    ROOM_NOT_FOUND: { status: 404, message: "Salon introuvable." },
    ROOM_CLOSED: { status: 409, message: "Ce salon est fermé ou expiré." },
    ROOM_FULL: { status: 409, message: "Ce salon est déjà complet." },
    VERSION_CONFLICT: { status: 409, message: "L'état a changé. Recharge la partie." },
    PHASE_CONFLICT: { status: 409, message: "La phase a changé. Recharge la partie." },
    DEADLINE_EXPIRED: { status: 409, message: "Temps écoulé, validation en cours." },
    FORFEIT_NOT_AVAILABLE: { status: 409, message: "Le forfait n'est disponible qu'après 90 secondes d'absence." },
    COMMAND_ID_REUSED: { status: 409, message: "Cet identifiant de commande a déjà été utilisé pour une autre action." },
    JOB_LEASE_INVALID: { status: 409, message: "Le bail de la tâche est invalide ou expiré." },
    JOB_NOT_DUE: { status: 409, message: "Cette tâche n'est pas encore échue." },
    STALE_JOB: { status: 409, message: "Cette tâche n'est plus d'actualité." },
    DATABASE_UNAVAILABLE: { status: 503, message: "Le service de données est temporairement indisponible." },
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
    CITY_ALREADY_SELECTED: { status: 409, message: "Une ville est déjà retenue, choisis-en une autre." },
    INVALID_CITY_SELECTION: { status: 400, message: "La sélection de villes n'est pas valide." },
    CONTENT_UNAVAILABLE: { status: 422, message: "Le corpus de questions est insuffisant pour ces options. Ajoute des catégories ou raccourcis la partie." },
    QUIZ_CONTENT_UNAVAILABLE: { status: 503, message: "Le corpus de questions est momentanément indisponible." },
    INVALID_ANSWER: { status: 400, message: "Ta réponse doit contenir entre 1 et 240 caractères." },
    WRONG_PHASE: { status: 409, message: "Cette action n'est pas disponible dans cette phase." },
    ALREADY_SUBMITTED: { status: 409, message: "Ta réponse est déjà enregistrée." },
    ALREADY_ACKNOWLEDGED: { status: 409, message: "Tu as déjà confirmé cette révélation." },
    INVALID_OPTION: { status: 422, message: "Cette option n'existe pas pour la question actuelle." },
    SKIP_LIMIT_REACHED: { status: 409, message: "Les trois passages de la partie ont déjà été utilisés." },
    NO_RESERVE_AVAILABLE: { status: 409, message: "Il n'y a plus de question de remplacement disponible." },
    INCOMPLETE_REVEAL: { status: 409, message: "La révélation ne peut pas encore être clôturée." },
    INVALID_CLUE: { status: 422, message: "L'indice doit être une phrase courte, sans chiffre, lien ni retour à la ligne." },
    AXIS_NOT_IN_PACK: { status: 503, message: "L'axe de cette partie est indisponible." },
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
    MATCH_NOT_FOUND: { status: 404, message: "Partie introuvable." },
    MATCH_NOT_ACTIVE: { status: 409, message: "Cette partie est terminée." },
    NOT_A_PARTICIPANT: { status: 403, message: "Tu ne participes pas à cette partie." },
    HISTORY_UNAVAILABLE: { status: 503, message: "L'historique est momentanément indisponible." },
    ACCOUNT_REQUIRED: { status: 403, message: "Crée un compte pour conserver cette progression." },
  };
  const resolved = known[message] ?? { status: 500, message: "Une erreur serveur est survenue." };
  return jsonError(message, resolved.status, resolved.message);
}
