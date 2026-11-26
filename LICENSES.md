# Licences des assets

Le code de Numebois est dans ce dépôt. Les modèles 3D publiés avec le jeu ont les licences suivantes.

## `public/assets/kaykit.glb`

Modèles extraits et optimisés par `npm run assets` (`scripts/build-assets.ts`) depuis deux packs gratuits de Kay Lousberg, avec leur texture de dégradé fusionnée en un seul atlas. La liste des modèles est dans `src/scene/asset-catalog.ts`.

| Pack                                      | Auteur                                                        | Licence                                                       | Source                                                         |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| KayKit : Forest Nature Pack 1.0 (FREE)    | Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [itch.io](https://kaylousberg.itch.io/kaykit-forest)           |
| KayKit : Medieval Hexagon Pack 1.0 (FREE) | Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [itch.io](https://kaylousberg.itch.io/kaykit-medieval-hexagon) |

Les troncs tombés et les souches viennent d'un pack de Quaternius, leurs couleurs reportées sur l'atlas KayKit :

| Pack                             | Auteur                                                | Licence                                                       | Source                                                             |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Ultimate Nature Pack (juin 2019) | Quaternius ([quaternius.com](https://quaternius.com)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [quaternius.com](https://quaternius.com/packs/ultimatenature.html) |

Les fichiers bruts des packs ne sont pas dans le dépôt. Les fleurs, champignons, arbres, terrain et effets sont générés par le code de Numebois.

## `public/assets/animals.glb`

Les animaux du pack, extraits et optimisés par `npm run assets` (clips doux seulement, couleurs avivées). Le chamois, le bouquetin et la marmotte sont faits dans Blender à partir de la biche, du cerf et du renard du même pack (`scripts/mountain_animals.py` : robe, cornes, silhouette ; squelette et clips d'origine). L'aigle est créé pour Numebois sans pack tiers : modèle, squelette et clips générés dans Blender par `scripts/eagle.py`. La liste est dans `src/scene/animal-catalog.ts`.

| Pack                                         | Auteur                                                | Licence                                                       | Source                                                                      |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ultimate Animated Animal Pack (juillet 2021) | Quaternius ([quaternius.com](https://quaternius.com)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [quaternius.com](https://quaternius.com/packs/ultimateanimatedanimals.html) |

## `public/assets/plume.glb`

Plume la chouette, créée pour Numebois sans pack tiers : modèle, squelette et clips générés dans Blender par `scripts/plume.py`, puis optimisés par `npm run assets`.

## `public/assets/squirrel.glb`

L'écureuil des défis, créé pour Numebois de la même façon, par `scripts/squirrel.py`.

## `public/assets/sounds/`

Enregistrements de [Freesound](https://freesound.org), tous en [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (licence vérifiée sur la page de chaque son), découpés, mis en boucle et réencodés par `npm run sounds` (`scripts/build-sounds.ts`). La liste est dans `src/scene/audio/sound-catalog.ts`. Le vent est synthétisé par le code.

| Fichier          | Son                                                                          | Auteur        |
| ---------------- | ---------------------------------------------------------------------------- | ------------- |
| `pond.ogg`       | [Water lapping on lake Pukaki](https://freesound.org/s/528067/)              | laughatlantic |
| `brook.ogg`      | [seamless stereo creek loop 02](https://freesound.org/s/678268/)             | msx2plus      |
| `falls.ogg`      | [Creek 06 (loop)](https://freesound.org/s/231536/)                           | VKProduktion  |
| `birds.ogg`      | [Forest_Birds (loop) 02](https://freesound.org/s/231537/)                    | VKProduktion  |
| `chorus.ogg`     | [Forest birds - ambient seamless loop](https://freesound.org/s/723913/)      | Magnesus      |
| `meadow.ogg`     | [Summer Meadow](https://freesound.org/s/409143/)                             | baryy         |
| `leaves.ogg`     | [wind_forest_08_strong_l_01](https://freesound.org/s/403051/)                | teadrinker    |
| `crickets.ogg`   | [crickets](https://freesound.org/s/210540/)                                  | Sclolex       |
| `chaffinch.ogg`  | [Birdsong Singleshot Denoised Wakeup Alarm](https://freesound.org/s/186024/) | unfa          |
| `blackbird.ogg`  | [Common Blackbird 13_seq](https://freesound.org/s/195909/)                   | tinga         |
| `woodpecker.ogg` | [Great Spotted Woodpecker](https://freesound.org/s/428146/)                  | naturenotesuk |
| `cuckoo.ogg`     | [Cuckoo](https://freesound.org/s/475049/)                                    | SiliconeSound |
| `owl.ogg`        | [Owl Hoot](https://freesound.org/s/465697/)                                  | Breviceps     |
| `chime.ogg`      | [GLEAM-GLOW-SFX-CHIME](https://freesound.org/s/351408/)                      | newagesoup    |
| `chimes.ogg`     | [Chimes](https://freesound.org/s/389789/)                                    | fmceretta     |
| `ding.ogg`       | [Correct Answer Ding](https://freesound.org/s/878603/)                       | Qvantor       |
| `bell.ogg`       | [Correct Bell](https://freesound.org/s/538147/)                              | Fupicat       |
| `seed.ogg`       | [Gem Sparkle](https://freesound.org/s/878614/)                               | Qvantor       |
| `heal.ogg`       | [Heal Restore](https://freesound.org/s/878621/)                              | Qvantor       |
| `stage.ogg`      | [Level Up Magic Harp](https://freesound.org/s/878598/)                       | Qvantor       |
| `finale.ogg`     | [Quest Complete](https://freesound.org/s/878605/)                            | Qvantor       |
| `jingle.ogg`     | [Win Jingle](https://freesound.org/s/878610/)                                | Qvantor       |
