---
name: add-skill
description: "Ajouter une notion, un domaine ou un type de saisie à Numebois. Use when : ajoute les divisions, l'enfant doit travailler…, nouvelle notion, nouveau domaine, nouveau module d'exercices, nouveau widget, générateur, indices, faits, tables, problèmes."
---

# Ajouter une notion ou un domaine

Recette de fond : [plan, « Recette : ajouter une notion ou un domaine »](../../../doc/PLAN_ACTION.md). Règles : [domain-modules.instructions.md](../../instructions/domain-modules.instructions.md) et [child-ux.instructions.md](../../instructions/child-ux.instructions.md). Modèle : `src/domains/times-tables/` (niveaux partagés par deux notions, faits dans `facts.ts`, indices tirés d'une table de méthodes, tests sur 1 000 graines).

## Écrire

1. **Domaine :** existant, ou `src/domains/<domain>/index.ts` (`defineDomain`) ajouté à `src/domains/index.ts`. L'ordre des domaines y règle l'ordre d'ouverture (`curriculum` les alterne).
2. **Générateur** (`generators.ts`) : l'id `<domain>.<notion>` en constante, un type d'exercice qui étend `Exercise` avec les valeurs tirées, les niveaux décrits en commentaire, `generate(rng, level, context)` pur qui refuse et retire les tirages hors contraintes (`context.vocabulary` : les mots du décor, pour un énoncé de problème ; modèle `src/domains/word-problems/problems.ts`).
3. **Indices** (`hints.ts`) : 1 = la méthode, 2 = la réponse avec la méthode. Phrases de 12 mots au plus, 3 phrases ou lignes et 120 caractères par bulle, aucun mot d'échec. L'indice 1 peut nommer l'erreur faite (`tried` : la réponse fausse et l'état du widget, #167) ; les leurres (`lures`) servent de liste d'erreurs typiques.
4. **Validation :** `validateNumber` ou `validateChoice` (`src/core/validate.ts`), sinon une nouvelle fonction au même endroit.
5. **Notion** (`skills.ts`, `defineSkill`) : prérequis (y compris d'autres domaines), `levels`, `challenge`, `facts` (`facts.ts`, ids `<notion>:<clé>`, `exercise(fact, rng)`, `groups` facultatifs) seulement pour ce qui se sait par cœur : une notion à faits se joue en rafale, les autres non. Réponse au pavé : le sentier la propose environ une fois sur trois parmi 4 choix (`offerChoices`, `src/core/choices.ts`) ; `lures` (`lures.ts`) donne les erreurs typiques de la notion (table voisine, retenue oubliée…), sinon ± 1, ± 10 et chiffres échangés. Un choix compte pour la maîtrise, jamais pour un fait.
6. **Nouveau type de saisie** (seulement si pavé, choix, signe entre deux nombres, droite graduée, opération posée, heure écrite, horloge à régler et règle ne suffisent pas) : le compilateur réclame les quatre morceaux.
   - `ExerciseInput` dans `src/core/types.ts` ;
   - sa règle de réponse dans `ANSWER_FITS` (`src/core/content.ts`) ;
   - son widget dans `src/ui/widgets/index.tsx`, placé avec `Work` (ou `Work wide`) et `AnswerZone`, cibles de 56 px, `pointerdown` ;
   - son pilote de test dans `DRIVERS` (`tests/e2e/helpers.ts`) : répondre comme l'enfant, et deux mauvaises réponses.
7. **Figure** (une illustration à lire sans la toucher : droite graduée, horloge, tableau de numération…) : champ `figure` de l'exercice, type `Figure` dans `src/core/types.ts` et son composant dans `FIGURES` (`src/ui/widgets/index.tsx`), affiché sous l'énoncé à côté de la zone de réponse. Modèles : `numbers.number-line-read`, `numbers.decompose` (plusieurs présentations tirées, `show`).

## Vérifier

1. Tests du module : contraintes de chaque niveau sur 1 000 graines (`src/domains/<domain>/<domain>.test.ts`).
2. Automatiques, sans rien écrire : `tests/unit/content.test.ts` (`exerciseErrors` sur 1 000 graines par niveau) et `tests/e2e/notions.spec.ts` (la notion jouée sur l'ardoise, indice, réponse montrée, dernier niveau, capture jointe).
3. `npm run format`, `npm run check`, puis `npx playwright test tests/e2e/notions.spec.ts -g <notion> --reporter=list`.
4. À l'œil : `?practice=<notion>&level=<n>` sur le serveur de dev (ou la tablette) joue la notion seule, sans toucher à la sauvegarde.
5. Plan : décisions, et tableau de couverture à la fin du jalon.
