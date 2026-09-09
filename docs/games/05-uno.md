# UNO — Dernière carte

Slug `uno`, P1, compétitif à deux, 5–15 min. Règlement simplifié fixé ici ; pas de cumul des pénalités ou de contestation de +4 en V1. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md).

## 1. Paquet et configuration

108 cartes uniques : par couleur red/yellow/green/blue, un 0, deux de 1..9, deux skip, deux reverse, deux draw2 =25×4 ; quatre wild et quatre wild4. Cartes identifiées UUID/instance, pas index mouvant de main. Distribuer 7 à chacun, pioche restante. Première défausse doit être numérique : tirer jusqu'à nombre, remettre les spéciales mises à part dans la pioche et remélanger. Couleur active = couleur du nombre. Premier joueur aléatoire.

Config `{turnSeconds:30, format:'single'}` ; durée options 20/30/60, format single uniquement V1. Une manche = une partie enregistrée. Le bouton revanche crée une nouvelle partie. Pas de score cumulé 500 points.

## 2. Actions légales

Une carte colorée est jouable si couleur active identique ou même symbole/numéro que sommet. Wild jouable toujours. Wild4 jouable **uniquement si aucune carte de la couleur active n'est dans la main au moment de le jouer** ; une carte de même nombre d'une autre couleur ne l'interdit pas. Serveur vérifie sans divulguer la main ; pas de défi +4 V1.

À son tour, jouer une carte ou piocher une seule carte, même si on pouvait jouer. Après pioche, seule cette carte nouvellement piochée peut être jouée, si légale ; sinon passer immédiatement. Si jouable, choix PLAY_DRAWN ou KEEP_DRAWN pendant le temps restant, sans nouveau chrono. On ne peut pas jouer une autre carte de sa main après avoir pioché.

Effets à deux : skip et reverse font rejouer leur auteur. Draw2 fait piocher deux à l'autre et lui saute son tour, l'auteur rejoue. Wild4 fait piocher quatre à l'autre et lui saute son tour, l'auteur rejoue. Wild simple change couleur puis passe la main. Pas d'empilement de +2/+4, pas d'interception hors tour.

Wild/wild4 : couleur choisie dans la même commande que la carte, après dialogue local ; carte ne part pas avant confirmation. Pas de phase serveur bloquée en attente de choix couleur. Si dernière carte jouée est pénalité, appliquer la pioche adverse puis finaliser victoire. Skip/reverse finissent aussi immédiatement si main vide. Il n'y a pas de « dernier tour » adverse.

## 3. Annonce dernière carte

Pour éviter une course réseau injuste, variante explicite : quand une carte jouée fait passer la main de 2 à 1, afficher avant validation un bouton/checkbox « Dernière carte ! ». La commande PLAY inclut `announceLastCard:boolean`. Si false lors de ce passage, tirer automatiquement deux cartes de pénalité pour l'auteur immédiatement après son jeu, avant d'appliquer l'effet de la carte ; aucune fenêtre de dénonciation dépendant de la latence. Si l'auteur termine de 1 à 0, pas d'annonce exigée.

On peut afficher un bouton permanent d'annonce qui arme ce booléen pour **la prochaine carte seulement**, reset après toute action/phase. Le serveur ne doit pas faire confiance à une annonce antérieure sans lien avec le PLAY courant. Cette adaptation est expliquée avant partie ; ne pas promettre la mécanique classique d'interpellation.

## 4. Chrono et blocages

Timeout début de tour : piocher une et la garder, puis passer, même jouable. Timeout après pioche : garder/passer. Les automatismes n'annoncent pas de victoire. Pioche vide : remélanger défausse sauf sommet, IDs conservés. Si aucune carte disponible, piocher zéro et passer ; une pénalité prend autant de cartes réellement disponibles, n'en fabrique pas. Deux tours complets successifs sans carte jouée ni pioche possible -> draw `blocked`. Plafond 300 tours -> draw `turn_limit`, sans départage arbitraire par main.

## 5. État et projection

```ts
type Color = 'red'|'yellow'|'green'|'blue';
type Card = {id:string; color:Color|null;
  symbol:'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4'};
type State = {
 schemaVersion:1; phase:'playing'|'after_draw'|'finished';
 activeSeat:0|1; hands:[Card[],Card[]]; drawPile:Card[]; discardPile:Card[];
 activeColor:Color; drawnCardId:string|null;
 turns:number; blockedTurns:number;
 counters:[PlayerCounters,PlayerCounters];
};
```

Vue : main propre complète IDs/symboles, nombre de cartes adverse uniquement, sommet défausse, couleur active, taille pioche, actions et IDs jouables calculés serveur. Pas de liste des cartes adverses même dans attributs/accessibilité. À la fin, révéler main restante adverse pour expliquer les points ; ordre restant pioche toujours caché. Révélation de main post-fin ne justifie pas de l'envoyer pendant le jeu.

## 6. Commandes / résultat

`PLAY_CARD {cardId,chosenColor?:Color,announceLastCard:boolean}` phase playing ; `DRAW {}` playing ; `PLAY_DRAWN {chosenColor?:Color,announceLastCard:boolean}` after_draw (ID déduit serveur) ; `KEEP_DRAWN {}` after_draw ; RESIGN/CLAIM_FORFEIT communs. Le serveur refuse chosenColor sur carte non wild, ID adverse, carte non détenue, wild4 illégal. Receipts rendent DRAW idempotent.

Victoire main vide. Score gagnant = valeur des cartes restantes adverses (chiffres valeur faciale, skip/reverse/draw2=20, wild/wild4=50), perdant=0. En draw scores=0, metrics gardent valeurs mains restantes. Ce score informatif ne décide pas une victoire par limite de tours. Forfait : winner score 0 et reason explicite. Metrics `{cardsPlayed,cardsDrawn,penaltyCardsTaken,missedAnnouncements,turns,remainingCards}`. Round_results contient une seule manche finale. Stats victoires + compteurs, pas de classement financier ou classement ELO.

## 7. UI

Main en éventail léger desktop, rail horizontal défilant mobile avec sélection puis bouton Jouer. Carte jouable distinguée sans masquer les autres. Nombre adverse très visible ; pioche centrale clic explicite ; couleur active texte+symbole. Après tirage, afficher seulement Jouer cette carte / Garder. Choix wild : quatre grands boutons accessibles, annuler revient à la main sans mutation. Afficher l'annonce dernière carte à côté de la validation quand main=2.

## 8. Tests / exclusions

Conservation 108 cartes, répartition initiale, sommet numérique. Tous effets à deux testés, wild4 selon couleur, tirage volontaire avec carte jouable, interdiction jouer autre carte après tirage, garde timeout, pénalité annonce et effet spécial combinés, dernière carte +2/+4, recyclage exact, blocage/300 tours, DRAW retry, main secrète et refresh after_draw. E2E partie finie avec deck fixture déterministe et vraie isolation des sessions.

Hors V1 : stacking, défis +4, règle 7–0, échange de mains, interception, élimination, équipes, règles personnalisées. Toute extension modifie rulesVersion, tests et aide avant partie.
