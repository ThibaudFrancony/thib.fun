# tibo.fun — instructions pour les agents

## Mission et statut

Créer un site privé en français regroupant neuf jeux pour deux amis en ligne. Les priorités produit sont Trou Noir, TTMC et Géographie. Le site partage comptes, salons, profils, résultats et historique des confrontations. L'expérience doit fonctionner sur desktop et mobile, sans transmission manuelle des questions et sans arbitre humain obligatoire. « Privé » signifie que les parties, profils et données ne sont pas publics ; cela n'implique pas une inscription sur invitation.

**Le dépôt contient les spécifications et un premier socle applicatif.** Le dépôt contient du code pour plusieurs jeux, mais seul [progression.md](progression.md) indique leur état réel de disponibilité. Ne pas présenter une fonctionnalité documentée comme développée ou testée. Une demande d'implémentation autorise les changements nécessaires à son périmètre, pas la réalisation arbitraire des neuf jeux.

## Lecture obligatoire et ordre de priorité

1. Instructions explicites de l'utilisateur dans la conversation active.
2. Ce fichier.
3. [Progression](progression.md), qui décrit la réalité du dépôt, les validations effectuées et les décisions opérationnelles.
4. [Index et décisions](docs/README.md), notamment le statut des décisions.
5. [Architecture](docs/01-architecture.md), [base de données](docs/02-database.md), [API et synchronisation](docs/03-api-realtime.md), [contrats du moteur](docs/08-engine-contracts.md).
6. [Produit et interface](docs/04-product-ui.md), [contenu et IA](docs/05-content-ai.md).
7. La spécification du jeu demandé dans le tableau ci-dessous.
8. [Livraison et recette](docs/06-delivery-testing.md).

Ne pas implémenter un jeu à partir du seul résumé du README. Lire ses dépendances communes. Si deux documents se contredisent, privilégier le contrat commun pour sécurité, transactions et réseau ; la fiche du jeu est l'autorité pour ses règles. Résoudre et documenter une contradiction réelle avant de coder la partie affectée.

## Stack retenue

- GitHub : dépôt privé, revue et CI.
- Next.js App Router, React, TypeScript strict ; Node.js sur Vercel.
- Tailwind CSS pour les styles, composants accessibles ; pas de moteur 3D.
- Supabase : Auth, PostgreSQL, Storage, Realtime Broadcast, Cron + pg_net + Vault pour réveiller les tâches durables.
- DeepSeek : correction sémantique des quiz, exclusivement côté serveur.
- pnpm, Vitest, Playwright ; versions exactes et lockfile au premier bootstrap, d'après les versions stables compatibles vérifiées à cette date.
- Pas de Redis, serveur WebSocket maison, ORM, microservices, paiement, matchmaking public ou chat vocal en V1.

Les détails de SDK évoluent. Vérifier la documentation officielle et les skills pertinents avant de produire du code ; les contrats métier de ces plans restent la référence. Ne pas remplacer la stack sans raison concrète et documentée.

## Dépôt GitHub et migrations de production

- Dépôt distant de référence : `https://github.com/ThibaudFrancony/thib.fun.git`. Le nom distant est `thib.fun`, même si le dossier local et les documents utilisent actuellement `tibo.fun` ; ne pas créer ou sélectionner un autre dépôt sur cette seule différence.
- Branche de production : **`main`**. GitHub reste le dépôt de référence, le support de revue et, si elle existe, de CI ; la connexion GitHub historique à Supabase n'est plus une procédure autorisée et ne doit pas appliquer de migration.
- Un push ou merge sur `main`, même avec de nouveaux fichiers SQL, ne constitue jamais l'application d'une migration de production. Ne pas utiliser **Deploy to production** GitHub/Supabase, d'action GitHub, de build Vercel ou de script de démarrage pour pousser le schéma distant.
- Pour toute inspection distante, utiliser en priorité le connecteur Supabase disponible dans Codex ; l'inspection en lecture seule peut être effectuée pour diagnostiquer. Toute application ou modification distante (migration, donnée ou configuration) exige une autorisation explicite dans la tâche active. Si le connecteur échoue, s'arrêter avant la mutation et fournir à l'utilisateur soit la commande terminal exacte dans un bloc `bash`, soit le SQL exact dans un bloc `sql` si la destination est l'éditeur SQL Supabase ; préciser la destination et ne jamais mélanger les deux formats. Inclure le message d'erreur exact et les prérequis utiles. Ne pas reformuler, tronquer ou remplacer silencieusement cette procédure par GitHub.
- Les fichiers SQL versionnés vont dans `supabase/migrations/` à la racine. La présence d'une migration dans Git ne prouve pas qu'elle a été appliquée à distance ; consulter `progression.md` et le connecteur Supabase, ou demander à l'utilisateur le résultat de la commande fournie en secours.
- Avant toute migration de production, inspecter via le connecteur le schéma distant et son historique : si des objets métier existent déjà, les récupérer dans une migration de référence et réconcilier l'historique sans réinitialiser la base. Ne pas supposer que le projet est vide parce qu'une migration existe dans le dépôt.
- Créer les migrations avec la CLI, les tester localement ou sur un environnement isolé, puis les intégrer au changement. Une migration déjà appliquée est immuable ; toute correction crée une nouvelle migration.
- Préserver utilisateurs, parties, résultats, contenus et politiques d'accès. Privilégier les ajouts compatibles, reprises de données explicites et changements en plusieurs étapes. Pas de DROP/TRUNCATE/reset distant, ni réparation d'historique de migration à l'aveugle pour faire passer un déploiement.
- Vercel et Supabase ne constituent pas une transaction de déploiement unique : une mise à jour via le connecteur ne garantit pas que le code Vercel est prêt, et inversement. Garder les changements compatibles avec l'ancien et le nouveau code ; pour une dépendance stricte, appliquer/vérifier la migration via le connecteur avant d'activer le code qui l'exige.
- Les données de test des branches ne deviennent pas automatiquement des données de production. Prévoir l'import idempotent/versionné des contenus de production séparément des fixtures.
- Pour les développements suivants, travailler directement sur `main`, sauf instruction contraire. Préserver les changements existants, ne pas forcer un push et ne pas réécrire l'historique de `main`. Après une action distante via le connecteur, vérifier son résultat ; un push GitHub seul ne prouve jamais qu'une migration est appliquée.
- Sauf instruction explicite contraire dans la tâche active, toute tâche qui a produit une modification réelle du dépôt doit se terminer par un commit puis un push vers `main`, suivis de la vérification du push. Une tâche de lecture ou de diagnostic sans fichier modifié ne committe ni ne pousse.

L'initialisation et le push de la documentation sur `main` ont été explicitement demandés ; désormais, toute tâche produisant une modification réelle suit la règle commit/push ci-dessus. Cette autorisation n'implique pas la création des neuf jeux, l'application de migrations ou la souscription de services dans la même tâche.

## Fiches des jeux

Les slugs techniques sont stables. Les noms d'affichage sont des propositions modifiables sans migration des identifiants.

| Priorité | Référence utilisateur | Slug | Nom d'affichage proposé | Plan |
|---|---|---|---|---|
| P0 | Trou Noir | `trou-noir` | Chute libre | [Plan](docs/games/01-trou-noir.md) |
| P0 | TTMC | `ttmc` | À ton niveau | [Plan](docs/games/02-ttmc.md) |
| P0 | Géographie | `geographie` | HexaPoint | [Plan](docs/games/03-geographie.md) |
| P1 | Skyjo | `skyjo` | Douze cases | [Plan](docs/games/04-skyjo.md) |
| P1 | UNO | `uno` | Dernière carte | [Plan](docs/games/05-uno.md) |
| P1 | JKLM / BombParty / Boom Party | `bombparty` | Syllabe Express | [Plan](docs/games/06-bombparty.md) |
| P1 | Bataille navale | `bataille-navale` | Flotte cachée | [Plan](docs/games/07-bataille-navale.md) |
| P1 | Compatibilité | `compatibilite` | Même réponse ? | [Plan](docs/games/08-compatibilite.md) |
| P1 | Roue de la longueur d'onde | `longueur-onde` | À l'unisson | [Plan](docs/games/09-longueur-onde.md) |

## Invariants non négociables

- Exactement deux participants par partie V1 ; modèle de données extensible, pas de faux support de 3+ joueurs.
- Toute mutation de jeu passe par l'API serveur authentifiée. Le client ne choisit jamais acteur, score, gagnant, bonne réponse, carte piochée ou heure officielle.
- Moteurs purs TypeScript côté serveur. L'état complet est privé ; `project(state, viewerId)` construit explicitement la vue autorisée de chaque joueur.
- PostgreSQL est la source de vérité. Commit atomique et contrôle de version, identifiants de commande idempotents, résultats calculés une seule fois.
- Realtime informe ; un message manqué se récupère par relecture d'un snapshot. Le moteur ne dépend pas de la livraison exactement une fois d'un message.
- Horloge de la base et tâches durables pour les échéances. Ni `setTimeout` serveur, ni onglet du créateur, ni Vercel Cron à la minute comme seule horloge des tours.
- Aucun secret dans `NEXT_PUBLIC_*`, le bundle, les projections, les logs ou les événements Realtime. Aucune table d'état complet publiée dans Postgres Changes.
- RLS sur toutes les tables exposées ; droits SQL explicitement révoqués puis accordés. Les RPC privilégiées ne sont exécutables que par le rôle serveur.
- Une partie conserve versions de règles, moteur et contenu. Ne pas casser les parties en cours lors d'un déploiement.
- Égalités et scores coopératifs sont des résultats distincts. Ne pas inventer de défaite dans les jeux coopératifs.
- Des fixtures de test ne constituent pas une banque de questions de production. Pas de génération LLM des questions en cours de partie.
- Français, clavier et tactile, responsive, erreurs lisibles, reprise après rafraîchissement.

## Façon de travailler

### Décision produit — inscription libre (12 septembre 2026)

- Demande utilisateur : arrêter d’exiger une invitation pour créer et utiliser un compte ; permettre une inscription classique par e-mail et mot de passe, puis afficher l’espace du compte une fois connecté.
- Ancienne règle : les comptes étaient admis uniquement via invitation et les parcours métier exigeaient un membre actif.
- Nouvelle règle : Supabase Auth accepte l’inscription e-mail/mot de passe ; chaque nouvel utilisateur Auth reçoit automatiquement un profil minimal et une admission active. Une confirmation d’e-mail reste appliquée si elle est activée dans l’environnement Supabase, mais ne dépend d’aucune invitation.
- Périmètre : admission, provisionnement/rattrapage des profils, callback de confirmation, écran de compte et navigation ; les invitations admin restent disponibles comme mécanisme historique optionnel et ne contrôlent plus l’accès.
- Raison : permettre à deux amis de créer leur compte eux-mêmes sans intervention manuelle, tout en conservant l’authentification Supabase et les contrôles serveur/RLS.

### Docker local opt-in — jamais automatique (18 septembre 2026)

- Demande utilisateur : ne jamais imposer Docker (Desktop / daemon, RAM) ; permettre le push sans tests Docker ; l'agent demande l'ouverture de Docker avant toute recette qui l'exige.
- Ancienne règle : la CI `push`/`PR` incluait un job `PostgreSQL local et E2E obligatoires` (`supabase start`, `db reset`, pgTAP, Playwright) et les recettes locales/Docker étaient attendues avant push.
- Nouvelle règle : Docker/Supabase local est strictement opt-in. Interdit sans autorisation explicite dans la tâche active : `docker *`, `supabase start/stop/status`, `supabase db reset/diff/lint`, `supabase test db --local`, `supabase migration list --local` contre daemon local, `pnpm test:db`, `pnpm test:e2e`, `pnpm test:step8`, `pnpm local:env`, `pnpm local:fixture` (ce dernier prépare la DB locale). Avant de les proposer, l'agent demande à l'utilisateur d'ouvrir Docker et attend sa confirmation ; en cas de refus ou sans réponse, il continue sans Docker et le note comme limite.
- Périmètre : travail agent local, vérifications pré-push/commit, CI automatique (`ci.yml` sans Docker), recette manuelle (`docker-e2e.yml` en `workflow_dispatch` uniquement), `docs/06-delivery-testing.md`.
- Raison : Docker Desktop consomme beaucoup de RAM ; l'utilisateur veut garder le daemon fermé par défaut et ne l'ouvrir que pour une recette Docker explicitement demandée.
- Vérification pré-push par défaut (sans Docker) : `pnpm test:matrix`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm content:validate`, `pnpm docs:check`, `pnpm exec next build --webpack`. Les suites Docker/pgTAP/E2E ne bloquent ni le commit ni le push ; leur absence est notée en limitation dans `progression.md`.

### Dissolution automatique des salons inactifs (19 septembre 2026)

- Demande utilisateur : dissoudre un salon après 1 h sans jouer à un jeu ; choix produit précisé dans la conversation : dissolution seulement si aucune partie n'a été lancée **et** qu'aucun joueur n'est présent depuis 1 h ; tous les salons en attente sont concernés, jamais une partie en cours.
- Ancienne règle : `docs/02-database.md` fixait 24 h après dernière activité significative, avec fermeture paresseuse au heartbeat et aucun balayage.
- Nouvelle règle : un salon `waiting` est fermé quand `greatest(rooms.updated_at, max(room_members.last_seen_at)) <= now() - interval '1 hour'`, par le balayage `private.dissolve_inactive_rooms()` planifié au cron toutes les 30 s et par `server_room_heartbeat` à la volée. Le heartbeat (présence) et la fin de partie (activité) remettent le délai à zéro ; la limite dure de 24 h (`expires_at`) reste un plafond.
- Périmètre : migration `20260919121421_step13_room_dissolution.sql`, test pgTAP `supabase/tests/step13_room_dissolution.sql`, test unitaire `src/server/rooms/dissolution-rpc.test.ts`, messages du salon, `docs/02-database.md`. Aucun changement de client, de transport Realtime ni de contrat de partie.
- Raison : éviter qu'un salon inoccupé reste « actif » jusqu'à 24 h et bloque la création/rejoint d'un nouveau salon, sans porter atteinte à une partie en cours ni à un salon réellement utilisé.

### Classement général et points inter-jeux (19 septembre 2026)

- Demande utilisateur : un leaderboard avec des points, sur n'importe quel jeu — victoire +10, défaite +5 — accessible par un bouton entre le salon et le profil, avec un podium top 3 et les 100 premiers en dessous. Choix précisés dans la conversation : match nul +7 chacun, réussite coopérative +10, partie sans vainqueur 0, backfill des parties déjà terminées, invités exclus, bouton sur toutes les pages, libellé « Leaderboard » et route `/leaderboard`.
- Ancienne règle : `docs/02-database.md` (« Aucun classement global V1 »), `docs/04-product-ui.md` et `docs/README.md` plaçaient le classement hors périmètre V1, et trois fiches de jeu interdisaient un classement inter-jeux par points.
- Nouvelle règle : les comptes permanents cumulent des points par partie terminée dans `private.player_scores` (victoire 10, défaite 5, nul 7, coopération 10, abandoned 0), alimentés par un trigger après insertion de `private.player_results` au moment exact de la finalisation, avec un backfill idempotent. La page `/leaderboard` (bouton header sur toutes les pages) affiche le podium des trois premiers et les 100 premiers ; la RPC `server_get_leaderboard` est réservée au rôle serveur et refuse les invités. Les scores internes des jeux restent séparés et ne sont jamais additionnés.
- Périmètre : migration `20260919171749_leaderboard_points.sql`, page et composants `src/app/leaderboard/*`, `src/server/leaderboard/*`, `src/lib/leaderboard-types.ts`, bouton dans `src/components/site-header.tsx` et `src/app/profil/page.tsx`, styles `.lb-*`, tests pgTAP `supabase/tests/leaderboard.sql` et Vitest, `docs/02-database.md` §6/§8/§13, `docs/04-product-ui.md` §2/§9/§12, `docs/README.md`, fiches TTMC/Skyjo/UNO, `docs/07-implementation-status.md`. Aucun changement des moteurs ni des résultats existants.
- Raison : donner une progression visible et amusante entre amis, sans mélanger les unités de score propres à chaque jeu et sans léser les parties coopératives, les égalités ou les interruptions.

### Profils publics et historique complet (19 septembre 2026)

- Demande utilisateur : supprimer la page liste `/historique` et garder l'historique dans le profil, dans la DA actuelle. Choix précisés dans la conversation : profil à gauche et historique à droite de la fenêtre ; création de `/profil/[id]` (UUID) qui affiche le profil d'un tiers en lecture seule + **son historique complet**, en remplacement de `/historique/duo/[id]` (atteint depuis le chat et le leaderboard) qui redirige ; le détail d'une partie reste réservé aux participants ; `players`/`player_game_stats` servent les agrégats.
- Ancienne règle : `docs/04-product-ui.md` §2/§3/§4 prévoyait `/joueurs/[id]`, listait `/historique` et `/duo/[id]`, et interdisait de montrer « ses parties avec un tiers » ; `docs/02-database.md` §7 notait `player_game_stats` « jamais historique tiers ».
- Nouvelle règle : `/historique` redirige vers `/profil` et son entrée disparaît du header. `/profil` (compte permanent) affiche la carte de profil à gauche et l'historique complet à droite (filtres, pagination, DA violette) ; `/profil/[id]` affiche le profil d'un tiers en lecture seule et son historique complet, réservé aux comptes permanents (invités refusés, propre identifiant redirigé). Le détail `/historique/[id]` reste limité aux participants et est re-skinné. Aucune migration : `player_game_stats` est déjà lisible par tout membre et `history_entries` reste lu côté serveur (`service_role`) après contrôle d'admission.
- Périmètre : `src/app/profil/*` (`[id]`, `profile-history`, `profile-public`, `account-header`), `src/server/profiles/*`, `src/app/api/profiles/[id]/history/route.ts`, suppression de `src/app/historique/page.tsx`, `history-browser.tsx`, `pair-history-browser.tsx` et `/api/history/pair/[playerId]`, redirection `/historique` dans `next.config.ts`, liens du chat et du leaderboard, styles `.pf-*`, tests Vitest `history-helpers.test.ts` et `src/server/profiles/repository.test.ts`, `docs/02-database.md` §6/§7, `docs/04-product-ui.md` §2/§3/§4/§7/§10/§12/§13, `docs/07-implementation-status.md`, `docs/README.md`.
- Raison : rendre la progression et les confrontations lisibles au même endroit que l'identité du joueur, et permettre de consulter le parcours d'un ami depuis son profil plutôt qu'une page « duo » à la signification floue.

### Mise à jour proactive du suivi

- Lire `AGENTS.md` et `progression.md` avant toute modification substantielle.
- Après chaque implémentation, correction, migration, test significatif ou décision de périmètre, mettre à jour `progression.md` dans le même changement. Y noter les fonctionnalités réellement présentes, les tests réellement exécutés, les limitations, les difficultés rencontrées et la prochaine étape utile.
- Ne jamais cocher une fonctionnalité sur la base d'une spécification seule. Distinguer `documenté`, `présent dans le code`, `validé localement`, `validé à deux sessions` et `déployé`.
- Si l'utilisateur signale un problème pendant le code (« ça ne marche pas », « j'ai une erreur », formulation équivalente), ou si une commande, un test ou une implémentation échoue, documenter automatiquement le problème dans la section `Difficultés rencontrées pendant le développement` de `progression.md`. Rester factuel, distinguer cause confirmée et hypothèse, puis ajouter la résolution et la vérification lorsqu'elles existent.
- Ce journal est append-only pour les problèmes réels : ne pas y ajouter de risques théoriques et ne pas supprimer un problème résolu ; compléter son entrée ou ajouter sa résolution.
- Comparer chaque demande explicite de l'utilisateur aux règles de ce fichier. Si elle les contredit, traiter cette demande comme une décision de projet : mettre à jour `AGENTS.md`, `progression.md` et les documents dépendants dans le même changement, en conservant la date, la demande, l'ancienne règle, la nouvelle règle, le périmètre et la raison. Ne pas créer silencieusement une exception temporaire.
- Ne pas qualifier de contradiction une simple contrainte d'outil, une panne, une hypothèse de l'agent ou une documentation obsolète : les consigner dans la bonne rubrique de `progression.md`.
- Si aucune contradiction utilisateur n'est détectée, le journal doit l'indiquer explicitement plutôt que d'en inventer une.

### Diagnostics et plans transmissibles à un autre agent

- Pour tout diagnostic, plan de correction, revue ou compte rendu destiné à être appliqué par un autre modèle, produire deux parties distinctes : `Synthèse pour l'humain` (problème, impact, plan, incertitudes et critères de validation en langage clair), puis `Instructions d'exécution pour l'agent` (courtes, impératives et sans ambiguïté).
- La partie destinée à l'agent doit identifier, pour chaque action, le chemin exact du fichier et le symbole concerné (fonction, composant, route, test ou migration), le comportement observé, la cause confirmée ou l'hypothèse explicitement marquée, le changement attendu, les invariants à préserver, les dépendances d'ordre et les commandes/tests de vérification. Remplacer les formulations vagues comme « corriger la connexion » par des modifications localisées et directement exécutables.
- Ce bloc est une spécification de passation, pas une demande de délégation supplémentaire. Si l'emplacement ou la cause exacte n'est pas établi, indiquer précisément ce qui reste à inspecter au lieu d'inventer un fichier ou un symbole.

Pour « implémente X suivant le plan » : auditer le socle existant, construire les dépendances manquantes de X, implémenter son moteur et ses tests, sa persistance, ses projections, son UI, puis tester avec deux sessions séparées. Ne pas créer de boutons simulant une fonctionnalité présentée comme réelle. Un jeu incomplet reste `coming_soon` et son démarrage est refusé côté serveur.

Les décisions marquées **défaut de spécification** sont exécutables sans redemander chaque détail. Elles ne sont pas des règles officielles revendiquées ni une validation visuelle du propriétaire. Ne solliciter l'utilisateur que pour une contradiction de périmètre, une décision structurante non couverte ou des identifiants/accès manquants. Continuer les travaux indépendants pendant un blocage externe.

Chaque ajout à la base utilise des migrations versionnées créées avec la CLI Supabase. Conserver scripts de contenu et tests reproductibles. Ne pas modifier silencieusement une migration déjà déployée. Ne pas lancer de reset de production, publier des secrets ou enregistrer des données de production dans Git.

À la fin d'une implémentation, donner : fonctionnalités réelles, tests effectués, limitations, configuration restante. Mettre à jour [la progression opérationnelle](progression.md) et, si nécessaire, [le suivi de spécification](docs/07-implementation-status.md), sans annoncer tous les jeux terminés lorsque seul un module l'est. Ne pas déployer ni appliquer de migration distante sans autorisation explicite de la tâche active ; le commit et le push d'une modification réelle suivent la règle ci-dessus.
