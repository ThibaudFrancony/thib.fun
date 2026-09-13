# Matrice de couverture — 13 septembre 2026

## Synthèse pour l'humain

Cette matrice sépare ce qui passe, ce qui reproduit encore un défaut, ce qui est bloqué par un prérequis externe et ce qui n'a pas encore été lancé. Un parcours `blocked` porte obligatoirement sa cause. Les échecs connus sont conservés comme tests de régression attendus afin qu'une correction future les fasse disparaître explicitement. Après l'étape 1, Vitest compte 43 fichiers, 330 tests réussis et 2 sentinelles d'échec attendu.

La source structurée est [`tests/coverage-matrix.json`](../tests/coverage-matrix.json). Le contrôle reproductible est `pnpm test:matrix`.

| Parcours | Statut | Preuve ou cause |
|---|---|---|
| Unitaires et contrats serveur | `pass` | Vitest et nouveaux contrats exécutés ; les défauts connus sont des échecs attendus. |
| Accueil et session invitée | `pass` | Playwright accueil + dialogue invité ; la session anonyme complète est exercée dans le job CI avec Supabase local. |
| E2E multijoueur avec deux comptes | `blocked` | `E2E_PASSWORD` absent ; la CI échoue explicitement. |
| Migrations et pgTAP isolés | `blocked` | Docker local indisponible. |
| Alice, Bob, invité et tiers non membre | `blocked` | Fixture local en attente de Supabase local. |
| Juge DeepSeek simulé | `pass` | Exact, faux, erreur et délai sans réseau. |
| Dispatcher, échéance, reçus, présence et triggers | `fail` | Payload dispatcher et garde d'échéance encore défectueux. |
| Régressions navigateur UNO | `fail` | Joker, panne réseau et heartbeat reproduits par trois tests ciblés. |
| Partie complète des neuf jeux à deux sessions | `not-run` | Prévue aux étapes 8–9. |

## Instructions d'exécution pour l'agent

1. Lire `tests/coverage-matrix.json` et exécuter `pnpm test:matrix` avant toute modification de la matrice.
2. Conserver exactement les statuts autorisés `pass`, `fail`, `blocked`, `not-run`.
3. Exiger `reason` pour chaque entrée `blocked`; ne jamais remplacer un blocage par un `skip` silencieux.
4. Mettre à jour la matrice et ce document avec les résultats réels de chaque étape ; ne pas marquer `pass` avant la commande ou le parcours correspondant.
5. Vérifier avec `pnpm test`, `pnpm test:db` (si Docker est disponible), `pnpm test:e2e` et `pnpm docs:check` selon les prérequis, puis inscrire les sorties dans `progression.md`.
