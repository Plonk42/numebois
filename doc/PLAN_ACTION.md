# Numebois : plan d'action

Ce document est vivant : il est mis à jour à chaque nouvelle demande (voir [Tenue du plan](#tenue-du-plan-et-personnalisations-copilot)). Le cahier des charges d'origine reste dans [PLAN.md](PLAN.md), et le workflow GitHub dans [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md).

Numebois est un jeu web éducatif pour un enfant de CE2 : chaque exercice réussi fait grandir une forêt cartoon. Il couvre les tables, le calcul mental, les opérations posées (addition, multiplication par 1 chiffre) avec un atelier guidé, les fractions, les unités et conversions, les mesures, l'heure et les durées. S'y ajoutent de petites leçons interactives, un mode « rafale » pour automatiser les calculs et des défis chronométrés bienveillants.

Stack : Vite + TypeScript + Preact, scène 3D Three.js en style cartoon low-poly, PWA hors-ligne sur tablette Android milieu de gamme, déploiement GitHub Actions vers GitHub Pages. Tout le contenu (notions, leçons, quêtes) est du TypeScript typé, organisé en modules par domaine. Ajouter « les divisions » ou « les triangles » revient à ajouter un module selon une recette fixe.

## Objectif principal : donner envie, malgré la difficulté à se concentrer

L'enfant a beaucoup de mal à se concentrer. Le but n°1 est qu'il ait envie de revenir de lui-même pour embellir sa forêt, et qu'il travaille ses leçons sans s'en rendre compte. Chaque choix de conception est jugé à cette aune.

1. **Boucles très courtes :**
   - un micro-retour à chaque bonne réponse (une pousse qui grandit un peu, une étincelle) ;
   - un nouvel élément environ toutes les 1 à 1,5 minute ;
   - jamais plus de quelques questions sans changement visible.
2. **La fin toujours visible :** le sentier s'affiche comme un chemin de 10 pierres. Il sait à tout moment combien il en reste. Longueur par défaut : court (environ 5 minutes). Une mini-session de 2 minutes compte aussi.
3. **C'est sa forêt :** à chaque nouvel élément, il choisit où le placer parmi 2 ou 3 emplacements qui brillent. C'est un seul toucher, qui ne casse pas le rythme.
4. **Un but visible pour le tableau :** les silhouettes des 3 « grands moments » du tableau (par exemple la cascade, la cabane, le cerf) sont visibles en transparence dès le départ et se révèlent au fil du jeu, avec un grand final quand le tableau est complet.
5. **De petites surprises :** de temps en temps, une visite imprévue (oiseau rare, papillons, arc-en-ciel). Rien à acheter, pas de tirage au sort, une seule monnaie (l'énergie).
6. **Le travail déguisé :**
   - le mot « leçon » n'apparaît jamais : c'est « Plume te montre une astuce » ;
   - les exercices parlent du décor du tableau (glands, cabane, ruisseau, horloge du moulin) ;
   - les devoirs de la semaine deviennent des « quêtes ».
7. **Concentration protégée :**
   - pendant une question, une seule chose à l'écran, sans menu ni animation qui attire l'œil en dehors des moments de récompense ;
   - les animaux et les éléments ne sont interactifs (les toucher les fait réagir) qu'entre deux questions ou à la fin du sentier.
8. **Manipuler plutôt qu'écrire :** horloge, règle, parts et opérations posées se manipulent au doigt, ce qui est plus engageant que la saisie seule.
9. **Revenir le lendemain sans punition :** si l'enfant a joué la veille, une petite nouveauté l'attend (une fleur éclose, un animal arrivé). Aucune série qu'on peut perdre, aucun message de manque.
10. **À éviter :** chronomètre imposé, classement, plusieurs monnaies, notifications, compte à rebours, tout ce qui ressemble à une punition.

## Décisions

- **Stack :** Vite + TS strict + Preact (interface et widgets en DOM/SVG, par-dessus la scène) + Three.js en WebGL2 (paysage 3D uniquement). PWA hors-ligne via vite-plugin-pwa.
- **Visuels : le rendu est la priorité n°1, c'est la motivation première de l'enfant.** Style cartoon low-poly en 3D temps réel. Base : les packs **KayKit** de Kay Lousberg (Forest Nature Pack et Medieval Hexagon Pack, licence CC0, conçus pour le mobile, une seule texture de dégradé partagée). Le MCP Blender sert à compléter dans le même style (stades de croissance, cabane, grands moments, animaux si besoin). Le code ajoute la vie : lumière, ciel, brouillard, vent, eau, particules, animations de pousse, ambiance qui s'enrichit. Le rendu est validé par une tranche verticale avant de construire le reste du jeu.
- **Assets :** seulement les versions gratuites de KayKit (CC0) ; pas de pack payant, les modèles et variantes manquants sont générés (code ou MCP Blender). Pas de dépôt privé. Les fichiers des packs et nos sources Blender restent hors du dépôt pour l'instant (`assets/` et `assets-private/` en local, ignorés par git) ; leur entrée dans le build se décidera avec la chaîne de traitement. Le site publié ne contient que les modèles glTF optimisés. Tout autre pack (animaux, sons) doit avoir une licence vérifiée compatible (CC0 de préférence).
- **Contenu en TypeScript, pas en YAML :** c'est toujours l'agent qui ajoute les notions et les quêtes, à la demande du propriétaire. Le compilateur et les tests vérifient tout, sans schéma ni validateur à part.
- **Un module par domaine** (`src/domains/<domain>/`), branché sur un registre. Le moteur (sentier, maîtrise, rafale, défis) est générique et ne connaît aucun domaine en particulier.
- **Sauvegarde :** un seul enfant, IndexedDB sous le préfixe `numebois:` (l'origine github.io est partagée avec les autres dépôts), export/import JSON. Les identifiants de notions sont stables. La compatibilité devient obligatoire dès que le propriétaire déclare « l'enfant joue pour de vrai » (voir [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md#compatibilité-des-sauvegardes)).
- **Pas de synthèse vocale :** textes courts, gros caractères.
- **Bienveillance partout :** aucune perte d'énergie, indices progressifs, comparaison uniquement avec soi-même, aucune formulation d'échec.
- **Opérations posées V1 :** addition (2 ou 3 nombres, jusqu'à 4 chiffres) et multiplication par un nombre à 1 chiffre. Pas de soustraction posée.
- **Hors périmètre V1** (à ajouter plus tard, module par module) : division, géométrie, soustraction posée, multiplication par 2 chiffres, synthèse vocale, plusieurs profils, synchronisation.

## Tenue du plan et personnalisations Copilot

- Ce fichier porte la vision : décisions, recettes, journal. Les tickets GitHub portent l'avancement. À chaque demande (« ajouter les divisions », « l'enfant doit travailler les triangles »…), l'agent met à jour dans le même commit les décisions, les recettes et le journal en bas du fichier. Le tableau de couverture est mis à jour à chaque jalon terminé, pas à chaque commit.
- Les instructions et skills Copilot sont maintenus en continu (voir [Personnalisations Copilot](#personnalisations-copilot)). Dès qu'une préférence ou une correction durable du propriétaire apparaît, l'agent met à jour le bon fichier dans le même commit, et le signale en une ligne à la fin de sa réponse.

## Conventions et glossaire

Le code (identifiants, fichiers, dossiers) est en anglais. Les textes affichés, les leçons, les docs et les instructions Copilot sont en français.

| Terme du jeu (FR)             | Nom dans le code |
| ----------------------------- | ---------------- |
| notion                        | `Skill`          |
| fait (7×8)                    | `Fact`           |
| domaine                       | `Domain`         |
| sentier                       | `Trail`          |
| rafale                        | `Drill`          |
| défi                          | `Challenge`      |
| tableau                       | `Painting`       |
| Album                         | `Album`          |
| décor                         | `Biome`          |
| grand moment                  | `Landmark`       |
| emplacement                   | `Slot`           |
| énergie                       | `Energy`         |
| quête (devoirs de la semaine) | `Quest`          |
| astuce de Plume (leçon)       | `Lesson`         |
| Carnet de la forêt            | `Notebook`       |

Domaines : `numbers`, `mental-math`, `times-tables`, `column-arithmetic` (opérations posées), `fractions`, `units`, `measures`, `time`, `word-problems`. Puis à la demande : `division`, `geometry`…

Widgets : `Keypad`, `Choice`, `FractionInput`, `TimeInput`, `Clock`, `Ruler`, `ScaleDial` (balance, verre doseur), `ConversionTable`, `FractionParts`, `NumberLine`, `ColumnOperation`.

## Couverture du programme

À vérifier contre le programme officiel en vigueur et les devoirs de l'enfant. La colonne « Rafale » indique que la notion peut se travailler en enchaînement libre jusqu'à l'automatisme.

| Domaine (module)    | Notions                                                                                                                      | Interaction                                  | Leçon               | Rafale                    | Chrono             | État                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------- | ------------------------- | ------------------ | ---------------------- |
| `numbers`           | Lire et écrire jusqu'à 10 000, comparer, ranger, décomposer (M/C/D/U), droite graduée                                        | Pavé, choix <, >, =, droite graduée          | Valeur des chiffres | Oui                       | Non                | Prévu M1               |
| `mental-math`       | Addition et soustraction de tête ≤ 100, compléments à 10 et 100, passage de la dizaine, +9/+11, doubles et moitiés, ×10/×100 | Pavé                                         | Stratégies          | Oui                       | Oui                | Prévu M1               |
| `times-tables`      | Tables de 2 à 10, commutativité, produit à trou                                                                              | Pavé, quadrillage de points                  | Quadrillage         | Oui (suivi fait par fait) | Oui                | Prévu M1               |
| `column-arithmetic` | Addition avec retenues, multiplication par 1 chiffre                                                                         | Atelier « opération posée »                  | Pas à pas guidé     | Oui                       | Non                | Prévu M3               |
| `fractions`         | Demi, tiers, quart… dixième : lire, colorier, droite graduée, comparer à 1, fraction d'une quantité                          | Parts à colorier, saisie a/b, droite graduée | Oui                 | Oui                       | Non                | Prévu M5               |
| `units`             | Longueurs km/m/dm/cm/mm, masses kg/g, contenances L/dL/cL, monnaie : relations, conversions, ordres de grandeur              | Tableau de conversion, choix                 | Oui                 | Oui                       | Non                | Prévu M4               |
| `measures`          | Règle (cm, mm), tracer un segment, ligne brisée, graduations (balance, verre doseur)                                         | Règle, graduations                           | Oui                 | Non                       | Non                | Prévu M4               |
| `time`              | Lire l'heure (pile, demie, quarts, 5 en 5, minute près), placer les aiguilles, 14 h = 2 h, durées, h/min/s, calendrier       | Horloge, saisie hh:mm, frise, calendrier     | Oui                 | Oui (lecture de l'heure)  | Lecture de l'heure | Prévu M4               |
| `word-problems`     | Énoncés à variables sur le thème de la forêt, en une ou deux étapes, mobilisant les autres domaines                          | Pavé, choix                                  | Non                 | Non                       | Non                | Prévu M1, puis enrichi |

## Architecture

- `src/core/` : moteur générique en TS pur.
  - `rng.ts`, `expr.ts` (interpréteur limité, pas d'`eval`) ;
  - `mastery.ts` (cycle de vie et Leitner), `facts.ts` (suivi fait par fait), `trail.ts` (sentier), `drill.ts` (rafale), `challenge.ts`, `records.ts` ;
  - `registry.ts` et `types.ts` : les contrats `Domain`, `Skill`, `Generator`, `Exercise`, `Lesson`, `Quest`.
- `src/domains/<domain>/` : un module autonome.
  - `index.ts` : `defineDomain` (id, nom affiché en français, icône, liste des notions) ;
  - `skills.ts` : notions avec id stable, prérequis, niveaux de difficulté internes, drapeaux `drill`/`challenge` ;
  - `generators.ts`, `validate.ts`, `hints.ts` : fonctions pures ;
  - `facts.ts` (facultatif) : découpage en faits élémentaires pour l'automatisation, par exemple « 7×8 » ou « 3+7=10 » ;
  - `lessons/*.ts` : leçons écrites avec `defineLesson` ;
  - `widgets/*.tsx` : seulement si le domaine a besoin d'une interaction qui lui est propre ;
  - `problems.ts` : modèles d'énoncés ;
  - `*.test.ts`.
- `src/domains/index.ts` : le registre, une ligne par domaine.
- `src/ui/widgets/` : widgets partagés (voir le glossaire). Contrat : ils reçoivent l'exercice et un mode (`demo`, `guided`, `free`) et renvoient une réponse. La validation et les indices viennent du domaine.
- `src/quests/YYYY-MM-DD.ts` : `defineQuest` (titre de quête, période, décor facultatif pour le prochain tableau, notions travaillées avec paramètres, rafale recommandée, leçons, défis). Une quête tient en une dizaine de lignes.
- `src/scene/` : paysage Three.js, `render/` (moteur de rendu), `biomes/` (décors) et `painting.ts`. Le module `word-problems` puise le vocabulaire et les objets du décor en cours pour habiller les énoncés.
- `src/ui/` : surimpression et mode atelier. Les widgets larges agrandissent le panneau sur environ 60 % de l'écran, la forêt reste visible.

### Leçons sans YAML

Une leçon est une courte liste d'étapes typées dans le module :

- `explain` : texte court et widget en démo animée, avec un petit script d'actions (par exemple « déplacer la grande aiguille sur 30 », « surligner la colonne des unités ») ;
- `manipulate` : consigne, widget en mode libre et condition de réussite ;
- `guidedExample` : widget en mode guidé, par exemple une opération posée commentée par Plume ;
- `check` : 2 ou 3 exercices tirés des générateurs du domaine, sans effet sur la maîtrise.

`LessonPlayer` les joue toutes de la même façon. Les illustrations sont les widgets eux-mêmes, donc pas d'images à produire. Une leçon fait au plus 6 étapes (vérifié par un test).

## Recette : ajouter une notion ou un domaine

Exemples de demandes : « ajouter les divisions », « l'enfant doit travailler les triangles ».

1. Mettre à jour ce plan : décisions, journal.
2. Si le domaine existe, ajouter la notion dans son `skills.ts`. Sinon, créer `src/domains/<domain>/` et l'enregistrer dans `src/domains/index.ts`.
3. Écrire générateurs, validation et indices, avec leurs tests (1 000 graines, contraintes respectées).
4. Réutiliser un widget partagé si possible. Sinon, créer un widget du domaine qui respecte le même contrat.
5. Écrire une leçon courte, et éventuellement des modèles de problèmes.
6. Déclarer les prérequis pour placer la notion dans le parcours.
7. Facultatif : une quête qui active la notion cette semaine, avec un décor assorti si besoin.
8. Ajouter un test Playwright du nouveau widget ou de la nouvelle leçon, puis vérifier les captures.

Ajouter un décor (« fais un tableau de montagne ») : créer `src/scene/biomes/<biome>.ts` (terrain, variante de couleurs, lumière et ciel, emplacements, 3 grands moments, éléments, effet inédit, ambiance sonore, vocabulaire des problèmes), compléter les modèles manquants avec le MCP Blender si besoin, l'enregistrer, ajouter un test de rendu et faire la revue visuelle.

Exemples anticipés :

- **Division :** partage, quotient et reste, ? × 6 = 42. Prérequis : tables. Réutilise le pavé et une saisie « quotient + reste », et ajoute une manipulation de partage de glands. La division posée viendra plus tard, en étendant le widget `ColumnOperation`.
- **Triangles :** module `geometry` avec un nouveau widget de géométrie en SVG : toucher les sommets, tracer avec règle et équerre, reconnaître et classer les triangles (rectangle, isocèle, équilatéral). Prérequis : mesures (règle).

## Rendu : un paysage de plus en plus riche et joli

C'est le cœur de la motivation. Chaque bonne réponse doit se voir, et chaque tableau doit devenir nettement plus beau du début à la fin.

### Direction artistique

1. **Style cartoon low-poly en 3D temps réel,** celui des packs KayKit : formes simples et arrondies, couleurs franches et chaleureuses, une seule texture de dégradé partagée par tous les modèles. Aucun asset d'un autre style ne s'y mélange.
2. **Sources d'assets :**
   - [KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest) : arbres, buissons, herbes, rochers. Version gratuite uniquement : les variantes de couleur et les modèles manquants sont générés.
   - [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) : tuiles hexagonales (rivières, lacs, côtes), moulins à vent et à eau, maisons, puits, montagnes, nuages.
   - **MCP Blender :** compléments dans le même style, en réutilisant la texture de dégradé KayKit. Il produit les fleurs et champignons, la cabane, les grands moments et les éléments rares (les arbres sont générés dans le jeu). Il exporte aussi en lot et fait les rendus de contrôle.
   - **Répartition (décision du propriétaire) : le code compose, KayKit fournit les pièces.** Procédural en TypeScript pour ce qui est continu ou dépend de la forme du décor ; assets pour les objets posés.
     - Arbres : procéduraux (voir plus bas).
     - Terrain : procédural (relief bas-poly à facettes, couleurs de l'atlas selon la hauteur et la pente, bord de diorama), ou tuiles hexagonales du Medieval Hexagon Pack selon la forme de tableau retenue.
     - Ruisseaux et lacs : tracé procédural (courbe qui creuse le terrain), ruban d'eau animé dans le shader (rides et écume qui défilent, couleurs franches de l'atlas, opaque) ; berges garnies de rochers et d'herbes KayKit le long du tracé.
     - Cascade : falaise en rochers KayKit empilés, nappe d'eau procédurale animée, écume et embruns en particules ; retouche dans Blender si c'est un grand moment.
     - Rochers, buissons, herbes : modèles KayKit (43 rochers, 22 buissons, 20 touffes d'herbe dont une version prévue pour un shader de vent), posés par le code selon la densité du palier de richesse, en `InstancedMesh` (un appel de dessin par modèle) ; saisons par cases de l'atlas (mousse, neige, herbe sèche).
     - Fleurs, champignons, cabane, moulin : modèles (KayKit ou MCP Blender).
   - **Saisons des arbres (prototype Blender, remplacé par la génération dans le jeu ; on en garde les cases de couleurs de l'atlas et les recettes de saison) :** l'atlas `forest_texture.png` reçoit de nouvelles cases de dégradé dans les emplacements que KayKit réserve aux couleurs supplémentaires ; les cases d'origine ne bougent pas. Chaque variante garde le maillage, l'échelle et le matériau unique de l'arbre KayKit, seuls les UV changent. La neige vient du dégradé lui-même (le haut des cases éclaire les faces tournées vers le ciel). 120 modèles :
     - feuillus `Tree_1`, `Tree_2` : `Spring`, `Blossom`, `Summer`, `Fruit` (pommes), `AutumnGold`, `AutumnOrange`, `AutumnRed`, `AutumnMixed` (couleur tirée par touffe), `Winter` ;
     - parasols `Tree_3` : les mêmes sans `Fruit` ; sapins `Tree_4` : `Spring`, `Summer`, `AutumnLarch`, `Winter`, `Festive` (boules et étoile) ; arbres nus : `Summer`, `Winter` (neige sur les branches).
   - **Nouvelles essences (prototype Blender, remplacé par les familles procédurales) :** assemblées à partir des touffes et des troncs KayKit (mêmes faces, UV, normales et matériau, seulement déplacés et mis à l'échelle), en tailles A, B, C : `Tree_Lollipop` (sucette, avec `Fruit`), `Tree_Poplar` (peuplier), `Tree_Oak` (grand chêne), `Tree_Birch` (bouleau, écorce blanche tachetée), `Tree_Fir` (sapin de Noël, avec `Festive`). Les pousses `Sapling_Round`, `Sapling_Cube`, `Sapling_Umbrella`, `Sapling_Pine` servent de premier stade de croissance. Toutes reçoivent les variantes de saison : 249 modèles au total.
     - Scripts reproductibles dans `assets-private/forest-seasons/` : `atlas.py` (disposition des cases), `make_atlas.py`, `species.py` (assemblage), `build_seasons.py` (variantes, export, rendus). On y trouve aussi le `.blend`, les glTF (saison, variante et provenance dans les `extras`) et les rendus de contrôle.
   - **Forêt procédurale dans le style KayKit (décision du propriétaire) :** le code génère le squelette de l'arbre (tronc, racines, branches), habillé de tubes low-poly lisses collés à la case d'écorce KayKit ; les feuillages sont les touffes du pack, posées au bout des branches. Une graine donne un arbre ; couper le même squelette selon l'âge (0 à 1) donne ses stades de croissance, donc un arbre peut pousser branche par branche à chaque bonne réponse. Environ 2 000 à 5 000 triangles par arbre adulte. Prototype : `assets-private/procedural-trees/kaykit_tree.py` (familles `Round`, `Cube`, `Gnarly`, `Umbrella`). Le style « peint » à cartes de feuilles (`gen_tree.py`) est écarté.
     - **Générée dans le jeu, en TypeScript (décision du propriétaire, tant qu'on n'est pas bloqué) :** `src/scene/trees/` porte l'algorithme du prototype. Générateur aléatoire à graine (jamais `Math.random`) pour que l'Album rejoue les mêmes arbres ; touffes KayKit chargées depuis le manifeste ; arbres d'un tableau regroupés en un seul appel de dessin (fusion ou `BatchedMesh`) ; pousse et vent par attributs de sommets (âge d'apparition, souplesse) dans le shader. Blender reste disponible pour créer de nouvelles pièces et faire des rendus de contrôle.
   - **Animaux** (écureuil, hérisson, oiseaux, cerf, Plume la chouette) : les packs KayKit n'en ont pas. On cherche d'abord un pack CC0 d'animaux low-poly animés au style compatible (par exemple Quaternius, à vérifier). À défaut, on les modélise avec le MCP Blender, avec des animations simples (respiration, saut, clignement).
3. **Forme du tableau :** un diorama 3D, vu en légère plongée avec une caméra presque fixe. La proposition par défaut est une petite île de tuiles hexagonales qui grandit, et l'Album devient une collection d'îles. Une variante en clairière rectangulaire bordée de forêt est aussi maquettée ; le choix se fait pendant la tranche verticale.
4. **Compositions faites à la main :** pour chaque décor, l'agent place les emplacements selon de vraies règles de composition (premier plan qui encadre, profondeur, lisibilité depuis la caméra, respiration). L'enfant choisit entre 2 ou 3 emplacements qui sont tous beaux : son choix ne peut pas enlaidir la scène.

### Ce que le code ajoute (la vie)

1. **Profondeur :** brouillard de distance teinté, ciel en dégradé, arrière-plan lointain (montagnes et nuages KayKit), vignette douce.
2. **Lumière :**
   - lumière hémisphérique et soleil directionnel, dont la couleur et l'angle sont propres à chaque tableau et à chaque palier (matin doré, après-midi, coucher de soleil) ;
   - ombres douces, limitées au diorama ;
   - halos et rayons de soleil simulés par des sprites, pas par du post-traitement coûteux ;
   - reflets sur l'eau.
3. **Mouvement :**
   - vent : un shader de sommets fait onduler la végétation depuis sa base, avec des rafales qui traversent la scène ;
   - eau animée (ondulation des sommets et texture qui défile) ;
   - nuages qui dérivent ;
   - la caméra respire très légèrement entre les questions.
4. **Vie :** animaux animés (déplacements courts, réactions au toucher entre deux questions), oiseaux qui traversent, papillons, pollen, feuilles qui tombent, lucioles le soir.
5. **Pousse :** chaque nouvel élément sort de terre avec un effet d'étirement, une gerbe d'étincelles et de feuilles, et un léger mouvement de caméra vers lui. Les arbres passent par des stades visibles.
6. **Paliers de richesse dans chaque tableau :** la richesse ne fait pas que s'accumuler, elle change visiblement d'ambiance à chaque palier.
   - 0 « clairière » : déjà jolie au départ ;
   - 1 « verdoyant » : herbes plus denses, premières fleurs ;
   - 2 « fleuri » : couleurs plus saturées, papillons ;
   - 3 « vivant » : animaux, oiseaux, rayons de lumière ;
   - 4 « féerique », le grand final : lumière dorée, lucioles, arc-en-ciel ou cascade étincelante.
7. **Escalade d'un tableau à l'autre :** les décors sont ordonnés pour être de plus en plus spectaculaires (clairière, puis ruisseau avec cascade, puis verger fleuri, puis forêt d'automne avec feuilles qui volent, puis nuit étoilée, puis neige…). Chaque nouveau décor apporte au moins un effet inédit. Les variantes de couleur KayKit et la lumière font l'essentiel des saisons.
8. **Ambiance sonore en couches** qui grandit avec la richesse : vent léger, puis oiseaux, puis ruisseau, puis grillons et chouette la nuit. Les sons viennent d'un pack audio de licence compatible, avec un bouton pour couper le son.

### Contraintes tablette

1. **Rendu :** WebGL2, résolution plafonnée à `min(devicePixelRatio, 1.5)` (2 en qualité haute), caméra adaptée au format de l'écran (paysage d'abord, portrait toléré).
2. **Modèles :** glTF optimisés par la chaîne de traitement (fusion, élagage, quantification, compression meshopt). Une seule texture de dégradé de 1024² au maximum, réductible à 256².
3. **Budget :**
   - moins de 100 appels de dessin, grâce à `InstancedMesh` pour la végétation répétée et au matériau partagé ;
   - moins de 150 000 triangles visibles ;
   - environ 64 Mo de mémoire graphique au maximum ;
   - 50 images par seconde visées et 30 au minimum.
4. **Paliers de qualité automatiques** (haut, moyen, bas), d'après un petit test de fluidité au lancement.
   - En qualité moyenne : ombres plus petites, moins de particules.
   - En qualité basse : pas d'ombres portées (remplacées par des ombres de contact pré-calculées), pas de vent en shader ni d'eau ondulante, résolution réduite.
   - Les animations de pousse et de récompense ne sont jamais coupées.
5. **Téléchargement :** environ 5 Mo au premier lancement (Three.js et un décor). Les autres décors sont chargés à la demande, puis gardés en cache par le service worker.

## Progression dans la durée sans surcharge

Principe : le contenu grandit, mais la charge par session reste fixe. Tout est limité par un budget, jamais par la quantité de contenu.

### Deux façons de jouer

1. **Sentier**, le mode par défaut, guidé et à budget fixe :
   - échauffement : 2 ou 3 questions faciles ;
   - cœur : 6 à 8 questions sur la notion en cours ou la quête ;
   - au plus une nouveauté (leçon, atelier ou défi) ;
   - fin sur une réussite, puis résumé.

   Réglage parent : court (environ 5 min) ou normal (environ 10 min).

2. **Rafale**, pour enchaîner des calculs jusqu'à l'automatisme (voir la phase 7). Pas de budget : il joue tant qu'il veut.

### Pour l'enfant

1. Au plus 3 notions « en cours » à la fois dans le sentier. Une nouvelle notion ne s'ouvre que lorsqu'une autre est acquise. La quête occupe l'une de ces places.
2. Cycle de vie d'une notion :
   - découverte ;
   - en cours ;
   - acquise ;
   - automatisée (pour les notions à faits, quand ses faits le sont) ;
   - entretien : révision espacée (boîtes de Leitner) aux intervalles 1, 3, 7, 21 puis 60 jours ;
   - ancrée.

   Les révisions sont plafonnées à environ 25 % du sentier, et le surplus est reporté.

3. La difficulté monte à l'intérieur d'une notion (niveaux internes). Les acquis se combinent dans des problèmes mixtes au lieu de s'empiler.
4. Viser environ 80 % de réussite. En dessous de 70 %, plus de nouveauté et davantage de réussites faciles. Si les temps de réponse s'allongent nettement, le sentier est raccourci.
5. Une leçon par session au maximum, jamais imposée deux fois, puis rangée dans le Carnet.
6. Les quêtes sont archivées à la fin de leur période. Leurs notions rejoignent la révision normale.

### Pour l'écran et la forêt : les tableaux

1. Écran principal invariable : la forêt, une question et la jauge, plus deux points d'entrée dans la scène, la souche « Rafale » et le panneau « Défi ». Le Carnet et l'Album sont les seuls endroits qui grandissent.
2. La forêt est découpée en **tableaux** de taille fixe (environ 25 emplacements, dont les 3 grands moments). Un tableau est conçu pour être complété en environ 40 minutes de jeu, soit une semaine de sessions courtes, mais il n'y a pas de calendrier.
3. **Un nouveau tableau commence quand le précédent est complet, quel que soit le jour.** Grand final animé, puis le tableau est encadré dans l'Album.
4. **Décor du nouveau tableau :** celui imposé par la quête en cours s'il y en a un, sinon l'enfant choisit parmi 2 ou 3 décors.
5. **Album des forêts :** tous les tableaux terminés sont conservés et revisitables, animés et en vie (pas une simple photo), avec les dates et ce qu'il a appris pendant ce tableau. Le tableau en cours n'est jamais archivé tant qu'il n'est pas complet.
6. Le nombre d'objets de chaque tableau est plafonné, ce qui règle aussi la question des performances sur tablette.

### Pour le parent et le code

1. Tests de contenu sur le registre :
   - prérequis existants, pas de boucle ;
   - au plus 2 nouvelles notions par quête ;
   - au plus 6 étapes par leçon ;
   - énoncés de longueur limitée ;
   - au plus 15 éléments par quête.
2. Identifiants stables. Une notion nouvelle démarre à zéro, et une notion inconnue de la sauvegarde est ignorée.
3. Tableau de bord parent (menu caché) :
   - par domaine : acquis, en cours, à revoir, automatisé ;
   - les faits fragiles ;
   - temps et taux de réussite des dernières sessions ;
   - actions : mettre en pause, forcer un focus, régler la longueur.

## Jalons

Chaque jalon est livré en ligne et jouable. Les jalons GitHub portent les mêmes noms.

- **M0 « Tranche verticale visuelle »** (phases 0 et R) : assets gratuits et compléments générés, chaîne de traitement des assets, un décor complet (clairière) avec ses 5 paliers de richesse, à la qualité visée, fluide sur la vraie tablette. Validation par le propriétaire et test de la réaction de l'enfant avant d'aller plus loin.
- **M1 « Boucle jouable »** (phases 1 à 4) : forêt en tableaux avec Album, nombres, calcul mental, tables, sentier, sauvegarde.
- **M2 « Rafale et défis »** (phases 7 et 8) : automatisation des tables et du calcul mental.
- **M3 « Opérations posées et leçons »** (phases 5a et 6).
- **M4 « Temps et mesures »** (phases 5b et 5c).
- **M5 « Fractions »** (phase 5d).
- Ensuite : nouveaux modules à la demande (division, géométrie…), selon la recette.

## Phase 0 : socle et déploiement

1. Vite + TS strict + Preact, ESLint, Prettier, Vitest, Playwright. `base: '/numebois/'`.
2. vite-plugin-pwa : manifest (paysage, plein écran, icônes), précache.
3. `.github/workflows/ci.yml` (voir [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md#ci-et-déploiement)) : jobs `checks`, `e2e` et `Delivery gate`, puis `deploy` sur `main`. Pages (source « GitHub Actions »), protection de `main`, squash et fusion automatique sont configurés.
4. Docs et personnalisations : ce plan, [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md), les formulaires de tickets, le modèle de PR et les personnalisations Copilot initiales (commités). Dépôt public ; labels, jalons M0 à M5, réglages de fusion (squash seul, titre de la PR, suppression des branches, fusion automatique) et protection de `main` (`Delivery gate` requis) en place.
5. Fait quand : la page vide est en ligne et installable.

## Phase R : tranche verticale visuelle (priorité n°1)

Dépend de 0. Bloque les phases 3 et 4. Peut avancer en parallèle de la phase 1.

1. **Assets de départ :**
   - télécharger KayKit Forest et Medieval Hexagon en version gratuite pour les maquettes ;
   - chercher un pack CC0 d'animaux low-poly animés au style compatible et vérifier sa licence.
2. **Sources des assets :** les packs gratuits et nos sources Blender restent en local, hors du dépôt, pour l'instant. La chaîne de traitement décidera ce qui entre dans le dépôt (modèles gratuits utilisés, ou leurs versions optimisées), avec un fichier `LICENSES.md`.
3. **MCP Blender :** configuration et premier lot de compléments dans le style KayKit (fleurs, champignons, cabane, cascade), avec la même texture de dégradé, exportés en glTF. Rendus de contrôle pour le propriétaire. Les arbres, eux, sont générés dans le jeu (étape 5).
4. **Chaîne de traitement des assets** (`scripts/build-assets.ts`, avec glTF-Transform) :
   - fusion, élagage, quantification, compression meshopt, texture de dégradé partagée ;
   - génération d'un manifeste typé (`src/scene/assets.gen.ts`), pour que chaque référence à un modèle soit vérifiée par le compilateur.
5. **Moteur de rendu** (`src/scene/render/`) :
   - `stage.ts` (moteur de rendu, caméra, redimensionnement), `sky.ts` (ciel, brouillard), `lighting.ts` (lumière hémisphérique, soleil, ombres, halos) ;
   - `instancing.ts` (végétation en `InstancedMesh`), `wind.ts` (shader de vent), `water.ts`, `particles.ts`, `ambient-life.ts` (animaux, oiseaux, papillons) ;
   - `growth-fx.ts` (pousse, étincelles, caméra), `richness.ts` (paliers 0 à 4 : lumière, densité, effets, ambiance) ;
   - `src/scene/trees/` : forêt procédurale (squelette, tubes, touffes KayKit, âge de pousse), avec un test qui vérifie qu'une graine donne toujours le même arbre et le temps de génération mesuré sur la tablette ;
   - `quality.ts` (paliers de qualité automatiques).
6. **Deux maquettes comparées,** une île de tuiles hexagonales (Medieval Hexagon gratuit) et une clairière à relief libre générée par le code, avec les mêmes arbres et effets, chacune avec des captures aux paliers 0, 2 et 4. Première étape : la scène de démonstration sans mécanisme de jeu (`.github/prompts/scene-validation.prompt.md`), qui valide seulement le look sur la station de travail. Le propriétaire choisit ensuite la forme du tableau ; la tablette vient après.
7. **Décor « Clairière » complet** dans la forme choisie : composition, environ 25 emplacements, 3 grands moments, les 5 paliers de richesse, ambiance sonore.
8. **Mode démo** `?debug&stage=0..4&fill=0..100` : curseur pour parcourir la richesse, compteur d'images par seconde, mesures de mémoire graphique, d'appels de dessin et de triangles.
9. **Fait quand :**
   - sur la vraie tablette : 50 images par seconde ou plus en qualité haute, au moins 30 en moyenne ;
   - le propriétaire valide les captures des paliers 0, 2 et 4 ;
   - L'enfant regarde la démo et veut voir la suite (critère qualitatif, noté dans le journal).

## Phase 1 : moteur générique et premiers modules

Dépend de 0. En parallèle de la phase R.

1. `src/core/types.ts` et `registry.ts` : contrats, et `defineDomain`, `defineLesson`, `defineQuest`.
2. `rng.ts`, `expr.ts`.
3. `mastery.ts` (cycle de vie, maîtrise sur les 10 dernières réponses, Leitner) et `facts.ts` (pour chaque fait : réussites, temps de réponse, état d'automatisation).
4. `trail.ts` : sentier à budget fixe, au plus 3 notions en cours, révision ≤ 25 %, au plus une nouveauté, adaptation au taux de réussite et aux temps de réponse.
5. Indices progressifs : 1re erreur → méthode ; 2e erreur → réponse et méthode, et une question proche revient plus tard. Une erreur ne fait jamais perdre d'énergie.
6. Modules `numbers`, `mental-math`, `times-tables` (avec faits) et `word-problems` (premiers modèles).

## Phase 2 : interface de base

Dépend de 1.

1. Carte question, pavé numérique dans le jeu (réaction dès que le doigt touche, touches clavier, jamais le clavier Android).
2. Widgets `Keypad`, `Choice`, `FractionInput`, `TimeInput`.
3. Jauge d'énergie, retour immédiat.
4. Paysage en priorité, portrait toléré, cibles de 56 px minimum, `touch-action: none` sur les zones à faire glisser.

## Phase 3 : scène de jeu et tableaux

Dépend de R. En parallèle des phases 1 et 2.

1. Brancher le moteur de rendu de la phase R sur l'état du jeu : l'énergie fait pousser les éléments, la richesse fait passer les paliers.
2. **Décors** (`src/scene/biomes/`) : chaque décor définit son terrain, sa variante de couleurs, sa lumière et son ciel, ses emplacements composés (environ 25), ses 3 grands moments, ses éléments, son effet inédit, son ambiance sonore et son vocabulaire pour les problèmes. V1 : clairière (issue de la phase R), puis ruisseau avec cascade, puis verger fleuri. Les suivants viennent à la demande, chacun plus spectaculaire que le précédent.
3. **Tableau** (`src/scene/painting.ts`) : il est décrit par des données compactes (décor, graine, éléments posés avec type, variante, emplacement, stade et date). La même description sert pour le jeu et pour l'Album.
4. Choix de l'emplacement par l'enfant parmi 2 ou 3 emplacements qui brillent. Silhouettes des grands moments. Stades de croissance. Plafond d'objets.
5. Animations : vent, eau, apparition avec rebond et particules, animaux qui réagissent au toucher (seulement hors question), ombres douces, grand final.
6. Personnages : Plume la chouette, la souche « Rafale », le panneau « Défi ».

## Phase 4 : boucle complète, tableaux, Album, sauvegarde, son

Dépend de 2 et 3.

1. Sentier complet, avec son chemin de 10 pierres visible : question → micro-retour → énergie → choix de l'emplacement → élément → suite, puis résumé de fin.
2. Calibrage de l'énergie : environ un élément toutes les 1 à 1,5 minute de jeu. La taille de la jauge est réglée pour qu'un tableau se termine en environ 40 minutes de jeu. Le réglage est centralisé dans un seul fichier.
3. Fin de tableau : grand final, encadrement, entrée dans l'Album, puis choix du décor suivant (celui de la quête s'il y en a un, sinon 2 ou 3 au choix) et démarrage immédiat.
4. Album des forêts :
   - une grille de vignettes, une page par tableau, avec le tableau rejoué en vie à partir de sa description ;
   - les dates, et ce qu'il a appris pendant ce tableau (notions acquises, faits automatisés, records) ;
   - les vignettes sont générées à la fin du tableau (rendu Three.js hors écran, WebP d'environ 30 Ko).
5. Petite nouveauté du lendemain s'il a joué la veille.
6. Sauvegarde IndexedDB versionnée (`SAVE_SCHEMA_VERSION`) : tableau en cours, Album (descriptions et vignettes), progression. `navigator.storage.persist()`. Export/import dans le menu parent caché (appui long), Album compris.
7. Effets sonores Web Audio débloqués au premier toucher, bouton pour couper le son.

## Phase 5 : ateliers interactifs

Dépend de 1 et 2. Les sous-phases sont indépendantes entre elles. Chaque atelier appartient à un module de domaine.

### 5a. `column-arithmetic` : widget `ColumnOperation`

1. Grille M/C/D/U colorée, cases de retenue, trait de résultat. Étape facultative d'alignement des nombres.
2. Saisie de droite à gauche, curseur qui avance tout seul (chiffre, puis retenue).
3. Addition : 2 ou 3 nombres, jusqu'à 4 chiffres. Multiplication par 1 chiffre, avec la table concernée affichée sur demande.
4. Trois modes :
   - guidé : la colonne active est surlignée et Plume explique (« 7 + 8 = 15, j'écris 5, je retiens 1 ») ;
   - accompagné : vérification colonne par colonne, l'indice est le calcul de la colonne ;
   - autonome : vérification à la fin, en montrant doucement la première colonne qui coince.
5. Le module calcule les chiffres et les retenues attendus par colonne. Le widget ne fait qu'afficher.

### 5b. `time`

1. Horloge SVG : en lecture, réponse en hh:mm ; en réglage, il fait glisser les aiguilles. La grande entraîne la petite, avec un pas d'1 ou de 5 minutes.
2. Niveaux : heures piles, demies, quarts, 5 en 5, minute près. Matin et après-midi (14 h ↔ 2 h).
3. Frise des durées, h/min/s, calendrier du mois.

### 5c. `units` et `measures`

1. Règle à déplacer, segment à tracer, ligne brisée. Les longueurs sont générées en mm exacts.
2. Graduations : balance, verre doseur.
3. Tableau de conversion, relations entre unités, ordres de grandeur, monnaie.

### 5d. `fractions`

1. Parts à colorier (galette, bande, tablette, tranche de tronc), lecture de fraction.
2. Droite graduée, comparer à 1, fraction d'une quantité.

## Phase 6 : leçons

Dépend de 5 pour les modes démo et guidé.

1. `LessonPlayer`, scripts de démo des widgets, Carnet de la forêt.
2. Déclenchement :
   - au premier déblocage d'une notion ;
   - proposée (jamais imposée) après 3 erreurs sur les 5 dernières réponses ;
   - depuis le Carnet, à tout moment ;
   - depuis une quête.
3. Leçons V1, chacune dans son module :
   - valeur des chiffres ;
   - stratégies de calcul mental ;
   - tables ;
   - poser une addition ;
   - poser une multiplication ;
   - lire l'heure ;
   - durées ;
   - unités de longueur ;
   - masses et contenances ;
   - règle ;
   - fractions ;
   - monnaie.

## Phase 7 : mode rafale (automatisation)

Dépend de 4.

1. Accès depuis la souche « Rafale », avec trois entrées en grandes icônes :
   - **« Je choisis »** : toutes les notions déjà découvertes, avec un sous-choix rapide quand c'est utile (par exemple quelle table) ;
   - **« Recommandé »** : la rafale fixée par la quête de la semaine ou par le parent (par exemple « table de 7 »), mise en avant par un ruban ;
   - **« Mes faits fragiles »** : le jeu choisit les faits les moins automatisés, mélangés à des faits sûrs pour garder environ 80 % de réussite.
2. Flux rapide :
   - question suivante environ 400 ms après une bonne réponse ;
   - aucune leçon ni défi pour interrompre ;
   - après une erreur, la réponse s'affiche brièvement, et le fait revient 2 ou 3 questions plus tard ;
   - les questions difficiles sont entrecoupées de faits sûrs.
3. Pas de minuteur visible (c'est la différence avec les défis). Le temps de réponse est mesuré en silence pour suivre l'automatisation.
4. Un fait est « automatisé » quand il est juste du premier coup, avec un temps sous le seuil (environ 3 s pour les tables, ajustable par notion), 3 fois à des jours différents.
5. Motivation :
   - l'énergie compte toujours, donc la forêt pousse aussi en rafale ;
   - une guirlande de feuilles grandit avec la série et repart à zéro sans message négatif ;
   - « l'arbre des tables » dans le Carnet : chaque fait automatisé devient une feuille verte, et une table complète fait fleurir l'arbre.
6. Après environ 15 minutes, Plume propose une pause, sans l'imposer.
7. Le budget du sentier ne s'applique pas à la rafale. Les réponses en rafale alimentent quand même la maîtrise et la révision.

## Phase 8 : défis chronométrés

Dépend de 4 et 7 (réutilise le suivi des faits).

1. Formats :
   - panier de glands : 30, 60 ou 90 secondes, compteur qui ne fait que monter ;
   - course de la feuille : 10 ou 20 questions, avec une feuille fantôme qui rejoue son meilleur temps ;
   - bonus éclair discret dans le sentier.
2. Seulement sur des notions maîtrisées, marquées `challenge`.
3. Déclenchement :
   - proposé par l'écureuil, au plus une fois par session, refusable, et pas juste après des erreurs ;
   - panneau « Défi » ;
   - quête (le défi compte comme fait dès qu'il est tenté).
4. Le temps est représenté par un soleil ou un sablier de feuilles : pas de rouge ni de bip. Une erreur ne coûte pas de temps. Pause sur `visibilitychange`.
5. Objectif = médiane récente + 1, fin toujours positive, tendance sur les 3 dernières tentatives.
6. Énergie de participation toujours donnée, éléments rares réservés aux défis (lucioles, arc-en-ciel, cerf, lanternes de champignons).
7. Garde-fou : moins de 50 % de réponses justes → le défi suivant est plus facile ou plus long.

## Phase 9 : contenu CE2 et première quête

En parallèle des jalons.

1. Notions et prérequis de chaque module, du simple au complexe.
2. Banque de problèmes à variables sur le thème de la forêt.
3. Première quête dans `src/quests/`, avec notions, rafale recommandée, leçon et défi.
4. Aperçu avant activation via `?quest=YYYY-MM-DD`. Activation automatique par la date.

## Phase 10 : performances tablette

Dépend de 4, puis à chaque jalon.

1. Respect du budget de la section [Contraintes tablette](#contraintes-tablette), vérifié à chaque jalon sur la vraie tablette avec `?debug`. Animations en pause quand l'onglet est caché.
2. Environ 5 Mo au premier lancement. Les autres décors sont chargés à la demande et gardés en cache hors-ligne.

## Vérification

1. Vitest, modules : 1 000 graines par générateur, toutes les contraintes respectées. Opérations posées comparées à un calcul direct. Horloge (aller-retour exact), conversions, fractions, `expr.ts` qui refuse toute entrée non autorisée.
2. Vitest, contenu (sur le registre) : prérequis et absence de boucle, limites des quêtes et des leçons, identifiants uniques, chaque notion `drill` déclare ses faits.
3. Vitest, moteur :
   - maîtrise, Leitner, sentier ;
   - rafale : retour d'un fait 2 ou 3 questions après une erreur, mélange qui garde environ 80 % de réussite, critère d'automatisation ;
   - défis avec temps simulé ;
   - aller-retour export/import ;
   - une fois la compatibilité activée, ouverture de chaque fixture figée `tests/fixtures/saves/schema-N.json`.
4. Simulation de 6 mois, avec un élève virtuel à 80 % de réussite et une quête par semaine, qui vérifie :
   - un sentier de taille constante ;
   - au plus 3 notions en cours ;
   - des révisions ≤ 25 % ;
   - aucune notion acquise oubliée plus de 60 jours ;
   - un nombre d'objets de la scène sous le plafond ;
   - un tableau complété en 35 à 45 minutes de jeu simulé ;
   - un Album qui contient tous les tableaux terminés, chacun rejouable à l'identique depuis sa description.
5. Playwright, en émulation Galaxy Tab S4 avec le processeur ralenti 4× :
   - sentier complet avec un nouvel élément ;
   - rafale « table de 7 » sur 30 questions, sans interruption ;
   - addition posée avec 2 retenues, en mode guidé puis autonome ;
   - multiplication posée ;
   - régler l'horloge sur 3 h 45 en faisant glisser ;
   - mesurer à la règle ;
   - colorier 3/4 ;
   - convertir 3 m 25 cm ;
   - leçon jusqu'au bout et page ajoutée au Carnet ;
   - défi de 30 s avec horloge simulée ;
   - rechargement : la forêt reste identique ;
   - compléter un tableau (horloge et énergie accélérées en mode test) : grand final, choix du décor, nouveau tableau ; après rechargement, le tableau terminé est dans l'Album et se rouvre animé ;
   - choix de l'emplacement d'un élément au toucher ;
   - mode hors-ligne.
6. Captures en paysage et en portrait de chaque widget, relues à l'œil.
7. Test sur la vraie tablette via l'URL Pages.
8. Contrôle qualité du rendu pour chaque nouveau décor, élément ou effet :
   - captures avant/après depuis une caméra fixe, aux paliers 0, 2 et 4 ;
   - mesure des images par seconde, de la mémoire graphique, des appels de dessin et des triangles, en qualité haute et basse ;
   - validation du propriétaire obligatoire pour un nouveau décor.
9. Vitest : chaque référence de modèle existe dans le manifeste généré ; chaque décor a ses 5 paliers, ses 3 grands moments et au moins un effet inédit ; chaque modèle utilise la texture de dégradé partagée.

## Workflow GitHub

Repris de PasCap, où il a donné de bons résultats pour itérer de façon cohérente, et adapté à Numebois. Le détail est dans [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md). En résumé :

- **`main` est la production :** chaque push sur `main` déploie sur la tablette de l'enfant, mais seulement si le `Delivery gate` de la CI passe.
- **Changements courants** (interface, widgets, notions, leçons, quêtes, textes, docs, tests, petites corrections) : contrôle local rapide, commit, push direct sur `main`.
- **Changements risqués** (format de sauvegarde ou de l'Album, service worker et cache PWA, moteur de rendu partagé, chaîne de traitement des assets, CI/workflows/secrets, dépendances) : branche courte, PR, `gh pr merge --auto --squash`.
- **Tickets :** une catégorie, une priorité, des domaines `area:*` et un jalon M0 à M5, sans GitHub Project. `/github-issue` crée un ticket, `/work-on-issue <X>` livre les X tickets les plus pertinents. Les tickets initiaux seront créés quand ce plan sera finalisé.
- **Sauvegardes :** compatibilité obligatoire dès que le propriétaire déclare « l'enfant joue pour de vrai ».

## Personnalisations Copilot

Tout est rangé dans le dépôt (`.github/`), donc versionné avec le code. Chaque fichier reste court et renvoie à ce plan plutôt que de le recopier.

### Instructions

- [copilot-instructions.md](../.github/copilot-instructions.md) : toujours chargé. Projet, règles non négociables, conventions, architecture, routes de livraison, auto-amélioration.
- [child-ux.instructions.md](../.github/instructions/child-ux.instructions.md) : textes et interactions pour un enfant de 8 ans (interface, scène, leçons, énoncés).
- [domain-modules.instructions.md](../.github/instructions/domain-modules.instructions.md) : moteur, domaines et quêtes (fonctions pures, identifiants stables, tests sur 1 000 graines).
- [scene-art.instructions.md](../.github/instructions/scene-art.instructions.md) : rendu Three.js, direction artistique low-poly, budget tablette, assets.

### Skills et prompts

| Skill ou prompt                            | Déclencheurs                                                                    | Contenu                                                                                                                                                                                                                  | Créé                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `github-issue` (skill, `/github-issue`)    | invocation explicite                                                            | Créer ou réutiliser un ticket trié                                                                                                                                                                                       | Oui                           |
| `work-on-issue` (prompt, `/work-on-issue`) | invocation explicite                                                            | Livrer les X tickets les plus pertinents                                                                                                                                                                                 | Oui                           |
| `scene-validation` (prompt, `/scene-validation`) | invocation explicite                                                      | Scène de démonstration sans mécanisme de jeu, en deux formes (clairière, île hexagonale), pour valider le style sur la station de travail                                                                              | Oui                           |
| `tablet-ui-check`                          | vérifier l'affichage, capture, tablette, interface                              | Émulation Playwright Galaxy Tab S4, paysage et portrait, processeur ralenti, `?debug`, vérifications DOM d'abord, 4 captures au maximum par session                                                                      | Phase 0, avec Playwright      |
| `visual-review`                            | rendu, plus joli, embellir, effet, paysage, décor moche                         | Captures avant/après à caméra fixe aux paliers 0, 2 et 4, budget tablette, liste de contrôle de la direction artistique, validation du propriétaire                                                                      | Phase R                       |
| `add-biome`                                | nouveau décor, tableau de montagne, biome                                       | Modèle tiré de la clairière, terrain et variante de couleurs, lumière et ciel, emplacements, 5 paliers, effet inédit, ambiance sonore, puis `visual-review`                                                              | Phase R                       |
| `blender-asset`                            | créer un modèle, asset manquant, Blender, low-poly                              | MCP Blender : partir d'un modèle KayKit proche, réutiliser la texture de dégradé, respecter l'échelle et le nombre de polygones, exporter en glTF, passer la chaîne de traitement, rendu de contrôle | Phase R, après le premier lot |
| `add-skill`                                | ajouter les divisions, l'enfant doit travailler…, nouvelle notion, nouveau domaine | La recette, une liste de contrôle, un modèle tiré de `times-tables`                                                                                                                                                      | Fin de phase 1                |
| `write-lesson`                             | leçon, astuce de Plume, explique-lui…                                           | Types d'étapes, scripts de démo des widgets, règles de formulation, au plus 6 étapes                                                                                                                                     | Phase 6                       |
| `weekly-quest`                             | devoirs de la semaine, cette semaine l'enfant doit…, photo du cahier, quête        | Relier les devoirs aux notions (ou passer par `add-skill`), choisir rafale, leçon, défi et décor, respecter les limites, aperçu `?quest=`                                                                                | Phase 9                       |

Chaque skill est créé quand le code correspondant existe, pour que ses modèles soient tirés du vrai code. Dès qu'une même procédure revient une deuxième fois, elle devient un skill.

Vérification : frontmatter YAML valide, `name` identique au nom du dossier, `description` avec les mots déclencheurs français. Dans une nouvelle conversation, « ajoute les divisions » doit charger `add-skill`.

## Points ouverts

1. Animaux : trouver un pack CC0 d'animaux low-poly animés compatible avec le style KayKit (licence à vérifier), sinon les modéliser avec le MCP Blender. Les sons demandent aussi une licence vérifiée.
2. Forme du tableau (île hexagonale ou clairière rectangulaire) : choix du propriétaire pendant la tranche verticale.
3. Méthode de multiplication posée de l'école (position des retenues) : à vérifier sur un cahier de l'enfant.
4. Notation de l'heure attendue (« 14 h 10 », « 14:10 » ou « 2 h 10 de l'après-midi ») : réglable par exercice.
5. Fractions vues en classe : liste des dénominateurs.
6. Seuil d'automatisation (environ 3 s) : à ajuster après quelques sessions réelles, grâce au tableau de bord.
7. Durée cible d'un tableau (environ 40 minutes de jeu) et longueur du sentier (10 pierres) : à ajuster selon l'attention réelle de l'enfant. Les deux réglages sont centralisés.

## Journal des évolutions

- 2026-11-22 : plan initial. Défis chronométrés bienveillants ; tables, fractions, calcul mental, opérations posées avec atelier, unités, heure, mesures, leçons ; maîtrise de la charge dans la durée ; contenu en modules TypeScript au lieu du YAML ; mode rafale pour l'automatisation ; tenue du plan et recette d'ajout.
- 2026-11-22 : objectif principal « donner envie malgré la difficulté à se concentrer » ; forêt en tableaux de taille fixe (nouveau tableau dès que le précédent est complet), décor imposé par la quête ou choisi par l'enfant, Album de tous les tableaux, choix de l'emplacement des éléments. Pas de compagnon persistant.
- 2026-11-22 : personnalisations Copilot maintenues en continu ; code en anglais, textes et docs en français, glossaire ; quêtes dans `src/quests/`.
- 2026-11-22 : le rendu devient la priorité n°1. Pack d'assets 2D illustré acheté (sources dans un dépôt privé), le code ajoute la vie, 5 paliers de richesse par tableau, des décors de plus en plus spectaculaires, une ambiance sonore en couches, une tranche verticale visuelle (M0) à valider avant le reste. Pas de carte panoramique : l'Album page par page suffit.
- 2026-11-22 : reprise du workflow GitHub de PasCap (routes courante et risquée, `Delivery gate` avant le déploiement, `/github-issue`, `/work-on-issue`, formulaires de tickets, modèle de PR), sans Project. Compatibilité des sauvegardes obligatoire dès que l'enfant joue pour de vrai. Tickets créés une fois le plan finalisé.
- 2026-11-22 : création de ce plan, de `doc/GITHUB_WORKFLOW.md`, des personnalisations Copilot, des formulaires de tickets et du modèle de PR (pas encore commités).
- 2026-11-22 : passage à la 3D temps réel avec Three.js, en style cartoon low-poly (remplace PixiJS et le pack 2D). Assets KayKit Forest et Medieval Hexagon (CC0), complétés avec le MCP Blender dans le même style. Tableau en diorama 3D (île hexagonale ou clairière, choix pendant la tranche verticale).
- 2026-11-22 : premier lot MCP Blender : variantes de saison des 20 arbres de KayKit Forest gratuit (120 modèles), par nouvelles cases de dégradé dans l'atlas partagé et changement d'UV ; pommes ajoutées pour `Fruit`. En attente de validation du propriétaire.
- 2026-11-22 : nouvelles essences assemblées à partir des pièces KayKit (sucette, peuplier, chêne, bouleau, sapin de Noël, en 3 tailles) et 4 pousses, avec leurs saisons ; variante `Festive` des sapins. 249 modèles. En attente de validation du propriétaire.
- 2026-11-22 : investigation d'arbres procéduraux stylisés (squelette, Skin, cartes de feuilles en alpha dans l'atlas) ; faisable, mais style différent de KayKit et budget tablette juste.
- 2026-11-22 : décision : forêt procédurale dans le style KayKit (squelette procédural, tubes low-poly, touffes KayKit), avec croissance par âge ; prototype `kaykit_tree.py`.
- 2026-11-22 : décision : les arbres sont générés dans le jeu en TypeScript (`src/scene/trees/`), même coût d'affichage que des modèles exportés, itérations plus simples ; Blender reste disponible en cas de blocage.
- 2026-11-22 : les 249 arbres faits dans Blender ne sont pas à valider : ils servent de référence pour la palette des saisons et les recettes (touffe par touffe en automne, neige par le dégradé) du générateur du jeu.
- 2026-11-22 : plan, workflow et personnalisations commités ; labels, jalons M0 à M5 et réglages de fusion créés. Dépôt privé sur compte gratuit : protection, fusion automatique et Pages en attente d'une décision (public ou GitHub Pro).
- 2026-11-22 : dépôt rendu public ; protection de `main`, fusion automatique et Pages configurées. Pas de pack payant : les assets manquants sont générés ; pas de dépôt privé ; les fichiers des packs restent hors du dépôt pour l'instant.
- 2026-11-22 : répartition procédural / assets validée : terrain, eau et squelettes d'arbres par le code ; touffes, rochers, buissons, herbes et objets par KayKit (ou Blender s'ils manquent), posés par le code.
- 2026-11-22 : d'abord une scène de démonstration sans mécanisme de jeu pour valider le style sur la station de travail (prompt `scene-validation`) ; les deux formes de tableau (île hexagonale, clairière à relief libre) restent en lice ; test sur la tablette ensuite.
