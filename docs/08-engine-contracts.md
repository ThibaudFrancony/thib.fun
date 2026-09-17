# Contrats du moteur et détails d'intégration

Ce document complète les interfaces volontairement compactes des fiches. Il évite d'inventer une couche transactionnelle différente pour chaque jeu. Les extraits TypeScript/SQL sont des contrats/pseudocode à traduire et tester, pas des fichiers exécutables déjà présents.

## 1. Types partagés

`QuestionRevisionRef = {itemId:string; packId:string}` : IDs UUID immuables ; référence privée, n'embarque pas la solution dans le registre client.

`ContestState = {attemptId:string; requesterId:string; status:'pending'|'resolved'; accepted:boolean|null; requestedAt:string; expiresAt:string}`. Les deux quiz utilisent exactement ce type.

`ResolvedContent` = union discriminée par gameSlug : quiz avec items résolus par ID, geography avec villes, bombparty avec index lexique, compatibility avec questions/options, longueur-onde avec axes ; cartes et bataille-navale reçoivent un catalogue constant versionné. Ce type est serveur uniquement. Charger avant reducer les seuls éléments nécessaires ; ne pas reconstruire le corpus depuis les réponses du navigateur.

`DeadlineSpec = {kind:string;phaseId:string;at:string;blocking:boolean}`. Un seul blocking=true par match. `matches.deadline_at/deadline_kind` reflète ce blocking ; les secondaires sont jobs uniquement. Une phase sans temps limite garde null. Les phases de révélation ont une deadline blocking pour empêcher NEXT après expiration ; le worker prend alors la relève. La phase judging n'a pas de délai de réponse joueur, seulement job IA borné et watchdog.

`JobSpec = {kind:string;phaseId:string|null;runAt:string;dedupeKey:string;payload:Record<string,unknown>}`. Kinds principaux : turn_timeout, preparation_timeout, choose_level_timeout, advance_reveal, contest_timeout, judge_answer, check_absence, release_ai_reservation. Le gameSlug + state.phase aiguillent `turn_timeout` vers comportement du jeu. Les noms ANSWER_TIMEOUT/LEVEL_TIMEOUT/JUDGMENT_RECEIVED des fiches sont les événements métier transmis au moteur, pas nécessairement d'autres lignes Cron.

`RoundRecord = {roundNo:number;summary:GameRoundSummary;completedAt:string}`. roundNo unique par match ; BombParty utilise numéro de tour, jeux cartes numéro de donne. Une manche quiz enregistre les deux tours terminés. Les tentatives intermédiaires sont quiz_attempts et match_events, pas round_results incomplets exposés.

```ts
type ResultSpec = {
  kind:'competitive'|'cooperative';
  outcome:'win'|'draw'|'cooperative'|'abandoned';
  winnerId:string|null;
  reason:'normal'|'round_limit'|'turn_limit'|'blocked'|'dictionary_exhausted'
    |'resign'|'claimed_forfeit'|'absence'|'judging_unavailable'|'technical_error';
  sharedScore:number|null;
  players:[
    {userId:string;score:number|null;metrics:Record<string,unknown>},
    {userId:string;score:number|null;metrics:Record<string,unknown>}
  ];
  summary:Record<string,unknown>;
};
```

Les compteurs `PlayerCounters` UNO : `{cardsPlayed:number;cardsDrawn:number;penaltyCardsTaken:number;missedAnnouncements:number;turns:number}`. Initialiser à 0 ; cardsDrawn inclut les cartes de pénalité et de tirage normal, pas les 7 initiales ; penaltyCardsTaken est donc un sous-ensemble. Compteurs des autres jeux sont explicités par leurs fiches.

Tous états commencent avec `round=1` ou `turn=1` lorsque utilisés ; tableaux sièges indexés 0/1. Ne pas mélanger compteur de tours déjà terminés et tour courant : `turns` dans les jeux cartes compte les tours terminés, initial 0, incrément une fois après résolution complète. `turn` BombParty/naval désigne tour courant, initial 1 ; vérifier limite après clôture. `questionIndex` compatibilité index 0 pour le tableau ; compared commence 0. Version DB commence 0 au start, chaque transition réussie +1.

## 2. Transition persistée complète

Le `Transition` du document architecture est enrichi par l'orchestrateur avec :

```ts
type CommitEnvelope = {
  matchId:string; expectedVersion:number;
  actorId:string|null; commandId:string;
  commandHash:string;
  source:'player'|'job'; jobId?:string; leaseToken?:string;
  previousPhaseId:string;
  next:{state:GameState;phaseId:string;deadlineAt:string|null;deadlineKind:string|null};
  views:[{viewerId:string;payload:MatchView},{viewerId:string;payload:MatchView}];
  jobsToUpsert:JobSpec[]; jobsToCancel:string[];
  attemptWrites:QuizAttemptWrite[];
  roundRecords:RoundRecord[];
  event:{type:string;payload:Record<string,unknown>};
  result:ResultSpec|null;
};
```

`QuizAttemptWrite` : create avec id/player/question/raw/normalized/submittedAt/status, ou resolve avec id/status/method/reason/model/tokens/latency. Une tentative soumise et son job sont insérés dans le même commit. La résolution et la phase reveal sont atomiques. Les métriques d'appel fournisseur peuvent être enregistrées séparément pour compter un appel même si son résultat devient obsolète, mais ne doivent pas appliquer un score indépendamment.

Les IDs phase/attempt/jobs sont générés serveur avant commit et conservés lors d'un retry de la même transition ; après conflit nécessitant nouvelle transition, garder commandId et recalculer phase/IDs si nécessaire. Le hash métier de commande exclut les champs dérivés. Pour les jobs, commandId peut être le jobId (UUID), stable sur retry, acteur null et bail obligatoire.

Comme `command_receipts.actor_id` est non nullable, les commits système utilisent `private.job_receipts` décrite dans le schéma ; ne pas insérer de faux utilisateur « système ». Le reçu utilisateur reste unique par match/commandId. Les jobs périodiques check_absence créent un nouveau jobId/dedupeKey pour chaque prochain runAt, jamais réutilisation d'un reçu déjà done.

## 3. Transaction de référence

Ordre conceptuel pour server_commit_match, avec tous noms de tables qualifiés et EXCEPTION sans détails privés :

```sql
-- fonction SECURITY INVOKER accessible service_role seulement
select * into m from private.matches where id = p_match_id for update;
-- valider appel serveur, admission/participant si source player ; job/bail si source job
-- chercher reçu existant ; si même acteur/hash, retourner reçu AVANT test échéance
-- si ID réutilisé avec contenu différent : COMMAND_ID_REUSED
-- vérifier m.status=active, m.version=expected, m.phase_id=previousPhaseId
-- prendre clock_timestamp() APRÈS acquisition du verrou
-- joueur : si deadline blocking dépassée, DEADLINE_EXPIRED sans écrire
-- job : vérifier run_at<=clock_timestamp(), lease valide, job cohérent avec phase
-- écrire nouvel état et version=m.version+1
-- écrire tentatives, jobs et round_results dans cette même transaction
-- écrire les 2 match_views whitelist portant la même nouvelle version
-- écrire événement et reçu
-- si résultat : finaliser une seule fois et mettre à jour room_views/historiques/stats
-- renvoyer seulement reçu/projection de l'acteur à la route navigateur
```

La transaction SQL valide aussi que les deux viewerIds sont exactement ceux de match_players, pas deux copies d'un même joueur ; next state's schéma/règles correspondent au moteur de la partie ; deadline ne peut pas être arbitrairement étendue par une commande refusée. En V1 on fait confiance au moteur serveur pour calculer règles/score, pas au body entrant. Autoriser les événements système check_absence indépendants du phaseId courant en revalidant leur condition, car ils surveillent toute la partie ; leurs autres contrôles de bail/statut/version restent obligatoires.

## 3 bis. Contrat transactionnel commun arrêté à l'étape 2

Cette section fixe le contrat partagé testé dans `src/server/matches/transaction-contract.ts`. La migration corrective additive de l'étape 3, le repository et la route de commandes raccordent désormais ce contrat localement au RPC, au dispatcher et au worker existants. Cette présence dans l'arbre ne vaut ni exécution PostgreSQL isolée ni application distante ; ces preuves restent à obtenir avant livraison.

### Identité d'un commit et clé de snapshot

Le commit est évalué contre la clé immuable de lecture `[matchId, phaseId, stateVersion]`. `matchId`, `phaseId` et `stateVersion` doivent correspondre au snapshot verrouillé ; une commande qui vise une autre partie, une autre phase ou une ancienne version est refusée sans mutation.

L'enveloppe de commit porte également :

- la source `player` ou `job` ;
- pour un joueur, `actorId` et le siège dérivé de l'utilisateur authentifié dans `match_players` ; le navigateur ne choisit pas ce siège ;
- pour un job, `actorId` et le siège nuls, `jobId` égal à `commandId`, ainsi que le `leaseToken` ;
- `commandType` et le hash SHA-256 du payload métier ; le hash exclut `expectedVersion` et les champs dérivés ;
- l'identifiant UUID stable `commandId`, utilisé pour retrouver le reçu.

Le RPC prend le verrou de la partie avant de lire la version et le reçu, puis prend `clock_timestamp()` après l'acquisition du verrou. Deux commandes concurrentes sur une même version ne peuvent donc produire qu'une seule transition. Le même ordre doit être appliqué aux commandes de salon, dans le périmètre de leur verrou de salon.

### Matrice des échéances

| Classe | Source | Règle d'échéance | Résultat en cas d'admissibilité |
|---|---|---|---|
| Coup ordinaire | joueur | `dbNow >= blocking deadline` refuse `DEADLINE_EXPIRED` ; `null` signifie sans échéance joueur | transition joueur |
| `RESIGN` | joueur | reste admissible après l'échéance courante | fin compétitive, adversaire gagnant, sauf avant le premier tour |
| `RESIGN` | joueur | reste admissible après l'échéance (départ volontaire) | compétitif : adversaire gagnant ; coopératif : abandon sans gagnant ; avant premier tour : abandoned |
| Absence / `check_absence` | job | `run_at` dû, puis condition revalidée : un joueur absent depuis 30 s ou les deux ; aucun `phaseId` n'est requis | si un seul joueur est absent, l'autre gagne (compétitif) ; si les deux, abandon sans gagnant ; no-op sans version si la condition n'est plus vraie. Le forfait réclamé n'existe plus. |
| Jugement | job | `run_at` du job dû, avec phase et bail valides ; pas de deadline de réponse joueur | transition de jugement |
| Préparation | job | job dû, phase cohérente et deadline bloquante de préparation atteinte | transition d'expiration |
| Timeout de phase / révélation | job | job dû, phase cohérente et deadline bloquante atteinte | transition d'expiration |
| Interruption coopérative | joueur | même admissibilité de sortie que `RESIGN`, selon le type envoyé | abandon coopératif sans gagnant ni défaite artificielle |

La comparaison est inclusive à la frontière (`>=`). Une commande refusée ne met à jour ni `last_seen_at`, ni état, ni version, ni job, ni résultat.

### Reçus et rejouabilité

Le lookup du reçu se fait sous verrou avant les contrôles d'échéance et de version. Si le même `commandId` retrouve le même acteur authentifié, le même type et le même hash de payload, le RPC renvoie exactement la réponse déjà committée et sa `committedVersion`, sans rejouer les effets. `expectedVersion` n'entre volontairement pas dans l'identité de rejeu : un retry peut arriver avec un snapshot client plus ancien.

Un `commandId` déjà utilisé avec un acteur, un type ou un hash différent donne `COMMAND_ID_REUSED`. Un conflit de version, de phase, de siège, de bail ou d'échéance ne consomme pas d'identifiant de commande. Les reçus de jobs sont séparés des reçus utilisateur ; un job conserve le même `jobId`/`commandId` pendant ses retries. La règle acteur/type/hash s'applique aussi à une commande de salon, avec la clé de ressource du salon.

### Jobs conservés, remplacés et annulés

Une transition ne vide jamais tous les jobs du match. `jobsToCancel` contient les IDs des jobs devenus invalides et eux seuls peuvent passer de `pending`/`running` à `cancelled`. Un job encore valide dans la même phase est conservé. Une tâche de phase remplacée reçoit une nouvelle clé de déduplication liée au nouveau `phaseId` ; un job terminal (`done`, `cancelled` ou `failed`) n'est jamais réactivé par un upsert avec son ancienne clé. Les jobs périodiques d'absence prennent un nouvel ID et une nouvelle clé à chaque `run_at`.

### Baux, données obsolètes et pannes

Un bail absent, différent ou expiré donne `JOB_LEASE_INVALID` et ne doit pas appliquer la transition. Un job qui ne correspond plus à la phase donne `STALE_JOB` et est annulé ; `check_absence` reste l'exception indépendante de phase, mais sa condition est toujours revalidée. Une donnée obsolète ou un conflit de version est une absence de commit, pas une défaite.

Une panne réessayable (worker, fournisseur IA indisponible) remet le job en `pending` avec les délais `1/2/4/8 s`. Au cinquième échec, le job devient `failed` et la partie est finalisée en `abandoned` avec `reason='technical_error'`, sans `winnerId` ni score partagé inventé. Une panne de base conserve le job et l'alerte tant que cette finalisation ne peut pas être commitée ; elle ne doit pas être annoncée comme réussie. Aucun de ces chemins ne crée une victoire.

## 4. Détails des jobs et résolution des conflits

Le dispatcher Cron réserve seulement jobs pending dus ou running au bail expiré ; pas jobs done/cancelled/failed. Chaque requête HTTP du batch contient les quatre couples ID/token maximum. Le worker n'accepte pas des instructions métier libres contenues dans cette requête : il recharge payload stocké en base. Les tentatives de job et réservations IA sont distinctes (un retry réseau de transport ne doit pas multiplier des appels IA déjà reçus).

Pour une deadline en retard, `onDeadline` applique une transition à l'heure DB actuelle. Le prochain tour bénéficie de sa durée complète à partir du traitement, **pas de l'ancienne échéance déjà passée**. Une panne ne fait donc pas perdre plusieurs vies instantanément par rattrapage de dix échéances théoriques. Pour check_absence, prochain runAt=now+5s. Pour une révélation raccourcie par NEXT, annuler ancien job et nouveau phaseId ; l'ancien ne peut pas avancer une deuxième fois.

Après 5 erreurs techniques de worker, effectuer un abandon commun via RPC de finalisation restreinte : état status abandoned, reason technical_error, jobs annulés, projections safe de fin et stats abandoned seulement. Cette RPC fonctionne même si le moteur du jeu échoue : elle conserve la dernière projection déjà sûre avec le résultat d'interruption, sans essayer de révéler les secrets. Si DB elle-même indisponible, conserver job/panne et alerte, ne pas prétendre avoir finalisé.

Le watchdog de correction : job IA doit finir en <=12 s ; lease30 s permet reprise après crash. Si une tentative pending dépasse45 s depuis submittedAt, le prochain check_absence (qui vérifie aussi santé des tentatives) déclenche remplacement technique idempotent ; une réponse IA ultérieure est ignorée. Dans un crash ambigu où l'appel distant a pu réussir sans retour, un second appel borné est possible, mais compteur/réservations en tiennent compte.

## 5. Cas particuliers à conserver

- UNO : après un DRAW où carte non jouable, finir le tour dans la même transition (pas after_draw inutile). Une pénalité pour oubli d'annonce s'applique avant l'effet de la carte comme fiche, mais le contrôle wild4 se fait sur la main **avant le jeu et avant la pénalité**.
- Skyjo : finalTurnsRemaining=1 lorsque premier joueur termine sa grille. Ne le décrémenter qu'après le tour de l'autre, jamais dans le même tour déclencheur. À la fin, retrait des colonnes nouvellement révélées avant somme/pénalité.
- Géographie : utiliser submitted séparé de placement null pour distinguer « pas joué » et « timeout ». Challenge : SET_CITY_SELECTION ne réserve rien globalement ; CONFIRM réserve sous verrou, les drafts adverses ne sont pas consultables.
- Compatibilité : choices=null ne distingue pas une option malformée ; seules chaînes présentes dans options sont admises. Les skip suppriment immédiatement les choix privés de l'état actif et ne les ajoutent pas à l'historique.
- Quiz : pendant reveal afficher delta proposé et score actuel ; appliquer au NEXT final/expiration. Un forfait pendant reveal termine sur résultat de forfait, ne cumule pas ensuite le delta d'un job périmé.
- Longueur-onde : au timeout clue, zéro point et `missedClues` pour donneur ; devineur n'a pas de missedGuess car n'a jamais reçu un tour.

## 6. Exemple de flux complet

Géographie : match version0, phase P1, A place. API calcule sa distance privée, commit v1 crée P2 et job timeout B, projection A voit son point, B voit seulement A a joué. B place : commit v2 crée P3 reveal, annule timeout, crédite deux scores et écrit round_result. Broadcast individuel -> GET des vues v2. A et B NEXT : première confirmation v3 garde P3, seconde v4 crée P4 nouvelle ville avec deadline complète ; job reveal P3 éventuellement reçu ensuite est cancelled. Au dernier round, finalisation écrit un seul résultat, deux historiques, deux stats et un agrégat duo.

Quiz : SUBMIT arrive avant échéance -> v1 judging + tentative T + job J. Appel DeepSeek hors transaction -> verdict accept. J commit v2 reveal pour T. Les deux NEXT -> application points et changement tour. Un retry HTTP de SUBMIT avec même commandId retourne son reçu sans créer T2 ; le client ignore son snapshot v1 s'il possède déjà v2.

## 7. Checklist de fichiers par jeu

Chaque module doit contenir config/schemas/moteur/projection/score/UI/tests, plus content loader si applicable ; registre public expose nom/description/durée/availability uniquement. Route `/parties/[id]` choisit l'UI par slug et passe la projection ; endpoint commandes choisit moteur via registre **serveur** et version. Les composants communs (Timer, PlayerPanel, ResultPanel, ConnectionBanner, ReadyButton, ConfirmAction) ne contiennent aucune règle spécifique.

À l'ajout d'un jeu : ajouter métadonnées DB/registre synchronisées, config Zod, union action/state/view, reducer, projection, métriques et historique, seed fixtures, tests, puis disponibilité après recette. Aucun changement aux profils ou système de salons ne doit être nécessaire simplement pour ajouter une dixième fiche.
