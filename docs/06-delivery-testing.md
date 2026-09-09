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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publique | SDK navigateur + RLS ; pas une clé privilégiée |
| `SUPABASE_SECRET_KEY` | serveur | RPC restreintes/Storage ; SDK actuel et rôle effectif à vérifier |
| `APP_ORIGIN` | serveur | URL canonique autorisée/links/Origin |
| `INTERNAL_JOB_SECRET` | serveur + Vault | secret aléatoire >= 32 octets, jamais client |
| `DEEPSEEK_API_KEY` | serveur | API IA |
| `DEEPSEEK_MODEL` | serveur | ID effectivement testé |
| `AI_DAILY_BUDGET_USD` | serveur | plafond configuré, pas un prix hardcodé |
| `CONTENT_ENV` | serveur | `fixtures` local ou `production` ; prod interdit fixtures |

Vault contient `worker_origin` et `internal_job_secret` correspondants. Configurer Cron seconde et nettoyage quotidien via migration/config selon environnement ; en local, worker joignable depuis PostgreSQL via adresse réseau adaptée, pas `localhost` supposé identique. Tester l'URL de bout en bout. Les secrets ne sont jamais écrits en migration. Prévoir rotation secret en acceptant ancien/nouveau pendant une courte fenêtre de déploiement puis révocation de l'ancien.

## 4. Déploiement et environnements

Configuration déclarée par le propriétaire : dépôt `https://github.com/ThibaudFrancony/thib.fun.git`, branche de production `main`, intégration GitHub Supabase connectée et **Deploy to production** activé. Working directory attendu `.` pour notre futur dossier `supabase/`. Automatic branching, protections de branche et liaison Vercel ne sont pas encore vérifiés : ne pas les présenter comme actifs.

L'intégration native Supabase sera l'unique exécutant automatique des migrations de production. Les workflows GitHub testent les migrations sur une base isolée ; ni eux ni le build Vercel ne lancent un second `db push` production. Avant bootstrap, inspecter le schéma et l'historique distants et capturer l'existant si nécessaire, sans reset. Un push uniquement documentaire n'introduit aucune migration SQL, même si les intégrations peuvent déclencher leurs vérifications.

GitHub privé ; CI sur pull request. Vercel branch previews sur Supabase dev/preview isolé, données fictives. Projet production séparé avec corpus publié. Configurer Auth Site URL/redirect allowlist par environnement, pas wildcard tous domaines. Fonctions en région proche de la DB européenne ; mesurer latence depuis France avant ready BombParty.

Déployer d'abord migrations compatibles, ensuite code, ensuite publication/activation du jeu. Garder les moteurs des parties actives et packs référencés. Rollback code uniquement si compatible avec schéma ; pas de downgrade SQL destructif automatique. Désactiver création de nouvelles parties d'un jeu en incident, permettre aux autres jeux de fonctionner.

Pour les deux intégrations déclenchées par main, cet ordre doit être organisé explicitement : migration additive compatible dans une première livraison vérifiée, puis code dépendant/activation dans une seconde si nécessaire. Ne pas supposer que Vercel attend la réussite Supabase. Ne retirer une ancienne colonne/fonction qu'après migration des données, suppression des dépendances et vérification des parties actives. Les migrations correctives avancent l'historique, elles ne remplacent pas un fichier déjà appliqué.

Au choix du plan payant, vérifier tarifs/quotas actuels : connexions/messages Realtime, compute DB, stockage/transfert, appels/durée Vercel, SMTP, IA. Mesurer dépenses d'un usage pilote de deux joueurs ; ne pas promettre coût fixe sans devis. Les boucles Cron ne font aucun HTTP quand il n'y a pas de job. Conserver un seul abonnement Realtime principal par utilisateur pour maîtriser les connexions.

## 5. Scripts et CI attendus

Scripts de l'application à créer : `pnpm dev`, `pnpm build`, `pnpm lint` (ESLint explicite), `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm content:validate`, `pnpm docs:check`. Définir réellement chaque script dans package.json ; ne pas déclarer réussi un script absent.

CI : installation frozen-lockfile ; lint/typecheck ; unitaires moteurs ; validation corpus ; DB locale migrations + tests d'autorisation/concurrence ; build ; parcours E2E du périmètre implémenté. Pas d'appel payant DeepSeek en CI standard, provider mock avec timeout/JSON invalide ; benchmark réel manuel daté avant activation et après changement modèle/prompt.

## 6. Matrice commune de tests

- Auth : invité valide/invalide/expiré/déjà consommé, e-mail vérifié, compte non admis, compte désactivé, reset de mot de passe.
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
