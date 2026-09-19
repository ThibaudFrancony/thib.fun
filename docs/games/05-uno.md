# UNO — Dernière carte

Slug `uno`, P1, compétitif à deux, 5–15 min. Règlement simplifié fixé ici : cumul des +2/+4 entre eux (règles `uno-2`), pas de contestation du +4 en V1. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md).

## 1. Paquet et configuration

108 cartes uniques : par couleur red/yellow/green/blue, un 0, deux de 1..9, deux skip, deux reverse, deux draw2 =25×4 ; quatre wild et quatre wild4. Cartes identifiées UUID/instance, pas index mouvant de main. Distribuer 7 à chacun, pioche restante. Première défausse doit être numérique : tirer jusqu'à nombre, remettre les spéciales mises à part dans la pioche et remélanger. Couleur active = couleur du nombre. Premier joueur aléatoire.

Config `{turnSeconds:30, format:'single'}` ; durée options 20/30/60, format single uniquement V1. Une manche = une partie enregistrée. Le bouton revanche crée une nouvelle partie. Pas de score cumulé 500 points.

## 2. Actions légales

Une carte colorée est jouable si couleur active identique ou même symbole/numéro que sommet. Wild jouable toujours. Wild4 jouable **uniquement si aucune carte de la couleur active n'est dans la main au moment de le jouer** ; une carte de même nombre d'une autre couleur ne l'interdit pas. Serveur vérifie sans divulguer la main ; pas de défi +4 V1.

À son tour, jouer une carte ou piocher une seule carte, même si on pouvait jouer. Après pioche, seule cette carte nouvellement piochée peut être jouée, si légale ; sinon passer immédiatement. Si jouable, choix PLAY_DRAWN ou KEEP_DRAWN pendant le temps restant, sans nouveau chrono. On ne peut pas jouer une autre carte de sa main après avoir pioché.

Effets à deux : skip et reverse font rejouer leur auteur. Wild simple change couleur puis passe la main. Draw2/wild4 créent une pénalité en attente et passent la main : l'autre doit contrer avec une carte du même symbole (le cumul grandit de 2 ou 4, couleur libre) ou prendre tout le cumul, auquel cas l'auteur de la dernière pénalité rejoue. Pas de mélange +2/+4, pas d'interception hors tour. Si la carte jouée vide la main, victoire immédiate même sur une pénalité (la pioche adverse s'applique pour le score, sans riposte).

Wild/wild4 : couleur choisie dans la même commande que la carte, après dialogue local ; carte ne part pas avant confirmation. Pas de phase serveur bloquée en attente de choix couleur. Si dernière carte jouée est pénalité, appliquer la pioche adverse puis finaliser victoire. Skip/reverse finissent aussi immédiatement si main vide. Il n'y a pas de « dernier tour » adverse.

## 3. Annonce dernière carte — supprimée (19/09/2026)

La règle d'annonce est retirée du jeu : jouer son avant-dernière carte puis sa dernière carte ne demande aucune case à cocher, aucune annonce et n'entraîne aucune pioche de pénalité. La commande PLAY accepte encore `announceLastCard:boolean` par compatibilité (parties et clients en cours) mais le serveur l'ignore ; `missedAnnouncements` reste dans l'état et les métriques, toujours à 0. On joue simplement, sans mécanique d'interpellation.

## 4. Chrono et blocages

Timeout début de tour : piocher une et la garder, puis passer, même jouable. Timeout après pioche : garder/passer. Timeout face à une pénalité en attente : prendre tout le cumul, l'auteur de la dernière pénalité rejoue. Les automatismes n'annoncent pas de victoire. Pioche vide : remélanger défausse sauf sommet, IDs conservés. Si aucune carte disponible, piocher zéro et passer ; une pénalité prend autant de cartes réellement disponibles, n'en fabrique pas. Deux tours complets successifs sans carte jouée ni pioche possible -> draw `blocked`. Plafond 300 tours -> draw `turn_limit`, sans départage arbitraire par main.

## 5. État et projection

```ts
type Color = 'red'|'yellow'|'green'|'blue';
type Card = {id:string; color:Color|null;
  symbol:'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4'};
type State = {
 schemaVersion:1; phase:'playing'|'after_draw'|'finished';
 activeSeat:0|1; hands:[Card[],Card[]]; drawPile:Card[]; discardPile:Card[];
 activeColor:Color; drawnCardId:string|null;
 pendingPenalty:{symbol:'draw2'|'wild4'; count:number}|null;
 turns:number; blockedTurns:number;
 counters:[PlayerCounters,PlayerCounters];
};
```

`pendingPenalty` est `null` hors cumul ; sinon il porte le symbole attendu pour le contre et le total de cartes à prendre. Les états `uno-1` sans ce champ se lisent comme `null` (compatibilité des parties en cours).

Vue : main propre complète IDs/symboles, nombre de cartes adverse uniquement, sommet défausse, couleur active, taille pioche, pénalité en attente (symbole + total, sans révéler la main adverse), actions et IDs jouables calculés serveur. Pendant une attente, seuls les IDs du symbole attendu sont jouables et `canDraw` signifie « prendre le cumul ». Pas de liste des cartes adverses même dans attributs/accessibilité. Exception documentée (décision du 19/09/2026) : `nextDrawCards` (fenêtre fixe de 8 cartes du sommet, `UNO_DRAW_PREVIEW_LIMIT`) et `nextDrawPlayable` (jouabilité de la première, calculée serveur) sont exposés au **seul joueur dont c'est le tour** pendant `playing`, pour révéler la carte piochée et animer les prises de pénalité en bloc ; `[]`/`false` pour l'autre joueur, hors phase `playing`, ou quand la pioche est vide (recyclage remélangé au tirage). L'ancien `nextDrawCard` reste exposé aux clients déjà chargés (première carte, jamais pendant une pénalité). Le reste de la pioche, la main adverse et l'état complet restent privés. À la fin, révéler main restante adverse pour expliquer les points ; ordre restant pioche toujours caché. Révélation de main post-fin ne justifie pas de l'envoyer pendant le jeu.

## 6. Commandes / résultat

`PLAY_CARD {cardId,chosenColor?:Color,announceLastCard?:boolean}` phase playing ; `DRAW {}` playing (pioche une carte, ou tout le cumul s'il y a une pénalité en attente) ; `PLAY_DRAWN {chosenColor?:Color,announceLastCard?:boolean}` after_draw (ID déduit serveur ; jouer ainsi un +2/+4 crée une pénalité en attente) ; `KEEP_DRAWN {}` after_draw ; RESIGN/CLAIM_FORFEIT communs. `announceLastCard` est optionnel et ignoré (compatibilité des parties en cours). Le serveur refuse chosenColor sur carte non wild, ID adverse, carte non détenue, wild4 illégal (hors riposte, où tout +4 est admis mais la couleur choisie reste exigée), toute carte d'un autre symbole que celui attendu pendant une attente, et le mélange +2/+4. Receipts rendent DRAW idempotent.

Victoire main vide. Score gagnant = valeur des cartes restantes adverses (chiffres valeur faciale, skip/reverse/draw2=20, wild/wild4=50), perdant=0. En draw scores=0, metrics gardent valeurs mains restantes. Ce score informatif ne décide pas une victoire par limite de tours. Forfait : winner score 0 et reason explicite. Metrics `{cardsPlayed,cardsDrawn,penaltyCardsTaken,missedAnnouncements,turns,remainingCards}`. Round_results contient une seule manche finale. Stats victoires + compteurs, pas de classement financier ni ELO ; le classement général du site (19/09/2026) cumule seulement des points par partie.

## 7. UI

Main en éventail léger desktop, rail horizontal défilant mobile. Clic direct sur une carte jouable (aucun bouton Jouer) ; carte non jouable sans popup. Carte jouable distinguée sans masquer les autres. Nombre adverse discret ; pioche centrale cliquable (libellée « Prendre N » pendant une attente) ; couleur active texte+symbole. Un bandeau annonce la pénalité en attente (« +N à prendre ou à contrer avec un +2/+4 »). Après tirage, la carte piochée est surlignée et « Garder la carte » reste disponible. Choix wild : quatre grands boutons accessibles, annuler revient à la main sans mutation. Aucune case d'annonce.

Fluidité d'aller-retour : la table affiche immédiatement la suite déterministe du coup, purement visuelle, pendant que la commande se confirme — à la fin du vol vers la défausse, la carte se pose sur la défausse et le tour passe au siège que le moteur désignerait (skip/reverse font rejouer leur auteur, +2/+4 cumulent et passent la main) ; à la fin du vol de pioche, la carte préchargée rejoint la main et soit le joueur reste en `after_draw`, soit le tour passe ; pour une prise de pénalité, les cartes connues ont déjà leur place réservée et volent une à une vers la main, qui se remplit à chaque atterrissage, puis le tour passe à l'auteur de la pénalité. Une carte qui vient de voler ne rejoue pas d'animation d'arrivée (défausse et main) : les animations `unoCardLand`/`unoCardIn` restent pour les cartes apparues sans vol (début de partie, coup adverse reçu par projection, fin de partie). La projection serveur remplace ces vues dès qu'elle arrive, un échec réseau les retire, et ni la fin de partie ni les commandes ne sont anticipées côté client.

## 8. Tests / exclusions

Conservation 108 cartes, répartition initiale, sommet numérique. Tous effets à deux testés, wild4 selon couleur, cumul +2 (2→4→6 puis prise, refus des autres cartes, prise à chaque palier, timeout qui prend), cumul +4 (4→8, sans restriction de couleur en riposte, couleur choisie exigée), non-mélange +2/+4, victoire immédiate sur dernière carte de pénalité, tirage volontaire avec carte jouable, interdiction jouer autre carte après tirage, garde timeout, absence de pénalité sans annonce, recyclage exact, blocage/300 tours, DRAW retry, main secrète et refresh after_draw. Projection : `nextDrawCards` (fenêtre de 8) et `nextDrawPlayable` exposés au seul joueur actif, masqués pour l'autre et quand la pioche doit être recyclée ; `nextDrawCard` conservé pour compatibilité, jamais pendant une pénalité. Vues optimistes : helpers purs testés (tour passé, skip/reverse, cumul, dernière carte posée sans résultat, après pioche, prise de pénalité progressive, refus hors tour/carte absente) et fixtures E2E (bascule à la fin du vol avant la réponse, pioche préchargée jouable ou non, prise de pénalité en rafale puis confirmation serveur, absence de double animation, retour arrière sur échec). E2E partie finie avec deck fixture déterministe et vraie isolation des sessions.

Hors V1 : défis +4, règle 7–0, échange de mains, interception, élimination, équipes, règles personnalisées. Toute extension modifie rulesVersion, tests et aide avant partie.
