# tibo.fun

Projet de plateforme privée de jeux à deux, en français, avec profils, salons en temps réel et historique partagé.

**État : cadrage uniquement. Aucune application n'est encore implémentée.**

- Agents : commencer par [AGENTS.md](AGENTS.md).
- Spécifications complètes : [docs/README.md](docs/README.md).
- État de réalisation : [docs/07-implementation-status.md](docs/07-implementation-status.md).

Stack retenue : GitHub, Vercel, Next.js/TypeScript, Supabase et DeepSeek pour la correction des quiz.

Dépôt : [ThibaudFrancony/thib.fun](https://github.com/ThibaudFrancony/thib.fun). Branche de production : `main`. Le propriétaire a activé le déploiement Supabase depuis GitHub ; les futurs fichiers `supabase/migrations/` seront appliqués par cette intégration. Ce premier lot contient uniquement la documentation et les exclusions Git, sans migration SQL.

Exemple de demande future : « Implémente Géographie conformément à `docs/games/03-geographie.md`, en construisant les dépendances communes manquantes et en exécutant la recette à deux sessions. »
