# État de réalisation

Dernière mise à jour : 10 septembre 2026.

**Le cadrage initial et les migrations de schéma sont versionnés ; les migrations sont validées sur le Supabase local dans Docker. Aucune migration n'a été appliquée à une base distante et aucune banque de contenu de production n'a été créée.** L'accueil multi-jeux, Géographie et UNO sont présents dans l'arbre de travail ; les autres jeux restent à développer.

Contrôles effectués : index des neuf jeux dans AGENTS, résolution des liens locaux, blocs de code Markdown équilibrés, absence de marqueurs d'espace réservé, couverture des règles/configurations/états/projections/scores/tests. Relecture croisée des droits SQL, reçus système, délais, contenu et résultats coopératifs. Le lint Supabase local ne signale aucune erreur ; 40 assertions pgTAP du schéma passent. Les contrôles applicatifs sont détaillés dans la ligne de chaque lot.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Accueil et sélection des jeux | Implémenté le 10 septembre 2026 | Rail responsive des neuf jeux ; Géographie seul jeu activable ; contrôle browser manuel validé ; E2E ajouté mais navigateurs Playwright à installer |
| Bootstrap Next/Vercel/GitHub | À faire | Accès et versions à vérifier |
| Supabase CLI/configuration | Validée localement | `supabase/config.toml`, seed vide, stack Docker démarré, migrations listées |
| Supabase schéma/Auth/Storage/RLS | Migrations validées localement, non appliquées à distance | Revue puis fusion sur `main` pour l'intégration GitHub |
| Salons/transactions/Realtime/jobs | À faire | Base |
| Profils/historique/duos | À faire | Base + finalisation |
| Géographie | Implémenté sur `codex/geographie` | Tests moteur/projection et parcours E2E présents ; migration distante et recette à deux à finaliser |
| Trou Noir | À faire | Socle + quiz + benchmark IA |
| TTMC | À faire | Socle + couverture niveaux + IA |
| Bataille navale | À faire | Socle |
| BombParty + entraînement | À faire | Socle + lexique + recette timer |
| Skyjo | À faire | Socle |
| UNO | Implémenté le 10 septembre 2026 (non commité) | Moteur pur, projection secrète, API/worker, UI, migration `20260910100000_uno_ready.sql` ; 13 tests UNO, typecheck/lint/build Webpack et Supabase local OK ; recette Chromium à deux sessions OK ; migration distante à finaliser |
| Compatibilité | À faire | Socle + questionnaires |
| Longueur d'onde | À faire | Socle + axes |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.
