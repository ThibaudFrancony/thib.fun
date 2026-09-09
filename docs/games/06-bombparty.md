# JKLM / BombParty / Boom Party — Syllabe Express

Slug canonique `bombparty`, P1, compétitif à deux + entraînement solo séparé. 3–10 min. Dépendances [architecture et jobs](../01-architecture.md), [SQL](../02-database.md), [API et temps](../03-api-realtime.md), [contenu](../05-content-ai.md). Le moteur valide des séquences de lettres, pas une définition linguistique de syllabe.

## 1. Règles V1

Chaque joueur commence à 3 vies (options 3/5), premier aléatoire. Une séquence de 2 ou 3 lettres apparaît. Le joueur actif doit fournir un mot accepté contenant cette séquence contiguë. Un mot déjà accepté dans **cette partie entière** est interdit aux deux. Réponse valide -> passe la main et tire une nouvelle séquence. Réponse invalide -> erreur visible seulement à l'auteur, même tour, même échéance ; nombre de tentatives non limité au niveau métier mais rate limiting actif.

Temps par tour : `max(5, initialSeconds - floor(validWordsTotal/6))`, initialSeconds options 10/15/20, défaut 15. La durée est fixée au début du tour ; pas de bombe aléatoire ou raccourcissement pendant saisie. Timeout -> actif perd une vie ; si zéro fin immédiate, sinon adversaire joue une nouvelle séquence avec la durée calculée. Une réponse valide ne rend pas de vie. Pas de bonus alphabet V1.

Config `{lives:3,initialSeconds:15,sequenceDifficulty:'normal'}` ; options difficulty easy/normal/hard. Limite 200 tours : comparer vies restantes puis nombre de mots valides, puis draw si égalité ; afficher reason `turn_limit`. Les tours comprennent succès et expirations, pas tentatives invalides.

## 2. Lexique et index

Pack immutable manifest avec source/licence/checksum et règles de normalisation. Pipeline Node : lowercase, NFKD + suppression accents, ligatures œ->oe/æ->ae, longueur normalisée 2..30, lettres a–z seulement. Exclure noms propres/abréviations et mots à tiret/apostrophe dans cette V1 ; accepter pluriels et formes conjuguées **uniquement présents dans la source importée**. Ne pas inventer des flexions à la volée. Garder displayForm accentuée pour suggestions et normalizedForm pour validation. Deux variantes normalisées identiques représentent un seul mot utilisé.

Importer lexique revu/licencié, cible >= 50000 formes acceptées pour jouabilité, mais publier un niveau seulement après couverture effective. Générer index `sequence -> sorted wordIds[]` pour tous substrings contigus de longueur 2/3. Catégories par nombre total de mots : easy >=200, normal 50..199, hard 10..49. Pour choisir une séquence en partie, exiger au moins 5 mots **encore inutilisés**, et éviter les 5 dernières séquences si possible. Si aucun candidat ne reste dans difficulté, élargir au pool easy/normal/hard avec >=5, puis >=1 ; si rien reste, fin draw `dictionary_exhausted`.

Pas de recherche linéaire sur tout le dictionnaire à chaque validation. Set normalisé pour membership + index préparé pour séquences. Cache serveur immuable par checksum, chargé depuis pack privé ou artefact serveur ; fichier jamais intégré accidentellement dans bundle du jeu compétitif. État match ne stocke que packId/checksum, séquence et mots utilisés, pas le lexique complet.

## 3. Temps réel et arbitrage

Deadline décidée en DB, envoyée aux deux ; chacun anime localement le timer. Requête `SUBMIT_WORD` -> normalisation et dictionnaire serveur -> commit version/phase/deadline. À `dbNow>=deadlineAt` rejet même si le worker n'a pas encore fait perdre une vie. Aucun timestamp client ne gagne du temps. Idempotence doit être vérifiée avant la deadline : retry d'un mot déjà accepté retourne son reçu, pas un nouveau timeout.

Job `turn_timeout` inscrit à chaque tour. Cron seconde + worker durable applique perte et changement de joueur, même sans entrée utilisateur. Une requête tardive peut accélérer le réveil du job, pas le remplacer. Critère p95 d'affichage transition <2 s après expiration en conditions normales staging. Si échec, le jeu reste beta/non ready et l'infra doit être revue avec mesures. Un modèle de réponse libre n'est jamais appelé pour valider un mot.

Brouillon de mot reste local, adversaire voit seulement « [pseudo] cherche un mot… » et chrono. Mot accepté est révélé immédiatement. Un refus ne révèle pas la tentative à l'autre et ne change pas la version du match ; `ILLEGAL_MOVE` comporte reasonCode, aucune nouvelle deadline. Compter les refus via métrique privée séparée sans réécrire l'état/version à chaque frappe.

## 4. État / projection / commandes / résultats

```ts
type State = {
 schemaVersion:1; phase:'playing'|'finished'; activeSeat:0|1;
 lives:[number,number]; turn:number; validWordsTotal:number;
 sequence:string; recentSequences:string[];
 usedWords:string[]; acceptedWords:{playerId:string;word:string;sequence:string;turn:number}[];
 packId:string; packChecksum:string;
 correctCounts:[number,number]; timeoutCounts:[number,number];
};
```

Vue contient séquence, vies, actif, chrono, derniers 10 mots acceptés, compteur total ; historique déroulable des mots acceptés autorisé. Pas de liste de suggestions ou de mots possibles en compétition. `SUBMIT_WORD {word:string}` seulement actif ; `RESIGN`/`CLAIM_FORFEIT` communs. Pas de commande client « explode » ni « addLife ». Un numéro de tour est identifié par phaseId.

Score individuel = mots valides, mais outcome décidé par vies/fin ci-dessus. Metrics `{validWords,timeouts,livesRemaining,longestWordLength,meanAcceptedResponseMs}` ; conserver sumResponseMs/count pour moyenne. Réponse mesurée début tour -> heure de commit. Round_results : un enregistrement par tour clos avec sequence/word? /actor/outcome/responseMs/livesAfter. Stats par difficulté/rulesVersion pour records ; entraînement exclu des duels.

## 5. Entraînement

Route `/entrainement/syllabes`, membre authentifié, aucun salon/match compétitif requis. Modes libre (pas de timer) et chrono solo (15 s, configurable 5..30). Choisir une séquence 2/3 lettres ou tirage ; recherche locale du joueur puis bouton Indice (affiche longueur et première lettre d'un mot admissible), bouton Suggestions (max 20 mots triés longueur croissante puis ordre alphabétique, pagination curseur). Afficher accents d'origine et souligner séquence. Bouton « Révéler après expiration » coché par défaut mode chrono ; ne pas effacer saisie à expiration.

GET `/api/games/bombparty/training/sequence?difficulty=` -> séquence/count ; GET `/api/games/bombparty/training/suggestions?sequence=&cursor=` -> exemples count/nextCursor ; POST `/api/games/bombparty/training/check` `{sequence,word}` -> valid/reason, sans points de profil. Refuser ces routes **pendant une partie BombParty active du même compte**, pour séparer assistance et compétition. Ce n'est pas une promesse d'empêcher toute recherche externe ou multi-compte.

État solo local/sessionStorage, statistiques de session affichées et remises à zéro ; pas de table d'historique compétitif ni victoire/défaite. Pas d'IA, pas d'envoi chaque frappe, résultats rapides via index. « Mot déjà utilisé » en solo porte sur session courante si option cochée, défaut oui.

## 6. UI / test / exclusions

Grande séquence centrale, input autofocus après changement de tour uniquement si actif, Entrée valide, erreurs courtes sous champ (Absent du dictionnaire / Ne contient pas la séquence / Déjà utilisé / Trop tard). Ne pas vider le champ après refus ; effacer après succès. Vies icon+nombre, timer animation réduite si préférence. Mobile : clavier ouvert sans cacher séquence ni chrono, éviter clavier auto-capitalisé/autocorrect trompeur.

Tests : accents/œ/majuscules, tirets rejetés, séquence contiguë, mêmes mots entre joueurs, replay commandId, refus n'allonge pas chrono, durée décroît aux multiples exacts de 6, plancher 5, timeout sans navigateur, mot/deadline concurrents, job du tour précédent, épuisement index, filtre usedWords, 200 tours départage, suggestions interdites pendant match actif, pagination sans doublons. E2E deux comptes et vrais jobs staging, mesure latence et récupération après interruption worker.

Construction : pipeline lexique et tests -> moteur -> jobs -> UI compétition -> entraînement -> recette rapide. Hors V1 : bonus alphabet, vies gagnées, équipes, chat, affichage live de la saisie adverse, recherche LLM, assistance compétitive.
