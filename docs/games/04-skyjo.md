# Skyjo — Douze cases

Slug `skyjo`, P1, compétitif à deux. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md). Variante V1 définie ici, incluant règles de fin précises ; ne pas importer d'autres variantes au souvenir d'un jeu physique.

## 1. Matériel et but

150 cartes uniques avec valeurs : cinq -2, quinze 0, dix de chacune des valeurs -1 et 1..12 (13 valeurs ×10). Chaque instance a un UUID/ID unique indépendant de sa valeur. Mélanger serveur ; distribuer 12 cartes à chacun en grille de 3 lignes ×4 colonnes, index `row*4+col`, puis une carte face visible à la défausse, reste pioche. Valeurs peuvent être négatives ; plus petit score final gagne.

Config `{format:'short',turnSeconds:60}`. Options short = 3 manches, full = seuil cumulé 100, avec maximum 20 manches ; turnSeconds 30/60/90. Short finit après exactement 3 manches. Full finit après une manche où au moins un total atteint 100, ou limite 20 ; comparer plus petits totaux, égalité possible. Noms modes « Rapide : 3 manches » / « Complet : jusqu'à 100 points ».

## 2. Préparation et ordre

Phase `setup` simultanée, 60 s : chaque joueur choisit exactement deux indices distincts à révéler. Cliquer sélectionne localement, `REVEAL_INITIAL` confirme les deux ensemble. Timeout sélectionne aléatoirement les emplacements manquants (zéro validé avant commande donc deux). Les deux cartes de chaque joueur deviennent visibles à tous immédiatement après sa confirmation. À la première manche, somme la plus grande commence ; égalité aléatoire serveur. Manches suivantes, alterner premier siège par rapport au premier de la manche précédente. Totaux cumulés n'influencent pas l'ordre.

## 3. Tour complet

1. `choose_source` : choisir défausse ou pioche.
2. Défausse : prendre carte visible puis obligatoirement remplacer un emplacement de sa grille encore présent, caché ou visible. La nouvelle carte est visible ; ancienne part visible à la défausse.
3. Pioche : seul le joueur actif voit la carte tirée ; choisir soit remplacement comme ci-dessus, soit défausser la tirée puis révéler une de ses cartes encore cachées.
4. Après action complète, supprimer chaque colonne présente dont les trois cartes sont visibles et de même valeur. La colonne supprimée conserve ses trois trous (aucune compression). Envoyer ses cartes vers pile `removed`, pas la défausse : c'est notre choix V1 explicite.
5. Si toutes les cartes restantes de l'actif sont visibles, déclencher la fin de manche ; l'adversaire a exactement un dernier tour. Si une fin était déjà déclenchée, ne pas ajouter encore un tour.
6. À fin du dernier tour : révéler toutes cartes restantes, supprimer aussi les colonnes complètes identiques nouvellement révélées, compter les valeurs restantes.

Pénalité du déclencheur : si son score brut est strictement positif et n'est pas **strictement inférieur** à celui de l'autre, doubler son score de manche. Score nul/négatif jamais doublé. Ajouter ensuite au cumulé. Exemples : 15 vs 12 -> 30 vs12 ; 10 vs10 ->20 vs10 ; -2 vs-3 -> -2 vs-3. Cette règle est figée dans rulesVersion.

## 4. Timeouts et pioche vide

Un seul budget de tour, démarré à choose_source ; choisir une source ne réinitialise pas deadline. Timeout choose_source : piocher puis jeter et révéler la carte cachée de plus petit index ; si aucune cachée, remplacer la carte présente de plus petit index par la tirée. Timeout après prise de défausse : remplacer plus petit index présent. Timeout après pioche : même politique jeter/révéler, ou remplacer si aucune cachée. Ces automatismes terminent réellement le tour et appliquent colonnes/fin.

Pioche vide : conserver sommet de défausse, remélanger le reste en pioche. Si aucune carte recyclable, `TAKE_DRAW` interdit et la défausse reste jouable. Auto-timeout utilise défausse. Impossible si les deux piles vides = invariant moteur violé -> incident technique/abandoned, pas inventer carte. Les cartes removed ne sont pas recyclées V1. Maximum 200 tours par manche ; à ce seuil révéler et compter sans pénalité déclencheur, puis passer manche suivante.

## 5. État et projection

```ts
type Card = {id:string; value:number};
type Cell = {card:Card; revealed:boolean}|null;
type State = {
 schemaVersion:1;
 phase:'setup'|'choose_source'|'resolve_draw'|'replace_discard'|'round_reveal'|'finished';
 round:number; activeSeat:0|1; firstSeat:0|1;
 grids:[Cell[],Cell[]]; initialReady:[boolean,boolean];
 drawPile:Card[]; discardPile:Card[]; removed:Card[];
 heldCard:Card|null;
 closingSeat:0|1|null; finalTurnsRemaining:number;
 turns:number; cumulative:[number,number];
 acknowledgedBy:string[];
};
```

Projection : grille propre et adverse avec `{slot,revealed,value?}` ; **une carte cachée est inconnue même de son propriétaire**, ne pas envoyer son ID réel. Carte tirée tenue visible à l'actif seulement ; adversaire voit une carte de dos et la phase. Exposer sommet défausse et nombre pioche/removed, pas ordre ni seed. Colonnes supprimées null. Pendant round_reveal exposer grilles finales, scores bruts/pénalité/cumulés, durée 10 s ou NEXT des deux.

## 6. Actions et persistance

`REVEAL_INITIAL {slots:[number,number]}` setup ; `TAKE_DRAW {}` choose_source ; `TAKE_DISCARD {}` choose_source ; `REPLACE {slot}` après source ; `DISCARD_AND_REVEAL {slot}` seulement resolve_draw et slot caché ; NEXT/RESIGN/CLAIM_FORFEIT communs. La phase replace_discard interdit de jeter la carte prise. Le payload n'inclut jamais valeur/id de carte choisie par client.

Toutes données dans état privé commun ; aucun corpus nécessaire. Round summary : grilles finales après suppression, scores bruts/pénalité/cumulés, déclencheur, nombre de tours. player score = total cumulé ; metrics `{roundsPlayed,rawPointsSum,penalties,columnClears,automaticTurns}`. Records distincts short/full ; score le plus bas meilleur. Pas de classement mélangeant les scores de durées différentes ; le classement général du site (19/09/2026) cumule seulement des points par partie.

## 7. UI

Grille perso en bas, adverse compacte au-dessus, pioche/défausse au centre. Carte tenue agrandie côté actif ; les cibles valides sont soulignées. Toutes actions réalisables clic/tap, pas drag obligatoire. Cartes cachées dos identique sans valeur dans aria-label ; colonnes supprimées restent espaces. Règles et panneau récap explicitent les 3 étapes possibles et le dernier tour. Couleurs par plages valeurs accompagnées des nombres.

## 8. Tests / séquence / exclusions

Conservation exacte des 150 cartes dans piles/grilles/main/removed ; mêmes valeurs n'impliquent pas mêmes IDs. Tester remplacement caché/visible, suppression une et plusieurs colonnes, choix de source et illégalité, timeout dans chaque sous-phase, recyclage, fin déclenchée par suppression de toutes cartes, un seul dernier tour, pénalité exemples, limite 200, score négatif, égalité de fin. Projection ne révèle jamais carte cachée ni carte tenue adverse. E2E fin de manche, refresh au milieu d'une pioche, score historique.

Construire moteur/tests avant animations, puis grilles et RPC, puis formats. Hors V1 : cartes spéciales, plus de deux joueurs, colonnes compressées, règles maison configurables. Durée attendue 10–20 min short, 20–40 min full, indicative.
