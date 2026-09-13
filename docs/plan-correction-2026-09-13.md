# Plan de correction pas à pas — 13 septembre 2026

Ce document transforme l'[audit complet](audit-code-2026-09-13.md) en feuille de route d'exécution. Il est soumis à relecture avant toute modification de code, création de migration, configuration de secret, traitement de données ou déploiement. **L'étape 1 a été exécutée après relecture utilisateur ; les étapes 2 à 10 restent non appliquées.**

Le numéro entre parenthèses renvoie aux constats D01 à D35 de l'audit. Les étapes sont ordonnées par dépendance : une étape n'est déclarée terminée que lorsque ses critères de sortie sont vérifiés et ajoutés à `progression.md`.

## Synthèse pour l'humain

Le site possède le code des neuf jeux, mais la chaîne complète n'est pas fiable. L'étape 0 a confirmé l'état local, Supabase et Vercel en lecture seule : 21 migrations appliquées, Cron actif mais Vault vide, trois parties TTMC et six jobs échus à préserver, et un dernier déploiement de production `READY` correspondant au HEAD. Elle a aussi relevé les avis de sécurité/performance Supabase. Le connecteur Vercel n'expose toutefois pas l'inventaire des noms de variables ni le réglage d'origine autorisée.

Le chantier doit commencer par les tests et les transactions communes, puis réparer les jobs, les jugements quiz, les règles propres aux jeux, la présence et la reprise réseau. Les parcours compte/salons/historique viennent ensuite. La configuration des secrets et le traitement des parties bloquées ne se font qu'après validation isolée et recette à deux sessions. L'étape 1 a uniquement renforcé la preuve locale et la CI ; elle n'a modifié ni le comportement métier ni la production.

## Instructions d'exécution pour l'agent

L'agent qui exécutera ce plan doit respecter l'ordre des étapes, s'arrêter à chaque sortie attendue en cas d'échec, et inscrire le résultat dans `progression.md`. Les chemins et symboles ci-dessous sont les points d'entrée à inspecter ; une cause non confirmée doit rester explicitement marquée comme hypothèse.

| Étapes | Fichiers/symboles à inspecter ou modifier | Invariants à préserver |
|---|---|---|
| 0–2 | `AGENTS.md`, `progression.md`, `supabase/config.toml`, `.env.example`, `.vercel/project.json` si présent ; connecteurs Supabase/Vercel | lecture distante seule ; aucun secret/ID brut dans les logs ; ne jamais choisir un projet Vercel voisin |
| 1 | `tests/e2e/*.spec.ts`, `tests/db/*.test.ts`, `vitest.config.ts`, `package.json` scripts | les tests obligatoires ne sont pas ignorés silencieusement ; fixtures hors production |
| 2–3 | `supabase/migrations/20260909185440_geography_pack_and_rpc.sql` (`server_commit_match`, `claim_due_jobs`, `dispatch_due_jobs`), `src/server/matches/repository.ts`, `src/app/api/matches/[matchId]/commands/route.ts` | nouvelle migration additive ; verrou, version, siège, hash et reçu idempotent ; résultats uniques |
| 4 | `src/server/jobs/worker.ts` (`workerJobSchema`), `src/games/ttmc/engine.ts` et `src/games/trou-noir/engine.ts` (`judgeJob`), routes jobs internes | bail valide ; jugement lié à la bonne tentative/phase ; aucun appel IA côté client |
| 5 | `src/games/geographie/engine.ts` (`resignTransition`), `src/games/geographie/map-projection.ts`, `src/games/geographie/components/geography-map.tsx`, `src/games/uno/components/uno-match.tsx`, migrations Compatibilité/Longueur d'onde et leurs triggers | confidentialité des projections ; forfait/abandon/cooperation distincts ; versions de contenu conservées |
| 6 | composants `src/games/*/components/*-match.tsx`, `src/app/salons/**`, routes heartbeat/realtime | heartbeat serveur pour les neuf jeux ; `try/catch/finally` ; snapshot monotone ; aucune reprise automatique d'une phase différente |
| 7 | `src/server/http.ts`, loaders de contenu, `src/components/auth-form.tsx`, `src/app/auth/callback/route.ts`, scripts `scripts/content/**` et `scripts/geography/**` | codes d'erreur publics sans SQL ; redirections internes ; migrations appliquées immuables ; contenu versionné |
| 8–9 | `src/app/salons/**`, `src/app/profil/**`, `src/app/historique/**`, `src/app/api/history/**`, entraînement BombParty, suites E2E | exactement deux participants ; RLS/ACL et confidentialité ; issues coopératives et invités correctes |
| 10 | connecteurs Supabase/Vercel, `supabase/migrations/`, logs et données de reprise | migrations via connecteur ; code compatible avec ancien/nouveau schéma ; aucun reset/suppression ; activation Vault en dernier |

Les sections suivantes constituent la procédure détaillée à exécuter après validation de la synthèse et des préconditions.

## Règles de conduite du chantier

- Travailler sur `main` selon les règles du dépôt, sans réécrire l'historique ni modifier une migration déjà appliquée.
- Faire les investigations distantes en lecture seule jusqu'au feu vert explicite pour une livraison. Ne configurer Vault, Cron ou des données de reprise qu'après validation des correctifs locaux et de la base isolée.
- Préserver les trois parties TTMC actives, les six jobs échus, les utilisateurs, les résultats et les engagements multiples observés. Toute reprise doit être idempotente et laisser une trace explicable.
- Pour chaque étape : écrire d'abord le test qui échoue sur le défaut, corriger, rejouer la régression et mettre à jour le suivi. Ne pas transformer une fonctionnalité `ready` en fonctionnalité validée sans partie complète dans deux sessions.
- Utiliser des données fictives en local et une base Supabase isolée pour les mutations. Les secrets ne doivent apparaître ni dans Git, ni dans les projections, ni dans les logs.

## Étape 0 — Geler l'état et préparer la preuve

1. Enregistrer le commit de départ, l'état Git, les versions Node/pnpm/Supabase et l'état distant en lecture seule : migrations, parties actives, jobs, Cron, Vault (noms uniquement), RLS, fonctions et packs.
2. Identifier le projet Vercel réellement relié à `thib.fun`, le commit déployé, le domaine, l'origine autorisée et les noms de variables sans afficher leurs valeurs. Si le projet n'est pas accessible, noter le blocage au lieu de choisir un projet voisin.
3. Exporter une liste anonymisée des parties/jobs à traiter (identifiants hashés, statut, phase, échéance, tentatives) afin de pouvoir vérifier qu'aucune donnée n'est supprimée ou réaffectée.
4. Créer une matrice des contrats communs : commande, acteur autorisé, phase, règle d'échéance, jobs à créer/annuler, issue attendue et visibilité de chaque siège.
5. Exécuter les advisors Supabase sécurité/performance en lecture seule, vérifier les ACL effectives et séparer les alertes bloquantes des alertes de défense en profondeur. Ne pas activer RLS sur une table privée sans politiques écrites et testées.

**Sortie :** état de référence daté, inventaire reproductible, environnement isolé réservé, alertes de sécurité classées et décision explicite sur les données à reprendre. Aucun changement de production.

### Relevé effectué le 13 septembre 2026

- Dépôt local : `main`, HEAD `58eaca9`, synchronisé avec `origin/main`; changements non commités limités aux documents d'audit/plan et au suivi. Node `v24.15.0`, pnpm `11.19.0`, Supabase CLI `2.104.0` (la télémétrie doit être désactivée dans cet environnement pour éviter une écriture bloquée).
- Supabase : projet `ttogfwnlknmiscnmlhof`, `ACTIVE_HEALTHY`, région `eu-west-1`, PostgreSQL `17.6`; 21 migrations appliquées, 9 jeux `ready`, 1 180 contenus publiés. Cron `tibo-fun-dispatch-due-jobs` actif chaque seconde ; cinq dernières exécutions `succeeded/1 row`, mais aucun nom dans `vault.secrets`.
- Données à préserver : 3 matchs TTMC actifs (2 `choose_level`, 1 `judging`), 6 jobs `pending` échus depuis le 12 septembre (`attempts=0`), et 2 joueurs anonymisés présents dans plusieurs matchs actifs. Aucun identifiant brut n'est reporté ici.
- Sécurité/observabilité : les ACL du schéma `private` refusent `USAGE` et `SELECT` à `anon`/`authenticated`; l'advisor signale tout de même 18 tables privées sans RLS, `is_site_member()` SECURITY DEFINER exécutable par `authenticated`, `pg_net` dans `public`, politiques anonymes prévues, protection des mots de passe compromis désactivée, 13 clés étrangères sans index et 6 index inutilisés. Ces alertes sont classées dans D30–D35 ; aucune remédiation automatique n'a été lancée.
- Vercel : le projet `thib.fun` est identifié dans l'équipe `thibaud73000's projects` (`team_UrGuXgGQZHe1NQuwU3IFwoZz`), avec l'identifiant `prj_SIq42aMngLTaKKMWbNGwmlU1RQKf`. Son dernier déploiement de production (`dpl_35YN2mtRFLrgAW7tXWqSs3CcNBc7`) est `READY`, cible `production`, et correspond exactement au commit `58eaca94ec35e58ed28fcedab59a0d8b405c8848` de `main`; les domaines `thibfun.vercel.app`, `thibfun-thibaud73000s-projects.vercel.app` et `thibfun-git-main-thibaud73000s-projects.vercel.app` sont associés. Les logs de build ne signalent qu'un avertissement sur l'évolution automatique de Node et aucun runtime error n'a été remonté. Aucun `.vercel/project.json` ou `vercel.json` local n'est présent. Le connecteur ne permet pas de lister les noms de variables ni le réglage d'origine autorisée.

**Statut de l'étape 0 : terminée avec une limite d'outillage.** L'état local, Supabase, le projet Vercel, le commit déployé, les domaines et les logs disponibles sont relevés en lecture seule. L'inventaire des noms de variables Vercel et le réglage d'origine autorisée restent à vérifier par un moyen qui les expose ; cette limite ne bloque pas la préparation des étapes suivantes. Aucune mutation n'a été effectuée.

## Étape 1 — Rendre la suite de tests fiable

1. Corriger les E2E qui attendent `/jeux/geographie` alors que la connexion arrive sur `/profil`, et faire échouer la CI quand un scénario obligatoire est ignoré faute de secret.
2. Remplacer l'assertion SQL globale `380` par un contrôle filtré par `pack_id`/manifest et ajouter les comptes attendus pour les packs publiés.
3. Préparer deux comptes permanents, une session invitée et un tiers non membre dans une base isolée ; renouveler les identifiants de recette sans les committer.
4. Ajouter des horloges contrôlables et un adaptateur DeepSeek simulé (réponse exacte, fausse, lente, erreur) pour tester les transitions sans coût externe.
5. Transformer les probes temporaires en tests de contrat versionnés : JSON dispatcher/worker, deadline, reçu idempotent, forfait, présence, triggers coopératifs et trois régressions UNO déjà reproduites.
6. Ajouter un rapport de couverture des parcours : `pass`, `fail`, `blocked` ou `not-run`, avec cause obligatoire pour `blocked`.

**Sortie :** la suite montre les pannes actuelles pour leur vraie cause ; aucune étape centrale ne passe silencieusement en `skip`. (D02, D04–D09, D12–D17, D28.)

### Réalisation de l'étape 1 — 13 septembre 2026

- Les E2E multijoueurs partagent désormais un helper qui attend `/profil` après connexion. Ils sont ignorés seulement hors CI lorsque `E2E_PASSWORD` manque ; la CI échoue explicitement dans ce cas.
- Les contrôles de contenu pgTAP filtrent les packs publiés par type, slug et version, puis comparent les quantités au manifeste. Le fixture local prépare Alice, Bob et un tiers désactivé sans écrire de secret dans le dépôt.
- Les juges Trou Noir et TTMC acceptent une horloge, un transport et des temporisations injectés. Les fixtures DeepSeek exactes, fausses, lentes et en erreur ne contactent aucun service externe.
- Les probes de contrats et les trois régressions navigateur UNO sont versionnées. Les défauts encore présents restent des échecs attendus jusqu'aux étapes 2, 5 et 6 ; ils ne sont pas masqués par un `skip`.
- La matrice structurée [`tests/coverage-matrix.json`](../tests/coverage-matrix.json) et son contrôle `pnpm test:matrix` rendent explicites les statuts `pass`, `fail`, `blocked` et `not-run`.

**Statut :** terminée côté harnais de tests. `pnpm test`, le typage, le lint et le contrôle de matrice passent ; la base pgTAP et les E2E multijoueurs restent bloqués localement par Docker et l'absence de `E2E_PASSWORD`. Aucun secret, RPC distant, migration de production ou déploiement n'a été exécuté.

## Étape 2 — Fixer le contrat transactionnel commun

1. Définir dans le contrat partagé les règles de délai par commande : coups ordinaires, `RESIGN`, `CLAIM_FORFEIT`, absence, jugement, préparation et interruption coopérative.
2. Définir la clé de version de snapshot et les conditions de commit : `match_id`, `phase_id`, `state_version`, siège authentifié, type de commande, hash du payload et identifiant de reçu.
3. Modifier la stratégie d'idempotence : chercher un reçu autorisé, reprendre le même résultat sous verrou, revérifier le reçu après attente du verrou, refuser un même identifiant avec acteur/type/hash différents. Appliquer la même règle aux commandes de salon.
4. Définir la différence entre `jobsToCancel` explicites et jobs conservés lorsqu'une action reste dans la même phase. Prévoir l'upsert d'une tâche remplacée sans réactiver une tâche annulée par accident.
5. Définir le comportement d'une panne technique : bail invalide, donnée obsolète, panne réessayable, cinq échecs, IA indisponible et job définitivement abandonné. Aucun de ces cas ne doit inventer une victoire.

**Sortie :** contrat approuvé par les tests de concurrence et de replay, avant de modifier les neuf moteurs. (D04, D05, D09, D10, D11, D13.)

### Réalisation de l'étape 2 — 13 septembre 2026 — `codex/step2-contract`

- Le contrat pur partagé est formalisé dans `src/server/matches/transaction-contract.ts` : matrice des échéances, clé `[matchId, phaseId, stateVersion]`, identité de commit, siège authentifié, hash, reçus, baux, déduplication et issues sans gagnant pour les abandons techniques/coops.
- Les tests `src/server/matches/transaction-contract.test.ts` couvrent les règles de replay, la concurrence sérialisée, les conflits de version/phase/siège, les jobs conservés/remplacés/annulés et les cinq catégories d'échec. Les sentinelles `src/server/matches/transaction-contract-gaps.test.ts` conservent les écarts observés du SQL actuel comme échecs attendus pour l'étape 3.
- Le contrat normatif est détaillé dans [`docs/08-engine-contracts.md`](08-engine-contracts.md). Aucun moteur de jeu, dispatcher, worker, RPC, migration de production, donnée existante, configuration Supabase/Vercel ou traitement de partie n'a été modifié.
- Choix arrêtés : les coups ordinaires refusent à `dbNow >= deadline`, `RESIGN` reste admissible après expiration, `CLAIM_FORFEIT` exige 90 secondes d'absence adverse, `check_absence` est indépendant de phase mais revalide sa condition, le jugement n'a pas de deadline joueur, et les interruptions coopératives abandonnent sans gagnant.
- Les reçus identiques rejouent la réponse déjà committée avant version/échéance ; acteur, type ou hash divergents donnent `COMMAND_ID_REUSED`. Les jobs valides sont conservés, seuls les IDs de `jobsToCancel` sont annulés, les jobs terminaux ne sont jamais réactivés, et une cinquième panne technique aboutit à `technical_error` sans victoire.

**Statut :** contrat partagé validé par les tests purs de concurrence et de replay ; raccordement SQL et vérification sur PostgreSQL isolé restent à faire à l'étape 3. Les neuf moteurs et les parties existantes sont volontairement hors périmètre.

## Étape 3 — Corriger les migrations et le commit serveur

1. Créer une nouvelle migration additive avec la CLI Supabase. Ne pas éditer les migrations appliquées.
2. Dans `server_commit_match`, autoriser les sorties admissibles après l'échéance selon la matrice de l'étape 2, tout en conservant le verrou et la règle d'absence.
3. Faire annuler uniquement les jobs remplacés par la transition ; conserver ceux dont la phase et la tentative restent valides ; réinsérer les tâches nécessaires avec une clé de déduplication correcte.
4. Déplacer la vérification de reçu au bon endroit dans la transaction et garantir une finalisation unique des résultats, statistiques, historique et jobs.
5. Séparer les erreurs RPC de bail, données et infrastructure ; rendre récupérables les jobs échus ou épuisés et ajouter une issue `technical_error` atomique quand aucune reprise n'est possible.
6. Utiliser l'horloge PostgreSQL au moment du commit ou de la transition, plutôt que l'heure lue avant une opération longue.
7. Rejouer les tests SQL en base isolée : expiration à la limite, abandon/forfait avant et après, deux clics concurrents, payload modifié, job obsolète, bail expiré, reprise après panne et finalisation unique.

**Sortie :** migrations testées et réversibles par ajout compatible ; les tests de transaction passent avec l'ancien et le nouveau code. (D04–D06, D09–D11, D22.)

## Étape 4 — Rétablir le dispatcher et les jugements quiz

1. Faire produire à `dispatch_due_jobs` exactement le corps accepté par `workerJobSchema` (`jobId`, `leaseToken`) ; le worker relit le contexte privé avec le bail.
2. Tester le secret valide/invalide, le lot vide, le lot partiel, la répétition du même bail et les erreurs HTTP sans perdre l'état du job.
3. Dans Trou Noir et TTMC, rattacher `judgeJob` à la tentative et à la phase suivante attendue ; ne pas exiger `deadline_at` pour un jugement qui n'en possède pas.
4. Vérifier exactitude, alias, réponse sémantique, correction lente, remplacement, timeout et révélation dans une transaction isolée.
5. Ajouter un budget IA persistant par job/partie, un plafond de tentatives réellement atomique, un contrôle de configuration avant lancement, un cache de correction si autorisé et une limite de corps appliquée avant le parsing complet.

**Sortie :** un job réel peut passer de `pending` à `running` puis à la transition attendue, sans double correction ni perte de bail ; aucun quiz ne démarre si ses préconditions IA ne sont pas réunies. (D01–D03, D10, D22, D25.)

## Étape 5 — Corriger les règles et projections propres aux jeux

1. Géographie : attribuer le forfait au demandeur, conserver l'interruption de préparation, remplacer l'espace de coordonnées doublement transformé, rendre le curseur clavier visible et afficher/rejouer une erreur de carte.
2. UNO : conserver la sélection de couleur tant que le joker et la phase restent valides ; fermer seulement sur annulation, changement de tour ou carte disparue ; ajouter focus initial, retour du focus et Échap.
3. Compatibilité et Longueur d'onde : renommer les variables `game_slug` des triggers ou cibler la contrainte nommée ; corriger la jointure `match_id` de la normalisation Longueur d'onde ; tester résultat normal et interruption coopérative.
4. Tous les jeux : passer en revue `RESIGN`, `CLAIM_FORFEIT`, `NEXT`, `READY`, `RANDOMIZE_FLEET`, résolution de contestation et issues `draw/cooperative/abandoned` dans moteur, projection, écran de fin et historique.
5. Corriger l'agrégation des métriques détaillées : somme, maximum, dernière valeur ou dénominateur selon le champ ; rendre le recalcul possible à partir des résultats conservés.
6. Alimenter correctement le hasard serveur pour les pools Géographie difficiles et les préparations automatiques ; refuser l'épuisement silencieux de valeurs d'entropie.

**Sortie :** tests moteur/projection et tests de composants couvrent les deux sièges, les issues coopératives et les limites d'affichage ; aucune défaite artificielle n'est affichée. (D06, D08, D14–D18, D26.)

## Étape 6 — Uniformiser présence, réseau et reprise

1. Créer un helper partagé pour `heartbeat`, `send`, `refresh` et l'état occupé ; utiliser `try/catch/finally`, messages lisibles et conservation de l'intention de commande.
2. Appeler le heartbeat dans les neuf parties, salons et retours d'onglet ; arrêter polling/heartbeat après la fin ; faire vérifier l'appartenance active par la politique Broadcast.
3. Ajouter une garde de version aux snapshots et ignorer une réponse HTTP plus ancienne qu'une vue déjà reçue ; gérer les changements de `matchId` et la reconnexion par relecture.
4. Tester coupure pendant abandon, réponse, tir, placement et configuration ; tester retour mobile, deux onglets, réponse perdue, clic double et Realtime manqué.
5. Vérifier la disponibilité et le libellé du forfait avec le même état serveur que celui qui sera committé. (D07, D09, D12, D13, D27.)

**Sortie :** une panne réseau libère l'interface et permet une reprise sûre ; aucune présence fictive après attente normale ; une réponse ancienne ne remplace pas une nouvelle.

## Étape 7 — Sécuriser erreurs, versions et contenu

1. Vérifier au commit le manifeste, la version moteur et la version de règles stockés au démarrage ; conserver les anciens loaders nécessaires pendant une partie.
2. Remplacer les messages SQL dans `error.code` par des codes publics stables et un identifiant de diagnostic interne ; ajouter les en-têtes `no-store` là où le contrat l'exige.
3. Restreindre `safeNext` après résolution d'URL à l'origine locale et aux chemins autorisés ; tester antislashs, encodage et caractères de contrôle.
4. Séparer validation de contenu et génération de migrations ; employer `fileURLToPath` dans les scripts Géographie ; refuser d'écraser une migration appliquée.
5. Vérifier provenance, quantité, couverture et checksum des packs ; documenter les seuils réellement disponibles (notamment Trou Noir/TTMC) sans activer une configuration non alimentée.

**Sortie :** une nouvelle publication ne casse pas les parties en cours, une erreur publique ne révèle pas SQL, et `content:validate` est portable et sans écriture durable. Revoir aussi les alertes advisors RLS/ACL, fonction `SECURITY DEFINER`, extension `pg_net`, accès invité, mots de passe compromis et index de clés étrangères. (D18, D21, D23–D26, D29–D35.)

## Étape 8 — Compléter les parcours produit manquants

1. Salons : gérer expiration, reprise d'un membre déjà présent, sortie réelle, quitter en attente, configuration, changement de jeu et transfert d'hôte selon le périmètre validé.
2. Compte : ajouter édition pseudo/avatar, upload protégé, oubli/réinitialisation du mot de passe et renvoi de confirmation ; conserver la distinction invité/compte permanent.
3. Historique et duo : pagination/curseur, filtres, pseudo adverse, détail `round_results`, résultats coopératifs, égalités, interruptions et agrégats paginés.
4. Entraînement BombParty : borner `usedWords`, ignorer une réponse d'ancienne séquence et vérifier la reprise après navigation.

**Sortie :** chaque bouton visible correspond à une mutation ou à un parcours réellement disponible, avec test d'accès et message d'erreur. (D19, D20 et limites produit de l'audit.)

## Étape 9 — Valider les neuf jeux en deux sessions

1. Exécuter sur l'environnement isolé les tests de salon, démarrage, rafraîchissement et fermeture avec deux comptes indépendants et un tiers.
2. Pour chaque jeu, exécuter le parcours complet jusqu'à l'historique : préparation, coup normal, coup concurrent, absence, expiration, abandon, forfait, égalité/cooperation si applicable, résultat et reprise.
3. Tester desktop et mobile, clavier, tactile, perte réseau et rechargement à chaque écran central.
4. Ne considérer un scénario `blocked` comme accepté qu'avec une dépendance documentée (par exemple secret de recette manquant) ; les tests métier ne doivent pas être ignorés automatiquement.
5. Mettre à jour la matrice de l'audit et `progression.md` jeu par jeu, avec date, commit, base et deux identifiants de session anonymisés.

**Sortie :** neuf parties terminées et consultables dans deux sessions ; tous les critères de clôture de l'audit sont verts. (D28 et tous les constats transversaux.)

## Étape 10 — Livraison progressive et reprise de production

Cette étape est volontairement la dernière : les automatismes actuels réveilleraient les jobs anciens et pourraient déclencher des absences si les étapes 3 à 6 ne sont pas terminées.

1. Faire relire le diff code/migrations et exécuter build, types, lint, unitaires, SQL isolé, E2E et contrôle documentaire.
2. Si la tâche active l'autorise explicitement, appliquer d'abord les migrations compatibles via le connecteur Supabase Codex ; vérifier leur application et l'absence de divergence d'historique. Si le connecteur échoue, arrêter l'opération et fournir à l'utilisateur soit la commande terminal exacte dans un bloc `bash`, soit le SQL exact dans un bloc `sql` pour l'éditeur Supabase ; préciser la destination, conserver l'erreur exacte et ne pas mélanger les formats. Ne pas basculer vers GitHub.
3. Livrer ensuite le code compatible avec l'ancien et le nouveau schéma ; vérifier le commit Vercel, les variables, l'origine et les logs sans afficher de secrets.
4. Configurer seulement maintenant `worker_origin` et `internal_job_secret` dans Vault, puis déclencher un job synthétique contrôlé et mesurer sa transition complète. Un Cron `succeeded` seul ne constitue pas une preuve.
5. Traiter les trois matchs TTMC et les six jobs échus avec une commande idempotente et une raison explicite ; examiner les engagements multiples avant toute nouvelle contrainte. Ne supprimer ni réinitialiser les données.
6. Activer alertes sur jobs en retard/épuisés, baux expirés, erreurs techniques, absence anormale et divergence de versions ; préparer le retour au commit précédent sans réécrire les migrations.

**Sortie :** le service réel progresse sans onglet hôte, les incidents existants sont repris ou interrompus explicitement, et l'historique reste cohérent. (D01, D10, D11, tous les P0/P1.)

## Feu vert demandé pour les étapes restantes

La relecture initiale a autorisé l'étape 1, exécutée ci-dessus. Les étapes 2 à 10 restent soumises à une validation distincte portant sur l'ordre, le périmètre des parcours manquants, la politique de reprise des trois parties TTMC et des six jobs, et la stratégie de déploiement. En attendant cette validation, aucune correction métier, migration, configuration de secret, traitement de donnée ou déploiement ne doit être engagé.
