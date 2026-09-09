# État de réalisation

Dernière mise à jour : 9 septembre 2026.

**Documentation rédigée. Les premières migrations de schéma sont préparées dans la branche `codex/geographie`, mais aucune migration n'a été appliquée à une base distante et aucune banque de contenu de production n'a été créée.** La cohérence documentaire et les fichiers SQL doivent encore être validés sur une base locale avant activation.

Contrôles documentaires effectués : index des neuf jeux dans AGENTS, résolution des liens locaux, blocs de code Markdown équilibrés, absence de placeholders TODO/TBD, couverture des règles/configurations/états/projections/scores/tests. Relecture croisée des droits SQL, reçus système, délais, contenu et résultats coopératifs. Ces contrôles ne sont pas des tests d'une application.

| Lot | État | Dépendances |
|---|---|---|
| Spécifications communes et AGENTS | Rédigées | Revue de cohérence documentaire |
| Neuf plans de jeux | Rédigés | Défauts de règles explicités dans les fiches |
| DA visuelle | Base provisoire documentée | Validation sur écrans réels |
| Bootstrap Next/Vercel/GitHub | À faire | Accès et versions à vérifier |
| Supabase CLI/configuration | Préparée | `supabase/config.toml`, seed vide, validation Docker à faire |
| Supabase schéma/Auth/Storage/RLS | Migrations préparées, non appliquées | Audit de la cible et validation locale |
| Salons/transactions/Realtime/jobs | À faire | Base |
| Profils/historique/duos | À faire | Base + finalisation |
| Géographie | Migrations communes préparées, jeu à faire | Socle + corpus géographique + moteur |
| Trou Noir | À faire | Socle + quiz + benchmark IA |
| TTMC | À faire | Socle + couverture niveaux + IA |
| Bataille navale | À faire | Socle |
| BombParty + entraînement | À faire | Socle + lexique + recette timer |
| Skyjo | À faire | Socle |
| UNO | À faire | Socle |
| Compatibilité | À faire | Socle + questionnaires |
| Longueur d'onde | À faire | Socle + axes |

Pour chaque lot terminé ajouter date, version/commit si existant, tests effectués et limitations réelles. Ne pas cocher « terminé » sur la base du plan seul.
