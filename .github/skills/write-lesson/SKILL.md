---
name: write-lesson
description: "Écrire une astuce de Plume (leçon) pour Numebois. Use when : leçon, astuce de Plume, explique-lui, montre-lui comment, Plume montre, pas à pas, démo d'un widget, Carnet."
---

# Écrire une astuce de Plume

Le mot « leçon » n'apparaît jamais dans le jeu : « Plume te montre une astuce ». Règles de texte : [child-ux.instructions.md](../../instructions/child-ux.instructions.md). Plan : phase 6. Modèle qui couvre chaque sorte d'étape : `src/domains/column-arithmetic/lessons/essai.ts` (hors registre, jamais proposée à l'enfant).

## Écrire

1. **Fichier :** `src/domains/<domain>/lessons/<nom>.ts`, `defineLesson` (`src/core/registry.ts`), id stable `<notion>/<nom>` (la sauvegarde garde les pages du Carnet par id), `title` court (le haut de l'ardoise et la page du Carnet). Ajoutée à `lessons` du domaine (`defineDomain`).
2. **Étapes** (`LessonStep`, `src/core/types.ts`), 6 au plus :
   - `explain` : le texte de Plume, en grand ; avec `figure` (tableau de numération, droite graduée, plaques-barres-cubes), ou `demo`, un exercice que le widget joue tout seul (le pavé tape la réponse, l'opération posée écrit colonne par colonne avec la bulle de Plume ; les autres widgets montrent la réponse) ;
   - `manipulate` : l'enfant essaie sur un widget ;
   - `guidedExample` : un exemple fait avec Plume (une opération posée en mode `guided` : Plume dit chaque colonne) ;
   - `check` : 2 ou 3 exercices de la notion tirés au `level` donné.
3. **Exercices :** construits avec les fonctions du domaine (`addition([37, 48], 0)`, `sum(8, 5, 1)`…), donc exacts ; ils peuvent venir d'une autre notion déjà au registre.
4. **Textes :** une bulle de Plume (12 mots par phrase, 3 phrases ou lignes, 120 caractères, aucun mot d'échec) ; tutoiement, mots justes, chiffres en chiffres.

## Ce que fait le lecteur

Quand elle vient (#51, `src/core/lessons.ts`) : avant la première question d'une notion, son astuce pas encore vue se joue d'abord ; après 3 erreurs sur 5, Plume la propose (refusable) ; au plus une par session ; le Carnet la rejoue à volonté. Une notion peut avoir plusieurs astuces : la première pas encore vue vient d'abord.

`LessonPlayer` (`src/ui/lesson.tsx`) : une étape après l'autre sur l'ardoise, « Suivant » (ou Entrée) pour continuer. Un essai manqué montre l'indice de la notion, un deuxième la réponse, comme au sentier ; rien ne compte pour la maîtrise et rien ne rapporte de feuilles (rejouable sans ferme). À la fin, la page entre dans le Carnet (`src/ui/notebook.tsx`, bouton sous le son ou sous l'Album), qui s'ouvre dessus ; un appui sur une page la rejoue.

## Vérifier

1. `lessonContentErrors` (`registryErrors` pour celles du registre) : notion, 6 étapes, textes, exercices valides, niveaux. `tests/unit/content.test.ts` passe tout le registre.
2. À l'œil : `?lesson=<id>&name=X` joue l'astuce au lancement (avec la sauvegarde ; `?sandbox` couvre le bouton du Carnet de son panneau).
3. Une spec Playwright par astuce (modèle : `tests/e2e/lesson.spec.ts`).
