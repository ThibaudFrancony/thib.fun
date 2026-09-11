# État de réalisation

Dernière mise à jour : 11 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Le cadrage initial et les migrations de schéma sont versionnés ; les contrôles applicatifs et statiques des neuf jeux sont validés localement, sans utiliser Docker. Aucune migration n'a été appliquée à une base distante et aucune banque de contenu de production n'a été créée.** L'accueil multi-jeux, Géographie, Trou Noir, TTMC, Skyjo, UNO, BombParty, Bataille navale, Compatibilité et Longueur d'onde sont présents dans `main` ; aucun jeu ne reste à développer dans le périmètre des neuf fiches.

Contrôles effectués : index des neuf jeux dans AGENTS, résolution des liens locaux, blocs de code Markdown équilibrés, absence de marqueurs d'espace réservé, couverture des règles/configurations/états/projections/scores/tests. Relecture croisée des droits SQL, reçus système, délais, contenu et résultats coopératifs. Le lint Supabase local ne signale aucune erreur ; 40 assertions pgTAP du schéma passent. Les contrôles applicatifs sont détaillés dans la ligne de chaque lot.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Accueil et sélection des jeux | Implémenté le 10 septembre 2026 | Rail responsive des neuf jeux ; Géographie, Trou Noir, TTMC et UNO activables dans le registre ; contrôle browser manuel antérieur ; E2E de jeu à deux sessions dépend des identifiants de recette |
| Bootstrap Next/Vercel/GitHub | À faire | Accès et versions à vérifier |
| Supabase CLI/configuration | Validée localement | `supabase/config.toml`, seed vide, stack Docker démarré, migrations listées |
| Supabase schéma/Auth/Storage/RLS | Migrations validées localement, non appliquées à distance | Revue puis fusion sur `main` pour l'intégration GitHub |
| Salons/transactions/Realtime/jobs | À faire | Base |
| Profils/historique/duos | À faire | Base + finalisation |
| Géographie | Implémenté sur `main` | Tests moteur/projection et parcours E2E présents ; migration distante et recette à deux à finaliser |
| Trou Noir | Implémenté sur `main` (11 septembre 2026) | Moteur, projection, correction, UI, worker, pack/RPC et tests présents ; recette à deux sessions, benchmark IA et migration distante à finaliser |
| TTMC | Implémenté sur `main`, commit `b5a49b5` (11 septembre 2026, cycle 2 terminé) | Moteur, projection, correction, UI, worker, pack 22 thèmes/440 questions, 116 tests au total, typecheck/lint/build webpack/docs:check OK ; push groupé avec Skyjo vérifié, recette à deux sessions, benchmark IA et migration distante à finaliser |
| Bataille navale | Implémenté sur `main`, commit `34fcd67` (11 septembre 2026, deux cycles Muse + revue de contrat terminés) | Moteur pur, projection sans fuite, flotte/tirs serveur, API/worker, UI violette sobre, migration `20260911190958_bataille_navale_activate.sql` ; 54 tests Bataille navale et 280 tests au total, typecheck/lint/build Webpack/docs:check OK ; push GitHub à vérifier, recette à deux sessions et migration distante à finaliser |
| BombParty + entraînement | Implémenté sur `main`, commit `cb88b8c` (11 septembre 2026, deux cycles Muse terminés) | Moteur pur, projection sans fuite, index serveur, API/worker, entraînement solo, UI, migration `20260911183307_bombparty_activate.sql` ; 60 tests BombParty et 226 tests au total, typecheck/lint/build Webpack/docs:check OK ; pack `content/bombparty/lexicon.json` inchangé (431 formes, CC0-1.0, sha256 vérifié) ; push GitHub vérifié sur `origin/main`, recette à deux sessions, migration distante et mesure latence à finaliser |
| Skyjo | Implémenté sur `main`, commit `2745261` (11 septembre 2026, deux cycles Muse terminés) | Moteur pur, projection sans fuite, API/worker, UI, migration `20260911180344_skyjo_activate.sql` ; 43 tests Skyjo et 166 tests au total, typecheck/lint/build Webpack/docs:check OK ; push vérifié, recette à deux sessions et migration distante à finaliser |
| UNO | Implémenté sur `main` le 10 septembre 2026 | Moteur pur, projection secrète, API/worker, UI, migration `20260910100000_uno_ready.sql` ; 13 tests UNO, typecheck/lint/build Webpack et Supabase local OK selon le suivi ; recette Chromium à deux sessions et migration distante à finaliser |
| Compatibilité | Implémenté le 11 septembre 2026 | Moteur, projection sans fuite, contenu 160 questions, API/worker, UI, migration/RPC, 13 tests dédiés ; E2E à deux comptes et migration distante à finaliser |
| Longueur d'onde | Implémenté en cours de validation locale | Moteur, projection, cible/indice/estimation, cadran SVG, UI responsive, API/worker, pack de 80 axes, migration/RPC `20260911210000_longueur_onde_ready.sql`, 15 tests dédiés ; E2E à deux sessions et migration distante restent à finaliser |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.
