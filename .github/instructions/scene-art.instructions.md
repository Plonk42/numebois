---
description: "Use when working on landscape rendering or the asset pipeline : rendu Three.js du paysage, style cartoon low-poly KayKit, effets, décors, tableaux, paliers de richesse, MCP Blender, budget tablette, glTF."
applyTo: "src/scene/**, scripts/build-assets.ts"
---

# Rendu du paysage (Three.js, cartoon low-poly)

Le rendu est la priorité n°1 : un paysage de plus en plus riche et joli est la motivation première de l'enfant. Détails dans `doc/PLAN_ACTION.md`, section « Rendu ».

## Direction artistique

- Un seul style : le cartoon low-poly des packs KayKit (formes simples et arrondies, couleurs franches, une seule texture de dégradé partagée). Ne jamais mélanger de modèles d'un autre style.
- Les modèles créés avec le MCP Blender partent d'un modèle KayKit proche. Ils réutilisent la même texture de dégradé (pas de nouveau matériau ni de nouvelle texture), avec la même échelle et une densité de polygones comparable.
- Une nouvelle couleur (saison, décor) = une nouvelle case de dégradé dans un emplacement libre de l'atlas KayKit (cases de 128×256), jamais une modification des cases d'origine ; la variante ne change que les UV. La disposition est déclarée une seule fois dans `src/scene/atlas.ts` (chaîne d'assets et jeu) ; les cases utiles du Medieval Hexagon y sont copiées au pixel près, pour un seul atlas et un seul matériau. Atlas sans mipmaps.
- Le code compose, KayKit fournit les pièces (décision du propriétaire) : terrain, ruisseaux, lacs, nappe de cascade et squelettes d'arbres sont procéduraux en TypeScript ; touffes, rochers, buissons, herbes et objets sont des modèles KayKit, posés par le code en `InstancedMesh`. Les petits éléments manquants (fleurs, champignons) sont générés en TypeScript dans le même style (`src/scene/props.ts`) ; Blender n'est qu'un recours. Détail dans le plan, section « Sources d'assets ».
- Arbres de la forêt : procéduraux dans le style KayKit (décision du propriétaire). Le squelette et les tubes low-poly lisses (case d'écorce KayKit) viennent du code, les feuillages sont des touffes KayKit ; pas de cartes de feuilles en alpha ni de style « peint ». La croissance coupe le même squelette selon l'âge. Prototype : `assets-private/procedural-trees/kaykit_tree.py`.
- Les arbres sont générés dans le jeu en TypeScript (`src/scene/trees/`), pas exportés de Blender : générateur à graine (jamais `Math.random`), arbres d'un tableau regroupés en un appel de dessin, pousse et vent par attributs de sommets. L'arbre est construit adulte ; son âge est une valeur dans une texture de données, jamais une reconstruction de géométrie. Au plus 5 000 triangles par arbre, la moitié pour les arbres de lisière (`detail: 'light'`), 700 pour la forêt lointaine (`detail: 'far'`, familles simples seulement). Blender sert aux nouvelles pièces et aux rendus de contrôle, ou en cas de blocage.
- Tout déplacement de sommets dans un shader (pousse, vent) s'applique aussi au matériau de profondeur de l'objet, sinon son ombre ne suit pas.
- Les formes de tableau partagent tout sauf le terrain (interface `Terrain`, `src/scene/terrain/`) : arbres, végétation, lumière et effets ne dépendent jamais d'une forme.
- Les effets du code (lumière, brouillard, particules, halos) restent dans la palette de la texture de dégradé et de la lumière du tableau.
- Les emplacements sont composés à la main et lisibles depuis la caméra. Vu de la caméra, un arbre cache le sol loin derrière lui : aucun emplacement devant un lac, une chute, un bassin ou un confluent. Chaque choix proposé à l'enfant doit donner une belle scène.
- Chaque palier de richesse (0 à 4) change visiblement l'ambiance (lumière, ciel, densité, vie, couche sonore) et le relief (taille du tableau, zones, montagnes, cascades), pas seulement le nombre d'objets. Les paliers sont très distincts : le palier 0 est presque nu mais déjà joli, le palier 4 est spectaculaire.
- Le relief d'un palier est déclaré dans le terrain du décor (`RELIEF` dans `src/scene/terrain/clearing.ts`), les densités et la lumière dans `src/scene/render/richness.ts`. Les éléments (sommets, marches, ruisseaux, emplacements) sont placés une fois dans la disposition finale ; un palier décide seulement lesquels sont présents. Un arbre garde sa place, sa graine et sa forme d'un palier au suivant (nombres tirés de sa position, jamais de son rang dans une liste).
- Chaque nouveau décor apporte au moins un effet inédit et dépasse le précédent.
- Les animations de pousse et de récompense ne sont jamais coupées, même en qualité basse.

## Budget tablette (Android milieu de gamme)

- Moins de 100 appels de dessin, moins de 150 000 triangles visibles, environ 64 Mo de mémoire graphique, 50 images par seconde visées et 30 au minimum. Le palier 4 de la clairière est à environ 135 000 triangles : tout ajout se paie ailleurs (mesurer par partie avant d'ajouter).
- `InstancedMesh` pour la végétation répétée, et un matériau partagé.
- Résolution plafonnée (`min(devicePixelRatio, 1.5)`, 2 en qualité haute).
- Une seule lumière directionnelle avec ombres, et une carte d'ombres limitée au diorama.
- Pas de post-traitement plein écran en qualité moyenne ou basse : halos et rayons sont simulés par des sprites.
- Vent et eau en shader de sommets (`onBeforeCompile`), désactivables.
- Aucune allocation à chaque image dans la boucle de rendu (vecteurs et matrices réutilisés). Animations en pause quand l'onglet est caché.
- Libérer (`dispose`) géométries, matériaux et textures quand on quitte un tableau ou l'Album.
- Paliers de qualité automatiques : tout nouvel effet ajoute son champ à `QualitySettings` (`src/scene/render/quality.ts`), ce qui oblige à déclarer son comportement en qualité moyenne et basse.
- Le brouillard et les sprites se règlent par rapport à la distance de la caméra, qui change avec le format de l'écran (portrait).

## Données et assets

- Un tableau est décrit par des données compactes et déterministes (décor, graine, éléments posés). Le même rendu doit se rejouer à l'identique dans l'Album.
- Le code ne référence les modèles qu'à travers le manifeste généré (`src/scene/assets.gen.ts`), jamais par un chemin écrit à la main. Les modèles utilisés sont listés dans `src/scene/asset-catalog.ts` ; `npm run assets` régénère le manifeste (commité) et `public/assets/kaykit.glb` (ignoré par git).
- Sans les packs (CI, clone neuf), la scène doit marcher avec les formes de remplacement de `src/scene/placeholders.ts` : tout nouveau type de modèle y reçoit une forme de même taille.
- Seulement les packs KayKit gratuits ; les modèles manquants sont générés. Les fichiers bruts des packs et nos `.blend` restent en local (`assets/`, `assets-private/`, ignorés par git) pour l'instant. Seuls les glTF optimisés par la chaîne de traitement entrent dans le build.

## Vérification

Pour tout nouveau décor, modèle ou effet, suivre le skill `visual-review` :

- captures avant/après depuis une caméra fixe, aux paliers 0, 2 et 4 (`npm run capture`) ;
- mesures avec `?debug` (images par seconde, mémoire, appels de dessin, triangles), en qualité haute et basse.

Un nouveau décor demande la validation du propriétaire.
