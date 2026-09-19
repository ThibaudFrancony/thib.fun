# État de réalisation

Dernière mise à jour : 18 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Les neuf jeux ont du code sur `main`.** La gate Étape 8 passe localement (session invitée, gestion réelle du salon, tour Trou Noir et tour TTMC sur desktop/mobile). Une passe de durcissement multijoueur du 17 septembre ajoute : rejoindre un salon par lien partagé, sortie d'un salon fermé, reçu de START vérifié, clôture explicite des parties actives remplacées (`superseded`), jobs de service non abandonnants et reprise des baux épuisés par cron. Le 18 septembre ajoute le **salon d'accueil générique** : création/rejoindre depuis l'accueil avant le choix du jeu, détection du groupe sur les pages de jeu, préparation de partie par l'hôte sans étape « prêt » — puis le **chat du site et les amis** : barre latérale droite, chat général en lecture pour tous les membres actifs, conversations privées entre amis, photos compressées côté client et réencodées serveur (migration additive `20260918214832_chat_and_friends`, appliquée au distant le 18/09), et une **page d'administration** `/admin` réservée à un e-mail en liste blanche (visibilité des jeux sur l'accueil, consultation en lecture seule du général et des messages privés), migration `20260919093337_admin_console` appliquée au distant. Les migrations `20260917163900_step10_multiplayer_hardening`, `20260918174047_step11_home_lobby` et `20260918174528_step11_lobby_prepare` sont alignées au distant. Vitest 72 fichiers / 488 tests + 2 sentinelles ; pgTAP 8 fichiers / 223 assertions (Docker non relancé pour les nouveaux fichiers chat/admin).

**La production est configurée et le worker tourne.** Au 17 septembre, l'historique distant compte 36 migrations alignées, aucun match actif, aucun job en attente. Les 4 parties bloquées et leurs jobs échus ont été clôturés explicitement (`technical_error`, données conservées) après autorisation. Vercel production sert le commit `371c070` ; `APP_ORIGIN`, `INTERNAL_JOB_SECRET`, la clé DeepSeek (`deepseek-flash`), `AI_DAILY_BUDGET_USD=1` et `ROOM_CHANGE_RPC_ENABLED=true` sont configurés, Vault contient `worker_origin` et `internal_job_secret`, et un job synthétique a prouvé la chaîne Cron → Vault → pg_net → worker Vercel. La recette réelle à deux comptes sur la production et l'Étape 9 (neuf jeux jusqu'à l'historique, invité et tiers) restent à exécuter.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Accueil et sélection des jeux | Implémenté | Rail responsive des neuf jeux ; les 9 entrées sont `ready` et les parcours locaux passent |
| Bootstrap Next/Vercel/GitHub | 🟡 Partiel | Workflow CI statique + Supabase local versionné ; variables Vercel et déploiement du HEAD à vérifier |
| Supabase CLI/configuration | Projet lié, 36/36 migrations distantes | Worker inactif : Vault vide, configuration Vercel à compléter |
| Salons/transactions/Realtime/jobs | 🟢 Local, 🟡 production | Lien partagé, sortie de salon fermé, reçu START et clôture `superseded` ajoutés et testés localement ; recette distante à faire |
| Salon d'accueil (groupe) | 🟢 Local, migrations distantes vérifiées | Bouton Salon, popup créer/rejoindre, places en direct, détection du groupe et lancement depuis la page de jeu ; tests pgTAP/Vitest/E2E locaux |
| Chat du site et amis | 🟢 Code et migration distante, 🟡 recette à deux sessions | Barre latérale, chat général, demandes/acceptation/retrait d'amis, conversations privées, photos compressées client + serveur, badges et son ; tests Vitest dédiés et pgTAP écrit (Docker non relancé) ; validation navigateur à deux comptes à faire |
| Administration (/admin) | 🟢 Code et migration distante, 🟡 recette propriétaire | Visibilité des jeux (colonne `games.visible`, accueil filtré) et vue lecture seule du général et des messages privés ; accès vérifié serveur puis base (`private.admin_accounts`, RPC `server_admin_*`) ; tests Vitest des schémas, du filtre d'accueil et des gardes de route ; recette propriétaire sur le vrai compte à faire |
| Profils/historique/duos | Profils 🟢 local, migration appliquée et vérifiée au distant (3/3 colonnes, 3/3 versions) | Recette distante à deux comptes restante |
| Géographie | Implémenté | Tests moteur/projection et E2E présents ; recette à deux à finaliser |
| Trou Noir | Implémenté | Moteur, projection, correction, UI, worker, pack/RPC et tests présents ; recette à deux sessions et benchmark IA à finaliser |
| TTMC | Implémenté | Pack 22 thèmes/440 questions ; recette à deux sessions et benchmark IA à finaliser |
| Bataille navale | Implémenté | Moteur, projection, API/worker, UI, migration distante vérifiée ; E2E à finaliser |
| BombParty + entraînement | Implémenté | Pack inchangé ; E2E et mesure de latence à finaliser |
| Skyjo | Implémenté | Moteur, projection, API/worker, UI ; E2E à finaliser |
| UNO | Implémenté | Moteur, projection, API/worker, UI ; E2E à finaliser |
| Compatibilité | Implémenté | Moteur, contenu 160 questions, API/worker, UI ; E2E à finaliser |
| Longueur d'onde | Implémenté | Moteur, projection, pack 80 axes, API/worker, UI ; E2E à finaliser |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.

## Accès invité

Le parcours est présent et validé localement : CTA dans le mode inscription, dialogue d'avertissement, session Auth anonyme, pseudo aléatoire généré côté serveur, accès aux salons/parties et distinction entre invité et compte permanent. La migration additive `20260912000100_anonymous_guest_access.sql` protège les écritures d'historique et de statistiques personnelles. Le nettoyage automatique des utilisateurs anonymes reste à vérifier/configurer.
