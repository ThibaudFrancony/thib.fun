# État de réalisation

Dernière mise à jour : 13 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Les neuf jeux ont du code sur `main`, mais leur fonctionnement complet n'est pas validé.** L'[audit du 13 septembre](audit-code-2026-09-13.md) identifie 29 défauts de code/produit et 6 observations d'infrastructure, dont des blocages de progression, d'abandon/forfait, de sécurité et de finalisation. Les 21 migrations sont appliquées sur le projet Supabase lié ; trois parties TTMC et six jobs échus restent bloqués. Aucun correctif n'a été appliqué pendant cet audit. Le [plan pas à pas](plan-correction-2026-09-13.md) est la prochaine étape de réalisation, sous réserve de relecture utilisateur.

Contrôles du 13 septembre : 318 tests unitaires, types, lint et build webpack réussis ; quatre E2E existants réussis et quatorze ignorés sans identifiants. Huit probes Vitest et six probes navigateur constatent des défauts, sans valider de correction. La suite transactionnelle SQL complète n'a pas été rejouée ; son assertion globale de 380 contenus est obsolète (1 180 items publiés). Les validations historiques de chaque lot ne remplacent pas une recette complète à deux sessions.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Accueil et sélection des jeux | Implémenté le 10 septembre 2026 | Rail responsive des neuf jeux ; Géographie, Trou Noir, TTMC et UNO activables dans le registre ; contrôle browser manuel antérieur ; E2E de jeu à deux sessions dépend des identifiants de recette |
| Bootstrap Next/Vercel/GitHub | À faire | Accès et versions à vérifier |
| Supabase CLI/configuration | Projet lié ; inspection distante en lecture seule | Projet `ttogfwnlknmiscnmlhof`, historique des 21 migrations concordant ; Vault vide malgré Cron actif |
| Supabase schéma/Auth/Storage/RLS | Migrations appliquées et vérifiées à distance | RLS publiques et fonctions serveur contrôlées ; protection des mots de passe compromis à activer dans Auth |
| Salons/transactions/Realtime/jobs | Présents, corrections bloquantes nécessaires | Audit D01–D13/D19 ; recette du circuit complet requise |
| Profils/historique/duos | Partiels | Finalisations, issues, agrégats, pagination et édition à corriger/compléter |
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

## Accès invité

Le parcours est présent localement : CTA dans le mode inscription, dialogue d'avertissement, session Auth anonyme, pseudo aléatoire généré côté serveur, accès aux salons/parties et distinction explicite entre invité et compte permanent dans les routes de compte et d'historique. La migration additive `20260912000100_anonymous_guest_access.sql` protège aussi les écritures d'historique et de statistiques personnelles.

La migration d'accès invité et ses corrections sont appliquées à distance ; le journal opérationnel contient les vérifications antérieures de connexion invitée. L'audit du 13 septembre n'a pas rejoué la recette complète avec deux sessions réelles. Le nettoyage automatique des utilisateurs anonymes reste à vérifier/configurer.
