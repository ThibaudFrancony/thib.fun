# État de réalisation

Dernière mise à jour : 17 septembre 2026.

Le suivi opérationnel détaillé et maintenu après chaque changement se trouve dans [progression.md](../progression.md). Ce document conserve le suivi de réalisation par lots et doit rester cohérent avec lui.

**Les neuf jeux ont du code sur `main`.** La gate Étape 8 passe localement (session invitée, gestion réelle du salon, tour Trou Noir et tour TTMC sur desktop/mobile). Une passe de durcissement multijoueur du 17 septembre ajoute : rejoindre un salon par lien partagé, sortie d'un salon fermé, reçu de START vérifié, clôture explicite des parties actives remplacées (`superseded`), jobs de service non abandonnants et reprise des baux épuisés par cron. La migration additive `20260917163900_step10_multiplayer_hardening` est appliquée au PostgreSQL local et au projet Supabase distant ; le Docker pgTAP passe 7 fichiers / 204 assertions.

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
| Profils/historique/duos | Partiels mais fonctionnels | Recette distante à deux comptes restante |
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
