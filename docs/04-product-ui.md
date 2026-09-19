# Produit, navigation et direction artistique

## 1. Intention et statut visuel

Site privé de jeux entre amis, français, parties principalement à deux. Interface moderne et ludique, lisible et rapide à comprendre. **Palette, noms et typographie ci-dessous sont des défauts provisoires**, pas une DA visuellement approuvée. Lors de l'implémentation, montrer accueil + salon + un écran de Géographie avant de décliner tous les jeux. Aucun besoin d'image IA ou de logo propriétaire pour construire les moteurs.

Base proposée : fond crème `#F7F7F2`, surfaces blanches, texte `#17211B`, secondaire `#536157`, accent vert `#245B45`, erreur `#B42318`, attention `#8A5300`, bordure `#D6DED7`. Vérifier les contrastes WCAG AA réels dans chaque combinaison ; jamais utiliser un accent clair comme seul texte. Police sans-serif locale/system (`Inter` si embarquée, sinon system-ui), chiffres tabulaires pour chronos et scores. Coins 16 px cartes/12 px boutons, espaces base 4 px, ombres discrètes. Pas de fond animé permanent. Chaque jeu reçoit un accent et une petite illustration vectorielle originale.

## 2. Routes et parcours

| URL | Accès | Contenu |
|---|---|---|
| `/connexion` | public | inscription/connexion e-mail-mot de passe, confirmation e-mail, oubli mot de passe |
| `/auth/callback` | public technique | échange Auth, redirection contrôlée relative |
| `/mot-de-passe` | lien Auth valide | définir nouveau mot de passe |
| `/` | membre | accueil neuf jeux |
| `/jeux/[slug]` | membre | règles courtes, options et créer/rejoindre |
| `/rejoindre` | membre | champ code et erreurs |
| `/rejoindre/[code]` | membre | rejoint par POST après clic explicite, puis salon |
| `/salons/[id]` | participant | attente et réglages |
| `/parties/[id]` | participant | jeu ; fin intégrée au même écran |
| `/profil` | membre | profil éditable à gauche, historique complet à droite |
| `/profil/[id]` | membre | profil d'un tiers en lecture seule + son historique complet |
| `/historique/[id]` | participant | détail résultat/manches |
| `/leaderboard` | membre (invités refusés) | podium top 3 et 100 premiers du classement général aux points |
| `/entrainement/syllabes` | membre | solo BombParty |
| `/admin/invitations` | admin | créer/copier/révoquer liens, pas envoi automatique |

Après connexion, conserver uniquement un `returnTo` relatif allowlisté pour reprendre un lien salon. Jamais une redirection externe libre. Un dépôt GitHub privé ne rend pas automatiquement le site privé : toutes les routes et données métier vérifient l'admission.

## 3. Accueil et navigation

Header : identité tibo.fun, navigation Jeux / Leaderboard / Profil, avatar et déconnexion. L'entrée « Historique » de l'ancien header est supprimée : l'historique se consulte désormais dans le profil. La route `/historique` redirige vers `/profil`. Desktop : largeur max 1200 px, 3 cartes prioritaires dans un bloc « À jouer maintenant », puis grille des 6 autres. Mobile : une colonne, cartes compactes ; aucun carrousel obligatoire cachant les priorités.

Le header porte un bouton **Salon** sur l'accueil **et sur les pages de jeu** : il ouvre une **petite fenêtre ancrée sous le bouton** (sans voile ni flou, fermeture Échap/clic extérieur) avec deux choix « Créer un salon » / « Rejoindre ». Créer ferme la fenêtre et **remplace le bouton par un badge de groupe inline** dans le header : le rond du joueur, la place vide qui se remplit en direct, le code d'invitation et un bouton porte (rouge au survol) pour quitter. Rejoindre demande uniquement le code, puis affiche le badge sans le code. Cliquer le badge rouvre la petite fenêtre avec le détail du groupe et, quand les deux joueurs sont présents, la grille des neuf jeux menant à la page normale du jeu en mode « groupe » : l'hôte règle les options puis clique « Jouer », l'invité attend et rejoint automatiquement la partie. Le salon est mémorisé côté serveur quel que soit le jeu déjà posé et relu en continu (montage, focus, 5 s, Realtime) : un membre ne perd plus son propre groupe en naviguant. Le parcours historique créer/rejoindre depuis une page de jeu reste disponible hors groupe.

Carte : nom d'affichage, illustration, description une phrase, « 2 joueurs », durée indicative issue de la fiche, badge disponible/bêta/bientôt et bouton Jouer. Bientôt désactive Jouer avec explication. Les trois jeux prioritaires restent mis en avant même non implémentés. Bouton global « Rejoindre avec un code ». Si partie active existante, bandeau « Reprendre ma partie ».

Descriptions seed : Chute libre « Réponds juste pour éviter la chute. » ; À ton niveau « Choisis ta difficulté et mise sur tes connaissances. » ; HexaPoint « Place les villes au plus près sur la carte. » ; Douze cases « Révèle et échange tes cartes pour réduire ton total. » ; Dernière carte « Débarrasse-toi de ta main avant ton adversaire. » ; Syllabe Express « Trouve le bon mot avant la fin du chrono. » ; Flotte cachée « Repère et coule la flotte adverse. » ; Même réponse ? « Comparez vos choix et découvrez vos points communs. » ; À l'unisson « Donne un indice et trouvez la même longueur d'onde. »

## 4. Compte et profil

Compte e-mail/mot de passe Supabase Auth, inscription libre et confirmation e-mail si activée par l’environnement. À la création Auth, un profil minimal et l’admission membre sont provisionnés automatiquement côté serveur ; aucune invitation n’est requise. SMTP réel à configurer pour usage entre amis ; documenter reset/confirmation avant mise en service. Pas de pseudo comme identifiant de connexion. À la première connexion, le compte permanent choisit un pseudo unique — le nom de création — avec l'avertissement explicite qu'il ne pourra plus être changé ; les comptes créés avant cette règle conservent leur pseudo existant comme nom de création. Un nom affiché optionnel peut ensuite remplacer l'affichage partout (vide = nom de création affiché). Il est 2–24 caractères et unique sans distinction de casse, comme le nom de création. Presets d’avatar fournis (8 symboles/couleurs), possibilité d'upload JPEG/PNG/WebP <= 2 Mo, réencodé en WebP 256×256 après vérification dimensions <= 4096×4096. Images signées privées, affichage de secours en cas d'URL expirée. Le header porte un bouton Profil (rond photo ou initiale) avec pastille d'alerte tant que le pseudo n'est pas choisi ; la photo est réutilisée dans les salons, groupes et parties.

Profil personnel : photo, nom affiché optionnel, nom de création figé (lecture seule), avatar de secours, historique complet de ses parties (filtres jeu/issue, pagination) présenté à droite de la carte de profil. Dénominateur taux de victoire = wins+losses+draws, hors coop/abandoned ; pas de pourcentage si zéro duel. Afficher séparément les interruptions. Profil d'autrui (`/profil/[id]`) : avatar, nom et agrégats par jeu en lecture seule, plus **son historique complet** (adversaires variés). Le détail d'une partie (`/historique/[id]`) reste réservé aux participants : une entrée où le visiteur n'a pas joué n'est pas cliquable. Jamais son e-mail. La décision du 19 septembre 2026 remplace la règle « pas ses parties avec un tiers ».

## 5. Salon

Deux emplacements fixes : avatars/pseudos, état présent/prêt. Code copiable avec feedback et lien copiable ; bouton partage natif si disponible, clipboard sinon. Options du jeu visibles par les deux, éditables par l'hôte seulement. Changer les options annule les deux ready, avec message explicite.

Depuis un salon d'accueil générique ou un salon d'attente déjà associé à un jeu, la page de jeu détecte le groupe (côté serveur ou rattrapage client) et remplace créer/rejoindre par un bandeau « Groupe » (code, joueur(s), quitter). L'hôte règle les options puis « Jouer » (le serveur pose le jeu et arme les deux prêts) ; l'invité voit l'attente et est redirigé dès le démarrage. Il faut deux joueurs connectés et un jeu choisi ; le serveur refuse tout démarrage sans jeu.

Chaque joueur a « Je suis prêt ». Hôte a « Lancer » seulement si deux prêts et corpus disponible ; le serveur répète ces contrôles. Règles adaptées résumées avant start, avec accès aux détails. Hôte non arbitre : questions, tours et corrections sont automatiques.

Si salon plein, code invalide, fermé, expiré ou partie déjà démarrée par d'autres : messages distincts quand cela ne révèle pas de données privées. Un participant existant revient à sa partie. Quitter en attente ne compte aucune partie. Revanche retourne au salon avec mêmes options et prêt=false. Changer de jeu après fin garde les participants et crée un nouveau match au start.

## 6. Cadre commun de partie

Header compact : retour salon avec confirmation si abandon, nom jeu, état connexion. Bandeau deux joueurs avec score et indicateur de tour (texte + forme + couleur). Zone centrale spécifique, action principale en bas sur mobile sans recouvrir contenu. Timer lisible lorsqu'il existe. Afficher « À toi », « Au tour de [pseudo] », « En attente de sa réponse », « Vérification… » ou « Résultats » selon état réel.

Sélection locale modifiable avant validation, bouton désactivé pendant envoi, indicateur réseau si réponse tarde. Aucun brouillon privé diffusé (mot, placement ville, réponse quiz ou compatibilité). Pas besoin de chat : indice longueur-onde est l'unique texte envoyé volontairement à l'autre. Animation de carte/révélation 150–300 ms, séquence non bloquante et `prefers-reduced-motion` respecté. Son optionnel désactivé par défaut, activation explicite persistée localement ; pas nécessaire à la réussite.

## 7. Résultats et historique

Écran fin : victoire/défaite/égalité ou score partagé, valeurs finales, détail des manches, adversaire, durée, raison si forfait/interruption ; boutons revanche, changer de jeu, historique. Un résultat coopératif ne montre jamais « Tu as perdu ».

Historique paginé par curseur `(ended_at,match_id)`, 20 lignes/cartes par page. Filtres jeu, issue ; date affichée fuseau navigateur (Europe/Paris par défaut si absent). L'historique vit dans le profil (`/profil` pour soi, `/profil/[id]` pour un tiers) en colonne droite de la carte, DA violette, chaque carte mène au détail si le visiteur a participé. Détail : score et règles utilisées, réponses révélées/manches, pas cartes restées secrètes non prévues par la fiche. Pseudo snapshot dans chaque partie et pseudo actuel dans le header du profil.

## 8. Accessibilité et responsive

Recette minimale 360×800, 390×844, 768×1024, 1440×900. Pas de scroll horizontal de page ; cartes de main peuvent défiler dans leur zone identifiée. Cibles tactiles >= 44×44 px. Focus visible, tabulation cohérente, boutons natifs, labels, erreurs reliées au champ. `aria-live=polite` pour changement de tour/résultat, pas annonce chaque tick. Cartes identifiées par texte/symbole en plus des couleurs. Dialogues piègent puis restaurent le focus.

Carte Géographie et cadran longueur-onde ont navigation clavier décrite dans leurs fiches. Grilles navales et cartes accessibles par flèches + Entrée/Espace. Aucune mécanique imposant drag-and-drop seul. Loading skeleton initial, état vide pour historiques, messages erreurs réessayables, fallback avatar. Tester aussi clavier mobile ouvert et zoom navigateur 200 %.

## 9. Hors périmètre UI

Pas d'écran paiement, publicité, invitations e-mail envoyées par notre app, thème personnalisable ou marché d'avatars. Mode sombre après V1 seulement si demandé. Ne pas remplir l'interface de noms techniques Supabase/LLM/RPC : « Vérification de ta réponse » suffit.

Chat et amis ont été sortis du hors-périmètre le 18 septembre 2026 (voir §10) et le classement inter-jeux le 19 septembre 2026 (voir §12) ; le vocal, lui, reste exclu.

Depuis le mode inscription, « Continuer en tant qu’invité » ouvre un dialogue précisant que le pseudo et la progression ne seront pas sauvegardés. La session anonyme reçoit un pseudo aléatoire serveur et peut jouer dans les salons ; elle ne dispose pas d’historique, de statistiques ni de profil de compte permanent. La perte de la session navigateur est définitive pour cet invité.

## 10. Chat et amis — décision du 18 septembre 2026

Décision produit : ajouter un chat de site et des amis, alors que le cadrage initial plaçait « messagerie » hors périmètre V1. Le vocal reste hors périmètre.

- Une flèche discrète reste ancrée au bord droit de toutes les pages. Elle ouvre une barre latérale violet sombre conforme à la maquette fournie : onglets « Général » et « Amis » avec pastilles de non-lus, compteur de messages, compteur approximatif de membres en ligne (activité < 2 min).
- Le chat général est lisible par tout membre actif, invités anonymes compris ; seuls les comptes permanents écrivent. Chaque message montre pseudo, heure (date dès que le message n'est plus du jour) et contenu ; les jours sont séparés (« Hier · 17 septembre »). Cliquer un pseudo propose « Profil » (page `/profil/[id]` du joueur) et « Ajouter en ami » avec les états déjà ami, demande envoyée ou reçue.
- L'onglet Amis liste les demandes reçues (Accepter/Refuser), les demandes envoyées et « Mes amis » avec présence, aperçu et non-lus. Un ami ouvre une conversation privée texte et photo ; il peut être retiré depuis la liste. Une photo est jointe par import ou Ctrl+V, compressée dans le navigateur (1280 px, WebP ~150 Ko) puis re-vérifiée et réencodée côté serveur.
- Notifications : pastilles de non-lus temps réel et son discret (WebAudio, coupable, débloqué au premier geste utilisateur). Accessibilité : `role="tablist"`, `role="log"`, Échap ferme les menus, focus visible, cibles ≥ 44 px, `prefers-reduced-motion` respecté.
- Chargement : les 30 derniers messages du général et des conversations existantes sont préchargés dès l'ouverture du site et conservés en cache par conversation. Rouvrir un onglet ou revenir sur une conversation affiche le cache instantanément, sans requête bloquante ; le haut du scroll charge 30 messages plus anciens à la fois. Le temps réel ne rafraîchit en direct que la conversation visible ; les autres entrées sont marquées à revalider en arrière-plan à la prochaine ouverture. Une requête en cours pour une même page n'est jamais dupliquée.
- Une demande d'ami refusée peut être renvoyée plus tard ; la suppression d'un ami conserve les messages en base mais rend la conversation inaccessible.

## 11. Administration (18/09/2026)

Page `/admin`, réservée au compte Auth dont l'e-mail figure dans `private.admin_accounts` (liste blanche en base, semée avec l'adresse du propriétaire). Toute autre personne, y compris un membre connecté, est renvoyée vers l'accueil ; le contrôle est refait côté serveur puis côté base, jamais seulement dans l'interface.

- **Visibilité des jeux** : liste des neuf jeux avec un interrupteur Actif / Désactivé. Un jeu désactivé disparaît du carousel et de la liste de l'accueil, mais sa route reste accessible par URL directe. La bascule est persistée immédiatement et le retour visuel est optimiste (interrupteur désactivé pendant l'appel).
- **Discussions** : vue type messagerie en lecture seule. Colonne de gauche séparant « Chat général » et « Messages privés » avec recherche par pseudo ; zone de droite affichant la conversation sélectionnée, les deux participants (pseudo et avatar), les messages, les photos (clic pour agrandir) et les dates. L'admin n'apparaît pas comme participant, ne peut pas écrire dans une conversation privée et aucune RPC d'envoi ne lui est exposée. Le fil utilise le même composant de messages que le chat du site, avec l'action « Ajouter en ami » désactivée.
- Le rendu reprend la DA violet sombre du chat, avec des transitions discrètes et un repli responsive (liste au-dessus de la conversation sur mobile).

## 12. Classement général — décision du 19 septembre 2026

Décision produit : ajouter un système de points inter-jeux et une page de classement, alors que le cadrage initial plaçait « classement mondial » hors périmètre V1.

- Bouton **Leaderboard** dans le header, visible pour les comptes permanents connectés (les invités et les visiteurs ne le voient pas), placé entre le bouton **Salon** (accueil, pages de jeu et salon) et l'avatar de profil.
- Page `/leaderboard` : podium des trois premiers (or/argent/bronze, avatar, pseudo, points) puis liste des 100 premiers avec rang, avatar, pseudo, victoires/défaites/égalités et points. Le rang du joueur courant est mis en évidence s'il est dans le top 100, sinon une carte « Ton rang » rappelle sa position. Un compte sans point voit un message d'invitation à terminer une partie.
- Barème : victoire +10, défaite +5, match nul +7, réussite coopérative +10, partie terminée sans vainqueur 0. Tous les jeux comptent ; le score interne d'un jeu n'est jamais mélangé au cumul. Les invités ne marquent pas de point et ne consultent pas le classement. Les parties déjà terminées sont recomptées avec ce barème.
- Accessibilité et responsive : podium à trois colonnes jusqu'à 640 px puis versions compactes, cibles ≥ 44 px, pas de dépendance à la couleur seule (rang et points en texte).
- Interaction (19/09/2026) : cliquer un joueur (carte du podium ou ligne du Top 100) ouvre un menu « Profil » (page `/profil/[id]`) ou « Demander en ami » (`POST /api/friends/requests`, libellé et état repris du chat). Le joueur courant n'a pas de menu ; Échap ou un clic hors du menu le referme. La couronne du premier passe derrière le rond de son avatar.
- DA (19/09/2026) : refonte visuelle spatiale sombre. Fond spatial fixe (`cover`, `center`, `fixed`) avec overlay bleu nuit léger, header translucide flouté, titre gradient blanc→violet, podium 2/1/3 (couronne dorée au-dessus du premier, badges argent « 2 » et bronze « 3 » en chevauchement), panneau Top 100 sombre avec lignes or/argent/bronze. Seuls quatre assets fournis sont utilisés (`public/leaderboard/space-bg.png`, `crown.png`, `badge-2.png`, `badge-3.png`) ; les avatars viennent toujours des photos/presets réels du site. Aucun autre élément graphique n'est créé.

## 13. Profils publics et historique — décision du 19 septembre 2026

Décision produit : supprimer la page liste `/historique` et regrouper profil et historique, y compris pour le profil d'un tiers, alors que le cadrage initial prévoyait `/joueurs/[id]` et interdisait de montrer « ses parties avec un tiers ».

- `/historique` n'existe plus en tant que page : la route redirige vers `/profil`. L'entrée « Historique » du header est retirée sur toutes les variantes.
- `/profil` (compte permanent) affiche deux colonnes sur desktop : la carte de profil éditable à gauche, l'historique complet à droite (filtres jeu/issue, pagination, DA violette). Sur mobile les colonnes s'empilent.
- `/profil/[id]` (UUID) affiche le profil d'un tiers en lecture seule (avatar, nom, agrégats par jeu) et **son historique complet**. Réservé aux comptes permanents ; les invités sont refusés. Visiter son propre identifiant redirige vers `/profil`.
- L'ancienne page `/historique/duo/[id]` redirige vers `/profil/[id]` ; le menu « Profil » du chat et du leaderboard pointe désormais vers `/profil/[id]`.
- Le détail d'une partie (`/historique/[id]`) reste réservé aux participants et est re-skinné dans la DA violette ; sur le profil d'un tiers, les entrées où le visiteur n'a pas joué ne sont pas cliquables.
- Aucune migration : les agrégats `player_game_stats` sont déjà lisibles par tout membre et `history_entries` reste lu côté serveur.
