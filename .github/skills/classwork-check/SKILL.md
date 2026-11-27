---
name: classwork-check
description: "Comparer les exercices et leçons de la classe de l'enfant avec les notions et astuces de Numebois. Use when : photos de fiches, exercices de la semaine, cahier, leçon de la classe, devoirs réels, vérifier que nos leçons correspondent, maitrelucas.fr, ce qu'il fait à l'école."
---

# Vérifier le jeu contre la classe

Le propriétaire envoie régulièrement des photos de fiches et de leçons de la classe. Le jeu doit suivre la classe : mêmes notions, même méthode, mêmes mots, même présentation. Plan : « Couverture du programme » et « Façons de faire de la classe ».

## Références, dans l'ordre

Règle du propriétaire (2026-11-27) : le programme (quelles notions, jusqu'où, dans quel ordre) vient **seulement des sources officielles** ; Maître Lucas est une ressource pour la manière d'enseigner, jamais pour le programme.

1. **La classe** (les photos) : c'est ce que l'enfant voit ; pour la méthode, les mots et la présentation, elle l'emporte en cas d'écart.
2. **Le programme officiel** du cycle 2 en vigueur (BO n° 41 du 31/10/2024) et les ressources éduscol : seule source pour le contenu et la progression.
   - [Ressources du cycle 2](https://eduscol.education.gouv.fr/4746/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-2) : le programme et le livret d'accompagnement CE2, des séquences détaillées (n° 1 : mesurer des longueurs avec les fractions).
   - [Ressources du cycle 3](https://eduscol.education.gouv.fr/5712/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-3), « Exemples de mise en œuvre par entrées thématiques » : fractions, calcul mental, résolution de problèmes, du CE1 au CM2.
   - [Repères annuels de progression](https://eduscol.education.gouv.fr/6910/reperes-annuels-de-progression-et-attendus-de-fin-d-annee-du-cp-la-troisieme) : à quelle période de l'année vient chaque notion.
3. **[maitrelucas.fr](https://maitrelucas.fr/ce2/maths-ce2/)** (choix du propriétaire) : ressource de qualité pour la méthode, le vocabulaire et les exemples, et source fréquente des fiches (pied de page « maitrelucas.fr »). Lire la leçon correspondante (`fetch_webpage`) quand la photo ne suffit pas. Son classement par niveau suit encore l'ancien programme (ses fractions sont en CM1) : ne jamais en déduire ce qui est au programme.

S'inspirer de la méthode et des mots, ne jamais recopier les textes, images ni exercices d'un site. Jamais le prénom de l'enfant (champ « Prénom » des fiches) ni les photos dans le dépôt.

## Procédure

1. **Relever** chaque exercice et chaque leçon des photos : notion, forme de la question (compléter, convertir, comparer, colorier, relier…), nombres et unités en jeu, vocabulaire (« retenue », « numérateur »…), méthode écrite pas à pas, présentation (colonnes c d u, retenue dans un rond, tableau m | dm | cm | mm).
2. **Retrouver** dans le code la notion et le niveau qui le couvrent : niveaux en tête de `src/domains/<domaine>/generators.ts`, astuces dans `lessons/`, indices dans `hints.ts`, bulles de Plume (par exemple `columns.ts`). Lire le code, pas seulement le plan. En cas de doute, jouer la notion (`?practice=<notion>&level=<n>`, astuce : `?lesson=<id>`).
3. **Classer** chaque point : ✓ couvert (notion et niveau), ≈ couvert avec un écart de forme, de mots ou de méthode, ✗ manquant (ticket du plan déjà prévu ou pas).
4. **Rendre compte** en un tableau court : exercice de la classe → notion et niveau du jeu → ✓/≈/✗ et l'écart. Signaler en tête ce que la classe travaille en ce moment et que le jeu n'a pas encore (priorité).
5. **Proposer, sans rien changer au jeu d'office :**
   - un **ticket parent par série de photos** (« Fiches de la classe du JJ/MM », `task`, `area:pedagogy`, label `classe`, sans jalon) : le tableau complet, chaque ligne ≈/✗ renvoyant à son ticket ;
   - ses **sous-tickets** (`gh api -X POST repos/Plonk42/numebois/issues/<parent>/sub_issues -F sub_issue_id=<id>`, l'`id` du ticket, pas son numéro) : un par notion à modifier, qui regroupe toutes les lignes de cette notion, nouveau (skill `github-issue`, jalon « Suivre la classe », label `classe`, l'exemple de la fiche reformulé) ou existant (rattaché, son jalon thématique ouvert gardé, label `classe` ajouté, commentaire avec ce que la classe en montre). Les lignes ✓ restent dans le tableau, sans ticket. Jamais de jalon thématique rouvert ;
   - règle du propriétaire (2026-11-26) : les tickets d'une série sont **fermés avant la série suivante** ; ils passent devant le reste, et le parent se ferme avec son dernier sous-ticket (un ticket n'a qu'un parent) ;
   - au propriétaire, les réglages du tableau de bord parent qui suivent la semaine (focus, astuce à proposer) : il les règle lui-même, jamais par code.
6. **Mettre à jour le plan** dans le même commit : section « Façons de faire de la classe » (méthode, mots, présentation confirmés par une photo, datés), tableau de couverture, points ouverts tranchés par les photos. Pas de journal des vérifications.

Une fois les tickets acceptés, chaque correction suit sa recette : `add-skill` (notion ou niveau), `write-lesson` (astuce), `child-ux` (textes).
