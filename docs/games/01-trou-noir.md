# Trou Noir — Chute libre

Slug `trou-noir`, priorité P0, mode compétitif à deux. Durée visée 10–15 min. Règles adaptées **définies pour notre V1**, pas transcription d'un livret commercial. Dépendances : [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [IA et contenu](../05-content-ai.md), [UI](../04-product-ui.md).

## 1. But et configuration

Chacun commence avec 100 points de réserve. Une mauvaise réponse fait perdre 10 points ; une bonne conserve la réserve. La piste descend visuellement de 100 à 0 vers un trou noir. Le plus grand score final gagne. Un match comprend au maximum 10 manches, chacune donnant une question à chacun. Après une manche où au moins un joueur atteint 0, la partie finit ; toujours terminer le deuxième tour de la manche pour équilibrer les occasions. Si les deux finissent à la même réserve, égalité, sans départage aléatoire.

Config Zod stricte : `{maxRounds: 10, answerSeconds: 60, categories: [...]}`. Options hôte : maxRounds 5 ou 10 (défaut 10), answerSeconds 30/60/90 (défaut 60), catégories sous-ensemble non vide parmi les cinq du corpus. Réserve initiale/perte fixes, pas de réglage V1. Pack de difficulté : niveaux 3–6 seulement, tirages appariés par difficulté.

Premier joueur tiré au hasard au start ; `firstSeat` reste ce siège initial dans l'état. Manche numérotée à partir de 1 : siège qui commence = `(firstSeat + round - 1) % 2`, actif = `(siègeQuiCommence + turnInRound) % 2`. Dans une manche, deux questions distinctes de même catégorie/niveau, affectées avant de voir les réponses. Faire tourner les catégories uniformément dans une liste mélangée, sans répéter la même tant que les autres du cycle restent disponibles. Prévoir deux questions de réserve par tour pour remplacements techniques. Aucune question/revision logique répétée dans la partie.

## 2. Déroulement exact

1. Start atomique : participants, réserve, ordre des questions/alternances et versions contenus fixés ; phase `answering` pour le premier joueur, deadline now+answerSeconds.
2. Les deux voient la question et à qui elle s'adresse ; seul l'actif peut répondre. Le brouillon n'est pas transmis.
3. `SUBMIT_ANSWER` fige la réponse. Correction déterministe ou job IA, phase `judging`, aucune nouvelle réponse.
4. Verdict valide : phase `reveal` de 12 s ; afficher réponse saisie, attendue, explication et effet proposé. L'effet n'est pas encore appliqué.
5. Contestation éventuelle selon contrat commun ; NEXT des deux ou expiration ferme révélation et applique exactement une fois 0/-10.
6. Si premier tour de manche, question de l'autre joueur, même si le premier vient d'atteindre 0. Sinon enregistrer round_result, vérifier fin, puis manche suivante.
7. Fin : réserve finale, bonnes/mauvaises réponses, égalité éventuelle et historique.

Expiration sans réponse : créer tentative `method=timeout`, rejected, raw_answer vide autorisée uniquement pour cette tentative système (adapter CHECK côté API, pas celui SQL longueur), puis révélation « Temps écoulé », perte -10 à la clôture. Timeout n'est pas contestable. L'échec de DeepSeek est une question void/remplacement, jamais un timeout du joueur déjà soumis. Les secondes d'IA ne réduisent pas le temps adverse.

## 3. État privé et projections

```ts
type State = {
  schemaVersion: 1;
  phase: 'answering'|'judging'|'reveal'|'finished';
  round: number; turnInRound: 0|1; firstSeat: 0|1;
  reserves: [number, number];
  schedule: {category:string; difficulty:number;
    questions:[QuestionRevisionRef,QuestionRevisionRef];
    replacements:[QuestionRevisionRef[],QuestionRevisionRef[]]}[];
  currentAttemptId: string | null;
  pendingVerdict: 'accept'|'reject'|null;
  contest: ContestState | null;
  replacementCount: number;
  acknowledgedBy: string[];
  perPlayer: [{correct:number;incorrect:number;timeouts:number},
              {correct:number;incorrect:number;timeouts:number}];
};
```

Les champs communs phaseId/deadline/statut sont dans matches. Fournir à l'UI round/maxRounds/reserves, question prompt/catégorie/difficulté courante, actif, statut tentative. En reveal uniquement : rawAnswer/canonical/explanation/verdict/impact. Ne pas fournir schedule, références contenant la solution, réserves de questions, références de sources avant correction. Le joueur inactif voit `judging` mais pas la réponse en cours avant reveal.

## 4. Actions et transitions

| Action | Payload | Autorisation/effet |
|---|---|---|
| SUBMIT_ANSWER | `{answer:string}` | actif, answering, avant deadline, une fois |
| CONTEST | `{attemptId:string}` | actif ayant reçu reject non-timeout, reveal, une seule fois |
| RESOLVE_CONTEST | `{attemptId:string,accept:boolean}` | adversaire, contestation ouverte |
| NEXT | `{}` | reveal sans contestation pending ; deux confirmations ou échéance |
| RESIGN / CLAIM_FORFEIT | `{}` | commun |

Système : ANSWER_TIMEOUT -> reveal ; JUDGMENT_RECEIVED -> reveal ou nouvelle question ; REVEAL_EXPIRED/CONTEST_EXPIRED -> appliquer puis avancer. Le worker vérifie phaseId et attemptId avant verdict. Le timer de contestation remplace celui de révélation, l'ancien job devient inopérant.

## 5. Persistance et résultats

Utiliser tables communes, quiz_attempts et packs quiz. `round_results.summary` : round, category, difficulty, deux `{playerId, questionPrompt, canonical, submittedAnswer, verdict, method, delta, reserveAfter}`. Les sources/explications révélées peuvent être conservées dans résumé safe. Questions void listées à part pour diagnostic, non comptées comme erreurs ou nouvelles manches.

`player_results.score` = réserve finale ; metrics `{correct,incorrect,timeouts,contestsAccepted,questionsPlayed}`. Statistiques par jeu : sommes correct/incorrect/timeouts, meilleur reserve final, played/wins/losses/draws communs. Duo : mêmes compteurs de confrontations, pas mélange avec score TTMC.

## 6. Écrans

Plateau vertical desktop : deux pions côte à côte sur une même graduation, grand bloc question à droite. Mobile : piste compacte au-dessus, question et champ visibles avec clavier ouvert. Libellés « Réserve »/« points » pour notre identité, pas besoin de revendiquer une mesure de QI. Révélation anime la chute après clôture, pas avant décision finale. Annonce texte accessible du changement de réserve.

Aide avant partie : une bonne réponse conserve tes points, mauvaise/temps écoulé -10, même nombre de tours, fin à zéro ou limite de manches. Écran fin compare pistes et détail des réponses, permet revanche.

## 7. Critères et tests spécifiques

- À 10 de réserve, premier joueur rate : second joue encore ; s'il rate aussi à 10, résultat draw.
- Après 5 manches en format court, score le plus haut gagne ; aucun tour bonus.
- Question invalide/provider indisponible ne modifie ni réserve ni compteur de mauvaise réponse.
- Contestation acceptée transforme pending -10 en 0, une seule fois ; NEXT ne contourne pas la fenêtre de l'autre.
- Réponse à deadline exacte rejetée ; réponse reçue avant puis IA lente reste éligible.
- Même catégorie/difficulté par paire, questions différentes ; jamais répéter logicalKey.
- Projection pré-reveal contient zéro alias/canonical/schedule ; tiers ne peut lire le pack.
- E2E : partie courte complète, bonnes et mauvaises réponses, refresh pendant judging, résultat unique dans les deux historiques.

## 8. Séquence de construction et exclusions

Implémenter d'abord moteur avec correcteur mock, projections/tests ; brancher tentative/worker/IA ; créer piste/champ/révélation ; importer contenu validé ; recette réelle. Pas de joker, défi verbal, sélection manuelle de questions par hôte, génération live ou arbitrage humain obligatoire V1. Toute autre variante nécessite nouvelle rulesVersion.
