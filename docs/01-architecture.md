# Architecture d'implémentation

Lire aussi [SQL](02-database.md), [API](03-api-realtime.md) et la fiche du jeu. Architecture V1 normative ; ne pas choisir un second système de persistance par jeu.

## 1. Stack et structure

Next.js App Router en TypeScript strict, runtime Node.js sur Vercel, React pour l'UI, Tailwind CSS. pnpm avec version épinglée dans `packageManager`, dépendances exactes, lockfile committé. Choisir la version stable compatible au bootstrap, consigner les versions réelles dans le README. Supabase JS et la bibliothèque SSR officielle compatible pour les cookies Auth ; valider la session côté serveur selon la documentation actuelle. Ne pas faire confiance au seul contenu d'un cookie décodé.

Utiliser Supabase JS pour RPC et Storage ; pas d'ORM V1. Zod pour entrées, états et sorties IA. Vitest pour moteurs ; Playwright pour parcours à deux. La carte de France utilisera un SVG projeté avec d3-geo, sans fournisseur de tuiles affichant les noms de villes. Pas de dépendance cartographique lourde pour les autres jeux.

```text
src/
  app/                         # routes publiques, privées, API
  components/                  # boutons, shell, timer, avatars, dialogues
  features/{auth,lobby,profile,history}/
  games/
    registry.ts                # métadonnées publiques seulement
    server-registry.ts         # imports server-only des moteurs
    contracts.ts
    <slug>/
      config.ts                # défauts, options autorisées
      schemas.ts               # unions discriminées état/action/vue
      engine.server.ts         # règles pures
      projection.server.ts     # whitelist par spectateur
      scoring.server.ts
      content.server.ts        # lecture corpus, si nécessaire
      components/              # UI spécifique
      tests/                   # moteur, projections, fixtures
  server/
    auth/, supabase/, matches/, rooms/, jobs/, ai/, content/
  lib/                         # formatage et utilitaires non secrets
supabase/{migrations,tests,seed.sql,config.toml}
content/{quiz,geography,words,compatibility,spectrums}/
scripts/                       # imports/validation, jamais clés
tests/e2e/
docs/
```

Pas de code Node/Supabase privilégié importé indirectement par le registre public. Marquer les modules sensibles `server-only`. Les données du dictionnaire d'entraînement peuvent être publiques ; solutions quiz et coordonnées complètes restent côté serveur.

## 2. Frontière de confiance

Le navigateur affiche une projection, collecte une intention et reçoit le résultat. Les API Node authentifient, autorisent, valident, exécutent le moteur. PostgreSQL effectue le commit atomique. Supabase Realtime envoie ensuite une invalidation privée permettant de relire la projection.

Les moteurs sont des fonctions pures : aucun appel réseau, aucune écriture, aucune lecture de l'horloge système ou aléatoire implicite. Forme cible :

```ts
type EngineContext = {
  nowMs: number;                // heure fournie par PostgreSQL
  actorId: string | null;       // null seulement pour événements système
  participants: readonly [string, string];
  content: ResolvedContent;     // version et identifiants fixés
  entropy: readonly number[];   // octets/valeurs serveur persistés si consommés
};
type Transition<S> = {
  state: S;
  deadlines: DeadlineSpec[];
  jobs: JobSpec[];
  roundRecords: RoundRecord[];
  result: ResultSpec | null;
};
interface GameEngine<S, A, V> {
  initialize(config: unknown, ctx: EngineContext): Transition<S>;
  reduce(state: S, action: A, ctx: EngineContext): Transition<S>;
  onDeadline(state: S, kind: string, ctx: EngineContext): Transition<S>;
  project(state: S, viewerId: string): V;
}
```

Les types `ResolvedContent`/actions/états sont des unions propres aux jeux, jamais `any`. Chaque moteur expose `engineVersion`, `rulesVersion`, `stateSchemaVersion`. Le serveur choisit le moteur correspondant à la partie ; conserver une version tant que des parties actives l'utilisent. Une migration explicite d'état peut remplacer cette compatibilité, avec tests.

Les mélanges sont réalisés avec une source cryptographique serveur et Fisher–Yates. La pioche résultante est conservée dans l'état privé ; pas besoin de publier la graine. Les tests injectent un ordre déterministe. Le tirage des contenus est fait au début, y compris réserves de remplacement, et persiste ses IDs/versions. Aucun nouveau tirage en cas de simple relecture ou retry.

## 3. Commande et commit

1. Authentifier et vérifier compte Auth actif/admis ; déduire `actorId` (l’admission est provisionnée automatiquement à l’inscription, sans invitation).
2. Valider taille, schéma, limites et appartenance ; lire état privé + version + heure DB via RPC serveur.
3. Répondre immédiatement depuis le reçu si le même `commandId` est déjà enregistré et le même contenu métier correspond.
4. Exécuter le moteur et construire les deux projections.
5. Appeler `server_commit_match` avec version attendue, acteur authentifié, commande, prochain état, projections, tâches et éventuel résultat.
6. La RPC verrouille la ligne partie ; vérifie idempotence, appartenance, version et échéance à l'heure DB après verrouillage ; écrit tous les éléments dans une seule transaction.
7. Les triggers des projections émettent uniquement `{resourceId, version}` sur le canal individuel concerné après commit.

Une collision de version retourne `VERSION_CONFLICT`, sans reçu consommé. Recharger et réévaluer une fois l'intention sur l'état courant ; si elle n'est plus légale, répondre conflit avec snapshot. Ne pas rejouer une action différente automatiquement. L'empreinte d'idempotence couvre type/payload/match/acteur, pas `expectedVersion`, afin qu'un retry identique après conflit reste possible. Le reçu existe uniquement pour une commande réellement appliquée.

La RPC reçoit un état calculé par un serveur de confiance ; les clients n'ont pas le droit de l'appeler. Le calcul des règles reste en TypeScript, pas dupliqué dans les triggers. Les contraintes DB garantissent cardinalité, transitions de statut, intégrité, version et unicité des résultats. Un commit normal incrémente la version de 1. Heartbeats et signaux éphémères n'incrémentent pas cette version.

## 4. Tâches durables et horloges

Tous les tours limités enregistrent `phaseId` unique et `deadlineAt` UTC. Les jobs expirés se traitent même si les deux onglets sont fermés. Mise en œuvre retenue :

- Supabase Cron appelle `private.dispatch_due_jobs()` chaque seconde.
- Cette fonction sélectionne au maximum 4 jobs arrivés à échéance, `FOR UPDATE SKIP LOCKED`, dont le bail est libre/expiré ; génère un `leaseToken`, réserve 30 s, incrémente `attempts`.
- S'il n'y a aucun job, aucun HTTP n'est émis. Sinon un seul `pg_net.http_post` appelle `/api/internal/jobs/run` sur Vercel avec IDs/tokens et un secret partagé conservé dans Vault et Vercel.
- Le worker vérifie secret, charge les jobs en vérifiant leurs baux, exécute au maximum 4 jobs en parallèle et attend leur terminaison dans la requête. Budget worker 20 s ; configuration fonction 60 s et timeout HTTP 25 s, à vérifier avec les limites du plan réel.
- Le commit système vérifie encore token, version, phase, statut et échéance. Un job ancien devient `cancelled` sans effet. Un crash laisse expirer le bail, puis le Cron relance. Backoff des erreurs transitoires 1/2/4/8 s, maximum 5 tentatives ; au-delà, marquer l'incident et annuler proprement la partie affectée, sans victoire technique.
- Un job de correction IA doit produire une solution de repli dans son budget, pas relancer indéfiniment le modèle. Voir document IA.

Cron sert de réveil approximatif, **pas de source de précision du chrono**. La DB rejette toute réponse reçue au commit à ou après la fin, même si le worker n'a pas encore affiché l'expiration. Cible de recette : transition d'expiration visible sous 2 s en usage normal, pas une garantie contractuelle. Mesurer à Paris avec fonctions/base dans des régions européennes proches. Le navigateur peut afficher « Temps écoulé, validation… » pendant ce délai.

Lors d'une action reçue sur une phase déjà expirée, répondre `DEADLINE_EXPIRED` et demander la mise en traitement du job existant de manière idempotente ; ne jamais accepter tardivement. Aucune heure fournie par le navigateur ne change le résultat. Pour les mouvements continus du cadran/carte, seul le placement confirmé est persistant.

Vérifier Cron seconde + pg_net + Vault sur le projet cible avant de déclarer BombParty opérationnel. Si la plateforme ne respecte pas la recette de latence, documenter les mesures et proposer un worker durable dédié ; ne pas remplacer discrètement par un timer navigateur.

## 5. IA asynchrone

La soumission quiz enregistre la réponse à temps, passe la phase en `judging`, et crée le job `judge_answer`. Le prochain tour ne commence pas pendant l'appel IA. Le worker appelle DeepSeek hors transaction, puis applique `JUDGMENT_RECEIVED` avec l'ID de tentative. Un verdict arrivé après remplacement, annulation ou résolution est ignoré. La transaction DB ne reste jamais ouverte pendant un appel réseau.

## 6. Disponibilité et évolution

Les cartes des neuf jeux existent dans le registre. `availability = coming_soon | beta | ready` est validé aussi côté serveur. Une partie exige un corpus publié compatible et les fonctionnalités requises actives. Déployer un module ne doit pas activer automatiquement un jeu encore incomplet.

Supabase conserve données/états et Vercel exécute des requêtes courtes ; aucune dépendance à la mémoire d'une instance. Utiliser des caches immuables indexés par version de contenu, jamais comme seule source de vérité. Ne pas mettre en cache les routes privées avec un cache partagé. Une panne réseau montre un état de reconnexion et bloque les actions engageantes ; pas de victoire optimiste.
