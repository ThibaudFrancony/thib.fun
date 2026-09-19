# tibo.fun

Site privé en français pour jouer à deux, en ligne, sur desktop et mobile. Deux amis créent un compte, ouvrent un salon avec un code, choisissent un jeu et jouent sans transmettre les questions à la main et sans arbitre humain.

« Privé » veut dire que les parties, les profils et l'historique ne sont pas publics. L'inscription se fait librement par e-mail et mot de passe, sans invitation.

## Comment ça se joue

1. On crée un compte sur `/connexion` (ou on essaie en invité).
2. On choisit un pseudo unique à la première connexion, plus une photo ou un avatar.
3. Depuis l'accueil, on crée un salon ou on rejoint celui de son ami avec un code.
4. L'hôte choisit le jeu et ses options, les deux joueurs se déclarent prêts, la partie démarre.
5. La partie se joue en temps réel, avec reconnexion et reprise après rafraîchissement.
6. À la fin, le résultat apparaît dans l'historique partagé, avec le détail par jeu et le bilan du duo.

Un seul salon actif à la fois par joueur : créer ou rejoindre est masqué tant qu'un salon ou une partie est en cours. Un salon d'attente sans partie et sans joueur présent depuis une heure est dissous automatiquement.

## Les 9 jeux

Les priorités produit sont Trou Noir, TTMC et Géographie. Les autres jeux suivent.

| Jeu | Identifiant | Le principe en une phrase |
|---|---|---|
| Chute libre (Trou Noir) | `trou-noir` | Réponds juste pour éviter la chute. |
| À ton niveau (TTMC) | `ttmc` | Choisis ta difficulté et mise sur tes connaissances. |
| HexaPoint (Géographie) | `geographie` | Place les villes au plus près sur la carte. |
| Douze cases (Skyjo) | `skyjo` | Révèle et échange tes cartes pour réduire ton total. |
| Dernière carte (UNO) | `uno` | Débarrasse-toi de ta main avant ton adversaire. |
| Syllabe Express (BombParty) | `bombparty` | Trouve le bon mot avant la fin du chrono. |
| Flotte cachée (Bataille navale) | `bataille-navale` | Repère et coule la flotte adverse. |
| Même réponse ? (Compatibilité) | `compatibilite` | Comparez vos choix et découvrez vos points communs. |
| À l'unisson (Longueur d'onde) | `longueur-onde` | Donne un indice et trouvez la même longueur d'onde. |

Chaque jeu a sa fiche de règles dans `docs/games/`. Les jeux pas encore prêts restent affichés « Bientôt » et leur démarrage est refusé côté serveur.

Un mode entraînement solo existe pour BombParty (`/entrainement/syllabes`).

## Autour des jeux

- Comptes : inscription e-mail/mot de passe, confirmation e-mail selon l'environnement, session invité possible sans historique persistant.
- Profils : pseudo de création figé, nom affiché optionnel, photo ou avatar, statistiques par jeu.
- Salons : code copiable, options réglées par l'hôte, statuts prêt, transfert d'hôte, revanche.
- Temps réel : Supabase Realtime pour informer, PostgreSQL comme source de vérité, relecture d'un snapshot en cas de message manqué.
- Historique : parties paginées avec filtres, détail d'une partie, bilan d'un duo (victoires, égalités, sessions coopératives).
- Chat et amis : barre latérale, chat général, demandes d'amis, conversations privées texte et photos.
- Administration : page `/admin` réservée (visibilité des jeux, lecture du chat) pour le compte en liste blanche.
- Contenus : banques de questions et lexiques versionnés dans `content/`, validés par script. Les réponses libres des quiz sont corrigées côté serveur avec aide sémantique (DeepSeek), jamais de génération de questions en cours de partie.

## Comment c'est construit

- Next.js App Router, React, TypeScript strict, Tailwind CSS, déployé sur Vercel.
- Supabase : Auth, PostgreSQL, Storage, Realtime Broadcast, Cron + pg_net + Vault pour les tâches durables (échéances de tours, jugements).
- Moteurs de jeu purs en TypeScript côté serveur : le client n'envoie que des intentions, le serveur calcule l'état, puis projette à chaque joueur uniquement ce qu'il a le droit de voir.
- Règles de sécurité : mutations uniquement via API serveur authentifiée, RLS sur les tables exposées, aucun secret côté client, horloge de la base pour les échéances.
- Tests : Vitest pour les moteurs et le serveur, pgTAP pour le SQL, Playwright pour les parcours navigateur desktop et mobile.

## Organisation du dépôt

- `src/app/` : pages Next.js (accueil, jeux, salons, parties, profils, historique, admin).
- `src/games/<slug>/` : moteur, règles et interface d'un jeu.
- `src/server/` : logique serveur, transactions de partie, jugements, salons.
- `supabase/migrations/` : migrations SQL versionnées, créées avec la CLI Supabase.
- `supabase/tests/` : tests pgTAP du SQL.
- `content/` : banques de questions, lexiques et scripts de génération/validation.
- `tests/e2e/` : parcours Playwright.
- `docs/` : spécifications (architecture, base, API, produit, contenu, livraison, contrats moteur, fiches des 9 jeux).
- `progression.md` : l'état réel du dépôt — ce qui est présent, validé, limité, et la prochaine étape.
- `AGENTS.md` : les règles de travail pour les agents automatiques.

## Démarrer en local

Prérequis : Node.js >= 20.9, `pnpm@11.19.0`.

```bash
pnpm install
pnpm dev
```

Contrôles courants, sans Docker :

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:matrix
pnpm content:validate
pnpm docs:check
pnpm exec next build --webpack
```

Recette locale complète avec base et navigateurs (Docker opt-in, jamais automatique) :

```bash
pnpm local:env
pnpm local:fixture
pnpm test:db
pnpm test:e2e
```

Docker Desktop consomme beaucoup de ressources : on ne le lance que si la tâche le demande explicitement.

## Documentation

- Suivi réel du projet : [progression.md](progression.md).
- Règles de travail des agents : [AGENTS.md](AGENTS.md).
- Index des spécifications : [docs/README.md](docs/README.md).
- Architecture : [docs/01-architecture.md](docs/01-architecture.md).
- Base de données : [docs/02-database.md](docs/02-database.md).
- API et temps réel : [docs/03-api-realtime.md](docs/03-api-realtime.md).
- Produit et interface : [docs/04-product-ui.md](docs/04-product-ui.md).
- Contenu et correction des quiz : [docs/05-content-ai.md](docs/05-content-ai.md).
- Livraison et recette : [docs/06-delivery-testing.md](docs/06-delivery-testing.md).
- État de réalisation par lot : [docs/07-implementation-status.md](docs/07-implementation-status.md).
- Contrats des moteurs : [docs/08-engine-contracts.md](docs/08-engine-contracts.md).

## État d'avancement

Le dépôt contient les spécifications des neuf jeux et du code pour plusieurs d'entre eux, mais **seul [progression.md](progression.md) dit ce qui est réellement disponible, validé et déployé**. Ne pas considérer une fonctionnalité comme terminée parce qu'elle est documentée.

## Contribuer

- Branche de production : `main`, directement. Pas de réécriture d'historique, pas de push forcé.
- Dépôt distant : `thib.fun` sur GitHub (le dossier local s'appelle `tibo.fun`, c'est normal).
- Toute modification réelle se termine par un commit puis un push vers `main`, avec mise à jour de `progression.md` dans le même changement.
- Base de données : nouvelles migrations créées avec la CLI Supabase dans `supabase/migrations/`, testées sur base isolée. Une migration appliquée est immuable, on la corrige par une nouvelle migration. Pas de reset distant, pas de secret commité.
- Production : un push sur `main` n'applique jamais une migration distante. Toute inspection ou application distante passe par le connecteur Supabase avec autorisation explicite.
