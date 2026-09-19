# Index des spécifications

Date du cadrage : 9 septembre 2026. Langue du produit : français. Cible : deux amis dans des navigateurs distincts, desktop ou mobile. Ces documents décrivent le produit à construire, pas des capacités déjà présentes.

## Décisions et limites de validation

**Validé par l'utilisateur :** neuf jeux, priorité Trou Noir/TTMC/Géographie, multijoueur avec code/lien, temps réel, profils et avatars, statistiques et historique des duos, architecture modulaire, GitHub/Vercel/Supabase, correction LLM des réponses libres avec DeepSeek comme premier candidat. Budget possible pour une expérience fiable. Documentation détaillée avant toute implémentation.

**Défauts de spécification exécutables choisis par l'agent :** exactement deux joueurs en V1, inscription libre par e-mail/mot de passe avec admission automatique, règles et durées détaillées dans les fiches, noms d'affichage proposés, structure SQL, contrats API, gestion des égalités, échéances et infra de tâches. L'inscription libre remplace la décision antérieure « comptes sur invitation » à la demande du propriétaire le 12 septembre 2026. Ils évitent de laisser l'implémenteur inventer les détails. Les versions adaptées de Trou Noir/TTMC/cartes ne doivent pas être présentées comme des reproductions certifiées de règles commerciales.

**DA non encore validée visuellement :** le propriétaire a validé « simple, moderne, agréable, responsive ». Les tokens et dispositions du document UI sont une base provisoire précise. Faire valider un écran représentatif avant de décliner neuf interfaces lors de l'implémentation ; cela ne bloque pas moteurs et base.

**Points opérationnels externes :** projets Vercel/Supabase réels, domaine, clés, SMTP, budget et corpus de production à configurer ultérieurement. Aucune ressource payante n'est créée par ces plans.

## Documents communs

| Document | Contenu |
|---|---|
| [Architecture](01-architecture.md) | Stack, modules, moteur, transactions et tâches |
| [Base de données](02-database.md) | Tables, contraintes, index, permissions, RPC |
| [API et temps réel](03-api-realtime.md) | Endpoints, commandes, échéances, reconnexion |
| [Produit et UI](04-product-ui.md) | Navigation, compte, salons, profils, DA, accessibilité |
| [Contenu et IA](05-content-ai.md) | Questions, DeepSeek, dictionnaire et provenance |
| [Livraison et tests](06-delivery-testing.md) | Bootstrap, déploiement, tests et critères de sortie |
| [Suivi](07-implementation-status.md) | Réalité de l'implémentation, à tenir à jour |
| [Contrats du moteur](08-engine-contracts.md) | Types partagés, commits, événements système et exemples |
| [Diagnostic du 13 septembre](audit-code-2026-09-13.md) | Audit des neuf jeux, preuves locales/distantes, 29 défauts et 6 observations d'infrastructure |
| [Plan de correction pas à pas](plan-correction-2026-09-13.md) | Étapes ordonnées, tests, critères de sortie et garde de livraison — à relire avant exécution |
| [Matrice de couverture des tests](test-coverage-2026-09-13.md) | Statuts `pass`, `fail`, `blocked` et `not-run`, preuves et causes des blocages |

## Jeux

1. [Trou Noir / Chute libre](games/01-trou-noir.md).
2. [TTMC / À ton niveau](games/02-ttmc.md).
3. [Géographie / HexaPoint](games/03-geographie.md).
4. [Skyjo / Douze cases](games/04-skyjo.md).
5. [UNO / Dernière carte](games/05-uno.md).
6. [BombParty / Syllabe Express](games/06-bombparty.md).
7. [Bataille navale / Flotte cachée](games/07-bataille-navale.md).
8. [Compatibilité / Même réponse ?](games/08-compatibilite.md).
9. [Longueur d'onde / À l'unisson](games/09-longueur-onde.md).

## Ordre d'implémentation recommandé

1. Comptes, accès privé, schéma, moteur transactionnel, worker, salons et projections.
2. Géographie, jusqu'à une vraie partie terminée dans deux navigateurs et consultable dans l'historique.
3. Banque de quiz + correction, puis Trou Noir et TTMC.
4. Bataille navale pour éprouver les secrets ; BombParty pour éprouver les échéances rapides.
5. Skyjo, UNO, compatibilité, longueur d'onde.

Chaque tranche comprend ses tests et son UI réelle. Les cartes des jeux non disponibles restent visibles comme « Bientôt », sans route de démarrage fonctionnelle.

## Hors périmètre V1

Matchmaking public, plus de deux joueurs, équipes, argent réel, monétisation, vocal, bots adversaires, app native, génération de quiz à la volée, éditeur de règles, replay animé complet, spectateurs. Le chat général du site et les conversations privées entre amis ont été ajoutés au périmètre le 18 septembre 2026 à la demande du propriétaire (voir [Produit et UI](04-product-ui.md) §10) : messages texte et photos, pas de vocal. Le classement général aux points inter-jeux a été ajouté le 19 septembre 2026 (voir [Produit et UI](04-product-ui.md) §12 et [Base de données](02-database.md) §13). Les profils publics et l'historique complet consultable sur le profil d'un tiers ont été décidés le 19 septembre 2026 (voir [Produit et UI](04-product-ui.md) §13) : la page liste `/historique` disparaît au profit de `/profil` et `/profil/[id]`, le détail d'une partie restant réservé aux participants. L'entraînement BombParty est la seule activité solo initiale. L'historique conserve des résumés de manches, pas des enregistrements vidéo.

## Références techniques vérifiées au cadrage

Vérifier les signatures exactes à l'implémentation :

- [Supabase Realtime](https://supabase.com/docs/guides/realtime), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [autorisation](https://supabase.com/docs/guides/realtime/authorization).
- [Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [limites des fonctions](https://supabase.com/docs/guides/functions/limits).
- [Supabase Auth](https://supabase.com/docs/guides/auth), [Storage](https://supabase.com/docs/guides/storage).
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Vercel et GitHub](https://vercel.com/docs/git/vercel-for-github).
- [DeepSeek JSON](https://api-docs.deepseek.com/guides/json_mode/), [tarifs](https://api-docs.deepseek.com/quick_start/pricing/).

Ces références justifient les capacités techniques ; les règles adaptées et la structure du projet sont nos décisions de conception.

## Accès invité

Une session Auth anonyme peut jouer dans les salons et parties sans créer de compte, avec un pseudo généré côté serveur. Elle ne conserve ni historique ni statistiques persistants ; le claim `is_anonymous` réserve les fonctions de compte aux utilisateurs permanents.
