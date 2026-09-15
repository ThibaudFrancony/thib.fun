# Matrice de couverture — mise à jour du 15 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. Les échecs connus sont conservés comme tests de régression attendus afin qu'une correction future les fasse disparaître explicitement. Au commit `70a962e623bcdf7c18e57fab934b56fa735b55b5`, Vitest compte 59 fichiers, 424 tests réussis et 2 sentinelles d'échec attendu ; la recette navigateur locale compte 30 réussites, 12 échecs et 2 scénarios sautés sur 44 exécutions.

La gate de l'étape 9 reste `blocked`, pas `pass` : l'étape 8 n'est pas démontrée avec tous ses critères de salon et les neuf parcours n'ont pas été validés jusqu'à l'historique. L'exécution navigateur locale préliminaire est conservée comme preuve d'échec, sans identifiant de session inventé.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `pnpm test:matrix`.

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest direct : 59 fichiers, 424 tests réussis et 2 sentinelles d'échec attendu. |
| Accueil et session invitée | `pass` | Playwright local : accueil et avertissement invité passent sur Chromium et mobile ; la session anonyme complète reste réservée à la CI et a été sautée hors CI. |
| E2E multijoueur avec deux comptes | `fail` | Fixture local avec deux comptes : 30 tests passent, 12 échouent et 2 sont sautés sur 44 exécutions Chromium/mobile. Les échecs confirmés concernent surtout la course de versions sur les deux clics « prêt » et une propagation de phase Longueur d'onde à isoler. |
| Migrations et pgTAP isolés | `pass` | Docker local sain ; les 5 fichiers pgTAP passent avec 168 assertions. Le fichier Step5 versionné a nécessité une copie temporaire identique à cause d'un I/O psql local. |
| Alice, Bob, invité et tiers non membre | `pass` | Fixture local préparé : Alice/Bob actifs et Mallory désactivé. Le mot de passe éphémère n'est ni conservé ni affiché ; la session invitée complète n'a pas été lancée hors CI. |
| Juge DeepSeek simulé | `pass` | Exact, faux, erreur et délai sans réseau. |
| Dispatcher, échéance, reçus, présence et triggers | `pass` | Les tests SQL locaux passent (168 assertions) et `supabase db lint --local` ne remonte aucune erreur de schéma. La migration Step6 n'a été appliquée qu'à PostgreSQL Docker local ; aucune validation distante n'est revendiquée. |
| Régressions navigateur UNO | `pass` | Sept tests Playwright ciblés passent sur Chromium et mobile : joker, panne, double clic, heartbeat, réponse perdue, Realtime manqué et deux onglets. |
| Reprises réseau des actions et responsive | `pass` | Cinq tests Playwright ciblés passent sur Chromium et mobile : RESIGN, réponse Trou Noir, FIRE, placement Géographie et RANDOMIZE_FLEET. |
| Partie complète des neuf jeux à deux sessions | `blocked` | Précondition toujours non démontrée : `server_change_room` n'est pas disponible dans les migrations locales et `RoomView` ne projette pas encore `hostId`/`expiresAt`. La tentative locale avec deux comptes a donné 30 pass, 12 fail et 2 skip, sans couvrir les neuf parcours jusqu'à l'historique ; identifiants de session : aucun. |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`. En cas de recette locale avec des identifiants éphémères, ne pas transformer un scénario sauté ou échoué en validation Step9.
