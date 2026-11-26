---
description: "Construire la scène de démonstration (sans mécanisme de jeu) pour valider le style du paysage : clairière et île hexagonale"
agent: agent
---

# Mission : scène de démonstration de Numebois, la plus belle possible (validation du style)

## Contexte à lire d'abord

- `.github/copilot-instructions.md` (règles non négociables, conventions, livraison).
- `.github/instructions/scene-art.instructions.md` (direction artistique, budget tablette).
- `doc/PLAN_ACTION.md`, sections « Décisions », « Rendu : un paysage de plus en plus riche et joli », « Phase 0 » et « Phase R ».
- `doc/GITHUB_WORKFLOW.md` (routes de livraison, CI, commits).
- Prototypes de référence, en local et non commités. À porter en TypeScript, sans les copier tels quels :
  - `assets-private/procedural-trees/kaykit_tree.py` : arbres procéduraux de style KayKit (squelette, tubes 6 côtés, touffes KayKit aux extrémités, pousse par âge) ;
  - `assets-private/forest-seasons/atlas.py` et `make_atlas.py` : cases de couleurs ajoutées à l'atlas KayKit (saisons, écorce de bouleau, pommes) ;
  - `assets-private/forest-seasons/build_seasons.py` : recettes de saison (couleur par touffe en automne, neige par le dégradé et sur les faces tournées vers le ciel) ;
  - `assets-private/forest-seasons/species.py` : découpage des touffes et des troncs KayKit en pièces réutilisables.

## Objectif

Construire une scène de forêt en 3D temps réel, un diorama vu en légère plongée, en deux formes à comparer : une clairière à relief libre et une île de tuiles hexagonales. Elle doit être la plus belle et la plus vivante possible, dans le style cartoon low-poly KayKit. Aucun mécanisme de jeu : pas d'exercice, pas de sentier, pas de sauvegarde, pas d'interface de jeu. Cette étape valide **seulement le look et le style**, sur la station de travail du propriétaire : il jugera sur captures et dans le navigateur, et choisira la forme du tableau. La fluidité sur la tablette sera validée plus tard, mais le budget tablette guide déjà la conception.

## Ce qui est décidé (ne pas remettre en cause)

- Un seul style : KayKit gratuit (CC0). Forest Nature Pack, avec une seule texture de dégradé partagée, enrichie de nouvelles cases de couleur dans ses emplacements libres. Jamais de modification des cases d'origine, ni de mélange avec un autre style (pas de cartes de feuilles en alpha, pas de style « peint »).
- Pour l'île hexagonale : tuiles du Medieval Hexagon Pack gratuit (`assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip` : `hex_grass`, pentes, `hex_river_*`, `hex_coast_*`, `hex_water`, collines, montagnes, nénuphars, plantes d'eau, nuages). Ce pack a sa propre texture (`hexagons_medieval.png`) : un deuxième matériau partagé est accepté. Vérifier si les deux textures peuvent être fusionnées en un seul atlas sans perte.
- Le code compose, KayKit fournit les pièces :
  - procédural en TypeScript : terrain, ruisseau, étang, nappe de la cascade, squelettes et troncs des arbres, placement de tout le reste ;
  - modèles KayKit : touffes de feuillage, rochers, buissons, herbes ;
  - éléments manquants (fleurs, champignons) : générés en TypeScript dans le même style ; le MCP Blender n'est qu'un recours.
- Arbres générés dans le jeu (`src/scene/trees/`) :
  - générateur aléatoire à graine, jamais `Math.random` ;
  - même graine = même arbre ;
  - pousse par âge de 0 à 1 (le même squelette coupé) ;
  - pousse et vent par attributs de sommets dans le shader ;
  - arbres d'un tableau regroupés en un seul appel de dessin (fusion ou `BatchedMesh`).
- Pas de pack payant ni de dépôt privé.
- Les fichiers bruts des packs (`assets/*.zip`) et `assets-private/` ne sont jamais commités, et les assets générés non plus.

## Périmètre

1. **Socle minimal** (phase 0 réduite) :
   - Vite, TypeScript strict, Three.js, ESLint, Prettier, Vitest, Playwright ; `base: '/numebois/'` ;
   - `npm run format` et `npm run check` (format, lint, types, Vitest, build) ;
   - `.github/workflows/ci.yml` avec les jobs `checks`, `e2e` et `Delivery gate`. Ce dernier doit garder exactement ce nom : c'est le contrôle requis sur `main`.
   - Pas encore de service worker ni de job `deploy`.
2. **Assets** :
   - `scripts/build-assets.ts` (glTF-Transform, lancé par `npm run assets`) extrait des zips KayKit locaux les modèles utilisés, les optimise (élagage, quantification, meshopt) et génère l'atlas étendu. Il les écrit dans un dossier ignoré par git, avec un manifeste typé `src/scene/assets.gen.ts`.
   - La disposition de l'atlas est déclarée une seule fois en TypeScript.
   - Si le zip est absent (CI, clone neuf), la scène doit marcher avec des formes de remplacement de même taille : c'est ce qui permet à la CI de passer sans les packs.
3. **Scène**, dans `src/scene/` :
   - deux formes de diorama, à partir de la même description de scène (graine, palier, saison), avec les mêmes arbres, végétation, lumière et effets. Le terrain est un module interchangeable (`?form=clearing|hex`) :
     - **clairière** : relief bas-poly à facettes généré par le code, couleurs de l'atlas selon la hauteur et la pente, bord de falaise propre ; ruisseau tracé par une courbe qui creuse le terrain ;
     - **île hexagonale** : île composée de tuiles du pack (herbe, pentes, rivière, côtes, eau autour) selon un plan généré par graine, avec des niveaux de hauteur ; la rivière suit les tuiles `hex_river_*` ;
   - dans les deux formes, une cascade qui tombe dans un étang ou dans la mer ;
   - eau opaque à couleurs franches, rides et écume animées dans le shader ; berges garnies de rochers et d'herbes ;
   - forêt procédurale (plusieurs familles et graines, lisière qui encadre la clairière), buissons, herbes, fleurs, champignons, rochers ;
   - lumière hémisphérique et soleil, ombres douces limitées au diorama, ciel en dégradé, brouillard teinté, nuages qui dérivent, légère respiration de la caméra ;
   - vie : vent dans la végétation, pollen, papillons, feuilles qui tombent, lucioles au palier 4. Les halos et rayons sont des sprites, sans post-traitement plein écran.
4. **Paliers de richesse 0 à 4** :
   - chaque palier change visiblement l'ambiance (lumière, couleurs, densité, vie), pas seulement le nombre d'objets ;
   - le palier 0 est déjà joli, le palier 4 est « féerique » (lumière dorée, lucioles, cascade étincelante) ;
   - la scène est décrite par des données compactes et déterministes (graine, palier, saison).
5. **Démonstration de pousse** : une touche ou un bouton de débogage fait pousser un arbre à un emplacement, avec étirement, gerbe d'étincelles et de feuilles, et léger mouvement de caméra. C'est un effet visuel, pas une mécanique de jeu.
6. **Saisons** : `season=spring|summer|autumn|winter` change les couleurs du feuillage par les cases de l'atlas (neige par le dégradé).
7. **Mode débogage** `?debug&form=clearing|hex&stage=0..4&season=…&seed=…` :
   - curseurs pour la forme, le palier et la saison ;
   - affichage des images par seconde, appels de dessin, triangles, mémoire graphique, temps de génération des arbres ;
   - paliers de qualité automatiques (haute, moyenne, basse), chaque effet déclarant son comportement à chaque palier.

## Hors périmètre

Exercices, interface de jeu, sentier, Album, sauvegarde, PWA et service worker, son, animaux (aucun pack CC0 validé ; des oiseaux procéduraux très simples sont tolérés), bâtiments du pack hexagonal (sauf un moulin à eau si cela sert la cascade), déploiement sur GitHub Pages, test sur la vraie tablette (étape suivante).

## Budget tablette (guide de conception, compteurs mesurés)

La fluidité n'est pas validée à cette étape, mais les compteurs, qui ne dépendent pas de la machine, doivent déjà respecter le budget, et la conception doit rester réaliste pour la tablette cible (Lenovo Tab M10 Gen 3, GPU Mali-G52 MP2).

- Moins de 100 appels de dessin, moins de 150 000 triangles visibles, environ 64 Mo de mémoire graphique.
- 50 images par seconde visées, 30 au minimum.
- Résolution plafonnée à `min(devicePixelRatio, 1.5)`, 2 en qualité haute.
- Une seule lumière avec ombres. `InstancedMesh` pour tout ce qui est répété.
- Aucune allocation à chaque image ; animation en pause quand l'onglet est caché ; libération (`dispose`) des ressources.

## Vérification

- Vitest :
  - une graine donne un arbre identique (même nombre de sommets, même empreinte des positions) ;
  - nombres de triangles par arbre et pour toute la scène sous le budget ;
  - la disposition de l'atlas ne touche pas les cases d'origine ;
  - le manifeste est cohérent.
- Playwright (émulation tablette, paysage 1280×800) :
  - la scène se charge sans erreur dans la console, avec les formes de remplacement en CI ;
  - captures depuis une caméra fixe, pour chacune des deux formes, aux paliers 0, 2 et 4, et une capture par saison au palier 4.
- Revue visuelle itérative : prendre des captures, les critiquer honnêtement (composition, lisibilité, profondeur, couleurs, cohérence avec KayKit), corriger, recommencer. Donner aux deux formes le même soin pour que la comparaison soit juste. Limiter le nombre d'images par session.
- Compteurs : appels de dessin, triangles et mémoire graphique relevés au palier 4 pour chaque forme, sous le budget. Les images par seconde sur la station de travail sont indicatives seulement.

## Livraison

- Route « risquée » (dépendances, CI, moteur de rendu) :
  - partir de `main` à jour, créer une branche, ouvrir une PR avec le modèle `.github/pull_request_template.md` ;
  - lancer `gh pr merge --auto --squash` sans attendre la CI ;
  - un commit par étape cohérente, avec ses tests.
- Mettre à jour `doc/PLAN_ACTION.md` dans la même PR : décisions prises, recette « ajouter un décor » ajustée. Mettre aussi à jour `.github/instructions/scene-art.instructions.md` si une règle durable apparaît.
- Ne jamais faire de force-push sur `main`, affaiblir un test, ni commiter des packs, `assets-private/` ou des assets générés.

## Quand s'arrêter et demander

Nouveau pack d'assets, changement de direction artistique, publication sur GitHub Pages avec les assets, ou budget tablette impossible à tenir sans sacrifier la beauté : décrire les options et attendre la décision du propriétaire.

## Compte rendu final (en français, court)

- Lien de la PR.
- Pour chaque forme : captures aux paliers 0, 2 et 4 et par saison, puis une comparaison côte à côte des deux formes au palier 4, avec un avis argumenté.
- Compteurs (appels de dessin, triangles, mémoire, temps de génération) par forme.
- Commandes pour lancer la scène sur la station de travail (`npm run assets`, `npm run dev`, URL avec les paramètres).
- Limites restantes et prochaines améliorations proposées.
