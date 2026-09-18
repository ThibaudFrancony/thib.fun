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
| `/profil` et `/joueurs/[id]` | membre | soi éditable, tiers public |
| `/historique` | membre | ses parties et filtres |
| `/historique/[id]` | participant | détail résultat/manches |
| `/duo/[id]` | membre concerné | moi contre cet utilisateur |
| `/entrainement/syllabes` | membre | solo BombParty |
| `/admin/invitations` | admin | créer/copier/révoquer liens, pas envoi automatique |

Après connexion, conserver uniquement un `returnTo` relatif allowlisté pour reprendre un lien salon. Jamais une redirection externe libre. Un dépôt GitHub privé ne rend pas automatiquement le site privé : toutes les routes et données métier vérifient l'admission.

## 3. Accueil et navigation

Header : identité tibo.fun, navigation Jeux / Historique / Profil, avatar et déconnexion. Desktop : largeur max 1200 px, 3 cartes prioritaires dans un bloc « À jouer maintenant », puis grille des 6 autres. Mobile : une colonne, cartes compactes ; aucun carrousel obligatoire cachant les priorités.

Le header d'accueil porte aussi un bouton **Salon** : il ouvre une **petite fenêtre ancrée sous le bouton** (sans voile ni flou, fermeture Échap/clic extérieur) avec deux choix « Créer un salon » / « Rejoindre ». Créer ferme la fenêtre et **remplace le bouton par un badge de groupe inline** dans le header : le rond du joueur, la place vide qui se remplit en direct, le code d'invitation et un bouton porte (rouge au survol) pour quitter. Rejoindre demande uniquement le code, puis affiche le badge sans le code. Cliquer le badge rouvre la petite fenêtre avec le détail du groupe et, quand les deux joueurs sont présents, la grille des neuf jeux menant à la page normale du jeu en mode « groupe » : l'hôte règle les options et lance, l'invité attend et rejoint automatiquement la partie. Le parcours historique créer/rejoindre depuis une page de jeu reste disponible hors groupe.

Carte : nom d'affichage, illustration, description une phrase, « 2 joueurs », durée indicative issue de la fiche, badge disponible/bêta/bientôt et bouton Jouer. Bientôt désactive Jouer avec explication. Les trois jeux prioritaires restent mis en avant même non implémentés. Bouton global « Rejoindre avec un code ». Si partie active existante, bandeau « Reprendre ma partie ».

Descriptions seed : Chute libre « Réponds juste pour éviter la chute. » ; À ton niveau « Choisis ta difficulté et mise sur tes connaissances. » ; HexaPoint « Place les villes au plus près sur la carte. » ; Douze cases « Révèle et échange tes cartes pour réduire ton total. » ; Dernière carte « Débarrasse-toi de ta main avant ton adversaire. » ; Syllabe Express « Trouve le bon mot avant la fin du chrono. » ; Flotte cachée « Repère et coule la flotte adverse. » ; Même réponse ? « Comparez vos choix et découvrez vos points communs. » ; À l'unisson « Donne un indice et trouvez la même longueur d'onde. »

## 4. Compte et profil

Compte e-mail/mot de passe Supabase Auth, inscription libre et confirmation e-mail si activée par l’environnement. À la création Auth, un profil minimal et l’admission membre sont provisionnés automatiquement côté serveur ; aucune invitation n’est requise. SMTP réel à configurer pour usage entre amis ; documenter reset/confirmation avant mise en service. Pas de pseudo comme identifiant de connexion. À la première connexion, le compte permanent choisit un pseudo unique — le nom de création — avec l'avertissement explicite qu'il ne pourra plus être changé ; les comptes créés avant cette règle conservent leur pseudo existant comme nom de création. Un nom affiché optionnel peut ensuite remplacer l'affichage partout (vide = nom de création affiché). Il est 2–24 caractères et unique sans distinction de casse, comme le nom de création. Presets d’avatar fournis (8 symboles/couleurs), possibilité d'upload JPEG/PNG/WebP <= 2 Mo, réencodé en WebP 256×256 après vérification dimensions <= 4096×4096. Images signées privées, affichage de secours en cas d'URL expirée. Le header porte un bouton Profil (rond photo ou initiale) avec pastille d'alerte tant que le pseudo n'est pas choisi ; la photo est réutilisée dans les salons, groupes et parties.

Profil personnel : photo, nom affiché optionnel, nom de création figé (lecture seule), avatar de secours, parties terminées, victoires, défaites, égalités, parties coopératives ; section par jeu. Dénominateur taux de victoire = wins+losses+draws, hors coop/abandoned ; pas de pourcentage si zéro duel. Afficher séparément les interruptions. Profil d'autrui : ces agrégats, bouton « Notre historique », pas ses parties avec un tiers ni son e-mail.

## 5. Salon

Deux emplacements fixes : avatars/pseudos, état présent/prêt. Code copiable avec feedback et lien copiable ; bouton partage natif si disponible, clipboard sinon. Options du jeu visibles par les deux, éditables par l'hôte seulement. Changer les options annule les deux ready, avec message explicite.

Depuis un salon d'accueil générique, la page de jeu détecte le groupe et remplace créer/rejoindre par un bandeau « Groupe » (code, joueur(s), quitter). L'hôte règle les options puis « Lancer la partie » (le serveur pose le jeu et arme les deux prêts) ; l'invité voit l'attente et est redirigé dès le démarrage. Il faut deux joueurs connectés et un jeu choisi ; le serveur refuse tout démarrage sans jeu.

Chaque joueur a « Je suis prêt ». Hôte a « Lancer » seulement si deux prêts et corpus disponible ; le serveur répète ces contrôles. Règles adaptées résumées avant start, avec accès aux détails. Hôte non arbitre : questions, tours et corrections sont automatiques.

Si salon plein, code invalide, fermé, expiré ou partie déjà démarrée par d'autres : messages distincts quand cela ne révèle pas de données privées. Un participant existant revient à sa partie. Quitter en attente ne compte aucune partie. Revanche retourne au salon avec mêmes options et prêt=false. Changer de jeu après fin garde les participants et crée un nouveau match au start.

## 6. Cadre commun de partie

Header compact : retour salon avec confirmation si abandon, nom jeu, état connexion. Bandeau deux joueurs avec score et indicateur de tour (texte + forme + couleur). Zone centrale spécifique, action principale en bas sur mobile sans recouvrir contenu. Timer lisible lorsqu'il existe. Afficher « À toi », « Au tour de [pseudo] », « En attente de sa réponse », « Vérification… » ou « Résultats » selon état réel.

Sélection locale modifiable avant validation, bouton désactivé pendant envoi, indicateur réseau si réponse tarde. Aucun brouillon privé diffusé (mot, placement ville, réponse quiz ou compatibilité). Pas besoin de chat : indice longueur-onde est l'unique texte envoyé volontairement à l'autre. Animation de carte/révélation 150–300 ms, séquence non bloquante et `prefers-reduced-motion` respecté. Son optionnel désactivé par défaut, activation explicite persistée localement ; pas nécessaire à la réussite.

## 7. Résultats et historique

Écran fin : victoire/défaite/égalité ou score partagé, valeurs finales, détail des manches, adversaire, durée, raison si forfait/interruption ; boutons revanche, changer de jeu, historique. Un résultat coopératif ne montre jamais « Tu as perdu ».

Historique paginé par curseur `(ended_at,match_id)`, 20 lignes/cartes par page. Filtres jeu, issue ; date affichée fuseau navigateur (Europe/Paris par défaut si absent). Détail : score et règles utilisées, réponses révélées/manches, pas cartes restées secrètes non prévues par la fiche. Duel : nombre de confrontations compétitives, victoires de chacun, égalités, sessions coopératives et meilleurs scores communs séparés ; filtre par jeu. Pseudo snapshot dans chaque partie et pseudo actuel dans le header du profil.

## 8. Accessibilité et responsive

Recette minimale 360×800, 390×844, 768×1024, 1440×900. Pas de scroll horizontal de page ; cartes de main peuvent défiler dans leur zone identifiée. Cibles tactiles >= 44×44 px. Focus visible, tabulation cohérente, boutons natifs, labels, erreurs reliées au champ. `aria-live=polite` pour changement de tour/résultat, pas annonce chaque tick. Cartes identifiées par texte/symbole en plus des couleurs. Dialogues piègent puis restaurent le focus.

Carte Géographie et cadran longueur-onde ont navigation clavier décrite dans leurs fiches. Grilles navales et cartes accessibles par flèches + Entrée/Espace. Aucune mécanique imposant drag-and-drop seul. Loading skeleton initial, état vide pour historiques, messages erreurs réessayables, fallback avatar. Tester aussi clavier mobile ouvert et zoom navigateur 200 %.

## 9. Hors périmètre UI

Pas d'écran paiement, publicité, chat, invitations e-mail envoyées par notre app, thème personnalisable, marché d'avatars ou classement mondial. Mode sombre après V1 seulement si demandé. Ne pas remplir l'interface de noms techniques Supabase/LLM/RPC : « Vérification de ta réponse » suffit.

Depuis le mode inscription, « Continuer en tant qu’invité » ouvre un dialogue précisant que le pseudo et la progression ne seront pas sauvegardés. La session anonyme reçoit un pseudo aléatoire serveur et peut jouer dans les salons ; elle ne dispose pas d’historique, de statistiques ni de profil de compte permanent. La perte de la session navigateur est définitive pour cet invité.
