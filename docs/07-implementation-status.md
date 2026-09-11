# État de réalisation

Dernière mise à jour : 11 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Le cadrage initial et les migrations de schéma sont versionnés ; les contrôles applicatifs et statiques des neuf jeux sont validés localement, sans utiliser Docker. Les 17 migrations versionnées correspondent à l'historique du projet Supabase lié et les packs de contenu sont publiés à distance ; la recette authentifiée complète reste à exécuter.** L'accueil multi-jeux, Géographie, Trou Noir, TTMC, Skyjo, UNO, BombParty, Bataille navale, Compatibilité et Longueur d'onde sont présents dans `main` ; aucun jeu ne reste à développer dans le périmètre des neuf fiches.

Contrôles effectués : index des neuf jeux dans AGENTS, résolution des liens locaux, blocs de code Markdown équilibrés, absence de marqueurs d'espace réservé, couverture des règles/configurations/états/projections/scores/tests. Relecture croisée des droits SQL, reçus système, délais, contenu et résultats coopératifs. Le lint Supabase local ne signale aucune erreur ; 40 assertions pgTAP du schéma passent. Les contrôles applicatifs sont détaillés dans la ligne de chaque lot.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Accueil et sélection des jeux | Implémenté le 10 septembre 2026 | Rail responsive des neuf jeux ; Géographie, Trou Noir, TTMC et UNO activables dans le registre ; contrôle browser manuel antérieur ; E2E de jeu à deux sessions dépend des identifiants de recette |
| Bootstrap Next/Vercel/GitHub | À faire | Accès et versions à vérifier |
| Supabase CLI/configuration | Authentifiée et liée | CLI 2.104.0, projet `ttogfwnlknmiscnmlhof`, historique des 17 migrations concordant ; aucun Docker utilisé |
| Supabase schéma/Auth/Storage/RLS | Migrations appliquées et vérifiées à distance | RLS publiques et fonctions serveur contrôlées ; protection des mots de passe compromis à activer dans Auth |
| Salons/transactions/Realtime/jobs | À faire | Base |
| Profils/historique/duos | À faire | Base + finalisation |
| Géographie | Implémenté sur `main` | Tests moteur/projection et parcours E2E présents ; migration distante vérifiée, recette à deux à finaliser |
| Trou Noir | Implémenté sur `main` (11 septembre 2026) | Moteur, projection, correction, UI, worker, pack/RPC et tests présents ; migration distante vérifiée, recette à deux sessions et benchmark IA à finaliser |
| TTMC | Implémenté sur `main`, commit `b5a49b5` (11 septembre 2026, cycle 2 terminé) | Moteur, projection, correction, UI, worker, pack 22 thèmes/440 questions, typecheck/lint/build webpack/docs:check OK ; migration distante vérifiée, recette à deux sessions et benchmark IA à finaliser |
| Bataille navale | Implémenté sur `main`, commit `34fcd67` (11 septembre 2026, deux cycles Muse + revue de contrat terminés) | Moteur pur, projection sans fuite, flotte/tirs serveur, API/worker, UI violette sobre, migration distante vérifiée ; recette à deux sessions et E2E à finaliser |
| BombParty + entraînement | Implémenté sur `main`, commit `cb88b8c` (11 septembre 2026, deux cycles Muse terminés) | Moteur pur, projection sans fuite, index serveur, API/worker, entraînement solo, UI, migration distante vérifiée ; pack `content/bombparty/lexicon.json` inchangé (431 formes, CC0-1.0, sha256 vérifié) ; recette à deux sessions, E2E et mesure latence à finaliser |
| Skyjo | Implémenté sur `main`, commit `2745261` (11 septembre 2026, deux cycles Muse terminés) | Moteur pur, projection sans fuite, API/worker, UI, migration distante vérifiée ; 43 tests Skyjo, recette à deux sessions et E2E à finaliser |
| UNO | Implémenté sur `main` le 10 septembre 2026 | Moteur pur, projection secrète, API/worker, UI, migration distante vérifiée ; 13 tests UNO, recette Chromium à deux sessions à finaliser |
| Compatibilité | Implémenté le 11 septembre 2026 | Moteur, projection sans fuite, contenu 160 questions, API/worker, UI, migration/RPC et vérification distante ; 13 tests dédiés ; E2E à deux comptes à finaliser |
| Longueur d'onde | Implémenté et activé | Moteur, projection, cible/indice/estimation, cadran SVG, UI responsive, API/worker, pack de 80 axes, migrations initiale et corrective vérifiées à distance, 16 tests dédiés ; E2E à deux sessions reste à finaliser |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.
