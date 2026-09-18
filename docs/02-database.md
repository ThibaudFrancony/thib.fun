# Schéma PostgreSQL et permissions

Contrat V1. Générer les migrations lors de l'implémentation avec `supabase migration new`, puis tester sur Supabase local. Cette description est normative ; elle ne prétend pas être une migration déjà appliquée. Utiliser UUID pour identités, `timestamptz` UTC, `bigint` pour versions, `integer` pour scores bornés. JSONB uniquement pour les données variables des moteurs et snapshots, validées par Zod côté serveur avec `stateSchemaVersion`.

## 1. Schémas et conventions

- `public` : petit ensemble de données lisibles avec RLS + RPC serveur explicitement restreintes.
- `private` : tables sensibles, non exposées dans les réglages Data API ; aucun `USAGE` ou droit sur objets à `anon`/`authenticated`.
- `auth`, `storage`, `realtime`, `cron`, `vault`, `net` : schémas gérés par Supabase/extensions ; ne pas recréer leurs tables.
- Toutes les FK sont indexées lorsqu'elles servent aux jointures/recherches ; les PK/composites couvrant déjà un préfixe évitent les doublons.
- Tous les champs sont `NOT NULL` sauf ceux explicitement indiqués `?`. JSON objets ont `CHECK jsonb_typeof(...)='object'` ; compteurs >= 0, tableaux/listes bornés par moteur.
- Les suppressions de compte sont administratives hors V1 ; ne pas cascader une suppression Auth vers l'historique. Préférer désactivation/anonymisation. FK utilisateurs `ON DELETE RESTRICT`.

## 2. Identités et accès

### `public.profiles`

`id uuid PK FK auth.users.id`, `pseudo text` (2–24 caractères après trim, lettres/chiffres/espace/underscore/tiret), `pseudo_key text UNIQUE` (normalisé casse et espaces, accents conservés), `avatar_path text?`, `avatar_preset text DEFAULT 'orbit-1'`, `created_at`, `updated_at`.

Ne pas stocker e-mail dans cette table lisible. Un avatar personnalisé et un preset sont autorisés dans le schéma ; si `avatar_path` est renseigné il prime. Mise à jour uniquement via API serveur, qui impose que l'acteur modifie son profil. Au signup libre, le profil minimal et l’admission sont provisionnés côté serveur à partir de l’identité Auth ; les métadonnées éventuelles ne servent jamais à une décision d’autorisation.

### `private.site_members`

`user_id uuid PK FK auth.users.id`, `role text CHECK IN ('member','admin')`, `status text CHECK IN ('active','disabled')`, `created_at`.

Source de vérité de l'admission. Ne jamais utiliser `user_metadata` pour autoriser admin/admission. Fonction helper `public.is_site_member()` sans paramètre utilisateur : renvoie seulement si `auth.uid()` est actif. Exception justifiée `SECURITY DEFINER` avec `search_path=''`, noms qualifiés, propriétaire dédié minimal ; retirer EXECUTE de PUBLIC/anon, accorder authenticated. Elle ne renvoie ni rôle ni liste d'utilisateurs. Utilisée dans les politiques RLS ; tester séparément.

Les sessions invitées utilisent un utilisateur Auth anonyme (`auth.users.is_anonymous=true`) avec un profil minimal et une admission active générés côté serveur. Elles peuvent participer aux salons et parties, mais les écritures d'historique, de statistiques du joueur et d'agrégats de duo persistants sont supprimées par la politique métier et les protections RLS dès qu'un invité est concerné. Le pseudo invité est aléatoire, unique et stable pendant la session navigateur.

### `private.invitations`

`id uuid PK`, `token_hash text UNIQUE`, `email_key text?`, `created_by uuid FK profiles`, `expires_at`, `max_uses integer DEFAULT 1 CHECK 1..10`, `used_count integer DEFAULT 0`, `revoked_at timestamptz?`, `created_at`. CHECK `used_count<=max_uses`.

Token aléatoire 32 octets URL-safe ; seul SHA-256 conservé. Les invitations peuvent rester disponibles pour des usages historiques/admin, mais elles ne sont plus nécessaires : à l’inscription Auth, le trigger serveur crée le membre et le profil minimal ; un compte Auth non admis ne voit aucune donnée métier. Premier admin initialisé par opération serveur documentée à partir de son UUID Auth vérifié, pas par « premier inscrit » public.

## 3. Salons et parties

### `private.rooms`

`id uuid PK`, `code text UNIQUE` (6 caractères alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), `host_id uuid FK profiles`, `game_slug text FK public.games` (**nullable** : un salon d'accueil peut exister avant le choix du jeu), `config jsonb`, `status text CHECK IN ('waiting','playing','closed')`, `version bigint DEFAULT 0`, `current_match_id uuid?`, `created_at`, `updated_at`, `expires_at`.

Code généré serveur avec retry sur collision. Durée d'un salon sans partie active : 24 h après dernière activité significative ; jamais fermer une partie active sur cette échéance. `current_match_id` FK ajoutée après création de matches pour résoudre le cycle. Ne pas réutiliser un code existant, même fermé. Changement jeu/config seulement en attente ; remet tous les ready à false.

### `private.room_members`

`room_id uuid FK rooms`, `user_id uuid FK profiles`, `seat smallint CHECK IN (0,1)`, `ready boolean DEFAULT false`, `joined_at`, `last_seen_at`, PK `(room_id,user_id)`, UNIQUE `(room_id,seat)`.

Unicité des sièges impose deux membres maximum. Création/join/start sous verrou de la ligne room. Membres conservés tant que salon ouvert ; en partie ils ne changent pas. Quitter en attente retire la ligne ; hôte sortant transfère à l'autre, ou ferme si vide. Quitter en partie applique la règle d'abandon avant sortie du salon.

### `public.games`

`slug text PK`, `display_name text`, `description text`, `priority smallint`, `kind text CHECK IN ('competitive','cooperative')`, `availability text CHECK IN ('coming_soon','beta','ready')`, `rules_version text`, `created_at`.

Seed des neuf slugs du AGENTS. Métadonnées du registre TS vérifiées contre cette table en CI ; ne pas autoriser le client à modifier la disponibilité. Les catégories coopératives comprennent compatibilité et longueur-onde.

### `private.matches`

`id uuid PK`, `room_id uuid FK rooms`, `game_slug text FK games`, `status text CHECK IN ('active','completed','abandoned')`, `mode text`, `config jsonb`, `rules_version text`, `engine_version text`, `state_schema_version integer`, `content_manifest jsonb`, `state jsonb`, `version bigint DEFAULT 0`, `phase_id uuid`, `deadline_at timestamptz?`, `deadline_kind text?`, `started_at`, `ended_at timestamptz?`, `end_reason text?`, `created_at`.

Index UNIQUE partiel `(room_id) WHERE status='active'`. Index `(status,deadline_at) WHERE status='active' AND deadline_at IS NOT NULL`. Deadline principale dans cette table pour empêcher les actions tardives ; d'autres échéances non bloquantes (contestation/absence) existent dans jobs. `deadline_kind` et `deadline_at` nuls ensemble. Fin implique ended_at ; active implique ended_at nul. État complet contient l'ordre des cartes, réponses et positions cachées : aucune lecture navigateur.

### `private.match_players`

`match_id uuid FK matches`, `user_id uuid FK profiles`, `seat smallint CHECK IN (0,1)`, `pseudo_snapshot text`, `avatar_snapshot jsonb`, `last_seen_at`, PK `(match_id,user_id)`, UNIQUE `(match_id,seat)`.

Deux lignes créées atomiquement au start. Une fonction start refuse 0/1/3 joueurs et un utilisateur déjà dans une autre partie active. Verrouiller les deux profils dans l'ordre UUID au démarrage pour éviter les doubles starts intersalons. Les pseudos historiques ne changent pas quand le profil est renommé.

### Projections `public.room_views` et `public.match_views`

`room_views` : `room_id uuid FK rooms`, `viewer_id uuid FK profiles`, `version bigint`, `payload jsonb`, `updated_at`, PK `(room_id,viewer_id)`.

`match_views` : `match_id uuid FK matches`, `viewer_id uuid FK profiles`, `version bigint`, `payload jsonb`, `updated_at`, PK `(match_id,viewer_id)`.

Index `(viewer_id,updated_at DESC)` sur chaque table. Une ligne par participant. Projection whitelist, jamais suppression opportuniste de clés d'un état complet. Les projections restent disponibles aux participants après fin ; les résumés d'historique sont indépendants. Retirer la room_view d'un joueur qui quitte le salon ; match_view historique conservée pour un participant légitime.

## 4. Commandes, jobs et IA

### `private.command_receipts`

`match_id uuid FK matches`, `command_id uuid`, `actor_id uuid FK profiles`, `action_type text`, `payload_hash text`, `committed_version bigint`, `response jsonb` (réponse filtrée de l'acteur), `created_at`, PK `(match_id,command_id)`.

Pour les mutations de salon, table équivalente `private.room_command_receipts` avec room_id ; pour create/join/invitation, `private.request_receipts(actor_id,request_id PK composite,route,payload_hash,response,created_at)`. Les reçus ne sont pas effacés pendant une partie. Conserver 30 jours pour retry ; le journal/résultat reste durable.

### `private.match_events`

`id bigint GENERATED ALWAYS AS IDENTITY PK`, `match_id uuid FK matches`, `version bigint`, `event_type text`, `actor_id uuid?`, `payload jsonb`, `created_at`, UNIQUE `(match_id,version)`.

Un événement agrégé par transition ; les détails multiples sont dans payload. Journal privé de diagnostic, pas stream public et pas contrat de replay complet. Peut contenir des secrets ; purge des payloads détaillés après 30 jours. Ne jamais logger leur contenu dans Vercel.

### `private.jobs`

`id uuid PK`, `match_id uuid? FK matches`, `kind text`, `phase_id uuid?`, `dedupe_key text UNIQUE`, `payload jsonb`, `run_at timestamptz`, `status text CHECK IN ('pending','running','done','cancelled','failed') DEFAULT 'pending'`, `attempts integer DEFAULT 0`, `lease_token uuid?`, `lease_until timestamptz?`, `last_error_code text?`, `created_at`, `completed_at timestamptz?`.

Index partiel `(run_at) WHERE status='pending'`, `(lease_until) WHERE status='running'`, `(match_id,status)`. Clé deadline `matchId:phaseId:kind` ; clé judge `matchId:attemptId:judge:v1`. Les anciens jobs sont annulés au commit de changement de phase. Conserver les jobs finaux 30 jours ; les tentatives IA agrégées restent dans métriques.

### `private.job_receipts`

`job_id uuid PK FK jobs`, `payload_hash text`, `committed_version bigint`, `response jsonb`, `created_at`. Reçus d'événements système, distincts de command_receipts qui exige un acteur humain. Insérer dans le même commit que la transition et clôture du job ; replay du même job renvoie son reçu sans réappliquer le résultat. Les jobs de surveillance récurrents ont un nouvel ID par exécution planifiée.

### `private.quiz_attempts`

`id uuid PK`, `match_id uuid FK matches`, `player_id uuid FK profiles`, `phase_id uuid`, `question_revision_id uuid FK content_items`, `raw_answer text CHECK length<=240`, `normalized_answer text`, `status text CHECK IN ('pending','accepted','rejected','ambiguous','void')`, `method text? CHECK IN ('exact','alias','numeric','llm','opponent','timeout')`, `reason_code text?`, `submitted_at`, `resolved_at timestamptz?`, `model_id text?`, `prompt_version text?`, `input_tokens integer?`, `output_tokens integer?`, `latency_ms integer?`, UNIQUE `(match_id,phase_id,player_id)`.

Un remplacement utilise un nouveau phase_id. L'action contestation ajoute un événement, met à jour method et résultat avant passage de tour ; pas de réécriture après clôture de la fenêtre.

### `private.judgment_cache`

`cache_key text PK` (SHA-256 de révision question + réponse normalisée + version prompt + modèle + politique), `verdict jsonb`, `created_at`, `expires_at`. TTL 30 jours. Seulement verdicts valides accept/reject, pas d'ambiguïté, pas d'acceptation manuelle. Données privées ; le cache n'est pas une nouvelle liste d'alias de confiance.

### `private.rate_limits` et `private.ai_usage_daily`

`rate_limits` : `key text PK`, `window_started_at timestamptz`, `count integer CHECK count>=0`. Clé combine opération/acteur ou IP hashée et granularité de fenêtre. Incrément/renouvellement atomique sous verrou dans `server_check_rate_limit`, heure DB. Un rejet ne renouvelle pas la fenêtre ; conserver maximum 48 h. IP hashée avec sel serveur rotatif quotidien, aucune IP brute dans les tables métier.

`ai_usage_daily` : `day date`, `provider text`, `model_id text`, `calls integer`, `input_tokens bigint`, `output_tokens bigint`, `estimated_cost_usd numeric(14,6)`, `reserved_cost_usd numeric(14,6)`, `price_revision text`, PK `(day,provider,model_id)`. Jour UTC. Réserver atomiquement un coût maximal par tentative avant l'appel, réconcilier coût réellement rapporté après appel ; expiration des réservations échouées via job et clé tentative unique. Ne pas lancer 100 appels concurrents au-delà du budget parce que le compteur n'est mis à jour qu'après. Si tarif/usage indisponible, plafond de 1000 appels/jour par défaut et alerte d'estimation indisponible ; aucune valeur de prix inventée.

`private.ai_calls` : `id uuid PK`, `attempt_id uuid FK quiz_attempts`, `call_no smallint CHECK IN (1,2)`, `provider text`, `model_id text`, `status text CHECK IN ('reserved','completed','failed','unknown')`, `reserved_cost_usd numeric(14,6)`, `actual_cost_usd numeric(14,6)?`, `input_tokens integer?`, `output_tokens integer?`, `reserved_at`, `expires_at`, `settled_at timestamptz?`, UNIQUE `(attempt_id,call_no)`. Index `(expires_at) WHERE status='reserved'`. Réservation et cumul journalier dans la même transaction, settle unique. Un appel dont l'issue/coût est inconnu conserve par prudence son estimation maximale en coût consommé, libère la réserve sans prétendre coût nul. Le budget de deux appels s'applique même après reprise d'un worker, grâce à ces deux slots persistants.

## 5. Contenus

### `private.content_packs`

`id uuid PK`, `kind text CHECK IN ('quiz','geography','words','compatibility','spectrums')`, `slug text`, `version integer`, `status text CHECK IN ('draft','published','retired')`, `manifest jsonb` (source, licence, auteur, checksum, compte et validation), `created_at`, `published_at timestamptz?`, UNIQUE `(kind,slug,version)`.

### `private.content_items`

`id uuid PK` = ID de révision immuable ; `pack_id uuid FK packs`, `logical_key text`, `category text?`, `difficulty smallint?`, `payload jsonb`, `created_at`, UNIQUE `(pack_id,logical_key)` ; index `(pack_id,category,difficulty)`.

Publication rend pack/items immuables. Nouvelle version pour correction, anciennes référencées par historique. Manifest de match liste packs + IDs des items utilisés/prévus. Les formats payload exacts sont dans le document contenu et les jeux. Les fichiers lexicaux volumineux peuvent être stockés en bucket privé `content-packs` avec checksum ; la table conserve chemin et version. Pas de million de mots dans un JSONB de match.

## 6. Résultats, historique et statistiques

### `private.match_results`

`match_id uuid PK FK matches`, `kind text CHECK IN ('competitive','cooperative')`, `outcome text CHECK IN ('win','draw','cooperative','abandoned')`, `winner_id uuid? FK profiles`, `shared_score numeric?`, `summary jsonb`, `reason text`, `completed_at`.

CHECK winner non nul si outcome win et nul autrement ; shared_score seulement coopération. Résultat créé aussi pour abandoned afin d'afficher l'interruption, mais exclu des compteurs de parties terminées.

### `private.player_results`

`match_id uuid FK results`, `user_id uuid FK profiles`, `outcome text CHECK IN ('win','loss','draw','cooperative','abandoned')`, `score numeric?`, `metrics jsonb`, PK `(match_id,user_id)` ; index `(user_id,match_id)`.

Score garde son unité propre : points quiz, km/points geo via metrics, points cartes (plus petit meilleur), vies/words BombParty. Aucune somme globale de scores de jeux différents.

### `private.round_results`

`match_id uuid FK matches`, `round_no integer`, `summary jsonb`, `completed_at`, PK `(match_id,round_no)`. Les fiches définissent la granularité : manche à deux tours de quiz, ville de géographie, donne de cartes, question de compatibilité. Les événements privés gardent les détails intermédiaires.

### `public.history_entries`

`viewer_id uuid FK profiles`, `match_id uuid FK matches`, `opponent_id uuid FK profiles`, `game_slug text`, `started_at`, `ended_at`, `outcome text`, `score numeric?`, `opponent_score numeric?`, `shared_score numeric?`, `payload jsonb` (pseudos snapshots, résumé safe, metrics autorisées), PK `(viewer_id,match_id)`.

Index `(viewer_id,ended_at DESC,match_id DESC)`, `(viewer_id,opponent_id,game_slug,ended_at DESC)`. Créées par finalisation, une par joueur, dans la même transaction que le résultat. Historique uniquement accessible au viewer.

### `public.player_game_stats`

`user_id uuid FK profiles`, `game_slug text FK games`, `played integer DEFAULT 0`, `wins integer DEFAULT 0`, `losses integer DEFAULT 0`, `draws integer DEFAULT 0`, `cooperative integer DEFAULT 0`, `abandoned integer DEFAULT 0`, `metrics jsonb`, `updated_at`, PK `(user_id,game_slug)`.

CHECK `played=wins+losses+draws+cooperative`. `abandoned` distinct, non inclus dans played. Les abandons volontaires et les absences compétitives comptent win/loss (le joueur parti perd). `metrics` est défini par chaque jeu ; pour les moyennes conserver total + count, calculer l'arrondi à la lecture. Les statistiques globales sont la somme de ces compteurs, pas une deuxième table pouvant diverger.

### `private.pair_game_stats`

`player_low uuid FK profiles`, `player_high uuid FK profiles`, `game_slug text`, `played integer`, `low_wins integer`, `high_wins integer`, `draws integer`, `cooperative integer`, `abandoned integer`, `metrics jsonb`, `updated_at`, PK `(player_low,player_high,game_slug)`, CHECK `player_low<player_high` et somme conforme à played.

Tri UUID canonique, pas ordre de salon. API duo autorise uniquement si l'acteur est un des deux. Vue dérivée choisit correctement « tes victoires ». Index supplémentaire `(player_high,game_slug)` pour recherche. Aucun classement global V1.

## 7. Permissions exactes

Toutes les tables public : activer RLS, révoquer INSERT/UPDATE/DELETE de anon/authenticated, accorder SELECT uniquement selon tableau. Pas de policy `FOR ALL USING(true)`.

| Table | SELECT authenticated |
|---|---|
| profiles | `is_site_member()` ; champs publics seulement |
| games | `is_site_member()` |
| room_views, match_views | `is_site_member() AND viewer_id=auth.uid()` |
| history_entries | même filtre viewer |
| player_game_stats | `is_site_member()` ; stats agrégées de membres, jamais historique tiers |

`anon` ne lit aucune donnée métier. Les pages de connexion sont publiques, leur contenu vient du code statique. Les RPC serveur exposées dans public sont `SECURITY INVOKER` ou, pour le provisionnement interne strictement nécessaire, `SECURITY DEFINER` avec `search_path=''`, noms qualifiés, EXECUTE révoqué de PUBLIC/anon/authenticated et accordé au seul `service_role` effectif de la clé secrète serveur. Ce rôle reçoit USAGE privé et les droits nécessaires. Le serveur vérifie admission et acteur pour chaque opération ; le fait de posséder une clé serveur contourne RLS, donc aucun p_actor venant du body client.

Pour Realtime : canal `user:<auth.uid()>`, privé. Politique SELECT sur `realtime.messages` limitée à ce topic, extension broadcast et membre actif. Pas de droit d'envoyer des événements métier aux clients. Presence peut être ajouté au topic `presence:room:<roomId>` avec vérification d'appartenance par helper restreint ; **V1 utilise les heartbeats persistants et projections pour éviter ce second canal**. Ne pas confondre signal présence avec droit de jouer.

Storage : bucket `avatars` privé, lecture signée via serveur pour membres, URL valable 1 h ; upload par API serveur uniquement, clé `userId/randomUUID.webp`. Bucket `content-packs` privé serveur uniquement. Contrôler fichiers réels (décodage/réencodage), taille et dimensions ; pas de SVG utilisateur.

## 8. RPC à implémenter

Toutes les RPC `server_*` suivantes sont exécutables uniquement par rôle serveur ; inputs SQL typés et JSON validés en amont. Elles retournent codes structurés, aucune chaîne SQL construite avec entrées utilisateur.

| RPC | Contrat |
|---|---|
| `server_provision_account(actor, pseudo?)` | provisionnement/rattrapage idempotent du profil et de l’admission du compte Auth courant |
| `server_create_room(actor, requestId, slug, config)` | membre actif, limite salons, code unique, siège 0 + projection + reçu |
| `server_create_lobby(actor, requestId)` | salon d'accueil sans jeu (`game_slug` null) ; renvoie le salon générique actif existant du membre au lieu d'en créer un second, code unique, siège 0 + projection + reçu |
| `server_get_active_lobby(actor)` | salon générique actif d'un membre (`waiting`, `game_slug is null`, non expiré) ; même forme que `server_get_room` (viewerId, hostId, expiresAt), `null` sinon |
| `server_prepare_lobby_match(actor, commandId, roomVersion, slug, config)` | hôte seul, salon complet et en attente : pose le jeu et la configuration, marque les deux joueurs prêts de façon atomique, puis la route serveur lance la partie habituelle |
| `server_join_room(actor, requestId, code)` | verrou salon, existe/en attente/non expiré, place, join idempotent |
| `server_change_room(actor, commandId, expectedVersion, action)` | ready/config/leave/rematch, droits hôte, projections atomiques |
| `server_start_match(actor, commandId, roomVersion, initialState, projections, jobs, manifest)` | verrou room/profils, 2 ready, aucun match actif, versions/contenu compatibles, création tout ou rien |
| `server_load_match(actor, matchId)` | admission/appartenance, état privé + version + dbNow pour serveur uniquement |
| `server_commit_match(actor?, commandId, expectedVersion, transition, jobToken?)` | verrou match, reçu avant deadline/version, contrôles, commit moteur + projections + jobs + événements + résultats |
| `server_heartbeat(actor, roomId, matchId?)` | appartenance, actualise last_seen, retourne dbNow, sans changer version jeu |
| `server_get_pair_history(actor, otherId, cursor, game?)` | agrégats et historique partagés filtrés |
| `server_get_job_context(jobId, leaseToken)` | vérifier token/bail, accès worker, charger contexte et heure DB |
| `server_finish_job(jobId, leaseToken, outcome, errorCode?)` | done/cancelled ou retry/failed ; jeton de bail vérifié, aucune mutation de score autonome |
| `server_content_read(kind, packIds, filters)` | corpus privé/manifest pour serveur seulement ; filtres bornés et versions publiées |
| `server_attempt_and_cache(operation, arguments)` | lecture cache/tentative et métriques IA ; mutations de résultat incluses au commit du match |
| `server_check_rate_limit(actor, operation, ipHash?)` | incrément atomique des fenêtres et renvoi allowed/retryAfter |
| `server_reserve_ai_usage` / `server_settle_ai_usage` | réservation par tentative et réconciliation idempotente de consommation |
| `server_admin_invitation(actor, operation, arguments)` | admin vérifié en DB, création/révocation/listage sans exposer les hashes |

Ces RPC sont l'accès aux tables privées depuis le SDK Supabase : **ne pas utiliser `.schema('private')` via une Data API qui n'expose pas ce schéma**. Le repository serveur encapsule les RPC et ne retourne jamais leurs objets complets à un navigateur. Les lectures de projections publiques peuvent utiliser le client à session utilisateur, dont RLS assure le filtrage.

Les RPC de commit revalident les permissions et le statut après verrouillage. Les workers possèdent un contexte système distinct : seuls types d'événements système autorisés, job existant et bail valide, pas d'acteur arbitraire.

Finalisation : sous verrou match, insertion `match_results ON CONFLICT` contrôlée ; si déjà finalisé, retourner résultat sans incrémenter stats. Sinon insérer player_results/history, mettre à jour stats et pair stats dans ordre stable, annuler jobs, clôturer match, salon revient waiting et tous ready=false. Un retry n'incrémente rien.

## 9. Recette SQL minimale

Tester avec clients anon, membre A, B participant, C membre tiers et clé serveur : C ne lit aucune projection/histoire A/B ; A ne peut écrire ni scores ni RPC serveur ; contenu/états cachés inaccessibles ; accès désactivé refusé ; les index soutiennent les filtres. Tester joins simultanés au dernier siège, deux starts, double commit, double finalisation et job ancien. Générer les types TS après migrations et vérifier qu'un reset local produit le même schéma. Auditeurs Supabase sans anomalies non justifiées avant livraison.

## 10. Ordre de migrations et dimensions

Ordre conseillé, chaque fichier créé par CLI et jamais renommé après déploiement : (1) private/permissions/profiles/site_members/invitations ; (2) games et packs/items ; (3) rooms/members puis matches/players et ajout FK current_match ; (4) projections et RLS ; (5) reçus/événements/jobs/quiz/cache/usage/rate limits ; (6) résultats/historique/stats ; (7) helpers et RPC après existence des tables ; (8) triggers Broadcast et Storage ; (9) extensions et fonctions Cron/Vault/pg_net configurées sans secrets dans Git ; (10) seeds métadonnées. Les fichiers de fixture joueurs utilisent Auth local, jamais identifiants de production.

Défauts de dimensions : 2 salons waiting maximum par hôte, 1 match actif par joueur, 2 joueurs/partie, état privé max 1 Mo vérifié serveur, projection max 128 Ko, jobs batch 4. À l'approche de ces tailles, tronquer seulement les journaux affichés (les détails restent dans round_results), jamais une carte/position nécessaire au moteur. Contrôler le JSON entier avant commit et retourner incident explicite en cas de violation ; aucune écriture partielle. L'historique long est paginé, pas recopié intégralement dans toutes les projections de chaque tour.
