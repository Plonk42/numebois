---
name: classwork-check
description: "Comparer les exercices et leçons de la classe de l'enfant avec les notions et astuces de Numebois. Use when : photos de fiches, exercices de la semaine, cahier, leçon de la classe, devoirs réels, vérifier que nos leçons correspondent, maitrelucas.fr, ce qu'il fait à l'école."
---

# Vérifier le jeu contre la classe

Le propriétaire envoie régulièrement des photos de fiches et de leçons de la classe. Le jeu doit suivre la classe : mêmes notions, même méthode, mêmes mots, même présentation. Plan : « Couverture du programme » et « Façons de faire de la classe ».

## Références, dans l'ordre

1. **La classe** (les photos) : c'est ce que l'enfant voit ; elle l'emporte en cas d'écart.
2. **[maitrelucas.fr](https://maitrelucas.fr/ce2/maths-ce2/)** (CE2, choix du propriétaire) : référence de qualité pour la méthode, le vocabulaire et la progression, et la source fréquente des fiches (pied de page « maitrelucas.fr »). Lire la leçon correspondante (`fetch_webpage`) quand la photo ne suffit pas.
3. Le programme officiel du cycle 2.

S'inspirer de la méthode et des mots, ne jamais recopier les textes, images ni exercices d'un site. Jamais le prénom de l'enfant (champ « Prénom » des fiches) ni les photos dans le dépôt.

## Procédure

1. **Relever** chaque exercice et chaque leçon des photos : notion, forme de la question (compléter, convertir, comparer, colorier, relier…), nombres et unités en jeu, vocabulaire (« retenue », « numérateur »…), méthode écrite pas à pas, présentation (colonnes c d u, retenue dans un rond, tableau m | dm | cm | mm).
2. **Retrouver** dans le code la notion et le niveau qui le couvrent : niveaux en tête de `src/domains/<domaine>/generators.ts`, astuces dans `lessons/`, indices dans `hints.ts`, bulles de Plume (par exemple `columns.ts`). Lire le code, pas seulement le plan. En cas de doute, jouer la notion (`?practice=<notion>&level=<n>`, astuce : `?lesson=<id>`).
3. **Classer** chaque point : ✓ couvert (notion et niveau), ≈ couvert avec un écart de forme, de mots ou de méthode, ✗ manquant (ticket du plan déjà prévu ou pas).
4. **Rendre compte** en un tableau court : exercice de la classe → notion et niveau du jeu → ✓/≈/✗ et l'écart. Signaler en tête ce que la classe travaille en ce moment et que le jeu n'a pas encore (priorité).
5. **Proposer, sans rien changer au jeu d'office :**
   - les écarts en tickets (skill `github-issue`, un ticket par notion, avec l'exemple de la fiche reformulé), ou en commentaire sur le ticket prévu ; prioriser ce qui est vu en classe cette semaine ;
   - au propriétaire, les réglages du tableau de bord parent qui suivent la semaine (focus, astuce à proposer) : il les règle lui-même, jamais par code.
6. **Mettre à jour le plan** dans le même commit : section « Façons de faire de la classe » (méthode, mots, présentation confirmés par une photo, datés), tableau de couverture, points ouverts tranchés par les photos. Pas de journal des vérifications.

Une fois les tickets acceptés, chaque correction suit sa recette : `add-skill` (notion ou niveau), `write-lesson` (astuce), `child-ux` (textes).
