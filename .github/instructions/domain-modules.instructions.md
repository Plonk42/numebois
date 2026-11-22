---
description: "Use when editing the generic engine, math domain modules or weekly quests : notions, générateurs d'exercices, validation, indices, faits, leçons, quêtes de la semaine, identifiants stables, tests sur 1 000 graines."
applyTo: "src/core/**, src/domains/**, src/quests/**"
---

# Moteur, domaines et quêtes

- `src/core/` reste générique : il ne connaît aucun domaine. Un domaine s'ajoute par `defineDomain` et une ligne dans `src/domains/index.ts`, jamais par un cas particulier dans le moteur.
- Générateurs, validation, indices, découpage en faits : des **fonctions pures**. Le générateur aléatoire est injecté (`rng`), jamais de `Math.random()` ni de `Date.now()` dans un domaine. Aucune dépendance à l'interface ou à la scène.
- Pas d'`eval` ni de `new Function` : les expressions passent par `src/core/expr.ts`.
- **Identifiants stables :** une notion, un fait, une leçon ou une quête publiés ne sont jamais renommés. Les sauvegardes y font référence. Pour remplacer, ajouter le nouveau et retirer l'ancien.
- La difficulté monte à l'intérieur d'une notion (niveaux internes), plutôt que par l'ajout de notions.
- Les réponses attendues doivent être exactes : un générateur refuse et retire les tirages hors contraintes (résultat négatif, retenue non voulue, division non entière…).
- Tests de chaque générateur sur 1 000 graines, avec toutes les contraintes vérifiées. Les opérations posées sont comparées à un calcul direct.
- Limites vérifiées par les tests de contenu :
  - au plus 2 nouvelles notions par quête ;
  - au plus 15 éléments par quête ;
  - au plus 6 étapes par leçon ;
  - prérequis existants et sans boucle ;
  - chaque notion `drill` déclare ses faits.
- Une quête (`src/quests/YYYY-MM-DD.ts`) tient en une dizaine de lignes et ne renvoie qu'à des notions existantes. Ajouter une notion manquante suit la recette du plan.
