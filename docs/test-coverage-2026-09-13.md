# Matrice de couverture — mise à jour du 14 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. Les échecs connus sont conservés comme tests de régression attendus afin qu'une correction future les fasse disparaître explicitement. Au commit `898fa9144b9ede988e6b2e21be65121a4f65654a`, Vitest compte 59 fichiers, 424 tests réussis et 2 sentinelles d'échec attendu.

La recette de l'étape 9 n'a pas commencé : son entrée est `blocked`, pas `pass`. Aucun identifiant de session n'est donc produit ou inventé.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `pnpm test:matrix`.

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest direct : 59 fichiers, 424 tests réussis et 2 sentinelles d'échec attendu. |
| Accueil et session invitée | `pass` | Playwright accueil + dialogue invité ; la session anonyme complète est exercée dans le job CI avec Supabase local. |
| E2E multijoueur avec deux comptes | `blocked` | `E2E_PASSWORD` absent ; la CI échoue explicitement. |
| Migrations et pgTAP isolés | `blocked` | Docker local indisponible. |
| Alice, Bob, invité et tiers non membre | `blocked` | Fixture local en attente de Supabase local. |
| Juge DeepSeek simulé | `pass` | Exact, faux, erreur et délai sans réseau. |
| Dispatcher, échéance, reçus, présence et triggers | `blocked` | Les assertions applicatives passent, mais la validation pgTAP/runtime et la concurrence PostgreSQL restent bloquées par l'absence de PostgreSQL/Docker local ; la migration corrective n'est pas appliquée à distance. |
| Régressions navigateur UNO | `pass` | Sept tests Playwright ciblés passent sur Chromium et mobile : joker, panne, double clic, heartbeat, réponse perdue, Realtime manqué et deux onglets. |
| Reprises réseau des actions et responsive | `pass` | Cinq tests Playwright ciblés passent sur Chromium et mobile : RESIGN, réponse Trou Noir, FIRE, placement Géographie et RANDOMIZE_FLEET. |
| Partie complète des neuf jeux à deux sessions | `blocked` | Précondition non démontrée : l'étape 8 n'est pas validée avec deux comptes permanents ; `E2E_PASSWORD` manque, `server_change_room` n'est pas disponible et `RoomView` ne projette pas `hostId`/`expiresAt`. Aucun des neuf parcours n'a été lancé au commit `898fa9144b9ede988e6b2e21be65121a4f65654a`; identifiants de session : aucun. |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`.
