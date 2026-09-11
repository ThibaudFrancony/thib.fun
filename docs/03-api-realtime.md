# API, commandes et synchronisation

Contrat commun obligatoire. Base `/api`. JSON UTF-8, pas de cache partagé (`Cache-Control: private, no-store`). Auth via session Supabase vérifiée côté serveur. Vérifier Origin sur les mutations utilisant cookies et n'accepter que l'origine configurée ; pas de CORS wildcard avec credentials. Les IDs d'acteur ne sont jamais fournis par le client.

## 1. Réponses et erreurs

```ts
type Success<T> = { ok: true; data: T; serverTime: string };
type Failure = {
  ok: false;
  error: { code: string; message: string; retryable: boolean };
  snapshot?: MatchView | RoomView;
  serverTime: string;
};
type MatchCommand = {
  commandId: string;       // UUID créé une fois par intention utilisateur
  expectedVersion: number;
  phaseId: string;
  type: string;
  payload: unknown;        // union Zod stricte du jeu
};
```

`serverTime` provient de la DB pour les commandes/heartbeats. Ne jamais renvoyer stack trace ou état privé. HTTP : 400 INVALID_INPUT, 401 UNAUTHENTICATED, 403 ACCESS_DENIED, 404 NOT_FOUND (également ressource hors périmètre), 409 ROOM_FULL/WRONG_PHASE/NOT_YOUR_TURN/VERSION_CONFLICT/ALREADY_SUBMITTED, 410 ROOM_EXPIRED, 422 ILLEGAL_MOVE/CONTENT_UNAVAILABLE, 429 RATE_LIMITED, 503 SERVICE_UNAVAILABLE. `DEADLINE_EXPIRED` = 409. Retry-After sur 429/503 quand applicable.

## 2. Routes du socle

| Méthode / route | Entrée | Résultat / règles |
|---|---|---|
| POST `/auth/provision` | pseudo? | provisionnement/rattrapage idempotent du profil du compte Auth courant |
| GET `/me` | — | profil, admission, statistiques globales |
| PATCH `/me` | pseudo?, avatarPreset? | contrôle unicité et propriétaire |
| POST `/me/avatar` | multipart fichier | image réencodée, chemin sauvegardé |
| GET `/games` | — | registre disponible pour membre |
| POST `/rooms` | requestId, gameSlug, config | roomView avec code/lien |
| POST `/rooms/join` | requestId, code | roomView ; espace/casse normalisés |
| GET `/rooms/:id` | — | projection du membre |
| POST `/rooms/:id/commands` | commandId, expectedVersion, type, payload | roomView |
| POST `/rooms/:id/heartbeat` | matchId? | serverTime + présence des membres |
| GET `/matches/:id` | — | matchView personnelle et serverTime |
| POST `/matches/:id/commands` | MatchCommand | matchView personnelle ; 202 si correction en cours |
| GET `/history` | cursor?, game?, outcome? | 20 entrées, nextCursor |
| GET `/history/:matchId` | — | résultat + résumés révélés pour participant |
| GET `/players/:id` | — | profil public de membre + agrégats |
| GET `/players/:id/versus-me` | cursor?, game? | statistiques de ce duo et confrontations |
| POST `/admin/invitations` | maxUses?, email?, expiresInDays? | admin seul, lien affiché ; aucun message envoyé automatiquement |
| GET `/admin/invitations` | cursor? | admin seul, état/expiration/utilisations, jamais tokens/hashes |
| DELETE `/admin/invitations/:id` | — | admin seul, révoque une invitation, pas les comptes déjà admis |
| POST `/internal/jobs/run` | ids et leaseTokens | secret worker ; pas Auth navigateur |

Limites : corps JSON navigateur 8 Ko, corps worker 16 Ko ; réponse libre 240 caractères ; indice 120 ; profil 24. Les transferts serveur de contenu/état vers RPC ne sont pas soumis à cette limite navigateur. Limitation persistante (table privée `rate_limits` documentée dans SQL) : join 10/min/utilisateur et 30/min/IP hashée, create 5/min/utilisateur, commandes 120/min/utilisateur avec plafond 10/s, quiz 10/min/utilisateur, suggestions 30/min/utilisateur, avatar 5/h. Nettoyage quotidien des fenêtres expirées. Les jobs internes ont secret et taille de batch, pas de quota utilisateur. Invites admin : expiresInDays 1..30 défaut 7, maxUses 1..10 défaut 1.

Commandes salon : `SET_READY {ready:boolean}`, `SET_CONFIG {gameSlug,config}` hôte seul, `START {}` hôte et deux prêts, `LEAVE {}`, `REMATCH {}` hôte après fin. REMATCH garde participants/config et demande de nouveau ready ; crée une nouvelle partie seulement au START. Hôte ne voit aucun secret supplémentaire.

## 3. Snapshot commun

```ts
type MatchView = {
  matchId: string; roomId: string; gameSlug: string;
  version: number; rulesVersion: string; phaseId: string;
  status: 'active' | 'completed' | 'abandoned';
  players: {id:string; pseudo:string; avatarUrl:string; seat:0|1}[];
  phase: string; activePlayerId: string | null;
  deadlineAt: string | null;
  allowedActions: string[];
  game: GameSpecificView;
  result: SafeResult | null;
};
```

`allowedActions` est ergonomique, le serveur vérifie encore. Si phase simultanée, activePlayerId=null et game comporte `submittedByPlayer`, sans réponse cachée. Result expose seulement les données de fin autorisées. RoomView : id/code/hôte/slug/config/version/membres(prêt,lastSeen)/status/currentMatchId. Pas de tokens d'invitation de compte dans les salons.

## 4. Broadcast et réconciliation

Après Auth, ouvrir un seul canal privé `user:<userId>` pour les invalidations persistantes. Événements `room.updated`, `match.updated`, `history.updated`, payload limité à `{id,version}` (history peut inclure matchId). Les clients ne publient pas ces événements. Les triggers sont déclenchés sur écriture des projections/historique dans la transaction de commit.

À l'ouverture d'une page : s'abonner, attendre SUBSCRIBED, puis charger snapshot ; ce séquencement évite un trou entre lecture et abonnement. À chaque invalidation version supérieure, recharger via GET. Fusionner les relectures concurrentes ; conserver le plus grand version, ignorer réponses hors ordre. À la reconnexion et au retour au premier plan : recharger systématiquement. Si un événement n'arrive jamais, le heartbeat toutes les 15 s permet de vérifier la version et relire. Le heartbeat retourne donc également `roomVersion` et `matchVersion` courantes ; cette précision complète sa ligne de route.

Realtime peut manquer, répéter ou retarder un message ; aucune règle ne dépend d'un message unique. Après réponse POST, appliquer directement le snapshot si plus récent sans attendre Broadcast. Afficher sélection/hover optimistes localement, jamais score ou carte piochée inventés.

## 5. Temps et absence

Le navigateur estime le décalage serveur avec heartbeat et milieu de requête/réponse ; le chrono visuel utilise `performance.now()` entre recalages. Il n'envoie pas de tick toutes les secondes. Ce chrono est indicatif ; l'heure de commit DB décide. Un clic avant zéro arrivé trop tard au serveur est refusé ; afficher une formulation réseau compréhensible, ne pas accepter une timestamp client falsifiable.

Heartbeat toutes les 15 s lorsque page active et immédiatement après retour de visibilité. « Reconnexion… » après perte du canal ; « adversaire absent » si last_seen dépasse 45 s. Les parties à chrono continuent pendant une absence ; pas de pause automatique exploitable. Bataille navale/compatibilité sans chrono gardent leur phase.

Job commun `check_absence` toutes les 30 s pour chaque match actif : si **les deux** last_seen ont plus de 120 s, abandoned technique ; si **un seul** dépasse 180 s, abandon technique également, sans attribuer une victoire automatique. Le joueur présent peut choisir `CLAIM_FORFEIT {}` après 90 s d'absence continue de l'autre : compétitif = victoire par forfait ; coopératif = abandoned sans résultat partagé. Vérifier last_seen DB au commit. Le heartbeat de retour rend une demande de forfait ultérieure illégale. Un joueur peut `RESIGN {}` après confirmation : compétitif loss/win, coopératif abandoned. Avant un premier tour, aucune pénalité compétitive : abandon de préparation = abandoned. Les résultats normaux atteints par timeout de jeu avant ces seuils restent normaux.

Les options de salon affichent ces règles ; ne pas afficher « pause » si le timer continue. Pas de sauvegarde reprenable le lendemain V1 : historique seulement après abandoned. Une navigation accidentelle n'est pas un RESIGN.

## 6. Révélation et progression automatiques

Chaque fiche fixe une durée de révélation. Le moteur crée un job `advance_reveal` à l'entrée et expose `NEXT {}`. Si les deux choisissent NEXT, avancer immédiatement ; sinon avancer à l'échéance. Les deux confirmations ont une clé par acteur/phase et ne doublent pas la transition. Aucune réponse suivante n'est visible avant changement de phase. Les quiz utilisent leur fenêtre plus longue pour permettre contestation.

## 7. Règles d'échec réseau

Un POST dont la réponse est perdue est renvoyé avec le même commandId. Garder la commande en mémoire et sessionStorage tant que non confirmée ; ne pas stocker de secret serveur. En refresh, relire snapshot puis demander/renvoyer la commande si utile. Même commandId avec payload différent => 409 COMMAND_ID_REUSED. Une commande rejetée avant commit ne consomme pas son id.

Une action simultanée peut produire conflit ; le serveur recharge et réévalue une fois. Cela concerne notamment deux prêts, deux votes et deux réponses de compatibilité. Ne pas forcer le deuxième joueur à recommencer une réponse qui reste légale. Une invalidation liée au heartbeat ne cause pas de conflit jeu.

## 8. Recette réseau obligatoire

Deux sessions A/B, tiers C : arrivée salon, ready simultanés, start répété, tour refusé, POST dupliqué, événement perdu, reconnexion, réponse hors ordre, fermeture onglet hôte, expiration sans action navigateur, réponse à deadline exacte, forfait/reconnexion concurrents. Simuler réseau lent et vérifier que les secrets restent absents des réponses GET/POST/Broadcast, pas simplement invisibles dans le DOM.
