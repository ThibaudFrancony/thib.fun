# tibo.fun — instructions pour les agents

## Mission et statut

Créer un site privé en français regroupant neuf jeux pour deux amis en ligne. Les priorités produit sont Trou Noir, TTMC et Géographie. Le site partage comptes, salons, profils, résultats et historique des confrontations. L'expérience doit fonctionner sur desktop et mobile, sans transmission manuelle des questions et sans arbitre humain obligatoire.

**Le dépôt contient actuellement des spécifications, pas une application.** Ne pas présenter une fonctionnalité documentée comme développée ou testée. La demande qui a créé ces fichiers autorisait uniquement la documentation. Une demande ultérieure d'implémentation autorise les changements nécessaires à son périmètre, pas la réalisation arbitraire des neuf jeux.

## Lecture obligatoire et ordre de priorité

1. Instructions explicites de l'utilisateur dans la conversation active.
2. Ce fichier.
3. [Index et décisions](docs/README.md), notamment le statut des décisions.
4. [Architecture](docs/01-architecture.md), [base de données](docs/02-database.md), [API et synchronisation](docs/03-api-realtime.md), [contrats du moteur](docs/08-engine-contracts.md).
5. [Produit et interface](docs/04-product-ui.md), [contenu et IA](docs/05-content-ai.md).
6. La spécification du jeu demandé dans le tableau ci-dessous.
7. [Livraison et recette](docs/06-delivery-testing.md).

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
- Branche de production : **`main`**. L'utilisateur a confirmé avoir relié ce dépôt à Supabase et activé **Deploy to production** sur cette branche. Cette configuration est déclarée par l'utilisateur ; ne pas prétendre avoir inspecté le dashboard tant que ce n'est pas fait.
- L'intégration GitHub native Supabase est le mécanisme prévu d'application des migrations de production. Un push/merge sur main contenant de nouvelles migrations doit être traité comme un déploiement potentiel de base de données.
- Ne pas ajouter un deuxième déploiement automatique via GitHub Actions, `supabase db push` dans le build Vercel ou un script de démarrage. La CI teste les migrations ; l'intégration Supabase les applique en production.
- Les fichiers SQL versionnés iront dans `supabase/migrations/` à la racine. Le working directory de l'intégration doit être `.` ; vérifier ce réglage au bootstrap. Le présent dépôt de cadrage ne contient aucune migration à appliquer.
- Avant la première migration, inspecter le schéma distant et son historique : si des objets métier existent déjà, les récupérer dans une migration de référence et réconcilier l'historique sans réinitialiser la base. Ne pas supposer que le projet est vide parce que le dépôt l'est.
- Créer les migrations avec la CLI, les tester localement ou sur un environnement isolé, puis les committer avec le code concerné. Une migration déjà appliquée est immuable ; toute correction crée une nouvelle migration.
- Préserver utilisateurs, parties, résultats, contenus et politiques d'accès. Privilégier les ajouts compatibles, reprises de données explicites et changements en plusieurs étapes. Pas de DROP/TRUNCATE/reset distant, ni réparation d'historique de migration à l'aveugle pour faire passer un déploiement.
- Vercel et Supabase ne constituent pas une transaction de déploiement unique : une fusion ne garantit pas que la base sera prête avant le code. Garder les changements compatibles avec l'ancien et le nouveau code ; pour une dépendance stricte, livrer/vérifier la migration avant d'activer le code qui l'exige.
- Les données de test des branches ne deviennent pas automatiquement des données de production. Prévoir l'import idempotent/versionné des contenus de production séparément des fixtures.
- Pour les développements suivants, travailler directement sur `main`, sauf instruction contraire. Préserver les changements existants, ne pas forcer un push et ne pas réécrire l'historique de `main`. Après un push, vérifier son résultat ; pour une migration, vérifier aussi le statut Supabase avant d'annoncer la base à jour.

L'initialisation et le push de la documentation sur main ont été explicitement demandés. Cette autorisation n'implique pas la création des neuf jeux, l'application de migrations ou la souscription de services dans la même tâche.

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

Pour « implémente X suivant le plan » : auditer le socle existant, construire les dépendances manquantes de X, implémenter son moteur et ses tests, sa persistance, ses projections, son UI, puis tester avec deux sessions séparées. Ne pas créer de boutons simulant une fonctionnalité présentée comme réelle. Un jeu incomplet reste `coming_soon` et son démarrage est refusé côté serveur.

Les décisions marquées **défaut de spécification** sont exécutables sans redemander chaque détail. Elles ne sont pas des règles officielles revendiquées ni une validation visuelle du propriétaire. Ne solliciter l'utilisateur que pour une contradiction de périmètre, une décision structurante non couverte ou des identifiants/accès manquants. Continuer les travaux indépendants pendant un blocage externe.

Chaque ajout à la base utilise des migrations versionnées créées avec la CLI Supabase. Conserver scripts de contenu et tests reproductibles. Ne pas modifier silencieusement une migration déjà déployée. Ne pas lancer de reset de production, publier des secrets ou enregistrer des données de production dans Git.

À la fin d'une implémentation, donner : fonctionnalités réelles, tests effectués, limitations, configuration restante. Mettre à jour [le suivi](docs/07-implementation-status.md), sans annoncer tous les jeux terminés lorsque seul un module l'est. Ne pas committer ou déployer automatiquement sans instruction de la tâche active.
