# Compatibilité — Même réponse ?

Slug `compatibilite`, P1, coopération à deux, 5–10 min. Version uniquement questions à choix, aucun mini-jeu physique ou d'adresse. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [contenu](../05-content-ai.md).

## 1. Périmètre et config

Mode V1 **accord** : les deux répondent pour eux-mêmes à la même question, puis découvrent s'ils ont choisi pareil. Pas de gagnant/perdant. Mode « deviner l'autre » documenté comme évolution, non activé en V1 pour ne pas mélanger deux scores différents.

Config `{questionCount:10,category:'amitie',answerSeconds:null}`. Options count10/15/20, category quotidien/absurde/amitie/couple, pas de timer par question. Catégorie couple explicitement choisie par hôte et visible avant ready ; aucune question sensible injectée dans catégorie généraliste. Pas de mesure scientifique de compatibilité : résultat = proportion de choix identiques dans cette session.

## 2. Corpus

Payload : `{logicalKey:string,category:string,prompt:string,options:{id:string,label:string}[],sensitivity:'light'|'personal',explanation?:string}`. 2 à 4 options uniques, question<=240 caractères, option<=80. Même ordre d'options chez les deux, IDs stables indépendants de l'ordre d'affichage. Pas de bonne réponse et aucun appel LLM. Exemples originaux : « Pour un week-end improvisé, tu préfères… » avec mer/montagne/ville/maison.

Minimum ready 40 questions relues par catégorie activée ; exclure doublons/logicalKey déjà tirés, sélectionner count+5 réserves sans remise au start. Ne pas demander adresse, santé détaillée, données financières ou mot de passe dans un jeu entre amis. Catégorie personal autorisée uniquement couple explicitement choisi. Conserver version de pack dans match.

## 3. Déroulement et passage

Phase answering simultanée : chacun choisit localement une option et confirme. Après `SUBMIT_CHOICE`, sa réponse est verrouillée ; l'adversaire voit « A répondu », jamais option/texte. Quand les deux ont confirmé, passer reveal8 s, montrer deux choix et accord oui/non. Créditer +1 accord si même optionId, pas comparaison de labels. Après NEXT des deux ou échéance, nouvelle question.

Bouton « Passer cette question » disponible à chacun tant que reveal non commencé, même si l'autre a répondu. `SKIP_QUESTION` annule la question pour les deux sans révéler aucune réponse et la remplace par une réserve. Maximum3 passages par partie, commun aux deux. Si plus de réserve/passages, désactiver le bouton avec explication ; le joueur peut quitter. Une question passée n'entre pas dans dénominateur et ne compte pas comme une des count questions complétées. Le moteur doit gérer skip et second submit concurrents : premier commit détermine phase ; si reveal committé, skip est trop tard, pas de suppression d'une réponse déjà révélée.

Sans chrono, seul le système d'absence commun peut abandonner une partie laissée ouverte. Pas d'auto-réponse aléatoire au nom d'un utilisateur. RESIGN = abandoned, score partagé partiel visible comme progression mais non compté comme résultat coopératif terminé.

## 4. Calcul

Fin après exactement questionCount questions comparées. `shared_score = round(100*matches/questionCount)`, de 0 à 100 ; stocker aussi matches et compared pour conserver valeur exacte. Résultat sous forme « 7 choix en commun sur 10 —70 % ». Ne pas afficher un verdict amoureux ou psychologique. Phrase ludique optionnelle indexée sur tranche, sans jugement : « Vos choix se rejoignent souvent ».

Individuellement outcome=cooperative, score=null ; shared_score dans result/history pour les deux. Aucune victoire/défaite/draw pour ce jeu, même si0 %. Historique duo sépare sessions et score moyen ; comparer records par catégorie/count/rulesVersion. Score moyen agrégé pondéré par questions (`sumMatches/sumCompared`), pas moyenne non pondérée des pourcentages.

## 5. État et actions

```ts
type State = {
 schemaVersion:1; phase:'answering'|'reveal'|'finished';
 questionIndex:number; questionIds:string[]; reserveIds:string[];
 currentQuestionId:string;
 choices:[string|null,string|null]; submitted:[boolean,boolean];
 matches:number; compared:number; skipped:number;
 acknowledgedBy:string[];
};
```

`SUBMIT_CHOICE {optionId:string}` answering, participant non soumis, option de question actuelle ; `SKIP_QUESTION {}` answering avec quota/réserve ; NEXT reveal ; RESIGN/CLAIM_FORFEIT communs (toujours abandoned ici). Chaque nouvelle question/remplacement = nouveau phaseId. Le deuxième submit peut être réévalué après version conflict puisque les deux réponses sont simultanées et indépendantes. Modifier choix déjà soumis interdit.

Projection answering : question/options, choix propre soumis ou sélection locale, booléen adverse submitted, compared/count, accords déjà révélés. Projection reveal : choix des deux, isMatch, score provisoire. N'envoyer ni questions futures ni choix adverse avant reveal. L'adversaire ne peut pas deviner le choix par taille ou nom d'événement : Broadcast invalidation seulement.

## 6. Persistance et confidentialité

Tables communes + pack compatibility. Chaque round_result = une question comparée avec prompt/options/IDs choisis/noms snapshots/isMatch ; questions passées conservent seulement reason/ID dans événements privés, jamais réponses dans history. History accessible uniquement aux deux participants, pas à tous membres du site. Profil public montre nombre sessions et agrégats seulement, aucune réponse intime.

Metrics `{agreements,compared,skipped,category}` dans les deux player_results, score=null. player_game_stats cooperative+=1, played+=1, wins/losses/draws inchangés ; duo somme scores/questions. Bouton « Rejouer » tire nouvelles questions en favorisant non vues récemment.

## 7. Interface

Grande question, 2–4 cartes boutons, validation distincte. Une fois soumis : carte propre sélectionnée et « En attente de [pseudo] ». L'autre ne reçoit pas de notification anxiogène de lenteur. Progression « Question 3/10 », avatars côte à côte. Révélation : deux choix avec avatars, accord souligné par animation douce ; pas d'animation d'échec agressive en cas de différence. Bouton Passer indique quota restant et que la question ne sera pas comptée.

Résultat : pourcentage + numérateur/dénominateur, liste accords/différences, catégorie et boutons communs. Interface clavier radio group + bouton confirmer. Pas de réponse libre à corriger ni d'explication IA des personnalités.

## 8. Tests et exclusions

Deux réponses identiques=>1, différentes=>0, choix ID invalide, modification après soumission, deux submits simultanés, skip avant/après reveal, remplacement invisible, épuisement quota, pas de timeout automatique, pourcentage0/100/arrondi, agrégats coop sans win/loss, tiers ne lit pas détail, refresh avant réponse adverse. E2E10 questions et histoire du duo.

Hors V1 : mode deviner l'autre, questions libres, LLM psychologue, quiz publics communautaires, réponses visibles sur profils, mini-jeux Wii, score de relation réel. Implémenter d'abord confidentialité et transitions, puis corpus/interface.
