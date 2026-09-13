# tibo.fun

Projet de plateforme privée de jeux à deux, en français, avec profils, salons en temps réel et historique partagé.

**État au 13 septembre 2026 : premier socle applicatif en place.** Du code existe pour plusieurs jeux ; l'état réel de disponibilité, de validation et de déploiement est celui de [progression.md](progression.md).

- Agents : commencer par [AGENTS.md](AGENTS.md).
- Progression opérationnelle : [progression.md](progression.md).
- Spécifications complètes : [docs/README.md](docs/README.md).
- État de réalisation : [docs/07-implementation-status.md](docs/07-implementation-status.md).

Stack retenue : GitHub, Vercel, Next.js/TypeScript, Supabase et DeepSeek pour la correction des quiz.

Dépôt : [ThibaudFrancony/thib.fun](https://github.com/ThibaudFrancony/thib.fun). Branche de production : `main`. GitHub sert au dépôt, à la revue et à la CI ; les migrations de production ne sont plus appliquées par la connexion GitHub/Supabase. Utiliser le connecteur Supabase dans Codex ; en cas d'échec, préciser s'il faut exécuter une commande terminal (`bash`) ou coller du SQL dans l'éditeur Supabase (`sql`), sans mélanger les formats.

Commandes de développement : `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm content:validate`, `pnpm docs:check`.

Exemple de demande future : « Implémente Géographie conformément à `docs/games/03-geographie.md`, en construisant les dépendances communes manquantes et en exécutant la recette à deux sessions. »
