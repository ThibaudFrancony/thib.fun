# Diagnostic du code — 11 septembre 2026

Référence examinée : `main`, commit `6c6a79f`. Demande : relever les erreurs, incohérences et problèmes de maintenance, puis proposer des corrections. Aucun correctif applicatif, commit ou déploiement n'est inclus dans cet audit.

Le socle est récupérable : moteurs séparés, projections explicites, état privé, validations Zod et transactions SQL constituent une bonne base. Les défauts les plus importants se situent dans les raccords entre moteur, persistance et navigateur. La compilation réussie ne suffit pas à valider ces raccords.

## Vérifications et limites

| Contrôle exécuté | Résultat |
|---|---|
| `pnpm test` | 5 fichiers, 28 tests réussis |
| `pnpm typecheck` | Réussi |
| `pnpm lint` | Réussi |
| `pnpm build` | Build de production réussi |
| `pnpm content:validate` | Échec reproduit : chemin Windows invalide |
| `pnpm docs:check` avant rédaction du rapport | 21 fichiers Markdown valides |
| `pnpm test:e2e` | 2 tests accueil réussis ; 4 tests de jeu ignorés, faute de `E2E_PASSWORD` |
| Probes ciblées des moteurs lors de l'audit délégué | Forfait Géographie attribué à l'adversaire ; répétition d'une action UNO refusée avec `NOT_YOUR_TURN` après passage du tour |

Les migrations, les API, les moteurs, les interfaces, les scripts et les tests ont été examinés. Les constats SQL ci-dessous sont issus de la lecture croisée du code et des contrats ; ils n'ont pas été rejoués sur PostgreSQL pendant cet audit. Docker et la CLI Supabase ne sont pas disponibles dans le PATH de cette session. Aucun dashboard ni environnement de production n'a été inspecté. Les tests E2E exécutés ne constituent donc pas une validation multijoueur.

Priorités : **P1** = correction avant de considérer le multijoueur fiable ; **P2** = correction dans la stabilisation qui suit. Une lacune déjà annoncée dans la progression est identifiée comme telle, sans la présenter comme une régression découverte en production.

## Bugs et corrections proposées

### 01 — P1 — Géographie attribue le forfait au mauvais joueur

- **Preuve :** [moteur Géographie](../src/games/geographie/engine.ts), lignes 498–513 : `RESIGN` et `CLAIM_FORFEIT` utilisent le même calcul `winner = 1 - actorSeat`.
- **Conséquence :** après une absence permettant le forfait, le joueur présent qui le réclame donne la victoire à son adversaire. Le cas de préparation est traité séparément comme abandon.
- **Reproduction moteur :** un état `placing` et une commande `CLAIM_FORFEIT` de `user-a` renvoient `winnerId: user-b`. L'admissibilité liée à la présence reste contrôlée par la base et n'a pas été exécutée dans cette probe.
- **Correction :** pour `claimed_forfeit`, choisir le siège du demandeur ; pour `resign`, conserver le siège adverse.
- **Recette :** vérifier ces deux actions pour chacun des deux sièges, puis le gagnant enregistré et les deux entrées d'historique.

### 02 — P1 — Certaines actions suppriment le minuteur de Géographie

- **Preuve :** [commit SQL](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 1285–1290, annule tous les jobs en attente ou en cours. Le [moteur](../src/games/geographie/engine.ts), lignes 405–438 et 483–494, conserve la phase et son échéance mais renvoie une liste de jobs vide pour une sélection de villes, une première confirmation ou le premier clic sur Suivant.
- **Conséquence :** le timeout de préparation ou l'avancement automatique de la révélation disparaît. Quand l'échéance passe, les commandes joueur sont refusées par SQL ; avec des joueurs toujours présents, la partie peut rester bloquée.
- **Correction :** préserver les jobs de la phase inchangée et annuler seulement les jobs explicitement remplacés. Définir clairement la sémantique de `jobsToCancel`. Une simple réinsertion ne suffit pas : `ON CONFLICT (dedupe_key) DO NOTHING` ne réactive pas une ligne annulée.
- **Recette :** premier clic sur Suivant puis attente des huit secondes ; préparation modifiée puis expiration ; vérifier qu'une seule transition système est appliquée.

### 03 — P1 — Une commande rejouée après coupure réseau n'est pas correctement reconnue

- **Preuve :** [route des commandes](../src/app/api/matches/[matchId]/commands/route.ts), lignes 35–56, exécute le moteur avant de consulter le reçu via `commitMatch`. Le [SQL](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 1215–1233, lit les reçus avant le verrou de partie, sans nouvelle lecture après l'attente du verrou.
- **Conséquence :** si une action est acceptée mais sa réponse perdue, la même commande peut échouer contre l'état déjà modifié avant d'atteindre son reçu. Deux copies simultanées peuvent aussi produire un conflit au lieu du même résultat.
- **Reproduction moteur :** Alice joue une carte et le tour passe à Bob ; rejouer cette action au nom d'Alice contre l'état suivant lève `NOT_YOUR_TURN`. La route atteint donc ce rejet avant sa recherche du reçu. Le scénario HTTP/PostgreSQL complet reste à couvrir.
- **Correction :** rechercher un reçu autorisé avant le calcul métier, puis revérifier sous verrou au commit ; lier le reçu à l'acteur et au hash de la commande. Côté client, garder le même identifiant pendant une nouvelle tentative de la même intention.
- **Extension :** les reçus de création, de jonction et de démarrage de salon retournent également une réponse existante sans vérifier systématiquement acteur/type/hash. Un identifiant réutilisé avec un autre contenu doit être refusé.
- **Recette :** réponse perdue, double requête simultanée et même identifiant avec contenu différent.

### 04 — P1 — UNO n'envoie pas de signal de présence

- **Preuve :** [interface UNO](../src/games/uno/components/uno-match.tsx), lignes 26–47, relit les vues mais n'appelle pas l'endpoint de heartbeat. Le GET de partie n'actualise pas la présence. Le [heartbeat SQL](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 794–823, et les commandes acceptées actualisent `last_seen_at`.
- **Conséquence :** rester devant la partie sans envoyer de commande n'est pas distingué d'une absence. Avec le worker actif, les seuils de 120/180 secondes peuvent entraîner un abandon malgré des navigateurs ouverts.
- **Correction :** partager le heartbeat de présence entre les jeux, avec reprise au retour au premier plan et exploitation de la version renvoyée.
- **Recette :** deux joueurs ouvrent UNO et restent présents sans action pendant plus de trois minutes ; distinguer ensuite fermeture et retour d'un navigateur.

### 05 — P1 — Un joueur peut être engagé dans plusieurs parties actives

- **Preuve :** [démarrage SQL](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 1128–1170, verrouille le salon sans verrou commun aux joueurs ni contrôle de leurs autres parties. L'index de [la table matches](../supabase/migrations/20260909182304_rooms_matches_and_content.sql), lignes 106–108, garantit seulement une partie active par salon.
- **Conséquence :** deux salons peuvent démarrer avec le même membre, y compris simultanément, contrairement au contrat d'une partie active par joueur.
- **Correction :** verrouiller les deux identités dans un ordre stable dans la transaction de démarrage et contrôler leurs engagements actifs. Prévoir un mécanisme de réservation unique si ce modèle devient nécessaire.
- **Recette :** deux démarrages concurrents dans des salons différents partageant un joueur : exactement un doit réussir.

### 06 — P1 — L'échec définitif d'un job ne termine pas proprement la partie

- **Preuve :** [server_fail_job](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 1069–1089, marque le job `failed` après cinq tentatives, sans finalisation technique. Le [contrat moteur](08-engine-contracts.md), ligne 96, exige une sortie `abandoned / technical_error`.
- **Conséquence :** un job d'échéance épuisé n'est plus repris et peut laisser une partie active sans tâche capable de faire avancer la phase. Un contrôle d'absence distinct ne constitue pas une résolution de l'incident technique.
- **Correction :** ajouter une finalisation technique atomique et idempotente indépendante du moteur défaillant, conservant une projection sûre et un résultat d'interruption ; rendre l'incident observable.
- **Recette :** injecter cinq erreurs consécutives, vérifier un seul résultat d'interruption et aucune victoire artificielle.

### 07 — P1 avant évolution des règles — Les versions enregistrées ne pilotent pas l'exécution

- **Preuve :** [chargement du contenu](../src/server/geo/content.ts), lignes 29–40, n'accepte pas de version de partie ; [RPC contenu](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 633–657, choisit le dernier pack publié. La route de commandes et le worker importent les moteurs courants et transmettent leurs constantes de version. Le commit ne compare pas ces versions avec celles de la partie.
- **Conséquence :** après publication d'un nouveau pack ou changement incompatible de moteur, une partie commencée peut être évaluée avec d'autres données/règles. Le manifeste stocké ne garantit actuellement pas la reproductibilité.
- **Correction :** charger le pack exact du manifeste de la partie et sélectionner le moteur par slug et version ; refuser explicitement une version non prise en charge ; vérifier les versions au commit.
- **Recette :** commencer une partie en v1, publier v2, terminer la partie v1 avec ses données et règles initiales.

### 08 — P2 — Une erreur réseau peut laisser les boutons bloqués

- **Preuve :** [UNO](../src/games/uno/components/uno-match.tsx), lignes 49–68 : `setBusy(true)` précède `fetch`, et `setBusy(false)` n'est pas dans un `finally`. Le même schéma est utilisé dans plusieurs écrans de salon et de Géographie.
- **Conséquence :** si la requête ou la relecture après action rejette sa promesse, l'interface reste occupée jusqu'au rechargement. Capturer uniquement une erreur de `response.json()` ne capture pas une panne de réseau.
- **Correction :** centraliser l'envoi avec `try/catch/finally`, une erreur lisible et une stratégie de nouvelle tentative liée à l'identifiant de commande.
- **Recette :** passer hors ligne pendant le POST, puis pendant le GET qui suit un POST réussi.

### 09 — P2 — Les réponses réseau peuvent faire reculer l'interface

- **Preuve :** [UNO](../src/games/uno/components/uno-match.tsx), lignes 26–47, applique directement `setMatch(next)`, alors que le polling et Realtime peuvent lancer plusieurs GET concurrents. Même problème dans [Géographie](../src/games/geographie/components/geography-match.tsx). Le [contrat réseau](03-api-realtime.md), ligne 77, demande de conserver la version la plus récente.
- **Conséquence :** une réponse v10 tardive peut remplacer v11 : anciennes cartes, ancien tour ou actions périmées réapparaissent temporairement.
- **Correction :** appliquer les snapshots avec une comparaison atomique de version, regrouper les relectures et invalider les réponses d'une ancienne navigation ; relire après abonnement et reconnexion.
- **Recette :** retarder artificiellement un GET ancien jusqu'après réception du plus récent.

### 10 — P2 — Trois scripts construisent mal les chemins de fichiers

- **Preuve reproduite :** `pnpm content:validate` échoue avec `ENOENT` sur un chemin commençant par `C:\\C:\\` et conservant `%20`. [Validation](../scripts/validate-geography-pack.mjs), ligne 4 ; [génération du pack](../scripts/build-geography-pack.mjs), ligne 4 ; [génération SQL](../scripts/write-geography-migration.mjs), ligne 5, utilisent `new URL(...).pathname`.
- **Correction :** utiliser `fileURLToPath(new URL(...))`, comme le font déjà Vitest et le contrôle documentaire. Cette conversion gère les lecteurs Windows et les espaces encodés ; voir la [documentation Node.js](https://nodejs.org/api/url.html#urlfileurltopathurl-options).
- **Recette :** relancer la validation depuis ce dépôt Windows et depuis un chemin Linux contenant des espaces. La génération de contenu/SQL ne doit être testée que vers une sortie isolée.

### 11 — P1 pour la recette — Les tests ne couvrent pas les garanties transactionnelles

- **Preuve :** les 28 tests actuels sont dans `src/games`. [Les tests SQL](../supabase/tests/geographie_schema.sql) vérifient surtout l'existence d'objets, les flags RLS et des volumes de données ; l'existence d'une politique ne démontre pas son efficacité. [Les E2E](../tests/e2e/geographie.spec.ts) et [UNO](../tests/e2e/uno.spec.ts), ligne 7, sont ignorés sans mot de passe. Aucun workflow `.github` n'est versionné dans le dépôt examiné.
- **Conséquence :** la suite peut être verte malgré les défauts d'idempotence, de timers ou de concurrence ci-dessus. Les résultats locaux de cet audit illustrent cette limite.
- **Correction :** ajouter une CI sur base isolée, rendre les prérequis E2E obligatoires en CI, et tester les comportements : accès membre tiers, doubles commandes, démarrages concurrents, échéances et finalisation unique. Conserver une exécution locale légère explicitement distincte si utile.
- **Recette :** une CI sans identifiants de fixture doit échouer explicitement ; une exécution complète doit terminer une vraie partie avec deux comptes indépendants.

### 12 — P2 — Les variables documentées ne correspondent pas au code

- **Preuve :** [documentation de livraison](06-delivery-testing.md), section 3, indique `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY`. [La configuration serveur](../src/server/config.ts), lignes 10–14, et [le client navigateur](../src/lib/supabase-browser.ts), lignes 9–11, attendent `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`, comme `.env.example`.
- **Conséquence :** suivre la documentation commune à la lettre peut rendre le serveur « non configuré » et empêcher la connexion.
- **Correction :** choisir un contrat de configuration unique, accepter explicitement les variantes nécessaires à une migration, puis aligner code, exemple et procédure de déploiement. Les noms actuels ne prouvent pas à eux seuls une faille de sécurité.
- **Recette :** démarrage avec chacune des configurations annoncées comme supportées ; erreur précise pour une variable manquante.

### 13 — P2 — Les limites d'usage des API restent documentaires

- **Preuve :** [contrat API](03-api-realtime.md), ligne 51, prévoit quotas persistants et corps navigateur de 8 Ko. Aucun mécanisme `rate_limits` n'apparaît dans les migrations ou routes examinées ; seul le worker impose explicitement un plafond de corps de 16 Ko.
- **Conséquence :** les membres peuvent multiplier créations, recherches et commandes sans les limites promises. Les validations Zod interviennent après lecture du JSON entier.
- **Correction :** appliquer des quotas atomiques persistants par opération et une lecture bornée du corps avant parsing, avec réponses 429/413. Ne pas utiliser une simple Map en mémoire d'une fonction Vercel.
- **Recette :** rafales simultanées au seuil et corps surdimensionnés, sans création/écriture partielle.

### 14 — P2 — Un salon expiré peut encore être démarré

- **Preuve :** [SQL salons](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql) : la jonction vérifie `expires_at` aux lignes 945–947, mais `server_set_room_ready` et `server_start_match` contrôlent le statut sans contrôler cette échéance.
- **Conséquence :** si les deux joueurs étaient déjà dans le salon, son expiration n'empêche pas sa préparation puis son lancement.
- **Correction :** centraliser la vérification du salon actif/non expiré sous verrou, avec des transitions explicites de fermeture.
- **Recette :** deux membres prêts dans un salon expiré : démarrage refusé sans insertion de partie.

### 15 — P1 — Le zoom de la carte déplace les marqueurs deux fois

- **Preuve :** [geography-map.tsx](../src/games/geographie/components/geography-map.tsx), lignes 47–49, projette les marqueurs en appliquant le viewport. Ils sont ensuite dessinés dans le groupe SVG qui applique ce même viewport, lignes 119–128. [projectGeoPoint](../src/games/geographie/map-projection.ts), lignes 47–52, confirme que zoom et déplacement sont déjà intégrés aux coordonnées.
- **Conséquence :** dès qu'on zoome ou déplace la carte, le marqueur affiché s'écarte du point choisi et les solutions/placements ne s'alignent plus sur le fond de carte. À titre d'illustration du calcul, une coordonnée située à 100 pixels du centre passe à 200 pixels avec un zoom x2, puis à 400 après la seconde transformation.
- **Correction :** choisir un seul espace de coordonnées : points non transformés dans le groupe transformé, ou points déjà transformés dans un groupe séparé. Garder l'inversion du clic cohérente avec ce choix.
- **Recette :** après zoom et déplacement, vérifier l'alignement du clic, du marqueur et de la ville cible dans le rendu SVG ; les tests de projection seuls ne détectent pas une seconde transformation du composant.

### 16 — P2 — Une partie Géographie interrompue est affichée comme une défaite

- **Preuve :** [FinishedPanel](../src/games/geographie/components/geography-match.tsx), lignes 113–116, ne distingue que égalité, victoire et défaite. Le moteur peut produire `outcome: abandoned`, notamment lors d'un abandon en préparation.
- **Conséquence :** une interruption sans vainqueur est présentée comme une défaite à chaque joueur, même si la base conserve un abandon.
- **Correction :** traiter explicitement chaque résultat autorisé et afficher la raison d'interruption.
- **Recette :** abandon pendant la préparation et interruption pour absence, sans libellé victoire/défaite.

### 17 — P2 — La politique Realtime ne vérifie pas l'admission active

- **Preuve :** [user_broadcast_receive](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 400–410, contrôle le rôle authentifié et le topic de l'utilisateur, mais pas `is_site_member()`.
- **Conséquence :** la politique autorise encore un utilisateur authentifié désactivé à s'abonner à ses invalidations. Les événements sont limités à des identifiants/versions ; ce constat ne démontre pas l'accès à l'état secret des parties.
- **Correction :** ajouter la vérification d'admission active et tester également la révocation d'un abonnement existant, dont l'autorisation peut avoir été évaluée avant désactivation.
- **Recette :** membre actif, compte non admis et membre désactivé, sur son propre canal puis sur celui d'un autre utilisateur.

### 18 — P2 — Le tirage des villes peut manquer de valeurs aléatoires

- **Preuve :** [entropyValues](../src/server/hash.ts), lignes 9–12, fournit 128 valeurs. Le mode difficile mélange 220 villes avec un décalage de 1 dans [le moteur](../src/games/geographie/engine.ts), lignes 69–84 et 375–377 : il utilise les indices 1 à 219. Les 92 indices manquants sont remplacés silencieusement par zéro. Le [worker](../src/server/jobs/worker.ts), lignes 70–80, passe même une liste vide au traitement du timeout de préparation.
- **Conséquence :** le mélange difficile est biaisé ; à contenu et brouillons identiques, le remplissage automatique en mode défi suit un ordre déterministe.
- **Correction :** fournir la quantité d'entropie nécessaire ou un générateur déterministe issu d'une graine aléatoire serveur ; refuser une source épuisée. Prévoir aussi de l'entropie pour la sélection automatique du worker.
- **Recette :** vérifier les besoins en valeurs pour chaque pool, le rejet d'une source insuffisante et la reproductibilité avec une graine explicitement fixée.

## Dette technique et périmètre encore incomplet

- **Admission :** le formulaire propose de créer un compte puis d'utiliser une invitation, mais aucun parcours d'acceptation n'est présent. Le helper serveur exige pourtant un membre admis. C'est une fonction partielle déjà déclarée dans la progression, à terminer ou à masquer dans l'interface jusqu'à disponibilité.
- **Erreurs :** [mapServerError](../src/server/http.ts), lignes 24–55, expose le message interne dans `error.code` même pour une erreur inconnue, et plusieurs erreurs métier ne sont pas traduites. Utiliser une liste de codes publics et un journal serveur expurgé avec identifiant de requête. Aucune fuite de clé n'a été démontrée.
- **Historique :** le repository renvoie 20 éléments et un curseur, mais la page n'exploite pas ce curseur : les parties plus anciennes ne sont pas accessibles par l'écran. Le décodeur ne vérifie que le type chaîne des champs avant interpolation dans le filtre PostgREST : valider UUID et timestamp ; le filtre de propriétaire reste présent, aucune lecture d'un autre historique n'est démontrée.
- **Coopératif :** le commit SQL, lignes 1327–1332 et 1360–1366, convertit aussi ce résultat en défaite ; l'agrégat de duo n'est mis à jour que pour une partie compétitive. Corriger SQL et affichage avant de brancher les jeux coopératifs. Ce défaut est latent, ces jeux n'étant pas implémentés.
- **Interface Géographie :** après un placement accepté, le brouillon `pendingPoint` reste renseigné jusqu'au changement de phase et le message peut encore indiquer que le point n'est pas envoyé. Vider le brouillon après acceptation ou dès que le joueur est marqué comme ayant joué.
- **Interface UNO :** le bouton de forfait ne reflète pas les 90 secondes d'éligibilité, et le dialogue de choix de couleur ne gère pas déplacement/restauration du focus ni Échap. Ajouter l'éligibilité issue de la présence et un vrai comportement de dialogue clavier.
- **Thèmes :** la page UNO réutilise `RoomJoin` depuis le module Géographie sans son conteneur `.geo-page`. Les classes de ce formulaire utilisent des textes blancs et des variables limitées à ce thème. Extraire un composant de jonction partagé avec des styles autonomes et vérifier son contraste.
- **Navigation et session :** la connexion redirige systématiquement vers Géographie, même si l'utilisateur venait d'un autre parcours. Conserver une destination interne validée. La session SSR mérite aussi une recette d'expiration : le helper serveur ignore les erreurs d'écriture de cookies et aucun proxy de rafraîchissement n'est présent ; la [procédure officielle Supabase pour Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) décrit ce mécanisme. L'accueil et les pages de configuration sont publics alors que le tableau des routes les annonce réservés aux membres : aligner ce contrat sans confondre catalogue visible et données de partie accessibles.
- **Types et duplication :** le repository force les retours RPC avec des assertions TypeScript ; les sélecteurs de jeux et la construction des transitions sont répétés entre routes et worker. Générer les types SQL, valider les frontières et introduire un registre serveur versionné. Partager les mécanismes de commande, présence et synchronisation entre interfaces.
- **Lisibilité :** plusieurs composants contiennent des blocs JSX très longs sur une seule ligne. Formater et extraire les sections cohérentes facilite les corrections ; cela ne justifie pas une réécriture complète du site.
- **Migrations :** le générateur SQL contient aussi une copie des fonctions métier de la migration. Éviter deux sources modifiables du même SQL et interdire l'écrasement silencieux d'une migration existante. Une correction SQL doit être livrée dans une nouvelle migration créée avec la CLI.
- **Traçabilité du contenu :** le manifeste local indique des URLs sources et une licence de carte, mais pas de checksum, date de récupération ni revue. Le générateur réécrit toujours la version 1 comme publiée. Compléter la provenance et créer une nouvelle version pour un contenu modifié, plutôt que réécrire silencieusement un pack existant.
- **Statistiques :** les compteurs de victoires/défaites sont additionnés, mais les objets `metrics` sont fusionnés par écrasement (`jsonb ||`) dans le commit SQL. Définir explicitement quelles métriques décrivent la dernière partie et lesquelles doivent être cumulées ou moyennées.
- **Exploitation :** présence de fonctions de dispatch ne signifie pas présence d'un Cron exécuté. L'activation des extensions, la planification, les secrets Vault, l'URL joignable du worker et les migrations réellement appliquées doivent être vérifiés sur un environnement isolé, puis sur l'environnement cible. Les statuts `ready` du registre ne démontrent pas cette recette.

## Ordre de correction recommandé

1. Corriger le gagnant du forfait, la conservation des timers, la double transformation de carte, la présence UNO et les reçus de commandes ; ajouter les tests de régression correspondants.
2. Sécuriser les transactions de démarrage, les échecs définitifs des jobs et la conservation des versions/contenus.
3. Stabiliser le client réseau, corriger les scripts Windows et aligner la configuration.
4. Exécuter une CI avec PostgreSQL isolé et deux comptes ; vérifier l'exploitation des timers avant d'annoncer les jeux prêts.
5. Terminer les parcours d'admission/historique et refactoriser les parties répétées. Les sept autres jeux restent hors du périmètre de cet audit correctif.

La demande de diagnostic ne contredit aucune règle d'AGENTS.md. Les écarts code/contrats listés ici ne constituent pas de nouvelles décisions utilisateur.
