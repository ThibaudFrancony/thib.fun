# Roue de la longueur d'onde — À l'unisson

Slug `longueur-onde`, P1, coopération à deux, 8–15 min. Règles adaptées et barème précis V1. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [contenu](../05-content-ai.md).

## 1. Concept et config

Une cible secrète se situe sur un axe entre deux extrêmes. Le donneur la voit et écrit un indice ; le devineur place l'aiguille selon cet indice. Révélation puis points partagés selon proximité. Rôles alternés à chaque manche, premier donneur aléatoire. Match coopératif, aucun gagnant individuel.

Config `{rounds:8,clueSeconds:90,guessSeconds:60}`. Options rounds 6/8/10 (toujours pair), clueSeconds 60/90/120, guessSeconds 30/60/90. Barème fixe. Corps du jeu utilisable sans vocal/chat externe ; indice écrit suffit.

## 2. Axes et cible

Pack spectrums : `{logicalKey:string,leftLabel:string,rightLabel:string,category:'quotidien'|'culture'|'absurde',exampleClue?:string}`. Labels <=60 caractères, opposés compréhensibles dans cet ordre. Exemple « Très froid / Très chaud ». Minimum80 axes relus pour ready ; tirer rounds sans remise, garder2 réserves techniques. exampleClue tutoriel seulement, ne pas le proposer dans une manche évaluée.

Cible `target` entière 0..100, tirage uniforme serveur au start de chaque manche à partir d'entropie persistée. Aucune corrélation publique avec heure/roundId. Le donneur voit une marque précise et la zone ; le devineur voit le cadran neutre. Aucun besoin d'un moteur physique ; demi-cercle SVG équivalent à une échelle linéaire 0..100. Mapping : angle degrés =180−1.8*value, x=cx+r*cos(angle), y=cy−r*sin(angle). Au pointeur convertir angle avec atan2, clamp demi-cercle, arrondir valeur à l'entier le plus proche.

## 3. Manche

1. Phase `clue` : deux voient axe et rôles. Seul donneur voit target, écrit un indice<=120 caractères.
2. `SUBMIT_CLUE` fige l'indice et passe à `guessing`, donneur ne peut plus le changer ; chrono guess démarre.
3. Devineur règle son aiguille localement, la déplace autant qu'il veut puis `SUBMIT_GUESS` confirme position entière 0..100.
4. Phase reveal8 s : cible et estimation visibles, erreur et points, crédit au total exactement une fois.
5. NEXT des deux ou échéance : rôles inversés, nouvel axe/cible. Après rounds : résultat partagé.

Ne pas envoyer la position provisoire du devineur au donneur ; elle reste locale. Le donneur ne peut pas soumettre sa propre estimation ni envoyer un deuxième indice. La cible reste visible pour lui pendant guessing, mais ses actions se limitent à attendre/quitter.

## 4. Indices et timeouts

Indice non vide, texte brut, trim/espaces normalisés ; pas de lien, pas de retour ligne, chiffres ASCII interdits pour éviter « 73 ». Ne pas prétendre empêcher tous les codes en mots : règle sociale affichée « Donne un exemple, pas la position ou un code convenu ». Aucun LLM de modération nécessaire V1. Une phrase comme « Un café tout juste servi » est admissible. Ne pas interdire systématiquement un mot des extrêmes si cela rend la règle opaque ; seules contraintes explicites ci-dessus.

Timeout clue : manche manquée, guess=null, clue=null, 0 point, reveal avec cible, puis suivante. Timeout guessing : 0 point, guess=null, même reveal ; **ne pas soumettre arbitrairement50**. La perte du réseau ne prolonge pas le chrono. Les règles d'absence communes peuvent interrompre si durée seuil atteinte.

## 5. Barème

Distance `error=abs(target-guess)` en unités0..100 :

| Erreur inclusive | Points |
|---|---|
| 0..4 | 4 |
| >4..9 | 3 |
| >9..14 | 2 |
| >14 | 0 |

Pas de 1 point V1. Score partagé = somme, maximum `4*rounds`, pourcentage affiché `round(100*score/(4*rounds))`. Dessiner les zones avec clamp aux bords 0/100 ; ne pas déplacer target près d'un bord pour faire tenir le visuel. Les zones tronquées sont un choix explicite de la version, le tirage reste uniforme.

Résultat individuel outcome=cooperative, score=null ; résultat commun partagé. Détailler nombre de 4 points, erreur moyenne sur estimations réellement validées, manches manquées séparées. Un score 0 terminé est une session coopérative terminée, pas une défaite. Abandon avant fin conserve historique interruption, pas record.

## 6. État / actions / projection

```ts
type State = {
 schemaVersion:1; phase:'clue'|'guessing'|'reveal'|'finished';
 round:number; firstClueSeat:0|1; clueSeat:0|1;
 axisIds:string[]; target:number;
 clue:string|null; guess:number|null;
 total:number; lastPoints:number; lastError:number|null;
 missed:number; acknowledgedBy:string[];
};
```

`SUBMIT_CLUE {clue:string}` donneur clue ; `SUBMIT_GUESS {position:integer0..100}` autre joueur guessing ; NEXT reveal ; RESIGN/CLAIM_FORFEIT communs. Les erreurs de format ne changent pas deadline. Pas de commande de reroll volontaire target/axe V1 pour éviter sélection favorable.

Projection donneur : axe, target, indice confirmé, phase/score ; guess seulement après reveal. Projection devineur : axe, indice une fois soumis, pas target avant reveal. Construire deux objets whitelist distincts et tester JSON complet. La cible ne doit jamais être encodée dans un CSS angle transmis au devineur, image pré-rendue, nom de fichier ou payload de préchargement. Ne pas cacher un target envoyé via simple style visibility:hidden.

## 7. Persistance / UI

Tables communes + pack spectrums. Round summary : axe left/right, clue, giverId/guesserId, target, guess, error, points, missedReason éventuelle. player metrics `{cluesGiven,guessesMade,missedClues,missedGuesses,guessErrorSum,guessCount}` ; stats coop communes et records par rounds/rulesVersion. Duo : sessions, total points/max points, meilleur score normalisé selon config, nombre de zones4.

Grand cadran SVG responsif, gauche/droite ancrés lisiblement, input indice ou estimation selon rôle, bouton confirmation. Devineur démarre curseur 50 **local non soumis** et doit valider. Fournir slider HTML accessible 0..100 synchronisé, flèches de 1, PageUp/Down de 10, Home/End, libellés extrêmes ; l'affichage de sa valeur numérique est autorisé. Donneur voit target chiffrée pour clarté mais ne peut l'envoyer en chiffres dans l'indice. Reveal superpose aiguille estimation et zones de cible, formes distinctes et texte erreur/points.

## 8. Tests / critères / exclusions

Barème sur erreurs 0/4/5/9/10/14/15/100, score maximum, target 0/100 zone tronquée, mapping valeur<->angle après resize. Deux rôles alternent exactement rounds/2 chacun. Target invisible dans tous payloads adverses avant reveal, guess provisoire jamais envoyé. Indice vide/chiffres/URL refusés, timeout clue/guess=0 sans fake 50, double submit pas double crédit, job ancien, refresh donneur/devineur, résultats coop et pourcentage. E2E 6 manches avec cible fixture et vraie séparation comptes.

Hors V1 : compétition par équipes, vote adverse, indices vocaux, comparaison LLM des indices, roue physique, mode spectateur, targets pilotées client. Construire moteur/barème/projections, puis cadran et contrôles accessibles, puis corpus et recette.
