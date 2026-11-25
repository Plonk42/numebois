---
name: add-biome
description: "Ajouter un décor de tableau à Numebois. Use when : nouveau décor, fais un tableau de montagne, biome, îles du ciel, grand arbre, terrain, grands moments, emplacements d'un décor, effet inédit."
---

# Ajouter un décor

Recette de fond : [plan, « Ajouter un décor » et « Escalade d'un tableau à l'autre »](../../../doc/PLAN_ACTION.md). Règles : [scene-art.instructions.md](../../instructions/scene-art.instructions.md). Modèles : le Verger des collines (`src/scene/biomes/orchard.ts`, `src/scene/terrain/orchard.ts`, #31), un seul diorama ; les Îles du ciel (`src/scene/biomes/sky.ts`, `src/scene/terrain/sky.ts`, #32), plusieurs îles.

## 0. Maquette, validée avant de construire

- Un worktree sous `assets-private/` (liens `node_modules` et `assets`, config Vite avec son port et son `cacheDir`, exclusions dans `.git/info/exclude`).
- Ajouter l'identifiant à `BIOME_IDS` (`src/scene/description.ts`) et un terrain de concept : relief, eau, arbres, sans emplacements. `npm run capture -- --query biome=<id> --stages 0,6,11` à côté de la clairière.
- Un décor change la géographie, pas la couleur : son **axe de croissance** (l'équivalent du relief de la clairière) et un **effet inédit**. Le propriétaire valide, puis l'enfant choisit entre les maquettes (#12).

## 1. Terrain (`src/scene/terrain/<id>.ts`)

- Implémenter `Terrain` (`terrain/types.ts`). Sol et dessous du diorama : `groundGrid` et `buildDiorama` (`terrain/diorama.ts`, profondeur de la jupe en option) ; seul le coloriage des facettes est propre au décor. Plusieurs diorama (îles) : chacun construit autour de son centre dans un `MeshWriter` à part, puis `append` à sa place ; `surfaceAt` répond pour l'île sous le point, `null` entre elles. Leur disposition est un arbre tiré de la graine (chaque île s'accroche à une île déjà là, placée le long de la ligne des centres par `reach`, tirage refait si une règle casse), pas une liste fixe : la variété d'une graine à l'autre vient de la structure, pas seulement des positions.
- Les valeurs par palier en colonnes (`<ID>_BY_STAGE`, une ligne par paramètre) ; un grand moment = une colonne booléenne, `revealAt` donne `waiting`/`announced`/`shown`, et une `Announcement` (étincelles) au palier d'avant.
- Disposition tirée de la graine et gardée en cache ; un arbre ou un emplacement est placé dans la disposition finale, un palier décide seulement s'il est là. Ce qui dépend de l'eau de tous les paliers (comme `awayFromWater` du verger, `sightsAt` des îles) se calcule une fois par graine avec des terrains « sans décor » (`scenery = false`).
- Outils disponibles : `crops` (rangs de fleurs ou de blé sur un sol `field`), `spinners` (pièce qui tourne : ailes de moulin), `drifters` (objet généré qui dérive sur une boucle : montgolfière), `cloudSea` (mer de nuages sous le tableau), ponts (`terrain/bridge.ts`, dans le sol), `TreeSpot.family/foliage/fruit` et `SlotSpot.family/foliage/fruit` (essence, feuillage et fruits imposés), `waterfalls` (`splash: false` : chute dans le vide, finie en brume), `banks`, `ponds`, `staticModels`.

## 2. Emplacements

- `SLOT_COUNT` (22) emplacements, ordonnés par le premier palier qui les montre puis par la distance au centre du premier tableau ; un plafond par palier (`OPEN_AT_MOST`) les ouvre au fil du tableau.
- Règles pour chaque emplacement pris seul : sur le sol (`grass`), loin de l'eau et jamais devant elle vu de la caméra, espacés, rien de haut au milieu du premier plan. Au moins 4 ouverts au palier 0 et toujours 2 libres au choix. Devant l'eau, un massif bas convient là où un arbre la cacherait.
- Laisser de l'herbe libre aux animaux (prés sans emplacements ni arbres, comme les îles) : 22 emplacements serrés ne leur laissent plus de chemin. Mesurer avec un script (`planHerd` sur 200 graines) : aucun animal sans place.
- Mesurer sur des centaines de graines avec un script de scratch avant d'écrire le test.

## 3. Décor (`src/scene/biomes/<id>.ts`, ajouté à `BIOMES`)

- `name`, `terrain`, `stageNames`, `effects` (ceux d'aucun décor précédent), `vocabulary` : les mots des problèmes (`Vocabulary` de `src/core/types.ts` : qui ramasse et qui reçoit, avec `to` et le pronom, objets à compter au singulier et au pluriel, lieux, groupes « 6 paniers de 8 … »). Les tests de contenu jouent chaque problème dans chaque décor (énoncé de 25 mots au plus : des noms et des lieux courts).
- `life` : les colonnes de `LIFE` de `richness.ts` à remplacer (densités, vie, sons) ; `light` : une teinte du ciel et de la lumière.
- Animaux de la boutique : `ANIMAL_OFFERS[<id>]` (`description.ts`). Un nouvel animal Quaternius : `animal-catalog.ts`, `ANIMAL_HEIGHT` (`ambient-life.ts`), `ANIMAL_LABELS` (`src/ui/shop.tsx`), puis `npm run assets`.
- Éléments rares de la boutique (#46) : `RARE_OFFERS[<id>]` (`description.ts`), chacun à partir d'un palier où il se voit (l'arc-en-ciel demande une chute qui tombe dans l'eau, `splash`) ; chaque décor a son grand élément rare (castors, moulin, montgolfière), qui se lit dans `terrain(seed, stage, rares)`, scintille tant qu'il est en vente et garde sa place dans le cadrage (l'achat ne bouge pas la caméra). Un nouveau rare : `RARE_NAMES`, `RARE_LABELS`, `RARE_ARRIVALS` et `RareIcon` (`src/ui/rares.tsx`).
- Un bâtiment du pack hexagonal : `asset-catalog.ts` (filtre `nodes` pour une partie mobile), ses cases d'atlas absentes peintes par `HEX_ALIASES` (`atlas.ts`) plutôt qu'en élargissant l'atlas, une forme de remplacement par `kind`.

## 4. Vérifier

- Tests Vitest sur le modèle de `tests/unit/orchard.test.ts` : budget (paliers × saisons, 12 graines, tout rempli), progression, grands moments annoncés puis montrés, effets, emplacements sur 100 graines et plus, arbres stables d'un palier à l'autre, animaux sur l'herbe ; sons (`sound.test.ts`, somme des boucles sous 2,7).
- Spec Playwright du paysage (`tests/e2e/scene.spec.ts`) aux paliers 0, 6 et 11, et l'Album (`album.spec.ts` : le choix du tableau suivant montre tous les décors, `NEXT_CHOICES`).
- Skill `visual-review` : douze paliers, quatre graines, quatre saisons, remplissages 0/50/100 %, qualité basse, formes de remplacement. Une mise en commun du moteur se vérifie au pixel près sur la clairière (`assets-private/scratch/pixdiff.ts`).
- Plan (décisions, recette, journal) et ticket, puis validation du propriétaire.
