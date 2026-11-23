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

La biche, le cerf, le renard et le loup, extraits et optimisés par `npm run assets` (clips doux seulement, couleurs avivées). La liste est dans `src/scene/animal-catalog.ts`.

| Pack                                         | Auteur                                                | Licence                                                       | Source                                                                      |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ultimate Animated Animal Pack (juillet 2021) | Quaternius ([quaternius.com](https://quaternius.com)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [quaternius.com](https://quaternius.com/packs/ultimateanimatedanimals.html) |

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
