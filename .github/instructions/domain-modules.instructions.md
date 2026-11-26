---
description: "Use when editing the generic engine or math domain modules : notions, générateurs d'exercices, validation, indices, faits, leçons, identifiants stables, tests sur 1 000 graines."
applyTo: "src/core/**, src/domains/**"
---

# Moteur et domaines

- `src/core/` reste générique : il ne connaît aucun domaine. Un domaine s'ajoute par `defineDomain` et une ligne dans `src/domains/index.ts`, jamais par un cas particulier dans le moteur.
- Contrats dans `src/core/types.ts` : une notion (`defineSkill`) porte son id, ses prérequis, son nombre de niveaux et trois fonctions `generate(rng, level, context)`, `validate(exercise, answer)`, `hint(exercise, 1 | 2)`, écrites dans `generators.ts`, `validate.ts` et `hints.ts` (un nombre tapé au pavé se valide avec `validateNumber` de `src/core/validate.ts`). Un exercice donne la consigne, l'énoncé, le widget de saisie (`keypad`, `choice`, `compare`, `number-line`, `column` pour une opération posée), parfois une figure à regarder (`figure` : droite graduée, tableau de numération, plaques-barres-cubes…) et la réponse attendue sous la forme que renvoie le widget.
- `tests/unit/content.test.ts` parcourt tout le registre (1 000 graines par niveau) avec `exerciseErrors` (`src/core/content.ts` : réponse exacte et de la forme que rend le widget, 2 à 4 choix, phrases de 12 mots, bulles de 3 phrases ou lignes et 120 caractères, énoncé de 25 mots, aucun mot d'échec, fait déclaré), et `tests/e2e/notions.spec.ts` joue chaque notion sur l'ardoise : une nouvelle notion y passe sans rien ajouter. Le module garde ses propres tests de contraintes. Recette complète : skill `add-skill`.
- Un nouveau type de saisie (`ExerciseInput`) demande sa règle de réponse (`ANSWER_FITS`), son widget (`src/ui/widgets/index.tsx`) et son pilote de test (`DRIVERS`, `tests/e2e/helpers.ts`) ; le compilateur les réclame. Une illustration à lire sans la toucher est une `Figure` (son composant dans `FIGURES`), pas une saisie. `?practice=<notion>&level=<n>` joue une notion seule, sans sauvegarde.
- Générateurs, validation, indices, découpage en faits : des **fonctions pures**. Le générateur aléatoire est injecté (`rng`), jamais de `Math.random()` ni de `Date.now()` dans un domaine. Aucune dépendance à l'interface ou à la scène : ce qu'un domaine sait du jeu passe par `context` (`ExerciseContext` : le vocabulaire du décor en cours, pour `word-problems`).
- Pas d'`eval` ni de `new Function` : les expressions passent par `src/core/expr.ts`.
- **Identifiants stables :** une notion, un fait ou une leçon publiés ne sont jamais renommés. Les sauvegardes y font référence. Pour remplacer, ajouter le nouveau et retirer l'ancien.
- La difficulté monte à l'intérieur d'une notion (niveaux internes), plutôt que par l'ajout de notions.
- Les réponses attendues doivent être exactes : un générateur refuse et retire les tirages hors contraintes (résultat négatif, retenue non voulue, division non entière…).
- Tests de chaque générateur sur 1 000 graines, avec toutes les contraintes vérifiées. Les opérations posées sont comparées à un calcul direct.
- Limites vérifiées par les tests de contenu :
  - au plus 6 étapes par leçon ;
  - prérequis existants et sans boucle ;
  - une notion à faits (tables, additions simples, compléments à 10, doubles…) se joue en rafale, et seules celles-là : la rafale entraîne ce qui se sait par cœur, pas « écrire un nombre » ni la droite graduée. Ses faits sont déclarés (`facts.all`, préfixés par l'id de la notion), `facts.of(exercise)` renvoie un fait déclaré ou `null`, et `facts.exercise(fact, rng)` pose ce fait ; `facts.groups` (facultatif, ids stables) limite une rafale à un groupe (« La table de 7 »).
- Leçons dans `Domain.lessons` (`defineLesson`, id `<notion>/<nom>`) ; `registryErrors` les vérifie.
- Les devoirs de la semaine ne s'écrivent pas en code : le parent les règle dans le tableau de bord (focus jusqu'à une date, niveaux, astuce et défi à proposer). Le code de la quête en fichier (`src/quests/`, `Quest`, `defineQuest`, `questErrors`) part avec #54. Une notion manquante suit la recette du plan, en avance sur le programme.
