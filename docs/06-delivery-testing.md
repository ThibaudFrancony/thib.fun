# Bootstrap, livraison et vérification

## 1. Périmètre des futures demandes

Ces plans ne créent ni compte fournisseur ni abonnement. Lorsqu'une implémentation est demandée, livrer la tranche complète et ses dépendances. Les accès externes manquants bloquent seulement la vérification distante : on peut construire et tester localement, mais il faut dire précisément ce qui n'a pas été vérifié. Une démo avec deux onglets partageant la même session Auth ne valide pas le multijoueur.

## 2. Bootstrap

1. Inspecter fichiers/AGENTS et statut Git ; préserver modifications utilisateur.
2. Vérifier versions actuelles officielles Next/React/Node/Supabase ; initialiser App Router TS strict, pnpm exact, Tailwind, Zod, Vitest/Playwright, modules server-only. Documenter versions dans README, ne pas utiliser `latest` en CI.
3. Initialiser Supabase CLI locale ; migrations créées par CLI ; schéma private/public et permissions, fonctions serveur, seeds metadata et fixtures locales clairement marquées.
4. Ajouter `.env.example` sans secrets et ignorer `.env*` sauf example. Configurer séparation dev/preview/prod ; preview ne doit jamais pointer vers la DB production.
5. Mettre en place Auth/admission/admin initial, SMTP dev (boîte locale) puis réel, bucket avatar et routes privées.
6. Construire moteur transactionnel, projections, worker et tests de jobs avant de brancher un jeu à timer.
7. Salons et premier jeu Géographie, puis historique/stats. Les autres jeux viennent selon index.

## 3. Variables et configurations

| Variable | Visibilité | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publique | endpoint projet de l'environnement |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publique | SDK navigateur + RLS ; pas une clé privilégiée. Noms historiques `PUBLISHABLE_KEY`/`SECRET_KEY` non lus par le code actuel |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | RPC restreintes/Storage ; clé privilégiée, jamais `NEXT_PUBLIC_` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | serveur | repli serveur optionnel des deux valeurs publiques |
| `APP_ORIGIN` | serveur | URL canonique autorisée/links/Origin ; comparaison exacte avec l'en-tête `Origin` |
| `INTERNAL_JOB_SECRET` | serveur + Vault | secret aléatoire >= 32 caractères, identique à Vault, jamais client |
| `DEEPSEEK_API_KEY` | serveur | API IA |
| `DEEPSEEK_MODEL` | serveur | ID effectivement testé |
| `AI_DAILY_BUDGET_USD` | serveur | plafond configuré, **obligatoire et strictement positif** sinon START quiz refuse |
| `AI_DAILY_CALL_LIMIT` / `AI_RESERVED_CALL_COST_USD` | serveur | plafond d'appels (défaut 1000) et coût réservé par appel (défaut 0) |
| `ROOM_CHANGE_RPC_ENABLED` | serveur | active explicitement les mutations avancées de salon après application/vérification du schéma compatible |
| `QUIZ_AI_LOCAL_FIXTURE` | serveur local uniquement | verdict déterministe `accept`, `reject` ou `ambiguous`; refusé en production et si `APP_ORIGIN` ou Supabase n'est pas loopback |
| `GEO_CONTENT_SOURCE`, `QUIZ_CONTENT_SOURCE`, `COMPATIBILITY_CONTENT_SOURCE`, `LONGUEUR_ONDE_CONTENT_SOURCE` | serveur | `database` (défaut) ou `file` ; en production, `database` exige les packs publiés |

Vault contient `worker_origin` et `internal_job_secret` correspondants. Configurer Cron seconde et nettoyage quotidien via migration/config selon environnement ; en local, worker joignable depuis PostgreSQL via adresse réseau adaptée, pas `localhost` supposé identique. Tester l'URL de bout en bout. Les secrets ne sont jamais écrits en migration. Prévoir rotation secret en acceptant ancien/nouveau pendant une courte fenêtre de déploiement puis révocation de l'ancien.

## 4. Déploiement et environnements

Configuration déclarée par le propriétaire : dépôt `https://github.com/ThibaudFrancony/thib.fun.git`, branche de production `main`. GitHub est conservé pour le dépôt, la revue et la CI ; la connexion GitHub/Supabase et **Deploy to production** ne sont plus utilisés pour appliquer les migrations. Automatic branching, protections de branche et liaison Vercel ne sont pas encore vérifiés : ne pas les présenter comme actifs.

Le connecteur Supabase dans Codex est le chemin prioritaire pour inspecter et appliquer les migrations de production. L'inspection distante en lecture seule peut servir au diagnostic ; toute application ou modification distante exige une autorisation explicite de la tâche active. Si le connecteur échoue, arrêter l'opération et fournir à l'utilisateur soit la commande terminal exacte dans un bloc `bash`, soit le SQL exact dans un bloc `sql` si la destination est l'éditeur SQL Supabase ; préciser la destination et ne jamais mélanger les formats. Inclure l'erreur exacte. GitHub, une action CI, le build Vercel et `supabase db push` automatique ne doivent pas servir de remplacement implicite. Une CI peut tester les migrations sur une base isolée, mais n'applique jamais la production. Avant toute migration, inspecter le schéma et l'historique distants et capturer l'existant si nécessaire, sans reset. Un push GitHub, même avec une migration SQL, n'introduit aucune modification distante.

GitHub privé ; CI sur pull request. Vercel branch previews sur Supabase dev/preview isolé, données fictives. Projet production séparé avec corpus publié. Configurer Auth Site URL/redirect allowlist par environnement, pas wildcard tous domaines. Fonctions en région proche de la DB européenne ; mesurer latence depuis France avant ready BombParty.

Déployer d'abord migrations compatibles, ensuite code, ensuite publication/activation du jeu. Garder les moteurs des parties actives et packs référencés. Rollback code uniquement si compatible avec schéma ; pas de downgrade SQL destructif automatique. Désactiver création de nouvelles parties d'un jeu en incident, permettre aux autres jeux de fonctionner.

Cet ordre doit être organisé explicitement : migration additive compatible appliquée et vérifiée via le connecteur, après autorisation explicite, dans une première opération, puis code dépendant/activation dans une seconde si nécessaire. Ne pas supposer que Vercel attend la réussite Supabase. Ne retirer une ancienne colonne/fonction qu'après migration des données, suppression des dépendances et vérification des parties actives. Les migrations correctives avancent l'historique, elles ne remplacent pas un fichier déjà appliqué.

Au choix du plan payant, vérifier tarifs/quotas actuels : connexions/messages Realtime, compute DB, stockage/transfert, appels/durée Vercel, SMTP, IA. Mesurer dépenses d'un usage pilote de deux joueurs ; ne pas promettre coût fixe sans devis. Les boucles Cron ne font aucun HTTP quand il n'y a pas de job. Conserver un seul abonnement Realtime principal par utilisateur pour maîtriser les connexions.

## 5. Scripts et CI attendus

Scripts de l'application à créer : `pnpm dev`, `pnpm build`, `pnpm lint` (ESLint explicite), `pnpm typecheck`, `pnpm test`, `pnpm test:matrix`, `pnpm test:db`, `pnpm test:e2e`, `pnpm test:step8`, `pnpm local:env`, `pnpm local:fixture`, `pnpm content:validate`, `pnpm docs:check`. Définir réellement chaque script dans package.json ; ne pas déclarer réussi un script absent. `local:env` écrit des variables éphémères depuis `supabase status`, active les dépendances strictement locales de la gate Étape 8, et `local:fixture` crée uniquement les identités fictives locales avec un mot de passe fourni par l'environnement. `test:step8` génère lui-même ce mot de passe sans l'afficher puis exécute les deux profils Playwright avec un seul worker.

CI : installation frozen-lockfile ; lint/typecheck ; unitaires moteurs ; validation corpus ; DB locale migrations + tests d'autorisation/concurrence ; build ; parcours E2E du périmètre implémenté. Pas d'appel payant DeepSeek en CI standard, provider mock avec timeout/JSON invalide ; benchmark réel manuel daté avant activation et après changement modèle/prompt.

## 6. Matrice commune de tests

- Auth : inscription libre e-mail/mot de passe, provisionnement automatique/rattrapage idempotent, e-mail vérifié ou en attente selon l’environnement, compte désactivé, reset de mot de passe.
- Salon : deux joins concurrents au dernier siège, ready simultanés, config annule ready, hôte quitte, start double, un utilisateur démarre deux salons concurrents, code expiré.
- Transaction : duplication exacte et payload modifié, versions concurrentes, rollback complet, score/finalisation unique, CAS échoué puis retry légal.
- Secrets : tier C via REST/RPC/Broadcast, participant voulant lire vue adverse, état privé inaccessible, solution quiz avant révélation, main/pioche/bateaux/target non divulgués.
- Jobs : échéance sans navigateur, worker crash, lease expiré/retry, job ancien, retard réseau, API sans secret, même job exécuté deux fois, reprise après déploiement.
- IA : submit reçu avant échéance, jugement après échéance autorisé car tentative déjà figée, mauvais JSON, refus/ambiguïté, panne complète, contestation, arrivée tardive après remplacement.
- Reconnexion : perte réseau, refresh, retour mobile, message manqué/doublé, GET hors ordre, POST réponse perdue, hôte fermé, forfait concurrent au heartbeat.
- Résultats : win/loss/draw/cooperative/abandoned, score plus petit meilleur, snapshots pseudos, ordre low/high duo inversé, curseur pagination sans doublons, moyennes correctes.
- UI : mobile 360 px + desktop, clavier, contraste, zoom 200 %, réduction animations, absence de console errors non expliquées.

Tests moteurs : assertions sur règles métier et propriétés (conservation des cartes, aucune carte unique dupliquée, score borné, pas de coup après fin), pas tests qui recopient l'implémentation ligne à ligne. Les tests E2E lancent deux contextes navigateurs indépendants et une DB isolée. Les horloges unitaires sont injectées ; au moins une recette worker utilise le vrai Cron de staging.

## 7. Critère de livraison d'un jeu

Moteur/schema/config documentés et implémentés ; contenu suffisant publié ; partie réelle de bout en bout avec deux comptes ; secrets testés au réseau ; reprise après refresh ; timeouts et abandons fonctionnels ; résultats et duo exacts ; UI utilisable clavier/tactile ; tests du jeu et du socle affecté passent ; documentation/statut actualisés. Pas de bouton Jouer actif avec données factices ou verdict toujours correct.

## 8. Exploitation minimale

Logs structurés : requestId, matchId, gameSlug, version, jobId, latencyMs, errorCode ; pas raw_answer, token, clé, état, mot de passe. Métriques : commandes acceptées/rejetées, conflits, retard jobs, appels IA/coût estimé, reconnexions, erreurs contenu. Alerte jobs failed ou retard > 10 s soutenu ; bouton admin de désactivation jeu possible après V1, en V1 update contrôlé côté serveur.

Nettoyage quotidien : reçus/events/jobs finaux > 30 j, caches expirés, salons expirés sans match, fenêtres rate limit. Historique/résultats conservés. Backups selon plan Supabase choisi ; vérifier restauration sur environnement isolé avant usage régulier. Si des données manquent après restauration, ne pas reconstruire scores par supposition.
