# Matrice de couverture — mise à jour du 16 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. Les échecs connus sont conservés comme tests de régression attendus afin qu'une correction future les fasse disparaître explicitement. Au commit de livraison indiqué dans la matrice, Vitest compte 59 fichiers, 425 tests réussis et 2 sentinelles d'échec attendu ; la recette navigateur locale compte 21 réussites et 1 scénario sauté sur chacun des profils desktop et mobile.

La gate de l'étape 9 reste `blocked`, pas `pass` : les défauts locaux de disponibilité, de gestion du salon, de permissions quiz, de job Longueur d'onde, de checksum Géographie et d'hydratation Auth ont été corrigés puis vérifiés localement, mais les neuf parcours n'ont pas encore été validés manuellement jusqu'à l'historique avec toutes les identités et conditions demandées. Aucun identifiant de session n'est inventé.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `node scripts/check-test-matrix.mjs` (le wrapper pnpm peut nécessiter un accès réseau au registre).

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest direct : 59 fichiers, 425 tests réussis et 2 sentinelles d'échec attendu. |
| Accueil et session invitée | `pass` | Playwright local : accueil et avertissement invité passent sur Chromium et mobile ; la session anonyme complète reste réservée à la CI et a été sautée hors CI dans les deux profils. |
| E2E multijoueur avec deux comptes | `pass` | Deux comptes permanents éphémères : desktop 21 réussites et 1 scénario sauté ; mobile 21 réussites et 1 scénario sauté. Les deux scénarios sautés sont la session anonyme complète, explicitement réservée à la CI. |
| Migrations et pgTAP isolés | `pass` | Docker local sain ; les 6 fichiers pgTAP passent avec 190 assertions. Le test historique qui rencontrait un I/O psql a été exécuté via une copie temporaire strictement identique. |
| Alice, Bob, invité et tiers non membre | `pass` | Fixture local préparé : Alice/Bob actifs et Mallory désactivé. Le mot de passe éphémère n'est ni conservé ni affiché ; la session invitée complète n'a pas été lancée hors CI. |
| Juge DeepSeek simulé | `pass` | Exact, faux, erreur et délai sans réseau. |
| Dispatcher, échéance, reçus, présence et triggers | `pass` | Les tests SQL locaux passent (190 assertions) et `supabase db lint --local` ne remonte aucune erreur de schéma. Les migrations Step8 n'ont été appliquées qu'à PostgreSQL Docker local ; aucune validation distante n'est revendiquée. |
| Régressions navigateur UNO | `pass` | Sept tests Playwright ciblés passent sur Chromium et mobile : joker, panne, double clic, heartbeat, réponse perdue, Realtime manqué et deux onglets. |
| Reprises réseau des actions et responsive | `pass` | Cinq tests Playwright ciblés passent sur Chromium et mobile : RESIGN, réponse Trou Noir, FIRE, placement Géographie et RANDOMIZE_FLEET. |
| Partie complète des neuf jeux à deux sessions | `blocked` | Les défauts locaux de la préparation sont corrigés et la suite ciblée passe, mais aucun run manuel des neuf jeux jusqu'à l'historique n'a été exécuté avec invité, tiers non membre et reconnexion complète. Identifiants de session anonymisés : aucun. |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`. En cas de recette locale avec des identifiants éphémères, ne pas transformer un scénario sauté ou échoué en validation Step9.
