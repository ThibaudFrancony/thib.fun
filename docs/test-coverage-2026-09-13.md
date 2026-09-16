# Matrice de couverture — mise à jour du 16 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. La correction Étape 8 du 16 septembre, sur un arbre basé sur `4f3eeeb`, a exécuté la suite navigateur complète puis une gate ciblée sur Chromium desktop et mobile. La suite complète a terminé avec 44 succès directs et 2 succès après retry ; les deux attentes instables ont été corrigées et leurs relances ciblées passent 6/6 sans retry. La gate finale passe 10/10 sans retry.

La gate de l'étape 8 passe désormais dans l'environnement local isolé : Auth anonyme est effectivement redémarré avec sa configuration, `local:env` active la gestion du salon, et un transport de jugement déterministe strictement local permet les parcours Trou Noir/TTMC sans secret factice ni réseau externe. L'étape 9 reste `not-run`, pas `pass` : aucun parcours manuel des neuf jeux jusqu'à l'historique avec toutes les identités et conditions demandées n'est revendiqué. Aucun identifiant de session n'est inventé.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `node scripts/check-test-matrix.mjs` (le wrapper pnpm peut nécessiter un accès réseau au registre).

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest direct : 60 fichiers, 432 tests réussis et 2 sentinelles d'échec attendu. |
| Accueil et session invitée | `pass` | Auth locale redémarrée ; avertissement et session anonyme complète jusqu'à `/profil`, 4/4 sans retry sur desktop/mobile. |
| E2E multijoueur avec deux comptes | `pass` | Deux contextes indépendants et deux projets ; suite complète sans échec final, corrections ciblées 6/6 puis gate finale 10/10 sans retry. |
| Migrations et pgTAP isolés | `pass` | Docker local sain ; les 6 fichiers pgTAP passent avec 190 assertions. Les 33 migrations locales et distantes sont alignées et `supabase db diff --local` ne trouve aucune différence de schéma. |
| Alice, Bob et tiers non membre — fixture local | `pass` | Fixture local vérifié par agrégats : 3 profils, 2 actifs et 1 désactivé. Le mot de passe éphémère n'est ni conservé ni affiché ; l'invité réel passe séparément. |
| Juge quiz local déterministe | `pass` | Fixture accept/reject/ambiguous sans réseau, refusée en production ou avec une origine non loopback. |
| Dispatcher, échéance, reçus, présence et triggers | `pass` | Les tests SQL locaux passent (190 assertions) et `supabase db lint --local` ne remonte aucune erreur de schéma. Les migrations Step8 n'ont été appliquées qu'à PostgreSQL Docker local ; aucune validation distante n'est revendiquée. |
| Régressions navigateur UNO | `pass` | Sept tests Playwright ciblés passent sur Chromium et mobile : joker, panne, double clic, heartbeat, réponse perdue, Realtime manqué et deux onglets. |
| Reprises réseau des actions et responsive | `pass` | Cinq tests Playwright ciblés passent sur Chromium et mobile : RESIGN, réponse Trou Noir, FIRE, placement Géographie et RANDOMIZE_FLEET. |
| Gate de sortie de l'Étape 8 | `pass` | Run `step8-correction-20260916-01` : SQL salon 22 assertions, Vitest 432 succès, gate Playwright finale 10/10 sans retry sur desktop/mobile. |
| Partie complète des neuf jeux à deux sessions | `not-run` | L'Étape 9 n'a pas été lancée dans cette correction ; aucun run manuel jusqu'à l'historique et aucun identifiant de session anonymisé (`[]`). |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`. En cas de recette locale avec des identifiants éphémères, ne pas transformer un scénario sauté ou échoué en validation Step9.
6. La gate Étape 8 étant verte localement, lancer l'Étape 9 dans une exécution dédiée et conserver `nine-game-complete-run` à `not-run` jusqu'au premier scénario réellement exécuté ; ne jamais convertir un scénario échoué ou sauté en réussite.
