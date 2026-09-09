# Bataille navale — Flotte cachée

Slug `bataille-navale`, P1, duel compétitif, 10–20 min. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [UI](../04-product-ui.md).

## 1. Grille et règles fixes

Grille 10×10, coordonnées internes row/col 0..9, UI lignes A–J et colonnes 1–10. Cinq bateaux : carrier longueur 5, battleship4, cruiser3, submarine3, destroyer2, soit 17 cases. Rectilignes horizontaux ou verticaux, pas diagonaux ; aucun chevauchement ou dépassement. **Bateaux autorisés à se toucher**, y compris côtés et diagonales ; ne pas marquer automatiquement l'eau autour d'un coulé.

Chacun place secrètement sa flotte puis confirme. Premier tireur aléatoire. Un tir par tour, toucher/couler **ne fait pas rejouer**. Quand les 17 cases de flotte adverse ont été touchées, victoire immédiate, pas de dernier tour. Aucun tir sur case déjà visée. Partie sans chronomètre de tir par défaut ; options turnSeconds null/60, default null. Préparation limite 180 s, puis placement automatique des éléments manquants.

Config Zod stricte : `{turnSeconds:null}`, champ autorisant uniquement null ou 60. Dimensions, catalogue de bateaux, contact autorisé et préparation 180 s sont des constantes de rulesVersion, pas des options client modifiables.

## 2. Placement

Brouillon local : sélectionner bateau, orientation, cellule d'origine ; afficher prévisualisation valide/invalide avant confirmer localement. Bouton pivoter et placer aléatoirement. `SET_FLEET` enregistre le brouillon complet ou partiel côté serveur pour reprise (debounce >=500 ms après placement, pas chaque mouvement pointeur). La projection personnelle retrouve le brouillon ; adverse voit seulement ready booléen.

`READY_FLEET` exige cinq bateaux uniques et positions valides, verrouille la flotte. `UNREADY_FLEET` autorisé tant que l'autre n'a pas confirmé et phase reste setup ; le deuxième READY peut déjà déclencher playing, ce qui interdit toute modification. Le serveur décide sous verrou/version. Aucun bateau changé après premier tir.

Placement aléatoire par backtracking avec choix mélangés ; conserver les bateaux déjà fixés lorsqu'on complète au timeout, avec backtracking sur le placement entier si aucun complément possible. Bouton aléatoire volontaire remplace toute la flotte. Limiter tentatives et utiliser un algorithme exhaustif fini pour cette petite grille, pas une boucle aléatoire infinie. Si timeout un joueur déjà prêt, ne pas modifier sa flotte.

## 3. Tir et informations

`FIRE {row,col}` actif seulement. Serveur calcule miss/hit/sunk ; pour sunk renvoie shipId/type et cellules du bateau coulé (elles ont toutes déjà été touchées). Adversaire reçoit coordonnées du tir et résultat sur sa grille. Tour passe après animation locale non bloquante ; state déjà committé. Afficher dernier tir distingué des anciens.

Si option 60 s et timeout, tirer automatiquement sur une case inconnue aléatoire du plateau adverse, sélection serveur sans utiliser les positions cachées pour biaiser le choix ; cela peut toucher/gagner. Message « Tir automatique » explicite. Sans timer, deadline principale null ; jobs d'absence communs restent actifs. Hôte ne peut pas voir flotte adverse ou choisir ses tirs automatiques.

## 4. État et projections

```ts
type Ship = {id:'carrier'|'battleship'|'cruiser'|'submarine'|'destroyer';
 row:number;col:number;orientation:'horizontal'|'vertical';length:number};
type Shot = {row:number;col:number;result:'miss'|'hit'|'sunk';shipId?:string;automatic:boolean};
type State = {
 schemaVersion:1; phase:'setup'|'playing'|'finished';
 fleets:[Ship[],Ship[]]; ready:[boolean,boolean]; activeSeat:0|1;
 shots:[Shot[],Shot[]]; // shots[0] = tirs du joueur0 sur flotte1
 turn:number; lastShot:{by:0|1;shot:Shot}|null;
};
```

La longueur est déduite d'un catalogue serveur, jamais crue depuis payload. Projections : flotte propre, tirs reçus, propres tirs, ready adverse, nombre/type de bateaux coulés, actif ; pas de flotte adverse avant finished. Vue de fin peut révéler les deux flottes, y compris en forfait/abandoned pour les participants seulement. Ne pas inclure d'IDs de bateaux dans un simple hit avant coulé si cela révèle quel bateau est touché : l'état privé peut l'avoir, la projection doit l'omettre.

## 5. Actions et stockage

`SET_FLEET {ships:[{id,row,col,orientation}]}` setup non ready, liste partielle valide ; `RANDOMIZE_FLEET {}` setup non ready ; `READY_FLEET {}` ; `UNREADY_FLEET {}` ; `FIRE {row,col}` ; RESIGN/CLAIM_FORFEIT communs. Requêtes malformées flottants/out-of-range refusées. SET_FLEET et RANDOMIZE changent version, donc collisions d'enregistrement doivent être réévaluées sans écraser un READY committé.

État commun uniquement, aucun corpus. `round_results` : un enregistrement final pour partie avec flottes révélées et journal des tirs, sans besoin de table cellule. `player_results.score` = nombre de cases adverses touchées (0..17) ; outcome par destruction/forfait, pas score seul. Metrics `{shots,hits,misses,sunkShips,automaticShots}` ; précision hits/shots, nulle si0. Statistiques moyennes utilisent sommes. Résultat affiche durée et tours.

## 6. UI

Desktop : grille de tirs à gauche, ma flotte à droite ; mobile : onglets « Mes tirs » / « Ma flotte », badge dernier tir adverse, ma grille miniature facultative. Cases de grille sur 360 px peuvent être <44 px visuellement : fournir mode zoom/grille agrandie et navigation clavier ; ne pas prétendre que 10 cases de 44 tiennent dans 320. Une case sélectionnée se confirme avec bouton « Tirer en B7 », évitant clic accidentel. Focus grille par roving tabindex, flèches déplacent, Entrée sélectionne, bouton confirme. Les hits/misses ont symbole et couleur.

Préparation : liste cinq bateaux/longueurs, rotation, aléatoire, état valide et prêt. Corps adverse montre simplement « Place sa flotte… ». Aide : toucher ne rejoue pas, bateaux peuvent se toucher. Fin : révélation et récap 17 cases/coulés/précision.

## 7. Tests et recette

Validation orientations/bords/chevauchement/IDs manquants/duplicats et bateaux adjacents autorisés. Backtracking produit flotte 17 cases sans overlap. Tir répété refuse sans consommer tour ; hit ne rejoue pas ; sunk seulement après toutes cases ; dernier hit finit une fois. Projections hit ne révèlent pas shipId non coulé. Modification après READY/start interdite ; deux READY simultanés démarrent une fois. Timeout auto choisit uniquement inconnu et peut gagner. E2E setup/refresh, match à deck flotte déterministe, history, tiers C incapable de lire flottes via API directe.

Hors V1 : radar, mines, salves, déplacement bateaux, mode IA, 3D, grille variable, tir simultané. Un simple tableau de boutons peut suffire, la rigueur concerne le moteur et les secrets.
