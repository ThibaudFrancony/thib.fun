# Géographie — HexaPoint

Slug `geographie`, P0, compétitif à deux, 8–15 min. Premier jeu recommandé pour valider tout le socle. Dépendances [architecture](../01-architecture.md), [SQL](../02-database.md), [API](../03-api-realtime.md), [UI](../04-product-ui.md).

## 1. Règles et configuration

France métropolitaine et Corse en V1. Une ville par manche, deux placements simultanés : chacun place et valide sans attendre l'autre, dans l'ordre qu'il veut. Personne ne voit ni proposition ni distance ni score adverse avant la révélation commune ; le premier qui valide attend simplement la validation adverse. Révéler les deux seulement quand les deux ont validé (ou à l'expiration de l'échéance partagée). Le plus grand total de points gagne. Égalité si totaux égaux, sans utiliser subrepticement la distance pour départager.

Config : `{rounds:10, turnSeconds:60, difficulty:'easy', selection:'random'}`. Options rounds 5/10/15, turnSeconds 30/60/90, difficulty easy/medium/hard, selection random/challenge. Noms UI : grandes villes/villes moyennes/toutes les communes du pack. Aucun DOM avec noms de villes de référence autour du pointeur.

Mode random : tirer sans remise dans un pack publié. Mode challenge : avant la partie, le premier siège tiré fournit `ceil(rounds/2)` villes et l'autre `floor(rounds/2)` villes, distinctes. Le serveur compose la liste en alternant leurs sélections. Doublon entre listes : le premier à confirmer garde sa ville, l'autre doit remplacer l'item en conflit avant confirmation. Ce mode est amical et identifié séparément dans stats car le proposant connaît mieux ses villes. Les deux jouent chaque ville. Les coordonnées ne sont jamais envoyées par l'autocomplete, seulement ID/nom/département.

## 2. Corpus et carte

Payload ville : `{inseeCode:string,name:string,departmentCode:string,departmentName:string,latitude:number,longitude:number,population:number,populationYear:number,difficulty:'easy'|'medium'|'hard',sourceUrl:string}`. Difficulté : easy population >= 100000, medium 20000..99999, hard < 20000 ; ces pools sont distincts. Pack hard limité à une sélection revue de communes, pas promesse toutes les communes françaises. Minimum pack ready : 30 easy, 100 medium, 200 hard ; ne proposer un niveau que si assez d'items publiés.

Carte SVG issue de frontières sourcées avec licence incluse. Projection d3-geo de type conique conforme adaptée à la métropole, `fitExtent` avec marge sur GeoJSON, mêmes calculs d'inversion partout. Pas de projection CSS inventée pour convertir pixels en latitude. Corse incluse à sa position géographique réelle, pas encart déplacé sans transformation inverse dédiée. Pas de labels de villes, pas de tuiles externes ; frontières de départements option affichée fixe V1 = non, littoral et frontières nationales seulement.

Le client inverse les coordonnées du pointeur en lon/lat via projection et transformation zoom/pan. Serveur accepte uniquement nombres finis, longitude [-6,10], latitude [41,52] ; point dans cette bbox accepté même en mer (ne pas faciliter par snapping au littoral). Validation mobile : appui place, poignée déplaçable, puis Confirmer. Point jamais envoyé avant validation. Bouton recentrer conserve le point sélectionné.

## 3. Calcul précis du score

Distance Haversine sur sphère rayon `6371.0088 km`, radians, clamp de l'intermédiaire a dans [0,1] avant asin. Formule `d=2*R*asin(sqrt(a))`, avec a = sin²(dLat/2)+cos(lat1)*cos(lat2)*sin²(dLon/2). Utiliser la distance non arrondie pour score :

`points = round(1000 * exp(-max(0, distanceKm - 5) / 100))`.

Tolérance tactile : 0–5 km => 1000. Exemples : 105 km => 368 ; 205 km => 135 ; 505 km => 7. Bornes [0,1000]. Timeout sans point confirmé => 0 et distance null, pas une distance fictive. Afficher distance arrondie 1 décimale sous 100 km, entier au-delà ; cette présentation n'affecte pas score.

Score final somme des points ; distance moyenne calculée sur placements valides seulement, accompagnée de nombre de placements/manqués. Ne pas récompenser l'absence par une moyenne trompeuse sans compteur. Aucun LLM ni géocodage live.

## 4. État et phases

```ts
type State = {
  schemaVersion:1;
  phase:'select_cities'|'placing'|'reveal'|'finished';
  round:number; firstSeat:0|1; turnInRound:0|1;
  cityIds:string[];
  challengeSelections:[string[],string[]];
  challengeConfirmed:[boolean,boolean];
  placements:[{lat:number;lon:number;distanceKm:number;points:number}|null,
              {lat:number;lon:number;distanceKm:number;points:number}|null];
  submitted:[boolean,boolean];
  totals:[number,number];
  acknowledgedBy:string[];
};
```

`select_cities` a 180 s de préparation ; timeout conserve les listes confirmées et remplit les autres slots par tirage autorisé sans doublon (les brouillons valides sont conservés quand possible), puis démarre. `firstSeat` est constant (composition du mode challenge, tirage initial) ; round commence à 1. `placing` : les deux sièges sont actifs simultanément pendant 60 s par défaut (échéance partagée unique). `turnInRound` est conservé dans l'état pour compatibilité mais ignoré : le premier `PLACE_CITY` reste dans la même phase et la même échéance sans réarmer le chrono adverse, le second fait passer en reveal 8 s, calcule les points de la manche pour les deux et crédite ensemble. Chaque placement est enregistré en privé ; la projection adverse ne révèle que submitted=true. NEXT des deux avance plus tôt. Totaux précédents restent identiques durant les deux placements pour ne pas révéler l'erreur de l'autre.

Projection placing : label ville/département, manche/totaux avant manche, actif pour chaque siège non encore validé, propre placement confirmé visible pour son auteur seulement (marqueur avatar + pseudo de l'auteur). Chaque joueur de la vue porte `avatarPreset` (preset public, photo signée chargée côté client via les avatars du salon). Reveal : cible vraie, deux placements avec photo de profil + pseudo au-dessus de chaque guess (plus de pointeur de couleur anonyme), distances, points et nouveaux totaux. Planning des villes futures caché. Le sélectionneur voit sa propre liste de challenge pendant préparation, pas celle adverse.

## 5. API spécifique et stockage

`SEARCH_CITIES` est un GET `/api/games/geographie/cities?q=&difficulty=` renvoyant max 20 ID/labels sans coordonnées, membre seulement. `SET_CITY_SELECTION {cityIds:string[]}` en préparation pour sa liste exacte (remplaçable jusqu'à confirmation) ; `CONFIRM_CITY_SELECTION {}` verrouille liste ; `PLACE_CITY {latitude:number,longitude:number}` chaque siège, une fois par manche, ordre libre (double validation = `PLACEMENT_ALREADY_SUBMITTED`) ; `NEXT`, `RESIGN`, `CLAIM_FORFEIT` communs. Les listes confirmées peuvent être invalidées par doublon global : ne révéler que « Une ville est déjà retenue, choisis-en une autre », sans l'ensemble adverse ; résolution déterministe premier commit conserve son choix.

Tables communes + pack geography. Round summary : cityId/nom/département/coordonnées révélées, placements/points/distances de chaque joueur. player score = points totaux ; metrics `{distanceSumKm,validPlacements,missedPlacements,bestDistanceKm}`. Stats séparées par selection/difficulty/rounds/rulesVersion pour records, compteurs victoire généraux par jeu.

## 6. UI / clavier

Carte prend la zone principale, aucune confirmation par simple clic. Afficher nom demandé et département pour homonymes. Zoom molette/pinch, boutons +/− et recentrer, déplacement tactile distinct du tap par seuil 8 px. Clavier : focus carte, flèches déplacent curseur de 5 pixels d'écran, Shift de 20, Entrée pose le point ; bouton Confirmer accessible ensuite. Instructions annoncées, lon/lat du curseur disponibles en texte accessible sans position cible. Après validation, le joueur voit son propre marqueur et l'état « Placement envoyé — en attente de ton partenaire ». Résultat : photo de profil + pseudo au-dessus de chaque guess (le plus proche se lit directement à la distance de la cible), distances/points dans le panneau ; le point exact reste matérialisé au sol.

## 7. Tests et critères

- Haversine zéro, Paris–Lyon ordre de grandeur, cas longitude/latitude inversées, NaN/Infinity et bbox refusés.
- Score exact exemples 0/5/105/205/505 ; affichage arrondi sans modifier calcul.
- Pointeur -> inversion -> reprojection à < 1 pixel, après resize/zoom/pan ; test Corse.
- A valide : B ne reçoit ni point/distance/score de A (seulement submitted=true) ; après la seconde validation, révélation et crédit unique, quel que soit l'ordre.
- Premier placement : même phaseId et même échéance conservés, pas de nouveau chrono ; second placement : reveal.
- Timeout de l'échéance partagée : tout siège sans placement reçoit 0 et distance null, révélation immédiate (0/0 si aucun placement).
- Ordre libre et égalité finale correcte.
- Challenge : homonymes distingués, doublon simultané, timeout préparation, listes cachées ; pas de coordonnées dans recherche.
- E2E partie 5 manches, refresh après premier placement, fin/historique/duo ; mobile placement sans scroll parasite.

## 8. Exclusions et construction

Construire carte/corpus/import, moteur pur de score, projections secrètes, partie random complète, puis challenge. Les deux modes font partie du périmètre décrit mais random peut être la première tranche. Pas de Street View, pays étrangers, adresses, suivi GPS du joueur, carte avec labels. Chronomètre unique partagé par manche (une seule échéance `turn_timeout` pour les deux placements simultanés).
