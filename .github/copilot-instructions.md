# Numebois : instructions de travail

Répondre en français. Réponses courtes ; signaler les limites restantes.

Numebois est un jeu web de maths pour un enfant de CE2 (8 ans, grande difficulté à se concentrer), sur une tablette Lenovo Tab M10 Gen 3 (Android, GPU d'entrée de gamme Mali-G52 MP2, 4 Go de RAM). Chaque exercice réussi fait grandir une forêt en 3D cartoon low-poly (Three.js, modèles KayKit CC0 complétés avec le MCP Blender). La vision, les décisions, le glossaire et les recettes sont dans `doc/PLAN_ACTION.md` (source de vérité). Le workflow GitHub est dans `doc/GITHUB_WORKFLOW.md`. Lire la section concernée avant d'agir, sans tout relire.

État actuel : socle (Vite, TypeScript, Preact, Three.js, tests, CI), paysage dans `src/scene/` avec quatre décors déclarés dans `src/scene/biomes/` (la clairière, dont le relief grandit avec les paliers, le Verger des collines, `?biome=orchard`, les Îles du ciel, `?biome=sky`, et la montagne des torrents, `?biome=mountain`, chacun avec ses emplacements et ses grands moments, qui arrivent avec les paliers) et sentier jouable (M1 en cours) : moteur (`src/core/` : contrats, maîtrise, faits, sentier, `Session`), notion « écrire en chiffres » de `numbers`, sept notions de `mental-math`, ardoise d'exercice avec Plume (modèle 3D animé), pavé, réserve de feuilles et de graines dorées (les feuilles du sentier passent par le panier de Plume, versé à la fin), chemin de pierres, résumé et tableau de bord parent caché (`src/ui/parent-menu.tsx`, `dashboard.tsx` : appui long sur la réserve ; suivi, réglage des notions, rafale recommandée), le jeu s'ouvre sur le paysage, à explorer aux doigts (#72), où un appui fait réagir animaux et arbres (#28), avec le sentier en bas et son panneau « Chemin du progrès » (un appui le commence, il reste en bas, plus petit, pendant les questions), progression et tableau en cours sauvegardés dans IndexedDB (`src/save/`), Plume demande le prénom de l'enfant au lancement tant qu'il manque (#138, `?name=` le donne sans le demander) ; entre deux sentiers, un appui sur la réserve ouvre la boutique (`src/scene/shop.ts`, `src/ui/shop.tsx`, sans nom dans le jeu), qui vend une pousse en feuilles, posée à la place que l'enfant choisit parmi 2 ou 3 qui brillent, et les animaux, les saisons, la nuit et les éléments rares (lucioles, arc-en-ciel, castors, moulin, montgolfière) du tableau en graines dorées (barre des saisons et de la nuit à côté du son) ; le palier suit le nombre d'éléments posés. Le tableau complet a son grand final, son cadre et entre dans l'Album (`src/save/album.ts`, `src/ui/album.tsx`, gardé à part dans IndexedDB), puis l'enfant choisit le décor suivant (`src/ui/finale.tsx`). La rafale (M2) part de la souche « Par cœur », en bas à droite entre deux sentiers (`src/core/drill.ts`, `src/ui/drill.tsx`), et ne travaille que les notions à faits, ce qui se sait par cœur ; elle s'ouvre sur l'arbre de ce qu'on sait par cœur (`src/ui/fact-tree.tsx`) : un arbre par notion à faits, une branche par groupe, une feuille par fait, un appui sur une branche lance sa rafale ; le panneau « Défi », en bas à gauche, lance le panier de glands et la course de la feuille, que l'écureuil propose aussi après un sentier réussi (`src/core/challenge.ts`, `records.ts`, `src/ui/challenge.tsx`). Restent les autres domaines et notions, et l'équilibrage du jeu (jalon « Équilibrage du jeu, temps et économie », #29 en dernier). Le jeu est publié sur https://plonk42.github.io/numebois/ à chaque push sur `main` qui passe la CI, installable et jouable hors-ligne (PWA) ; `?scene` montre le paysage seul, `?practice=<notion>&level=<n>` une notion seule sans sauvegarde, `?sandbox` le jeu sans sauvegarde avec son panneau de raccourcis (depuis le panneau `?debug`).

## Règles non négociables

- Objectif n°1 : que l'enfant ait **envie** de revenir. Le **rendu du paysage passe avant tout** : un paysage de plus en plus riche et joli est sa motivation première.
- Aucune punition : aucune ressource perdue, pas de série perdue, pas de compte à rebours, pas de classement, aucune formulation d'échec. Chronomètre seulement dans les défis, toujours refusables.
- Progression : l'enfant accumule des feuilles (bonnes réponses) et des graines dorées (apprentissages) et les dépense quand il le décide, dans la boutique de fin de sentier ; les paliers avancent avec les éléments posés (plan, « Boucle de progression »).
- Pas de ferme : l'enfant prendra tout raccourci rentable. Les gains suivent la difficulté et la nouveauté ; ni rater exprès, ni répéter le plus facile ne rapporte plus que travailler à son niveau.
- Pendant une question, une seule chose à l'écran, rien qui distrait.
- Le mot « leçon » n'apparaît pas dans le jeu (« Plume te montre une astuce ») ; les devoirs de la semaine sont des « quêtes ».
- Réglages pédagogiques (notions et astuces disponibles, niveaux, focus, devoirs de la semaine, défi à proposer) : seulement dans le tableau de bord parent, sur la tablette. Jamais de processus programmatique (fichier de quête, activation par la date, mise à jour du jeu).

## Conventions

- Code (identifiants, fichiers, dossiers) en anglais. Textes du jeu, leçons, docs et personnalisations Copilot en français. Termes : voir le glossaire du plan (sentier = `Trail`, rafale = `Drill`, tableau = `Painting`, quête = `Quest`…).
- Architecture :
  - `src/core/` : moteur générique ;
  - `src/domains/<domain>/` : un module par domaine, enregistré dans `src/domains/index.ts` ;
  - `src/ui/widgets/` : widgets partagés ;
  - `src/scene/` : rendu, décors, tableaux.

  Tout le contenu est en TypeScript (pas de YAML).

- Seulement des assets gratuits (KayKit CC0, animaux Quaternius CC0) et des compléments générés (code ou MCP Blender) : pas de pack payant, pas de dépôt privé. Les fichiers bruts des packs et nos `.blend` ne sont pas commités pour l'instant (`assets/`, `assets-private/` ignorés).
- Dépôt public : le prénom de l'enfant n'apparaît nulle part (code, docs, commits, tickets) ; écrire « l'enfant ». Commits avec le compte personnel (`plonk42@gmail.com`), jamais l'adresse professionnelle.

## Livrer

- Partir de `main` à jour (`git pull --ff-only`). Ne jamais mettre de côté (stash), réinitialiser, jeter ni commiter des modifications sans rapport.
- `main` = production : un push déploie sur la tablette de l'enfant si la CI passe.
- **Courant** (interface, notions, leçons, textes, docs, tests, petites corrections) : `npm run format`, `npm run check` et les specs Playwright concernées, puis commit et push sur `main`.
- **Risqué** (format de sauvegarde ou de l'Album, service worker, moteur de rendu partagé, chaîne de traitement des assets, CI, dépendances) : branche, PR avec le modèle, `gh pr merge --auto --squash`, sans attendre la CI.
- Un commit par étape cohérente, avec ses tests et ses docs. Résumé à l'impératif, `(#N)` ou `Closes #N`. Ne jamais faire de force-push sur `main`, affaiblir un test ni ajouter de relances pour obtenir du vert.
- Tests déterministes (propriétaire) : aucun résultat ne dépend du temps qui passe ni de la charge de la machine. Temps de jeu sur l'horloge murale, figée et avancée par le test (`page.clock.setFixedTime`) ; `?seed=` fixe aussi les questions. Une attente bornée sur un état observable reste permise.
- Ticket avancé sans être fermé : y ajouter un commentaire court une fois livré (commit ou PR, ce qui est fait, ce qui reste).
- Ordre (propriétaire) : prendre les tickets dans l'ordre de leurs dépendances (bloquants d'abord) et **finir puis fermer** chacun (`Closes #N`) avant le suivant, plutôt qu'avancer plusieurs tickets à moitié. Ce qui dépend d'un ticket encore à faire (Album, tableau…) part dans un ticket ou un commentaire, pas en suspens.
- Changement d'interface : vérification en émulation tablette en paysage 1280×800 (la tablette n'est jamais utilisée en portrait). Changement de rendu : captures avant/après aux paliers 0, 6 et 11, et budget tablette mesuré. Un nouveau décor demande la validation du propriétaire.
- Le jeu est une surprise pour l'enfant, qui le recevra prêt à l'emploi : ne jamais prévoir d'étape « observer l'enfant ». Le propriétaire valide en jouant à sa place.
- Sauvegardes : compatibilité obligatoire une fois que le propriétaire a déclaré « l'enfant joue pour de vrai » (voir le workflow).
- Lancer les commandes longues en mode synchrone et attendre leur fin. Ne jamais interroger une commande en arrière-plan avec `sleep` ou `tail`.
- Un seul écrivain par fichier : un fichier modifié par les outils d'édition n'est jamais réécrit depuis le terminal (`prettier --write`, scripts de remplacement) dans la même étape ; formater une fois avant le commit, `git diff` à l'appui. Après un `git rebase`/`checkout`, relire le disque avant d'éditer. Conflit « le contenu du fichier est plus récent » : le disque fait foi (rétablir, jamais écraser).

## Tenir le plan et les personnalisations à jour

- À chaque demande de fonctionnalité, mettre à jour dans le même commit le plan (décisions, recettes, journal en bas du fichier). Le tableau de couverture se met à jour à chaque jalon terminé.
- Utiliser le skill adapté s'il existe (liste dans le plan, section « Personnalisations Copilot ») : `visual-review` pour tout changement de rendu.
- **Auto-amélioration :** quand le propriétaire exprime une préférence durable ou corrige la façon de faire, l'enregistrer au bon endroit dans le même commit, puis le signaler en une ligne à la fin de la réponse :
  - règle transversale → ce fichier ;
  - règle liée à certains fichiers → `.github/instructions/*.instructions.md` ;
  - procédure répétable → skill `.github/skills/<nom>/SKILL.md`.

  Supprimer les doublons et les règles périmées ; garder chaque fichier court. Une procédure qui revient une deuxième fois devient un skill.
