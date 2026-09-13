# Diagnostic fonctionnel et plan de correction — 13 septembre 2026

Référence : `main`, commit `58eaca9`. Audit demandé après signalement des boutons d'abandon et de forfait. **Aucun correctif métier ni changement de production n'a été effectué.** L'étape 1 du plan a depuis ajouté uniquement un harnais de tests, des fixtures locales et une CI versionnée ; les défauts décrits ici restent les cibles des étapes de correction.

Le problème dépasse les boutons : plusieurs ruptures entre navigateur, moteurs et transactions empêchent la progression ou la finalisation des parties. Les moteurs disposent de nombreux tests, mais le circuit complet n'est pas validé. Corriger seulement le Cron ou seulement l'interface déplacerait les blocages.

## Synthèse pour l'humain

L'audit établit 29 défauts de code/produit et 6 observations d'infrastructure. Les blocages les plus urgents sont le worker jamais appelé faute de secrets Vault, le JSON dispatcher incompatible avec le worker, les jugements quiz obsolètes, la garde SQL qui refuse l'abandon après expiration, le mauvais gagnant du forfait Géographie, les timers annulés par des actions partielles et l'absence de heartbeat dans six jeux. La production contient trois parties TTMC actives et six jobs échus à préserver.

L'étape 0 exécutée ensuite a confirmé l'état Supabase en lecture seule et a relevé les advisors sécurité/performance. L'accès Vercel est maintenant exploitable : le projet `thib.fun` de l'équipe `thibaud73000's projects` a été identifié, et son dernier déploiement de production est `READY` sur le même commit que `main`. Le connecteur n'expose toutefois pas l'inventaire des noms de variables ni le réglage d'origine autorisée. Aucun correctif, secret, traitement de donnée ou déploiement ne doit être déduit de ce document.

## Instructions d'exécution pour l'agent

Commencer par [le plan pas à pas](plan-correction-2026-09-13.md), en suivant les étapes 0 à 10 et leurs critères de sortie. Les points d'entrée principaux sont `supabase/migrations/20260909185440_geography_pack_and_rpc.sql` (`server_commit_match`, `claim_due_jobs`, `dispatch_due_jobs`), `src/server/jobs/worker.ts` (`workerJobSchema`), `src/app/api/matches/[matchId]/commands/route.ts`, `src/games/ttmc/engine.ts`, `src/games/trou-noir/engine.ts`, `src/games/geographie/engine.ts`, `src/games/uno/components/uno-match.tsx` et les scripts de contenu indiqués dans D29. Toute migration est additive et créée avec la CLI ; toute action distante passe par le connecteur Supabase ; les changements de production attendent une validation isolée et deux sessions réelles.

## Périmètre, preuves et limites

Lecture croisée des contrats communs, fiches des neuf jeux, pages/composants, routes API, moteurs/projections, worker, chargeurs de contenu, migrations, scripts et tests. Le [diagnostic du 11 septembre](audit-code-2026-09-11.md) a été recontrôlé : plusieurs de ses défauts restent présents et se sont propagés aux nouveaux jeux.

Niveaux de preuve : **production** = inspection distante en lecture seule ; **reproduit** = comportement exécuté localement ou requête SQL planifiée sans écriture ; **code** = chemin défectueux établi par lecture, sans recette complète de ce scénario ; **incomplet** = fonctionnalité prévue mais absente, pas une régression.

Priorités : **P0** = circuit commun de jeu bloqué ; **P1** = partie perdue, résultat faux ou fonctionnalité centrale peu fiable ; **P2** = stabilisation et parcours incomplets.

| Vérification exécutée | Résultat et portée |
|---|---|
| `pnpm test` | 43 fichiers, 330 tests réussis et 2 sentinelles d'échec attendu pour les défauts encore présents. |
| `pnpm typecheck`, `pnpm lint` | Réussis. |
| `pnpm exec next build --webpack` | Réussi ; toutes les routes attendues sont construites. |
| Probes Vitest historiques et contrats versionnés | Les 8 probes initiales ont reproduit 7 défauts/ruptures et une projection UNO fictive ; les contrats de l'étape 1 sont maintenant versionnés et conservent les défauts attendus sans les masquer. |
| Playwright | 10 résultats acceptés (4 scénarios ordinaires et 6 échecs attendus des 3 régressions UNO sur deux navigateurs) ; 16 tests sont ignorés localement : 14 multijoueurs sans `E2E_PASSWORD` et 2 sessions anonymes réservées à la CI Supabase locale. |
| Probes navigateur isolées | Les trois régressions UNO sont versionnées dans `tests/e2e/uno-regressions.spec.ts` et reproduites avec API simulée ; aucun match distant créé ou abandonné. |
| Contenus | Les 5 étapes du script `content:validate` ont réussi dans une copie isolée ; les fichiers SQL générés y sont identiques aux originaux. Validation Géographie en chemin avec espaces : échec `ENOENT` reproduit. |
| Supabase | 21 migrations appliquées, dont les corrections de projections invitées et le Cron. Inspection des jobs, phases, fonctions, permissions et volumes de packs, sans extraire de réponses privées ni de valeurs de secrets. |
| Supabase advisors | Alerte RLS sur 18 tables privées, fonction `SECURITY DEFINER` accessible à `authenticated`, `pg_net` dans `public`, accès anonymes attendus et protection des mots de passe compromis désactivée ; 13 clés étrangères sans index (informations à classer, aucune remédiation exécutée). |
| SQL coopératif | Erreur `42702: column reference "game_slug" is ambiguous` reproduite avec `EXPLAIN`, sans `ANALYZE`, dans une transaction explicitement en lecture seule. |
| Navigateur local | Accueil chargé, rendu visible, aucun avertissement/erreur de console à cette étape. Les erreurs réseau injectées plus tard sont bien apparues comme rejets non gérés. |

Le résultat du build final est consigné dans [progression.md](../progression.md). La suite transactionnelle PostgreSQL n'a pas été exécutée sur une base locale isolée. Les deux sessions réelles de production citées dans l'ancien journal n'ont pas été rejouées ici. Le projet Vercel `thib.fun` et son dernier déploiement de production ont été inspectés en lecture seule : le déploiement `dpl_35YN2mtRFLrgAW7tXWqSs3CcNBc7` est `READY`, cible `production`, et correspond exactement au commit `58eaca94ec35e58ed28fcedab59a0d8b405c8848` de `main`. Le build ne signale qu'un avertissement sur la future évolution automatique de la version Node ; aucun runtime error n'a été remonté par le connecteur. Les noms de variables Vercel et le réglage d'origine autorisée restent non consultables via ce connecteur. La présence de tous les bugs du code local dans le bundle de production n'est donc pas affirmée.

Cet audit couvre les surfaces présentes et identifie des défauts concrets ; il ne garantit pas l'absence de tout autre bug, notamment sous concurrence réelle, lors de l'expiration Auth ou pendant une partie complète de chacun des neuf jeux.

## Ce qui bloque aujourd'hui

### D01 — P0 — Le Cron tourne, mais ne lance aucun worker

**Production + code.** Sur `ttogfwnlknmiscnmlhof`, le job `tibo-fun-dispatch-due-jobs` est actif toutes les secondes et ses dernières exécutions sont `succeeded`. Cependant `vault.secrets` est vide : ni `worker_origin` ni `internal_job_secret` n'existe. Le [dispatcher SQL](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), lignes 569–610, retourne alors `WORKER_CONFIGURATION_MISSING` sans appel HTTP. Un succès Cron signifie ici uniquement que la fonction SQL a répondu.

Trois parties TTMC sont encore `active` : deux en `choose_level`, une en `judging`. Six jobs sont en attente, tous échus depuis le 12 septembre, avec `attempts=0`. L'absence de traitement automatique est donc confirmée. Il faut configurer les deux entrées Vault et la variable serveur correspondante **après avoir corrigé et testé D02–D07**, puis valider le circuit complet et traiter explicitement les anciennes parties bloquées.

### D02 — P0 — Le dispatcher envoie un JSON refusé par le worker

**Production pour le format SQL ; reproduit pour sa validation locale.** `claim_due_jobs` produit `{jobId, matchId, kind, phaseId, payload, leaseToken, runAt}` ; `dispatch_due_jobs` transmet ces objets tels quels. Le [worker](../src/server/jobs/worker.ts), lignes 96–103, exige des objets stricts contenant uniquement `{jobId, leaseToken}`. La [route interne](../src/app/api/internal/jobs/run/route.ts) renvoie donc 400 `INVALID_REQUEST` avant tout traitement si elle reçoit ce lot avec une configuration valide.

La probe du vrai schéma Zod échoue sur `unrecognized_keys`. Corriger le producteur pour n'envoyer que les identifiants de bail ; le worker continuera à relire l'état privé en base. Tester le corps effectivement construit par SQL contre la vraie route, pas une fixture simplifiée différente.

### D03 — P0 — Le jugement TTMC/Trou Noir ne peut pas être committé

**Code, probe moteur et état TTMC distant concordants.** Dans les deux [moteurs quiz](../src/games/ttmc/engine.ts), `SUBMIT_ANSWER` passe à `ctx.nextPhaseId`, mais `judgeJob` conserve `ctx.phaseId`. Le commit SQL rejette ce job avec `STALE_JOB`. Même après correction de la phase, il rejette tout job autre que l'absence si `deadline_at` est nul : or `judging` n'a précisément aucune échéance de réponse.

Le job TTMC en production a effectivement une phase différente du match et une échéance de match nulle. Corriger conjointement le rattachement du job à la tentative et la validation SQL par type de tâche. Un verdict ne doit dépendre que de la tentative toujours en attente, du bail valide et de l'heure de soumission déjà enregistrée. Vérifier exact/alias, IA lente, panne et remplacement, puis passage effectif à `reveal`.

### D04 — P1 — L'expiration du chrono interdit également abandon et forfait

**Code + garde identique vérifiée en production.** Dans [server_commit_match](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql), ligne 1236, toute commande `source=player` est rejetée après `deadline_at`, sans distinguer un coup de jeu de `RESIGN` ou `CLAIM_FORFEIT`. Les moteurs acceptent ces sorties, mais SQL annule leur résultat. Cela explique directement le message « Temps écoulé, validation en cours. » observé dans le journal.

Autoriser les commandes de sortie selon leur propre règle temporelle et conserver le contrôle d'absence de 90 secondes sous verrou. Tester les neuf jeux avant/après échéance, pendant un jugement et avec un worker indisponible. Préserver les interruptions coopératives et les règles d'abandon avant le premier tour.

### D05 — P1 — Certaines actions détruisent le minuteur encore nécessaire

**Code, probes moteur ; annulation globale vérifiée en production.** Le commit, lignes 1285–1290, annule tous les jobs `pending/running`, même si la phase reste la même ; `jobsToCancel` n'est pas exploité. Plusieurs transitions conservent l'échéance mais retournent `jobs: []` : sélection/confirmation de villes, placement/prêt de flotte, premier `NEXT`, résolution de contestation.

Jeux concernés : Géographie, Trou Noir, TTMC, Skyjo, Bataille navale, Compatibilité et Longueur d'onde. Les probes TTMC `NEXT` et navale `RANDOMIZE_FLEET` confirment cette absence de remplacement. Après l'échéance, D04 bloque aussi les actions restantes. Préserver les tâches toujours valides, annuler celles explicitement remplacées et définir les règles d'upsert. Réinsérer le même `dedupe_key` avec `DO NOTHING` ne réactive pas une tâche annulée.

### D06 — P1 — La finalisation des deux jeux coopératifs contient une erreur SQL

**Définitions de production inspectées + erreur SQL reproduite sans écriture.** Les fonctions [record_compat_pair_stats](../supabase/migrations/20260911200000_compatibilite_ready.sql) et [record_longueur_onde_pair_stats](../supabase/migrations/20260911233839_longueur_onde_cooperative_result_triggers.sql) déclarent une variable `game_slug`, puis utilisent `ON CONFLICT (player_low, player_high, game_slug)`. PostgreSQL ne sait pas s'il s'agit de la variable ou de la colonne.

La planification de cette instruction dans le même contexte de variable retourne `42702`. Ce chemin est exécuté au résultat normal **et à l'interruption coopérative** ; il peut donc faire échouer un abandon même sans chrono expiré. Renommer les variables locales avec un préfixe distinct ou utiliser la contrainte nommée. Recetter les finalisations et interruptions des deux jeux dans une vraie transaction isolée, avec deux comptes permanents et avec un invité.

### D07 — P1 — Six jeux ne maintiennent pas la présence

**Code ; UNO reproduit sur Chromium et WebKit.** Seuls Géographie, Trou Noir et TTMC appellent `/api/matches/:id/heartbeat`. UNO, Skyjo, BombParty, Bataille navale, Compatibilité et Longueur d'onde relisent les vues sans envoyer de heartbeat. Le GET ne met pas `last_seen_at` à jour ; seuls les coups acceptés le font alors.

Un joueur peut être déclaré absent alors qu'il attend ou réfléchit devant son écran : forfait possible après 90 secondes, interruption automatique après 120 secondes d'absence des deux ou 180 secondes d'un seul. Partager un mécanisme de présence sur les neuf jeux, refléter l'éligibilité réelle du forfait et vérifier retour mobile/reconnexion. Une fois la partie terminée, arrêter les heartbeats et le polling inutile. Ne pas activer le worker avant cette correction.

### D08 — P1 — Géographie donne la victoire au joueur absent

**Reproduit sur le vrai moteur.** [resignTransition](../src/games/geographie/engine.ts), lignes 505–522, calcule toujours `winner = 1 - actorSeat`. Alice qui réclame un forfait en phase de jeu obtient donc une victoire pour Bob. Les autres moteurs compétitifs distinguent cette action de l'abandon volontaire.

Pour `claimed_forfeit`, choisir le demandeur ; pour `resign`, son adversaire. Garder la préparation comme interruption. Tester les deux sièges, les vues et les résultats réellement enregistrés.

## Transactions, reprise et réseau

### D09 — P1 — La répétition d'une commande acceptée peut être refusée

**Reproduction sur la vraie route avec repository simulé.** La [route des commandes](../src/app/api/matches/[matchId]/commands/route.ts) exécute le moteur avant d'atteindre le reçu SQL. Un `CHOOSE_LEVEL` accepté, puis renvoyé avec le même identifiant après perte de réponse, obtient `WRONG_PHASE` ; le commit n'est appelé qu'une fois. Le même phénomène concerne cartes, réponses, placements et fin de partie.

La lecture SQL du reçu avant le verrou n'est pas revérifiée après attente ; les reçus des salons ne comparent pas systématiquement acteur/type/hash. Les clients recréent un UUID à chaque clic. Lire un reçu autorisé avant réduction, le revérifier sous verrou et conserver un identifiant par intention jusqu'à son issue certaine. Recette : doublons simultanés, réponse perdue, payload modifié et action déjà terminée.

### D10 — P1 — Les jobs épuisés ou mal chargés n'ont pas de sortie fiable

**Code.** [claim_due_jobs et server_fail_job](../supabase/migrations/20260909185440_geography_pack_and_rpc.sql) limitent à cinq tentatives. Un échec HTTP avant entrée dans le worker peut laisser un job `running` avec bail expiré et cinq tentatives, qui ne sera plus réclamé. `server_fail_job` marque sinon `failed` sans finaliser techniquement la partie.

De plus, [getJobContext](../src/server/matches/repository.ts) transforme toute erreur RPC en `JOB_LEASE_INVALID`. Le worker traite ce code comme obsolète et tente une annulation, même s'il s'agissait d'une panne temporaire de base. Distinguer bail invalide, erreur de données et panne réessayable ; prévoir récupération des baux épuisés, alerte et interruption atomique `technical_error`, indépendante du moteur en panne.

### D11 — P1 — Plusieurs parties actives par joueur sont possibles

**Production + code.** Le démarrage verrouille le salon, sans réservation ni verrou commun des deux joueurs. L'unicité existante porte uniquement sur le salon. La lecture distante montre un participant engagé dans trois parties actives et un autre dans deux, sans extraire leurs identités.

Contrôler les engagements sous verrou ordonné des deux joueurs, puis refuser le deuxième démarrage avec lien de reprise. Traiter d'abord les parties déjà bloquées ; ne pas ajouter une contrainte qui échouerait sur cet existant. Tester deux starts concurrents dans des salons différents partageant un joueur.

### D12 — P1 — Une panne réseau laisse les boutons occupés indéfiniment

**UNO reproduit sur les deux navigateurs ; motif répété dans les neuf jeux, salons, configurations, Auth et entraînement.** Les fonctions `send`, `createRoom`, `setReady`, etc. positionnent `busy=true` avant `fetch` sans `try/catch/finally`. Si le POST ou le GET suivant rejette, la remise à `false` n'arrive pas. Attraper l'erreur de `response.json()` ne traite pas une panne réseau.

Après confirmation d'abandon UNO et coupure simulée, le bouton reste désactivé malgré les rafraîchissements ; console : `unhandledRejection: TypeError: Failed to fetch` / `Load failed`. Centraliser l'envoi et les erreurs, toujours libérer l'interface, conserver brouillons/intention et proposer une reprise cohérente avec D09.

### D13 — P2 — Un ancien snapshot peut remplacer un plus récent

**Code.** Les neuf composants appliquent directement `setMatch(next)` et le salon `setRoom(next)`, alors que polling, Realtime et actions peuvent lancer plusieurs GET simultanés. Aucune garde de version ni annulation de requête ancienne ne protège cet ordre.

Cela peut réafficher une ancienne main, un tour passé ou une ancienne question, puis provoquer des conflits. Appliquer les vues avec comparaison atomique de version, gérer le changement de `matchId` et regrouper les relectures. Recetter v11 reçue avant v10, réponse tardive après navigation et reprise après reconnexion. Le polling fournit déjà un rattrapage utile ; la reconnexion Realtime seule n'est pas une garantie suffisante.

### D14 — P1 — Le choix de couleur UNO disparaît tout seul

**Reproduit sur Chromium et WebKit.** [UnoMatch.refresh](../src/games/uno/components/uno-match.tsx), ligne 37, ferme `pendingPlay` dès que la phase n'est pas `after_draw`. Or un joker déjà dans la main se joue depuis `playing`. Le polling de 2,5 secondes ferme donc le dialogue avant que le joueur ait forcément choisi.

Conserver le dialogue tant que la même action reste légale dans la même phase. Fermer si le tour change, la carte disparaît ou l'utilisateur annule. Ajouter gestion du focus et Échap ; ce dialogue ne les gère actuellement pas.

### D15 — P1 — Zoom et déplacement Géographie faussent les marqueurs

**Code, défaut du précédent audit toujours présent.** [projectGeoPoint](../src/games/geographie/map-projection.ts) applique déjà zoom et décalage, puis [GeographyMap](../src/games/geographie/components/geography-map.tsx) dessine ces points dans un `<g>` qui applique à nouveau la même transformation. Avec zoom ×2, un écart au centre est donc multiplié par quatre pour le marqueur, contre deux pour la carte.

Choisir un seul espace de coordonnées et tester l'alignement clic/point/révélation dans le SVG rendu. Autres défauts de cette surface : les flèches changent un `cursor` non dessiné avant Entrée ; un échec de chargement de carte laisse un fond vide sans explication ni reprise. Les tests mathématiques actuels ne couvrent pas ces interactions.

## Résultats, salons et comptes

### D16 — P1 — Certaines interruptions et coopérations sont affichées comme des défaites

**Code.** [FinishedPanel Géographie](../src/games/geographie/components/geography-match.tsx), lignes 113–116, ne traite pas `abandoned`. [La page historique](../src/app/historique/page.tsx) ne traite pas `cooperative` et retombe sur « Défaite », avec deux scores individuels nuls rendus « — – — », au lieu du score partagé.

Rendre le traitement des issues exhaustif, afficher la raison de fin et l'unité du score commun. Tester `win/loss/draw/cooperative/abandoned`, y compris 0 % coopératif et abandon en préparation.

### D17 — P1 — Une jointure de résultat Longueur d'onde utilise le mauvais match

**Définition locale et distante confirmée ; scénario complet non exécuté.** Dans [normalize_longueur_onde_player_result](../supabase/migrations/20260911233839_longueur_onde_cooperative_result_triggers.sql), lignes 22–25, la jointure est `mr.match_id = new.match_id`, sans lien entre `m.id` et `mr.match_id`. Le slug peut provenir d'une autre partie et la normalisation `loss → cooperative` être omise.

Rattacher explicitement la jointure au match courant. De préférence calculer directement toutes les issues dans le commit commun, puis retirer les rustines par jeu lors d'une migration compatible. Tester plusieurs jeux existant avant la finalisation Longueur d'onde.

### D18 — P2 — Les métriques cumulées sont remplacées par celles de la dernière partie

**Code.** Le commit et les triggers de duo utilisent `metrics = metrics || excluded.metrics`. Les clés identiques sont remplacées, alors que les spécifications demandent des sommes et dénominateurs : bonnes réponses, essais, distances, accords/questions comparées, etc.

Les compteurs génériques s'additionnent déjà ; ce constat concerne les métriques détaillées. Définir somme, maximum ou dernière valeur par champ ; calculer les moyennes depuis total/count. Recalculer les agrégats à partir des résultats conservés, sans inventer les données absentes. Vérifier deux parties de longueurs différentes et une interruption.

### D19 — P2 — Les parcours de salon sont incomplets ou incohérents

**Code.** `server_join_room` rejette un salon `playing` avant de vérifier si le demandeur en est déjà membre : revenir par son code après démarrage échoue. `server_set_room_ready` et `server_start_match` omettent le contrôle `expires_at`. Le bouton « ← Salon » navigue vers un lobby qui redirige immédiatement vers `currentMatchId` : il ne permet pas réellement de sortir de la partie.

Définir une reprise explicite pour un membre existant, un contrôle commun d'expiration et un parcours de sortie cohérent. Le transfert d'hôte, quitter en attente, modifier les options ou changer de jeu dans le même salon ne disposent pas des mutations/UI prévues. Les livrer comme fonctionnalités manquantes, pas comme boutons déjà réparés.

### D20 — P2 — L'historique et le profil ne remplissent pas encore les parcours prévus

**Incomplet.** La page historique charge seulement les vingt premières entrées ; elle ignore `nextCursor`, n'offre aucun filtre et n'affiche pas le pseudo adverse pourtant disponible. Le détail API ne renvoie pas les `round_results`, et l'interface renvoie au match plutôt qu'à un détail des manches. Le duo renvoie toutes les confrontations sans curseur.

Le profil est une carte de consultation : pas d'édition pseudo/avatar, d'upload, de statistiques visibles ni de page de profil tiers/duo. Les parcours oubli/nouveau mot de passe et renvoi de confirmation sont absents ; le message de lien expiré demande pourtant un nouvel e-mail. Prévoir pages et endpoints dédiés avec leurs tests d'accès. L'inscription libre et le provisionnement existent ; ils ne sont pas à reconstruire arbitrairement.

## Robustesse, exploitation et contenu

### D21 — P1 avant évolution — Les versions enregistrées ne pilotent pas les parties

**Code.** `MatchSnapshot`/`JobContext` n'exposent pas le manifeste de contenu, les chargeurs choisissent le pack publié courant, et routes/worker importent systématiquement les moteurs actuels. Les versions stockées ne sont pas contrôlées au commit. Une publication peut donc changer la référence d'une question ou rendre son ID introuvable pendant une partie.

Charger les versions exactes du manifeste, conserver les anciens moteurs nécessaires et valider les versions au commit. Tester un match démarré avant publication d'un nouveau pack, puis après déploiement d'une nouvelle version de moteur.

### D22 — P2 — Les nouvelles échéances peuvent consommer du temps avant affichage

**Code.** Le démarrage utilise `Date.now()` du serveur Next plutôt que l'heure de base. Les workers de quiz calculent la nouvelle échéance avec `context.serverNow` lu **avant** l'appel DeepSeek. Une correction de dix secondes retire donc dix secondes à la fenêtre de révélation de douze secondes ; un remplacement peut également perdre du temps de réponse.

Récupérer une heure DB fraîche à la transition ou dériver l'échéance relative au commit, avec contrôle de version. Tester un correcteur artificiellement lent et mesurer le temps réellement disponible après affichage.

### D23 — P2 — Les erreurs utiles sont masquées, et les erreurs internes sont renvoyées en clair

**Code et probe.** [mapServerError](../src/server/http.ts) transforme le message utilisateur inconnu en « erreur serveur », mais renvoie le message original dans `error.code`, y compris une erreur SQL. À l'inverse `getMatchSnapshot`, `getRoomView`, `getJobContext` et l'authentification effacent la cause technique derrière `NOT_FOUND`, bail invalide ou déconnexion.

Séparer codes publics stables et diagnostic interne expurgé, conserver un identifiant de requête et mapper les erreurs métier manquantes (`HOST_REQUIRED`, `PLAYERS_NOT_READY`, etc.). Ajouter les en-têtes privés/no-store contractuels. Ne jamais journaliser état complet, réponse libre ou secret.

### D24 — P2 — La garde de redirection autorise une URL extérieure

**Reproduit par résolution URL locale.** Les deux `safeNext` de [AuthForm](../src/components/auth-form.tsx) et du [callback](../src/app/auth/callback/route.ts) acceptent `/\external.example` : cette chaîne commence par `/`, pas par `//`, mais le parseur URL la résout vers `https://external.example/`.

Valider l'origine après résolution et limiter les destinations aux routes internes nécessaires, avec tests des antislashs et caractères de contrôle. Aucune exfiltration de session n'a été démontrée ; le défaut confirmé est une redirection externe après authentification. La connexion e-mail envoie actuellement vers `/profil`, conformément au changement produit précédent, mais la reprise d'un lien de salon reste à compléter.

### D25 — P1 avant activation fiable des quiz — Préconditions IA et limites absentes

**Code ; noms de variables Vercel non consultables via le connecteur.** Les adaptateurs ont un timeout et deux tentatives par exécution, mais pas de réservation persistante du budget, de plafond journalier effectif, de cache durable ni de comptage des appels entre reprises du worker. Sans clé/modèle, une réponse non exacte produit un remplacement puis éventuellement une interruption ; la création n'en vérifie pas la disponibilité.

Les quotas API et la limite de corps de 8 Ko restent aussi documentaires : les routes analysent le corps entier avant Zod. Définir un précontrôle serveur des quiz, quotas atomiques, budget/tentatives persistantes et lecture bornée. Documenter les vraies variables utilisées : `.env.example` ne liste pas DeepSeek et les documents utilisent des noms de clés Supabase différents de ceux attendus par le code.

### D26 — P2 — Le tirage Géographie difficile manque d'entropie

**Code.** `entropyValues()` fournit 128 valeurs, mais le mélange du pool difficile de 220 communes nécessite 219 valeurs après celle du premier siège. `randomUnit` remplace les valeurs manquantes par zéro. Le worker Géographie passe une liste vide à la préparation automatique.

Le tirage reste partiellement aléatoire, mais son mélange est biaisé et certains choix automatiques déterministes. Utiliser une graine serveur et un générateur reproductible suffisamment alimenté, ou fournir le nombre exact de valeurs ; refuser l'épuisement silencieux. Vérifier également les besoins des grands paquets de cartes.

### D27 — P2 — La désactivation d'un membre n'est pas vérifiée par la politique Broadcast

**Code.** `user_broadcast_receive` vérifie bien le topic privé propre à l'utilisateur, mais pas son admission active. Un compte désactivé peut donc rester éligible aux invalidations de son canal. Le contenu de ces événements est limité à des identifiants/versions : aucune fuite de main ou solution n'a été établie.

Ajouter le contrôle d'admission et tester nouvel abonnement et abonnement déjà ouvert après désactivation. Conserver les protections existantes contre la lecture du canal d'un autre utilisateur.

### D28 — P1 pour la livraison — La suite verte ne valide pas les parcours centraux

**Code + exécutions.** Les sept fichiers E2E de jeu attendent encore `/jeux/geographie` après connexion, alors que l'Auth redirige vers `/profil`. Ils sont ignorés sans identifiants. Le scénario TTMC s'arrête à l'écran de vérification et ne valide ni jugement ni résultat. Aucun E2E Skyjo/Bataille navale n'existe. Aucun workflow GitHub Actions n'est versionné.

Le test SQL attend `count(*) from private.content_items = 380`, sans filtrer le pack ; la base contient maintenant 1 180 items. Ce contrôle échouera sur le schéma complet. Corriger les tests obsolètes et établir une recette intégrée avec base isolée, vrai dispatcher, deux comptes et tiers non participant. La CI doit échouer si les scénarios requis sont ignorés.

### D29 — P2 — Les scripts de validation ne sont pas tous portables ni purement vérificateurs

**Reproduit + code.** Trois scripts Géographie emploient `URL.pathname`, ce qui conserve `%20` dans un chemin avec espaces ; la validation échoue alors avec `ENOENT`. Employer `fileURLToPath`.

`content:validate` appelle aussi les générateurs Compatibilité/Longueur d'onde, qui écrivent à des chemins de migrations déjà appliquées. Dans la copie de cet audit, les contenus étaient identiques et aucun diff SQL n'a été produit ; néanmoins le script réécrit ces fichiers et mélanger validation/génération permettrait de modifier une migration immuable après changement de source. Séparer vérification et génération vers une nouvelle sortie, refuser l'écrasement d'une migration appliquée.

## Observations d'infrastructure relevées pendant l'étape 0

### D30 — P1 de défense en profondeur — Advisor RLS sur 18 tables privées

**Production + advisor, portée effective vérifiée.** `supabase_list_tables` signale `rls_enabled=false` sur 18 tables du schéma `private` et propose de les activer. Une vérification SQL en lecture seule montre que `anon` et `authenticated` n'ont actuellement pas `USAGE` sur `private` et n'ont pas de droit `SELECT` direct sur ces tables ; les migrations révoquent explicitement ces droits et accordent l'accès aux fonctions serveur. L'exposition directe via le Data API n'est donc pas démontrée dans l'état actuel, mais l'absence de RLS resterait une faille de défense en profondeur si un privilège, une vue ou une fonction changeait.

L'advisor propose le SQL suivant, **à ne pas exécuter seul** : sans politiques compatibles, l'activation peut bloquer les accès prévus et ne corrige pas le modèle d'autorisation. Il faut d'abord décider ACL contre RLS, écrire les politiques minimales, tester les rôles et relancer l'advisor.

```sql
ALTER TABLE "private"."site_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."content_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."content_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."room_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."match_players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."command_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."room_command_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."request_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."match_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."job_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."round_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."match_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."player_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private"."pair_game_stats" ENABLE ROW LEVEL SECURITY;
```

### D31 — P2 — Fonction `is_site_member()` signalée comme SECURITY DEFINER

**Advisor + code.** `public.is_site_member()` est `SECURITY DEFINER` et exécutable par `authenticated`, choix utilisé par les politiques RLS publiques pour consulter `private.site_members`. Elle ne renvoie qu'un booléen et son `search_path` est vide ; le risque à trancher est l'appel RPC direct et le sondage d'admission, pas une fuite de la table privée. Vérifier qu'elle n'est pas exposée au-delà des politiques, puis révoquer l'exécution ou la déplacer si le contrat le permet.

### D32 — P2 — Extension `pg_net` installée dans `public`

**Advisor + état distant.** `pg_net` est requise par la fonction de dispatch Cron actuelle mais l'advisor recommande un schéma non public. Évaluer une migration vers un schéma dédié avec les privilèges minimaux, en vérifiant les fonctions `net.http_post` et le job Cron avant toute modification ; ne pas déplacer l'extension pendant le dépannage des jobs.

### D33 — P2 — Politiques anonymes et protection des mots de passe

**Advisor + décision produit.** Les politiques anonymes sur les vues publiques, `games` et Realtime correspondent à l'accès invité prévu. La protection Auth des mots de passe compromis reste désactivée. Décider si l'expérience d'inscription libre doit l'activer, puis tester un mot de passe compromis et un compte invité sans réduire les contrôles d'admission.

### D34 — P2 — Treize clés étrangères sans index couvrant

**Advisor performance.** Treize clés étrangères, notamment dans `matches`, `rooms`, `match_events`, `pair_game_stats` et l'historique public, n'ont pas d'index couvrant. Aucun ralentissement utilisateur n'est mesuré dans cette étape. Ajouter des index de façon additive après lecture des plans et des volumes, puis vérifier les verrous et le coût d'écriture.

### D35 — P2 — Indices actuellement signalés comme inutilisés

**Advisor performance.** Six index n'ont pas encore été utilisés, dont `matches_due_active_idx` et `jobs_running_lease_idx`. Cette observation ne justifie pas leur suppression : les échéances et les jobs sont justement bloqués et n'ont pas encore eu de trafic normal. Rejouer les parcours après correction, mesurer l'usage, puis décider séparément de chaque index.

## Limites produit distinctes des bugs

- Les neuf entrées TS et SQL sont `ready`, mais cela ne prouve pas une partie complète jouable. Un statut de disponibilité doit dépendre d'une recette réelle et des préconditions serveur.
- TTMC contient réellement 22 thèmes/440 questions ; le marathon 50 points est déjà désactivé dans l'UI et refusé par le moteur. **Ce n'est pas un bouton cassé.** Il faut 32 thèmes pour cette configuration.
- Trou Noir contient 120 questions publiées, contre 300 prévues pour le lancement ; TTMC reste sous le seuil global de 600. Les configurations prises en charge peuvent avoir assez de questions pour une partie, mais les exigences de couverture/relecture et le benchmark IA ne sont pas démontrés.
- L'entraînement BombParty est présent, avec blocage serveur pendant une partie active. Sa reprise réseau, les réponses tardives d'une ancienne séquence et le dépassement des 200 mots `usedWords` doivent être traités : le client accumule sans borne alors que l'API refuse au-delà de 200.
- Les invitations admin historiques, la reprise globale d'une partie, le partage de lien complet et les pages de statistiques décrites restent partiels ou absents. Leur livraison vient après la stabilisation, sans la confondre avec une régression.

## Matrice d'impact par jeu

Tous les jeux partagent les défauts de commandes/réseau et d'exploitation signalés ci-dessus.

| Jeu | Actions/parcours particulièrement concernés | Recette indispensable après correction |
|---|---|---|
| Trou Noir | Répondre/juger, contester/accepter, continuer, abandon/forfait | Partie courte entière, réponse exacte puis sémantique, timeout, contestation et historique. |
| TTMC | Choix automatique niveau 1, réponse/jugement, continuer, abandon/forfait | Deux niveaux différents, timeout choix, jugement lent, remplacement, fin à cible/manches. |
| Géographie | Forfait au mauvais gagnant, sélection des villes, premier Suivant, zoom, interruption affichée Défaite | Random + défi, zoom/déplacement/clavier, révélation automatique, deux sièges pour forfait. |
| UNO | Joker refermé, absence de heartbeat, forfait toujours proposé, panne réseau | Joker en main et pioché, attente de plus de trois minutes, fermeture réelle de l'adversaire, fin. |
| Skyjo | Présence, premier Continuer, résolution des tirages | Setup simultané, donne complète, retrait colonne, dernier tour, reprise. |
| BombParty | Présence, délais automatiques, interaction avec entraînement | Mot valide/invalide/doublon, timeout jusqu'à fin, retour d'onglet, entraînement hors match. |
| Bataille navale | Préparation annulant le timer, présence, forfait | Flottes des deux côtés, attente jusqu'à préparation automatique, tir/timeout/dernier coulé. |
| Compatibilité | Présence, premier Continuer, commit final/abandon coopératif, historique | Choix simultanés, passage concurrent, dix questions, 0 % et 100 %, interruption sans défaite. |
| Longueur d'onde | Présence, premier Continuer, commit final, jointure de résultat et historique | Six manches, rôles alternés, deux types de timeout, résultat coopératif et interruption. |

## Plan d'action exécutable

### Lot 1 — Construire une recette qui montre les pannes

Corriger la destination Auth des E2E et le filtrage du test SQL. Préparer une base Supabase isolée avec deux comptes permanents et une session invitée, ainsi qu'un tiers pour les accès interdits. Ajouter les tests de contrat dispatcher/worker, les tests transactionnels de fin/abandon et les régressions navigateur identifiées. Aucun appel réel DeepSeek requis pour cette première étape.

**Sortie attendue :** chaque scénario critique échoue pour sa vraie cause sur le code actuel ; les contrôles nécessaires ne sont plus silencieusement ignorés. Références D02–D09, D12–D17, D28.

### Lot 2 — Réparer la progression, l'abandon et les résultats

Créer les nouvelles migrations avec la CLI : contrat de dispatch minimal, commit distinguant coups/sorties/jugements, préservation des jobs valides, résultat coopératif normalisé, correction des deux triggers ambigus et de la jointure. Corriger `judgeJob` dans les deux quiz et le gagnant du forfait Géographie. Ajouter la gestion des baux/échecs techniques et une heure DB fraîche pour les transitions.

**Sortie attendue :** expiration, réponse/jugement, révélation et abandon aboutissent chacun à une transition unique ; une erreur technique termine proprement sans victoire artificielle. Références D02–D06, D08, D10, D17, D22.

### Lot 3 — Stabiliser présence, commandes et reprise

Partager les fonctions de présence/envoi/rafraîchissement entre les neuf écrans, avec `finally`, conservation des intentions et garde de version. Ajouter le reçu avant calcul et sa revérification sous verrou ; verrouiller les engagements actifs des joueurs. Corriger le dialogue UNO, l'espace de coordonnées Géographie et les issues affichées. Ne pas introduire une reprise automatique de coup sur une nouvelle question sans vérification de phase.

**Sortie attendue :** deux fenêtres ouvertes ne produisent jamais une absence fictive ; perte de réponse, retour mobile et GET désordonné ne perdent ni ne doublent le coup. Références D07, D09, D11–D16.

### Lot 4 — Rétablir le service en production de façon contrôlée

Identifier le bon projet Vercel et vérifier le commit déployé, l'origine, les noms de variables et l'accès au worker. Si la tâche active l'autorise explicitement, appliquer les migrations compatibles via le connecteur Supabase Codex et vérifier leur application ; en cas d'échec du connecteur, fournir à l'utilisateur soit la commande terminal exacte dans un bloc `bash`, soit le SQL exact dans un bloc `sql` pour l'éditeur Supabase, en précisant la destination et en conservant l'erreur exacte, sans passer par GitHub. Livrer ensuite le code compatible. **Configurer Vault et activer le traitement réel seulement après validation des lots 2–3**, car cela réveillera les tâches anciennes et la détection d'absence.

Prévoir un traitement explicite, limité et idempotent des trois parties TTMC bloquées et des engagements multiples, en conservant leurs données et la raison de sortie. Ne pas effacer des parties pour faire disparaître le symptôme. Ajouter un contrôle de santé mesurant une tâche réellement terminée, pas seulement Cron `succeeded`, et des alertes sur les jobs en retard/épuisés.

**Sortie attendue :** partie réelle à deux sessions, délais sans navigateur, résultat unique, reprise des incidents existants et historique cohérent. Référence principale D01 ; dépend de D02–D17.

### Lot 5 — Fermer les défauts de robustesse et de données

Résoudre la redirection externe, distinguer erreurs métier/techniques, activer les quotas et budgets persistants, versionner réellement moteurs/contenus, corriger l'agrégation des métriques et le tirage aléatoire. Aligner documentation/variables, contrôler la disponibilité IA et la couverture des corpus. Rendre les scripts portables, séparer génération et validation, vérifier les politiques d'admission Realtime.

**Sortie attendue :** reprise après publication, limites respectées sous concurrence, erreur publique sans fuite, agrégats recalculables. Références D18, D21, D23–D27, D29–D35.

### Lot 6 — Terminer les parcours annoncés puis valider les neuf jeux

Livrer expiration/reprise/sortie des salons, édition de profil, récupération du compte, filtres/pagination/détail des manches et duo. Ajouter les recettes manquantes Skyjo/navale ; prolonger celles des autres jeux jusqu'au résultat et à l'historique. Couvrir clavier/mobile et les cas limites de l'entraînement. Mettre en place la CI versionnée avec contrôle des scénarios ignorés.

**Sortie attendue :** matrice ci-dessus complétée, aucun jeu déclaré prêt sur la seule présence de son code. Références D19–D20, D28 et limites produit.

## Critères de clôture du chantier

1. Pour chaque jeu et chaque siège : abandon avant/après expiration, forfait indisponible à 89 s puis admissible à 90 s, retour adverse concurrent au forfait, résultat correct des deux côtés.
2. Une partie complète par jeu dans deux sessions indépendantes ; aucun arbitre ou navigateur hôte requis pour traiter les délais.
3. Répétition, concurrence et perte de réponse : une seule mutation et un seul résultat ; refus du même identifiant avec autre contenu.
4. Worker : bon secret/mauvais secret, vrai JSON SQL, bail expiré, cinq échecs, job obsolète, panne IA et reprise contrôlée.
5. Historique, statistiques et duo vérifiés sur victoire, défaite, égalité, coopération et interruption ; confidentialité des invités et du tiers.
6. Build, types, lint, unitaires, SQL isolé et E2E obligatoires réussis ; migrations et état distant vérifiés après livraison autorisée.

Les choix de cadence Cron et de stockage des secrets s'appuient sur les documentations officielles [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) et [Vault](https://supabase.com/docs/guides/database/vault). Le rejet des clés supplémentaires du worker a été vérifié sur le schéma installé et correspond au comportement des [objets stricts Zod](https://zod.dev/api#objects).

La demande d'audit et de plan ne contredit aucune instruction d'AGENTS.md. Les écarts relevés entre code et spécifications ne sont pas de nouvelles décisions produit.
