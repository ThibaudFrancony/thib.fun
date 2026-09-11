# tibo.fun

Projet de plateforme privée de jeux à deux, en français, avec profils, salons en temps réel et historique partagé.

**État au 11 septembre 2026 : premier socle applicatif en place.** L'accueil multi-jeux, Géographie et UNO sont présents dans `main`. Le reste du produit est encore partiel ou spécifié uniquement.

- Agents : commencer par [AGENTS.md](AGENTS.md).
- Progression opérationnelle : [progression.md](progression.md).
- Spécifications complètes : [docs/README.md](docs/README.md).
- État de réalisation : [docs/07-implementation-status.md](docs/07-implementation-status.md).

Stack retenue : GitHub, Vercel, Next.js/TypeScript, Supabase et DeepSeek pour la correction des quiz.

Dépôt : [ThibaudFrancony/thib.fun](https://github.com/ThibaudFrancony/thib.fun). Branche de production : `main`. Le propriétaire a activé le déploiement Supabase depuis GitHub ; les fichiers `supabase/migrations/` sont appliqués par cette intégration. Les migrations sont validées localement dans Docker, mais aucune migration distante ni banque de contenu de production n'est encore déclarée comme vérifiée.

Commandes de développement : `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm content:validate`, `pnpm docs:check`.

Exemple de demande future : « Implémente Géographie conformément à `docs/games/03-geographie.md`, en construisant les dépendances communes manquantes et en exécutant la recette à deux sessions. »
