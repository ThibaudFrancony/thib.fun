# État de réalisation

Dernière mise à jour : 11 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Le cadrage initial et les migrations de schéma sont versionnés ; les migrations sont validées sur le Supabase local dans Docker. Aucune migration n'a été appliquée à une base distante et aucune banque de contenu de production n'a été créée.** L'accueil multi-jeux, Géographie et UNO sont présents sur `main` ; les autres jeux restent à développer.

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
| Géographie | Implémenté sur `main` | Tests moteur/projection et parcours E2E présents ; migration distante et recette à deux à finaliser |
| Trou Noir | À faire | Socle + quiz + benchmark IA |
| TTMC | Code présent dans l'arbre de travail, non commité (11 septembre 2026, cycle 2 de revue) | Moteur, projection, correction, UI, worker, pack 22 thèmes/440 questions, 116 tests au total, typecheck/lint/build webpack/docs:check OK ; recette à deux sessions, benchmark IA et migration distante à finaliser |
| Bataille navale | À faire | Socle |
| BombParty + entraînement | À faire | Socle + lexique + recette timer |
| Skyjo | À faire | Socle |
| UNO | Implémenté sur `main` le 10 septembre 2026 | Moteur pur, projection secrète, API/worker, UI, migration `20260910100000_uno_ready.sql` ; 13 tests UNO, typecheck/lint/build Webpack et Supabase local OK selon le suivi ; recette Chromium à deux sessions et migration distante à finaliser |
| Compatibilité | À faire | Socle + questionnaires |
| Longueur d'onde | À faire | Socle + axes |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.
