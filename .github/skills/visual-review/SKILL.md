---
name: visual-review
description: "Revue visuelle du rendu du paysage Numebois. Use when : rendu, plus joli, embellir, effet, paysage, décor moche, captures, paliers de richesse, saisons, comparer les formes, budget tablette, appels de dessin, triangles."
---

# Revue visuelle du rendu

Pour tout changement de rendu (décor, modèle, effet, lumière). Règles de fond : [scene-art.instructions.md](../../instructions/scene-art.instructions.md).

## Captures

1. `npm run assets` si l'atlas (`src/scene/atlas.ts`) ou le catalogue (`src/scene/asset-catalog.ts`) a changé.
2. Lancer `npm run dev` (terminal en arrière-plan).
3. Prendre les captures avant, puis après le changement, avec un `--name` différent :

   ```sh
   npm run capture -- --name avant --forms clearing,hex --stages 0,2,4
   npm run capture -- --name saisons --stages 4 --seasons spring,summer,autumn,winter --columns 4
   ```

   Caméra fixe et temps figé (`time=12`) : deux captures de la même description sont comparables. Autres options : `--seed`, `--size 800x1280` (portrait), `--quality low`, `--query assets=placeholder` (formes de remplacement), `--trees` (triangles par famille d'arbres).

4. Les images vont dans `test-results/captures/` (ignoré par git), avec une planche `<name>-sheet.jpg`. Regarder les planches plutôt que chaque image : quelques images par session suffisent.

Le script affiche pour chaque capture les appels de dessin, les triangles (scène, puis avec la passe d'ombres), la mémoire graphique estimée et le temps de génération des arbres.

## Liste de contrôle

- Composition : premier plan qui encadre, sujet lisible (cascade, eau), respiration ; rien d'important caché par un arbre.
- Cohérence KayKit : formes simples, couleurs franches de l'atlas, pas de transparence ni de style étranger.
- Paliers : 0 déjà joli ; 2 et 4 changent l'ambiance (lumière, ciel, vie), pas seulement la densité.
- Saisons : seuls les UV changent ; neige par le dégradé.
- Les deux formes reçoivent le même soin tant que le propriétaire n'a pas choisi.
- Budget : moins de 100 appels de dessin, moins de 150 000 triangles, environ 64 Mo. Vérifier aussi `--quality low` et les formes de remplacement.
- Mouvement (vent, eau, pousse avec la touche G) : à regarder dans le navigateur, `?debug`.

## Conclure

- Critiquer honnêtement, corriger, recommencer.
- `npm run check` et `npm run test:e2e`.
- Un nouveau décor demande la validation du propriétaire : lui montrer les planches.
