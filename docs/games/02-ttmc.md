# TTMC — À ton niveau

Slug `ttmc`, P0, compétitif à deux, 15–25 min. Adaptation à deux entièrement définie ici. Dépendances communes [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [IA](../05-content-ai.md).

## 1. But et règles

Chacun part à 0. Un sujet apparaît ; le joueur choisit sa difficulté de 1 à 10 avant de voir la question. Bonne réponse : avance du niveau choisi ; mauvaise : reste en place. Objectif 30 par défaut, score non plafonné (28+7=35). Fin seulement après le deuxième tour de la manche où quelqu'un atteint l'objectif. Comparer alors les scores réels ; égalité possible. Maximum 20 manches pour éviter un match sans fin ; au terme, meilleur score gagne même sous l'objectif.

Config `{targetScore:30, maxRounds:20, answerSeconds:60, themeSelectionSeconds:20}`. Options : targetScore 20/30/50, answerSeconds 30/60/90 ; maxRounds fixé respectivement 15/20/30 selon cible. Sélection difficulté 20 s fixe. Aucune difficulté ajustée secrètement au joueur.

Premier joueur aléatoire, alternance par manche : `firstSeat` garde sa valeur initiale ; actif = `(firstSeat + round - 1 + turnInRound) % 2`, round commence à 1. Les deux reçoivent le **même thème** dans une manche pour équilibrer les domaines. Pour chacun des 10 niveaux, préaffecter une question distincte à chaque joueur : si les deux choisissent 7, ils n'ont pas la même question. C'est une exigence de couverture du corpus. Un thème n'est pas répété avant épuisement du pool ; questions jamais répétées. Réserves de remplacement peuvent être choisies dans le même thème/niveau ; si indisponibles, rendre la tentative void sans points puis proposer un autre thème pour ce joueur **dans le même tour**, au même niveau, jusqu'à 2 remplacements, comme budget commun.

## 2. Phases

`choose_level` (20 s) -> `answering` (durée choisie) -> `judging` -> `reveal` (12 s) -> prochain joueur/manche/fin.

Au choose_level : afficher uniquement label et courte description du thème ; pas de questions ni réponses. Le joueur peut bouger le sélecteur, puis `CHOOSE_LEVEL` confirme. Après confirmation, aucun retour. Timeout sélection choisit niveau 1 et lance son temps de réponse complet.

Soumission, normalisation, IA, contestation et remplacement selon document commun. Timeout réponse = mauvaise, 0 point, pas de contestation. Points appliqués à la fermeture de reveal pour permettre correction manuelle exceptionnelle. Question ambiguë/erreur technique ne consomme pas le tour ; nouvelle question même niveau avec temps complet. Si thème de remplacement nécessaire, conserver niveau et afficher le changement technique avant question, jamais obliger à refaire un choix moins favorable sans explication.

À fin de manche : round_result, si score >= target pour au moins un ou maxRounds atteint -> result, sinon manche suivante. Pas de case spéciale, exacte arrivée, recul ou question finale V1.

## 3. État et données

```ts
type State = {
  schemaVersion:1;
  phase:'choose_level'|'answering'|'judging'|'reveal'|'finished';
  round:number; turnInRound:0|1; firstSeat:0|1;
  scores:[number,number];
  themes: {themeId:string; label:string;
    byLevel: Record<string,[QuestionRevisionRef,QuestionRevisionRef]>}[];
  chosenLevel:number|null;
  currentQuestionId:string|null;
  currentAttemptId:string|null;
  pendingVerdict:'accept'|'reject'|null;
  replacementCount:number;
  contest:ContestState|null;
  acknowledgedBy:string[];
  counters:[PlayerCounters,PlayerCounters];
};
type PlayerCounters = {
  correct:number; incorrect:number; timeouts:number;
  chosenLevelSum:number; answeredCount:number;
  correctByLevel:Record<string,number>; attemptsByLevel:Record<string,number>;
};
```

Réserves de remplacement et références de thèmes alternatifs conservées dans content_manifest/état privé à l'initialisation. `QuizQuestion` comme Trou Noir ; requiredPrecision ne varie pas en cours de correction pour faire correspondre un résultat espéré. Une question niveau 10 doit demander un fait plus difficile, pas refuser arbitrairement toute faute.

Allocation concrète : pour une configuration, sélectionner `maxRounds` thèmes principaux distincts et deux thèmes de secours distincts des principaux. Chacun doit avoir deux questions par niveau. Les questions de secours d'un niveau forment une file privée commune de quatre éléments, consommée sans remise ; préférer un supplément même thème/niveau si le corpus en possède. Tous IDs/ordre sont fixés au start. Minimum configuration cible 30 :22 thèmes ; cible 50 :32 thèmes. Le seuil global 30 thèmes du corpus permet le défaut, mais n'active donc pas automatiquement l'option 50. Une option insuffisamment couverte est désactivée et le serveur refuse de la démarrer. Si des erreurs techniques épuisent la file du niveau en cours, abandoned judging_unavailable sans pénalité ; ne pas réutiliser une question déjà vue.

Projection : score/cible/manche, thème, actif, niveau choisi après confirmation, prompt uniquement answering/judging/reveal, solution seulement reveal. Aucun `byLevel` public. L'adversaire voit le choix de risque confirmé et progression, pas le brouillon.

## 4. Commandes

`CHOOSE_LEVEL {level:integer1..10}` actif choose_level ; `SUBMIT_ANSWER {answer}` actif answering ; `CONTEST`, `RESOLVE_CONTEST`, `NEXT`, `RESIGN`, `CLAIM_FORFEIT` comme contrat commun. Le moteur refuse choix niveau pendant answering et modifications de niveau dans payload réponse. Les actions système sont LEVEL_TIMEOUT, ANSWER_TIMEOUT, JUDGMENT_RECEIVED, REVEAL_EXPIRED, CONTEST_EXPIRED.

Chaque phase a nouvel UUID ; niveau choisi appartient à un seul tour. Une soumission d'une ancienne phase ne peut pas répondre à une nouvelle question de remplacement. Tous scores et choix enregistrés serveur.

## 5. Résultats et statistiques

Score individuel = position réelle finale. round summary : thème principal, pour chaque joueur niveau/question/réponse/verdict/méthode/points/somme après. Metrics : correct/incorrect/timeouts, moyenne niveau choisi = chosenLevelSum/answeredCount, réussite par niveau. Un tour void n'entre pas dans answeredCount ; timeout réponse oui. Conserver points gagnés, pas une moyenne de pourcentages par partie.

Statistiques permanentes : compteurs communs, niveau maximal réussi, sommes de niveaux/tentatives, réussite globale. Comparer records uniquement même configuration/rulesVersion si score brut dépend de durée/cible. Le score interne reste propre à TTMC ; le classement général du site (19/09/2026) cumule uniquement des points par partie, jamais ces scores internes.

## 6. UI

Plateau horizontal compact desktop, barre de progression mobile, deux pions identifiés et dépassement de cible affiché en chiffre. Carte thème puis 10 boutons niveaux, avec indications « accessible » près de 1 et « très difficile » près de 10. Bouton confirmer distinct ; sur mobile grille 2×5 avec cibles >= 44 px. Ne pas préconfirmer un niveau au simple glissement. Question et champ remplacent la sélection, puis correction et mouvement pion.

Règles visibles : difficulté = points possibles, faux = 0, réponse libre tolérante, dernier tour équilibré, limite manches. Message « Dernier tour de la manche » lorsque premier joueur atteint cible ; ne pas annoncer déjà gagnant.

## 7. Tests et recette

- Score 28 + niveau 7 réussi -> 35, non 30 ; l'adversaire peut encore atteindre 36 et gagner.
- Les deux scores 35 après manche -> draw ; aucune règle départage inventée.
- Timeout choix -> niveau 1 puis chrono réponse entier.
- Les deux choisissent même niveau sur même thème -> questions distinctes ; aucune fuite des autres niveaux.
- Conflit/retry ne change ni niveau ni question aléatoire.
- Maximum manches -> compare scores même sous cible.
- Contestation acceptée crédite le niveau exactement une fois à clôture.
- Refuser un corpus qui n'a pas la couverture annoncée ; tester remplacement sans répétition.
- E2E deux navigateurs, deux niveaux différents, timeout, LLM mock puis benchmark réel commun, fin et stats.

## 8. Implémentation / hors périmètre

Réutiliser correction commune, pas copier son code. Construire moteur niveaux/score, sélection du contenu, projections, plateau et tests. Hors V1 : équipes, cases spéciales, jeu physique exact, thèmes personnalisés saisis par hôte, génération live. Une banque bien calibrée est un prérequis de ready, pas une amélioration optionnelle.
