---
description: "Use when working on landscape rendering or the asset pipeline : rendu Three.js du paysage, style cartoon low-poly KayKit, effets, décors, tableaux, paliers de richesse, MCP Blender, budget tablette, glTF."
applyTo: "src/scene/**, scripts/build-assets.ts"
---

# Rendu du paysage (Three.js, cartoon low-poly)

Le rendu est la priorité n°1 : un paysage de plus en plus riche et joli est la motivation première de Sacha. Détails dans `doc/PLAN_ACTION.md`, section « Rendu ».

## Direction artistique

- Un seul style : le cartoon low-poly des packs KayKit (formes simples et arrondies, couleurs franches, une seule texture de dégradé partagée). Ne jamais mélanger de modèles d'un autre style.
- Les modèles créés avec le MCP Blender partent d'un modèle KayKit proche. Ils réutilisent la même texture de dégradé (pas de nouveau matériau ni de nouvelle texture), avec la même échelle et une densité de polygones comparable.
- Une nouvelle couleur (saison, décor) = une nouvelle case de dégradé dans un emplacement libre de l'atlas KayKit (cases de 128×256), jamais une modification des cases d'origine ; la variante ne change que les UV. Scripts dans `assets-private/forest-seasons/`.
- Arbres de la forêt : procéduraux dans le style KayKit (décision du propriétaire). Le squelette et les tubes low-poly lisses (case d'écorce KayKit) viennent du code, les feuillages sont des touffes KayKit ; pas de cartes de feuilles en alpha ni de style « peint ». La croissance coupe le même squelette selon l'âge. Prototype : `assets-private/procedural-trees/kaykit_tree.py`.
- Les arbres sont générés dans le jeu en TypeScript (`src/scene/trees/`), pas exportés de Blender : générateur à graine (jamais `Math.random`), arbres d'un tableau regroupés en un appel de dessin, pousse et vent par attributs de sommets. Blender sert aux nouvelles pièces et aux rendus de contrôle, ou en cas de blocage.
- Les effets du code (lumière, brouillard, particules, halos) restent dans la palette de la texture de dégradé et de la lumière du tableau.
- Les emplacements sont composés à la main et lisibles depuis la caméra. Chaque choix proposé à Sacha doit donner une belle scène.
- Chaque palier de richesse (0 à 4) change visiblement l'ambiance (lumière, ciel, densité, vie), et pas seulement le nombre d'objets. Le palier 0 est déjà joli.
- Chaque nouveau décor apporte au moins un effet inédit et dépasse le précédent.
- Les animations de pousse et de récompense ne sont jamais coupées, même en qualité basse.

## Budget tablette (Android milieu de gamme)

- Moins de 100 appels de dessin, moins de 150 000 triangles visibles, environ 64 Mo de mémoire graphique, 50 images par seconde visées et 30 au minimum.
- `InstancedMesh` pour la végétation répétée, et un matériau partagé.
- Résolution plafonnée (`min(devicePixelRatio, 1.5)`, 2 en qualité haute).
- Une seule lumière directionnelle avec ombres, et une carte d'ombres limitée au diorama.
- Pas de post-traitement plein écran en qualité moyenne ou basse : halos et rayons sont simulés par des sprites.
- Vent et eau en shader de sommets (`onBeforeCompile`), désactivables.
- Aucune allocation à chaque image dans la boucle de rendu (vecteurs et matrices réutilisés). Animations en pause quand l'onglet est caché.
- Libérer (`dispose`) géométries, matériaux et textures quand on quitte un tableau ou l'Album.
- Paliers de qualité automatiques : tout nouvel effet déclare son comportement en qualité moyenne et basse.

## Données et assets

- Un tableau est décrit par des données compactes et déterministes (décor, graine, éléments posés). Le même rendu doit se rejouer à l'identique dans l'Album.
- Le code ne référence les modèles qu'à travers le manifeste généré (`src/scene/assets.gen.ts`), jamais par un chemin écrit à la main.
- Seulement les packs KayKit gratuits ; les modèles manquants sont générés. Les fichiers bruts des packs et nos `.blend` restent en local (`assets/`, `assets-private/`, ignorés par git) pour l'instant. Seuls les glTF optimisés par la chaîne de traitement entrent dans le build.

## Vérification

Pour tout nouveau décor, modèle ou effet :

- captures avant/après depuis une caméra fixe, aux paliers 0, 2 et 4 ;
- mesures avec `?debug` (images par seconde, mémoire, appels de dessin, triangles), en qualité haute et basse.

Un nouveau décor demande la validation du propriétaire.
