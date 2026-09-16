# Matrice de couverture — mise à jour du 16 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. Les échecs connus sont conservés comme tests de régression attendus afin qu'une correction future les fasse disparaître explicitement. Le préflight du 16 septembre a exécuté 44 cas finaux sur Chromium desktop et mobile : 38 pass et 6 fail, sans skip ; il ne constitue pas une recette Étape 9.

La gate de l'étape 8 reste en échec applicatif : le runtime Auth local répond `Anonymous sign-ins are disabled`, `ROOM_CHANGE_RPC_ENABLED` est absent et la route de lancement exige une configuration IA absente pour Trou Noir/TTMC. La gate de l'étape 9 reste donc `blocked`, pas `pass` : aucun parcours des neuf jeux n'a été lancé manuellement jusqu'à l'historique avec toutes les identités et conditions demandées. Aucun identifiant de session n'est inventé.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `node scripts/check-test-matrix.mjs` (le wrapper pnpm peut nécessiter un accès réseau au registre).

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest direct : 59 fichiers, 425 tests réussis et 2 sentinelles d'échec attendu. |
| Accueil et session invitée | `fail` | Le préflight passe pour l'accueil et l'avertissement, mais la session complète échoue sur Chromium et mobile avec `Anonymous sign-ins are disabled`. |
| E2E multijoueur avec deux comptes | `fail` | 44 cas finaux : 38 réussites et 6 échecs. Session invitée, Trou Noir et TTMC échouent sur les deux projets ; aucun échec n'est ignoré. |
| Migrations et pgTAP isolés | `pass` | Docker local sain ; les 6 fichiers pgTAP passent avec 190 assertions. Le test historique qui rencontrait un I/O psql a été exécuté via une copie temporaire strictement identique. |
| Alice, Bob et tiers non membre — fixture local | `pass` | Fixture local vérifié par agrégats : 3 profils, 2 actifs et 1 désactivé. Le mot de passe éphémère n'est ni conservé ni affiché ; l'invité échoue séparément au niveau Auth. |
| Juge DeepSeek simulé | `pass` | Exact, faux, erreur et délai sans réseau. |
| Dispatcher, échéance, reçus, présence et triggers | `pass` | Les tests SQL locaux passent (190 assertions) et `supabase db lint --local` ne remonte aucune erreur de schéma. Les migrations Step8 n'ont été appliquées qu'à PostgreSQL Docker local ; aucune validation distante n'est revendiquée. |
| Régressions navigateur UNO | `pass` | Sept tests Playwright ciblés passent sur Chromium et mobile : joker, panne, double clic, heartbeat, réponse perdue, Realtime manqué et deux onglets. |
| Reprises réseau des actions et responsive | `pass` | Cinq tests Playwright ciblés passent sur Chromium et mobile : RESIGN, réponse Trou Noir, FIRE, placement Géographie et RANDOMIZE_FLEET. |
| Gate de sortie de l'Étape 8 | `fail` | Les 22 assertions SQL locales passent, mais la gestion avancée n'est pas activée dans `.env.local`, l'Auth refuse les invités et START Trou Noir/TTMC est refusé par configuration IA absente. |
| Partie complète des neuf jeux à deux sessions | `blocked` | Dépendance précise : la gate Étape 8 ci-dessus échoue. L'Étape 9 n'a pas commencé ; aucun run manuel jusqu'à l'historique et aucun identifiant de session anonymisé (`[]`). |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`. En cas de recette locale avec des identifiants éphémères, ne pas transformer un scénario sauté ou échoué en validation Step9.
6. Ne pas démarrer la matrice des neuf jeux tant que la gate applicative de l'Étape 8 n'est pas repassée : rétablir/valider Auth anonyme local, activer la gestion du salon dans l'environnement de recette et fournir une configuration IA de test vérifiable pour Trou Noir/TTMC.
