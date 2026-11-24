---
name: visual-review
description: "Revue visuelle du rendu du paysage Numebois. Use when : rendu, plus joli, embellir, effet, paysage, décor moche, captures, paliers de richesse, saisons, budget tablette, appels de dessin, triangles."
---

# Revue visuelle du rendu

Pour tout changement de rendu (décor, modèle, effet, lumière). Règles de fond : [scene-art.instructions.md](../../instructions/scene-art.instructions.md).

## Captures

1. `npm run assets` si l'atlas (`src/scene/atlas.ts`) ou le catalogue (`src/scene/asset-catalog.ts`) a changé.
2. Lancer `npm run dev` (terminal en arrière-plan).
3. Prendre les captures avant, puis après le changement, avec un `--name` différent :

   ```sh
   npm run capture -- --name avant --stages 0,6,11
   npm run capture -- --name saisons --stages 11 --seasons spring,summer,autumn,winter --columns 4
   ```

   Caméra fixe et temps figé (`time=12`) : deux captures de la même description sont comparables. Autres options : `--seed 1,2,3,4` (plusieurs graines), `--fill 0,50,100` (part des emplacements remplis), `--quality low`, `--query assets=placeholder` (formes de remplacement), `--trees` (triangles par famille d'arbres).

4. Les images vont dans `test-results/captures/` (ignoré par git), avec une planche `<name>-sheet.jpg`. Regarder les planches plutôt que chaque image : quelques images par session suffisent.

Le script affiche pour chaque capture les appels de dessin, les triangles (scène, puis avec la passe d'ombres), la mémoire graphique estimée et le temps de génération des arbres.

## Liste de contrôle

- Composition : premier plan qui encadre, sujet lisible (cascades, lac, confluent), respiration ; rien d'important caché par un arbre.
- Cohérence KayKit : formes simples, couleurs franches de l'atlas, pas de transparence ni de style étranger.
- Paliers (0 à 11) : nombreux et progressifs. 0 presque nu mais déjà joli ; chaque palier est un petit pas visible, sur l'ambiance (lumière, ciel, vie) ou le relief (taille, montagnes, chutes), pas seulement la densité ; 11 spectaculaire. Pour un changement de relief ou de palier, capturer les douze (`--stages 0,1,2,3,4,5,6,7,8,9,10,11 --columns 4`) et vérifier qu'aucun palier ne ressemble à son voisin ni ne fait un saut.
- Saisons : les couleurs changent par les UV (neige par le dégradé), la lumière par `SEASON_LIGHT` (`richness.ts`), qui tire celle du palier vers les couleurs de la saison. L'été garde la lumière du palier ; le dernier palier reste féerique en toute saison, l'hiver reste froid. Comparer la planche des quatre saisons aux paliers 0, 6 et 11 (`--stages 0,6,11 --seasons spring,summer,autumn,winter --columns 3`).
- Nuit (#85) : `NIGHT_LIGHT` passe après la saison ; le tableau reste lisible, rien ne bouge. Captures avec `--query night` (paliers 0, 6 et 11, quatre saisons, chaque décor : `--query "night&biome=sky"`).
- Variété : chaque graine doit donner un tableau nettement différent. Pour un changement de disposition ou de terrain, comparer au moins quatre graines au même palier (`--stages 11 --seed 1,2,3,4 --columns 4`).
- Emplacements et grands moments : pour un changement qui les touche, comparer les remplissages 0, 50 et 100 % aux paliers 0, 6 et 11 (`--fill 0,50,100 --columns 3`), puis les paliers des grands moments, avant et après chacun (`--stages 5,6,7,8 --seed 3,7,12 --columns 4`). Le budget se vérifie au palier 11, tout rempli, dans les quatre saisons.
- Budget : moins de 100 appels de dessin, moins de 150 000 triangles, environ 64 Mo. Vérifier aussi `--quality low` et les formes de remplacement.
- Mouvement (vent, eau, pousse avec la touche G) : à regarder dans le navigateur, `?debug`.

## Conclure

- Critiquer honnêtement, corriger, recommencer.
- `npm run check` et `npm run test:e2e`.
- Un nouveau décor demande la validation du propriétaire : lui montrer les planches.
