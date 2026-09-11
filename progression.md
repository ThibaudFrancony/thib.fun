# Progression du projet

Dernière mise à jour : 11 septembre 2026  
Branche de référence : `main`  
Dernier commit observé : `2a33854` — `feat: add UNO game flow and geography updates`

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
| Tests et CI | 🟡 | `pnpm test` (5 fichiers, 28 tests), `pnpm typecheck`, `pnpm lint` et l'E2E homepage desktop/mobile passent localement ; la CI complète reste à vérifier. |
| Déploiement Vercel/Supabase | ⚠️ | Le dépôt et `main` sont configurés côté Git ; les dashboards, protections, environnements et migrations distantes n'ont pas été inspectés dans cette tâche. |

## Progression par jeu

| Jeu | Slug | Statut actuel | Ce qui existe | À faire avant de le déclarer réellement prêt |
|---|---|---:|---|---|
| Trou Noir | `trou-noir` | ⏳ | Spécification et métadonnées du registre. | Moteur, quiz, correction, contenu revu, projections, UI, tests et recette à deux. |
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

### Format des prochaines entrées

`date — problème` : signalement ou erreur, contexte, cause si connue, correction ou statut actuel, puis test ou vérification effectuée.

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
