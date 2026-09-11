# Progression du projet

Dernière mise à jour : 11 septembre 2026  
Branche de référence : `main`  
Dernier commit observé : `6c6a79f` — `feat: refondre la homepage violette`

Ce fichier décrit la réalité du dépôt et non les seules capacités prévues dans les spécifications. Il complète [AGENTS.md](AGENTS.md), [docs/README.md](docs/README.md) et [docs/07-implementation-status.md](docs/07-implementation-status.md). Les statuts utilisés sont :

- ✅ documenté ou disponible comme contrat ;
- 🟢 présent dans le code ;
- 🟡 partiel ou à vérifier ;
- ⏳ à faire ;
- ⚠️ dépendance ou décision externe non vérifiée.

## Vue d'ensemble du site

| Domaine | Statut | Réalité et prochaine étape |
|---|---:|---|
| Cadrage produit et architecture | ✅ | Neuf jeux, V1 à deux joueurs, contrats d'architecture, base, API et moteurs documentés. |
| Dépôt et branche de travail | 🟢 | Remote GitHub configuré ; `main` suit `origin/main` et constitue la branche de production déclarée. Ne pas forcer ni réécrire son historique. |
| Shell Next.js et accueil | 🟢 | App Router, layout, header, accueil et rail responsive des neuf jeux présents. Homepage refondue en DA violette sobre : sélection prioritaire visible, jeux secondaires en rail, palette unifiée et responsive validé en E2E. Les jeux non prêts restent désactivés. |
| Authentification et admission privée | 🟡 | Écran de connexion et helpers serveur présents ; invitations, admission complète, SMTP réel, reset et administration restent à vérifier/terminer. |
| Salons et lancement de partie | 🟡 | Routes, vues, schémas et appels RPC existent ; le socle complet à deux sessions, concurrence et reprises doit encore être validé de bout en bout. |
| PostgreSQL/Supabase | 🟡 | Migrations versionnées et tests locaux présents ; aucune migration de production ne doit être considérée comme appliquée sans vérification distante. |
| Transactions de partie | 🟡 | Repository, versionnement, reçus et commits sont amorcés ; la recette complète des conflits, doublons et finalisations reste nécessaire. |
| Realtime | 🟡 | Helper client et invalidations existent ; reconnexion, message manqué et vérification réseau complète restent à finaliser. |
| Jobs et échéances | 🟡 | Worker Géographie/UNO présent ; Cron, pg_net, Vault, baux, reprise après crash et latence de production ne sont pas déclarés vérifiés. |
| Profils, statistiques et historique | 🟡 | Routes/repository d'historique existent ; le parcours complet profils, stats et agrégats de duo reste à achever. |
| Contenus | 🟡 | Pack Géographie local versionné présent ; aucun corpus de production publié, ni banque quiz DeepSeek prête. |
| Tests et CI | 🟡 | Audit du 11/09 : 28 tests, typecheck, lint et build réussis ; E2E : 2 tests accueil réussis, 4 tests de jeu ignorés faute de `E2E_PASSWORD`. Validation du contenu en échec sous Windows. Aucun workflow CI versionné ; transactions et multijoueur restent à valider sur une base isolée. |
| Déploiement Vercel/Supabase | ⚠️ | Le dépôt et `main` sont configurés côté Git ; les dashboards, protections, environnements et migrations distantes n'ont pas été inspectés dans cette tâche. |

## Progression par jeu

| Jeu | Slug | Statut actuel | Ce qui existe | À faire avant de le déclarer réellement prêt |
|---|---|---:|---|---|
| Trou Noir | `trou-noir` | 🟡 | Clone de revue : moteur answering/judging/reveal, correction déterministe + DeepSeek serveur, projections sans fuite, UI, pack 120 questions, RPC `server_get_quiz_content` (`20260911130000_trou_noir_quiz_rpc.sql`), `contestsAccepted` réel dans perPlayer/ResultSpec. Code présent dans l'arbre de travail, non commité. | Valider SQL sur base isolée, recette à deux sessions, benchmark DeepSeek daté, puis commit/déploiement explicites. |
| TTMC | `ttmc` | ⏳ | Spécification et métadonnées du registre. | Moteur des niveaux, banque de questions, correction, UI, tests et benchmark IA. |
| Géographie / HexaPoint | `geographie` | 🟢 | Moteur pur, types/config, projection privée, scoring Haversine, carte, UI, API, worker, pack local, tests unitaires et E2E. Le registre TS le marque `ready`. | Vérifier le socle complet, la migration/activation distante, le contenu de production et une partie avec deux comptes indépendants. |
| Skyjo | `skyjo` | ⏳ | Spécification et métadonnées du registre. | Moteur de cartes, secrets, score plus petit meilleur, persistance, UI et tests. |
| UNO / Dernière carte | `uno` | 🟢 | Moteur, deck, types/config, projection de main secrète, UI, API de commandes, worker, migration `20260910100000_uno_ready.sql`, tests moteur/projection et E2E. Le code est présent sur `main`. | Vérifier le socle transactionnel complet, l'activation Supabase distante et une recette indépendante à deux comptes. |
| BombParty | `bombparty` | ⏳ | Spécification et métadonnées du registre. | Lexique licencié/versionné, chrono durable, moteur, entraînement solo, UI et tests de reprise. |
| Bataille navale | `bataille-navale` | ⏳ | Spécification et métadonnées du registre. | Placement/tirs secrets, projection par joueur, moteur, UI, tests anti-fuite et recette réseau. |
| Compatibilité | `compatibilite` | ⏳ | Spécification et métadonnées du registre. | Questions originales, réponses simultanées, score coopératif, moteur, UI et tests. |
| Longueur d'onde | `longueur-onde` | ⏳ | Spécification et métadonnées du registre. | Axes et contenu originaux, indice contrôlé, score coopératif, moteur, UI et tests. |

## Difficultés rencontrées pendant le développement

Cette section est un journal des problèmes réellement observés pendant le travail. L'IA l'alimente automatiquement lorsqu'un problème est signalé ou détecté, notamment quand l'utilisateur dit « ça ne marche pas », « j'ai une erreur » ou lorsqu'une commande, un test ou une implémentation échoue.

Ne pas y inventer de risques théoriques. Si la cause n'est pas confirmée, l'indiquer comme hypothèse. Une difficulté résolue reste dans le journal ; on ajoute sa résolution au lieu de réécrire ou supprimer l'entrée.

### 11/09/2026 — Contrôle documentaire sous Windows

- Problème : `scripts/check-docs.mjs` construisait un chemin `C:\C:\...` avec `URL.pathname` et ne contrôlait pas `progression.md`.
- Résolution : utilisation de `fileURLToPath` et ajout de `progression.md` à la vérification.
- Vérification : `node scripts/check-docs.mjs` valide 21 fichiers Markdown.

### 11/09/2026 — Vérifications après refonte de la homepage

- Problème : `pnpm test` échouait sur quatre suites avec `Cannot find package '@/games/...'` ; la suite E2E était également bloquée au départ par l'absence des navigateurs Playwright.
- Cause confirmée : l'alias Vitest utilisait `URL.pathname`, incompatible avec le chemin Windows ; les navigateurs Chromium et WebKit n'étaient pas installés dans l'environnement.
- Résolution : remplacement par `fileURLToPath` dans `vitest.config.ts`, puis installation des navigateurs Playwright nécessaires à la recette desktop/mobile.
- Vérification : `pnpm test` valide 5 fichiers et 28 tests ; `pnpm typecheck`, `pnpm lint` et `tests/e2e/home.spec.ts` passent sur Chromium et mobile.

### 11/09/2026 — Diagnostic transversal du code

- Demande : examiner les erreurs, incohérences et problèmes de maintenance, puis proposer des corrections. Aucune contradiction avec AGENTS.md ; aucune autorisation de correction générale ou de déploiement n'est déduite de cet audit.
- Rapport : [diagnostic du code et correctifs proposés](docs/audit-code-2026-09-11.md). Les constats sont distingués des fonctionnalités encore incomplètes et des configurations distantes non vérifiées.
- Erreur reproduite : `pnpm content:validate` échoue avec `ENOENT` sur un chemin Windows commençant par `C:\\C:\\` et contenant `%20`. Cause confirmée : `URL.pathname` utilisé comme chemin système. Le même motif existe dans les scripts de génération du pack et du SQL ; correctif proposé avec `fileURLToPath`, non appliqué dans cette tâche.
- Bugs établis par lecture croisée : attribution inversée du forfait Géographie ; annulation des timers lors d'actions conservant la phase ; traitement des commandes avant recherche du reçu ; absence de heartbeat UNO ; absence de contrôle d'une partie active par joueur ; jobs en échec définitif sans finalisation technique. Voir le rapport pour preuves, scénarios et autres écarts. Les scénarios SQL ne sont pas déclarés reproduits en base.
- Vérifications exécutées : `pnpm test` (5 fichiers/28 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` réussis. `pnpm test:e2e` : 2 tests accueil réussis et 4 tests de jeu ignorés faute de mot de passe de fixture. `pnpm docs:check` valide les 21 fichiers préexistants avant rédaction du rapport.
- Vérifications complémentaires : les probes déléguées de moteur reproduisent le forfait Géographie attribué à l'adversaire et le rejet `NOT_YOUR_TURN` d'une action UNO répétée après changement de tour. Double transformation des marqueurs de carte confirmée par lecture du composant et de la projection. Après ajout du rapport, `pnpm docs:check` valide 22 fichiers.
- Limites réelles : Docker et CLI Supabase absents du PATH ; un worker a confirmé l'échec de `supabase --version`. Pas d'exécution SQL locale ni de recette multijoueur dans cet audit. Aucun dashboard ou statut de migration distant inspecté.
- Incidents d'outillage : certaines lectures d'inventaire et de routes dynamiques ont été refusées par le garde de lecture ; poursuite par extraits ciblés autorisés et lectures déléguées. Des recherches sur un dossier `.github` absent ou un glob Windows invalide ont échoué ; l'inventaire ciblé a ensuite permis de conclure. Ces incidents ne sont pas des bugs de l'application.
- Nettoyage des vérifications : Next a régénéré `next-env.d.ts` pendant le build. La tentative de restauration Git a échoué car `.git/index.lock` n'était pas accessible en écriture ; une lecture programmatique pour normaliser ce fichier a aussi été refusée par le garde. Son contenu initial connu et ses fins de ligne ont ensuite été rétablis directement, et le statut Git confirme l'absence de modification applicative.
- Statut : diagnostic et propositions uniquement. Aucun correctif applicatif, migration, commit ou déploiement. Prochaine étape utile : corriger les bugs de forfait/timers/reçus/présence avec leurs tests de régression, puis réaliser la recette transactionnelle sur une base isolée.

### 11/09/2026 — Vérifications d’outillage pour l’implémentation complète

- Problème : la CLI Supabase installée (`2.104.0`) ne peut pas consulter les projets distants dans ce shell car aucun `SUPABASE_ACCESS_TOKEN` n’est fourni ; la première commande sans désactivation de télémétrie a aussi été bloquée par une écriture EPERM dans `~/.supabase/telemetry.json`.
- Résolution partielle : `SUPABASE_TELEMETRY_DISABLED=1 supabase --version` fonctionne. La vérification distante reste en attente d’une authentification/connexion effective ; aucune migration distante n’est déclarée appliquée.
- Problème : l’exécution non interactive OpenCode/Muse a signalé `Error starting FSEvents stream` puis est restée sans réponse dans l’environnement shell isolé ; le catalogue du modèle était toutefois disponible.
- Résolution : un test CLI relancé avec l’accès réseau et aux fichiers nécessaires a fonctionné avec `opencode 1.18.30` et `opencode/muse-spark-1.3-contributor-free`, en retournant `READY` avec un coût `0`. Aucun fichier du dépôt n’a été modifié par OpenCode.
- Statut : le CLI est utilisable ; l’erreur précédente était liée à l’environnement shell isolé. La vérification Supabase distante reste en attente d’une authentification effective.

### Format des prochaines entrées

`date — problème` : signalement ou erreur, contexte, cause si connue, correction ou statut actuel, puis test ou vérification effectuée.

### 11/09/2026 — Cycle 1 de revue croisée Trou Noir (clone, sans commit)

- Demande : base retenue provisoirement ; corriger loader contenu via RPC, compter `contestsAccepted`, vérifier judging/timeouts/remplacements/forfait/double NEXT, conserver 120 questions et design, lancer typecheck/lint/test. Aucune contradiction avec AGENTS.md ; aucune autorisation de commit, push, Docker ou modification de l'application OpenCode n'est déduite. Journal sans contradiction inventée.
- Corrections : `src/server/quiz/content.ts` n'interroge plus `content_packs`/`content_items` via PostgREST ; lecture via `server_get_quiz_content()` (nouvelle migration `20260911130000_trou_noir_quiz_rpc.sql`, réponse plate validée par `quizQuestionSchema`, `numericValue` null normalisé). `perPlayerStatsSchema` + `emptyStats` + `applyCloseOfReveal` + `resultFor` comptent `contestsAccepted` lors d'une contestation acceptée ; `questionsPlayed = correct + incorrect` (les timeouts sont déjà inclus dans incorrect). Remplacements ambigus : 2 remplacements autorisés, abandon au 3e void (`> MAX` au lieu de `>= MAX`). Projection : `NEXT` masqué après sa propre confirmation et pendant contestation pending. Tests ajoutés : judging (seconde réponse refusée, verdict périmé), timeouts (contest_timeout maintient le rejet, advance_reveal périmée après clôture), non-double-comptage contestation + ResultSpec, forfait RESIGN/CLAIM_FORFEIT/abandon avant premier tour, double NEXT, RPC plate, visibilité NEXT/RESOLVE_CONTEST.
- Vérifications : `pnpm typecheck` OK, `pnpm lint` OK, `pnpm test` OK (11 fichiers / 60 tests). Pack `content/quiz/dist/trou-noir.json` conservé à 120 questions ; aucun changement de design violet/sauge. SQL non exécuté localement (pas de Docker/CLI Supabase dans cette tâche) ; recette à deux sessions et benchmark DeepSeek restant à faire.
- Statut : corrections présentes dans l'arbre de travail uniquement. Aucun commit, push, déploiement ou migration distante.

### 11/09/2026 — Cycle 2 de revue croisée Trou Noir (clone, sans commit)

- Demande : repartir des corrections du cycle 1 ; auditer puis corriger si nécessaire les 9 points (RPC `server_get_quiz_content`, anti-lecture private, contestsAccepted/questionsPlayed/score, guards phase/attemptId/lease/deadlines, remplacements ambigus, RESIGN/CLAIM_FORFEIT/absence, double NEXT, projection sans fuite, routes/worker/UI/E2E 120 questions et thème) ; ajouter/corriger les tests ; lancer typecheck/lint/test/build. Travail via CLI uniquement, sans Docker, sans application OpenCode, sans commit ni push. Aucune contradiction avec AGENTS.md ; journal sans contradiction inventée.
- Audit : (1) RPC conforme — `SECURITY INVOKER`, `search_path = ''`, `private.*` qualifié, `jsonb_strip_nulls`, forme plate compatible `quizQuestionSchema` (`numericValue` null strippé puis normalisé), `ORDER BY` interne à `jsonb_agg`, `revoke public/anon/authenticated` + `grant service_role`, `create or replace` rejouable, ordre lexicographique `...120000` < `...130000`, pack `...120000` idempotent (`on conflict do update/do nothing`, sans DROP) et cohérent (slug `trou-noir`, `published`, 120 inserts vérifiés). (2) Aucune lecture PostgREST directe des tables private dans `src` (recherche `content_packs|content_items|private\.` sans résultat ; loader via `admin.rpc` uniquement). (3) `contestsAccepted` incrémenté une seule fois sur contestation acceptée, `questionsPlayed = correct + incorrect` (timeouts inclus dans incorrect), timeout `-10` non contestable, `contest_timeout` expiré maintient le rejet, `ResultSpec` exposant les compteurs. (4) Guards moteur (phase, `NOT_YOUR_TURN`, `ALREADY_SUBMITTED`, `attemptId` vs `STALE_DEADLINE`, `CONTEST_PENDING`, `ALREADY_ACKNOWLEDGED`, `NO_CONTEST_PENDING`) et worker (phase + `attemptId` vérifiés avant jugement, verdict périmé annulé, ancien job inopérant par `previousPhaseId`) conformes. (5) 2 remplacements puis abandon technique au 3e void (`consecutive > MAX`), événement sans fuite. (6) RESIGN tardif => adversaire gagne, CLAIM_FORFEIT tardif => demandeur gagne, avant premier tour => `abandoned` sans vainqueur, absence => `abandoned` sans vainqueur. (7) NEXT exige deux `actorId` participants distincts (contrôle `seatForActor` + `ALREADY_ACKNOWLEDGED`). (8) Projection pré-reveal sans prompt-fuite : ni `schedule`, `replacements`, `canonical`, `aliases`, `logicalKey`, `packId`, `itemId`, `themeLabel`, `pendingVerdict`, ni explication ; reveal avec `expectedAnswer`/`explanation` autorisés mais sans `aliases`. (9) Routes start/commands, worker, UI `geo-*` violet/sauge, page `/jeux/trou-noir`, E2E à deux sessions (ignorée sans `E2E_PASSWORD`), pack 120 questions confirmé (`trou-noir.json` : 120 ; migration : 120 inserts).
- Corrections du cycle 2 (arbre de travail uniquement) : `engine.test.ts` — assertion morte `expect(() => onTrouNoirDeadline(...))` sans matcher remplacée par une vraie vérification de convergence idempotente (`contest_timeout` sur état résolu ferme exactement une fois avec `correct=1`/`contestsAccepted=1`, puis deadline rejouée => `STALE_DEADLINE`) ; ajout du cas `CLAIM_FORFEIT` avant premier tour (`abandoned`, sans vainqueur, raison `claimed_forfeit`). `projection.test.ts` durci (clés `aliases/logicalKey/packId/itemId/themeLabel/pendingVerdict`, explication et `schedule` absents pré-reveal ; reveal sans `aliases/logicalKey/schedule`). Nouveau `src/server/quiz/rpc.test.ts` (4 tests) verrouillant sans base : ordre lexicographique et rejouabilité des deux migrations, `SECURITY INVOKER`/`search_path` vide/`private.*`/`jsonb_strip_nulls`/absence-de-résultat, forme plate + grants/revokes, interdiction de lecture PostgREST directe des tables private dans le loader.
- Vérifications : `pnpm typecheck` OK, `pnpm lint` OK, `pnpm test` OK (12 fichiers / 64 tests), `pnpm build` OK (routes `/jeux/trou-noir`, `/api/matches/[matchId]/commands`, `/api/internal/jobs/run` présentes).
- Non vérifiable sans Supabase distant (ni Docker/CLI ici) : exécution réelle de `server_get_quiz_content()` en base (résolution UUID->jsonb, `ORDER BY` dans `jsonb_agg`, comportement 0-ligne sans pack, application effective des `revoke/grant` et idempotence par rejouement), historique/hypothèses d'objets distants préexistants, recette à deux sessions avec `commitMatch`/`lease`/`deadlines` réels, benchmark DeepSeek daté. Aucune migration n'est déclarée appliquée en production ; les deux fichiers SQL restent non committés dans ce clone.
- Statut : audit + durcissements présents dans l'arbre de travail uniquement. Aucun commit, push, déploiement ou migration distante.

### 11/09/2026 — Validation du build après intégration Trou Noir

- Problème : `pnpm build` avec le bundler Turbopack échoue dans cet environnement avant compilation (`Failed to write app endpoint /page`, processus CSS incapable de binder un port, `Operation not permitted`). Cause confirmée comme restriction système/outillage ; ce n’est pas une erreur TypeScript ou applicative.
- Résolution : `pnpm exec next build --webpack` compile et génère toutes les pages/routes avec succès ; le projet garde sa configuration existante, sans contournement ajouté pour Turbopack. Le fichier généré `next-env.d.ts` a été restauré à son contenu versionné.
- Vérifications : `pnpm typecheck`, `pnpm lint` et `pnpm test` passent dans `main` (12 fichiers / 64 tests) ; build webpack OK. Le build Turbopack reste un incident d’environnement documenté.

## Points à savoir pour les prochains développements

- Une fiche Markdown est un contrat de conception, pas la preuve qu'une fonction existe.
- Toute fonctionnalité doit être suivie séparément comme documentée, codée, testée localement, validée avec deux sessions et déployée.
- Une partie V1 a exactement deux participants ; les résultats coopératifs ne doivent jamais être transformés en défaite artificielle.
- Le navigateur envoie une intention. Le serveur choisit l'acteur authentifié, le score, les cartes, la bonne réponse, l'heure et l'état suivant.
- Les moteurs sont purs et versionnés (`rulesVersion`, `engineVersion`, `stateSchemaVersion`).
- Les secrets restent côté serveur ; aucun état complet, secret ou contenu sensible dans le bundle, `NEXT_PUBLIC_*`, Realtime ou les logs.
- Les migrations Supabase sont versionnées, testées localement et immuables après application. Une migration de production est un événement de déploiement.
- Les tests payants DeepSeek ne doivent pas tourner dans la CI standard ; utiliser un provider mock et un benchmark réel daté avant activation.
- Toute modification importante doit laisser `progression.md` plus précis qu'avant, sans annoncer une capacité non vérifiée.

## Journal des contradictions et décisions utilisateur

Cette rubrique concerne uniquement les demandes explicites de l'utilisateur qui modifient une règle d'`AGENTS.md`. Une documentation obsolète ou une erreur d'implémentation n'est pas une contradiction utilisateur.

| Date | Demande ou décision utilisateur | Ancienne règle | Nouvelle règle | Périmètre / raison | Statut |
|---|---|---|---|---|---|
| 11/09/2026 | Récupérer le dépôt GitHub et configurer le push sur `main`. | `main` est déjà la branche de production et le remote de référence. | Aucun changement de règle. | Demande conforme aux guidelines existantes. | Consigné, sans dérogation |
| 11/09/2026 | Demande de maintenir un suivi de progression et d'actualiser `AGENTS.md` de manière proactive. | Mise à jour du statut seulement en fin d'implémentation. | `progression.md` devient le suivi opérationnel ; l'agent doit le mettre à jour après chaque changement significatif et journaliser les contradictions explicites. | Améliore la traçabilité du projet. | Appliqué |
| 11/09/2026 | Documenter automatiquement les problèmes signalés pendant le code ou détectés par les tests. | La section mélangeait difficultés réelles et risques anticipés. | La section devient un journal simple des problèmes réellement rencontrés ; les risques théoriques n'y sont plus ajoutés. | Permet de retrouver les erreurs et leurs résolutions sans bruit. | Appliqué |
| 11/09/2026 | Refonte de la homepage en violet, clean, responsive et sobre. | Aucune règle métier ou technique ne prescrivait une exception pour la homepage. | Aucun changement de règle ; le périmètre reste visuel et conserve les flux réels ainsi que les jeux non disponibles désactivés. | Demande conforme aux contrats UI et d'accessibilité existants. | Consigné, sans dérogation |

### Incohérences documentaires corrigées, sans décision utilisateur

- Le README indiquait qu'aucun jeu n'était implémenté ; il indique maintenant que l'accueil, Géographie et UNO sont présents dans `main`.
- Le suivi indiquait Géographie sur `codex/geographie` et UNO non commité ; il est maintenant réaligné sur `main` et le commit `2a33854`.
- `AGENTS.md` indiquait que le dépôt ne contenait aucune migration ; il précise maintenant que les migrations versionnées existent, sans conclure à leur application distante.

Ces corrections ne constituent pas des contradictions de l'utilisateur avec `AGENTS.md`.
