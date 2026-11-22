---
name: github-issue
description: "Créer ou réutiliser un ticket GitHub Numebois trié à partir d'une demande courte. Use /github-issue pour chercher les doublons, enregistrer un bug, une proposition de fonctionnalité ou une tâche, avec catégorie, priorité, domaine, statut et jalon."
argument-hint: "Décris le bug, la fonctionnalité ou la tâche à enregistrer"
user-invocable: true
disable-model-invocation: true
---

# Enregistrer un ticket GitHub

Transformer le texte qui suit `/github-issue` en un ticket GitHub bien délimité, ou réutiliser un ticket existant qui correspond. L'invocation autorise l'enregistrement et le tri, **pas l'implémentation**, la fermeture d'un ticket ou la création d'un jalon. Ne pas lancer ce workflow simplement parce qu'un exemple d'invocation apparaît dans la conversation. La livraison suit ensuite le [workflow GitHub](../../../doc/GITHUB_WORKFLOW.md), pas ce skill.

Les changements courants (petits ajustements d'interface, corrections mineures, typos) n'ont pas besoin de ticket.

## Inspecter d'abord

1. Lire les instructions du dépôt et le [workflow GitHub](../../../doc/GITHUB_WORKFLOW.md). Utiliser le [formulaire](../../ISSUE_TEMPLATE/) adapté comme contrat de contenu.
2. Avant toute écriture, vérifier le remote Git, le propriétaire et le nom du dépôt, l'hôte GitHub et l'identité authentifiée. Numebois est `Plonk42/numebois` sur `github.com`. Si une intégration GitHub vise un autre hôte (entreprise), utiliser `gh api --hostname github.com` ou `gh … -R Plonk42/numebois`. Ne jamais afficher de jeton ni demander de secret.
3. Récupérer les labels et les jalons réels (M0 à M5…) avec leurs descriptions. Suivre la pagination. Il n'y a pas de GitHub Project.
4. Chercher dans les tickets **ouverts et fermés** avec plusieurs termes et synonymes (français et anglais), puis lire les candidats probables et leurs commentaires. Une recherche indisponible ne prouve pas l'absence de doublon : lister les tickets paginés ou signaler le blocage. Préférer réutiliser un ticket ouvert qui couvre le même résultat, en n'ajoutant que l'information nouvelle. Ne pas rouvrir automatiquement un ticket fermé : demander s'il s'agit d'une récidive ou d'un nouveau périmètre.

## Délimiter et trier

- Préserver l'intention du propriétaire. N'inspecter le code et les docs que pour établir le comportement actuel. Ne pas inventer de reproduction, d'accord, de solution technique ni de vérification. Une demande courte mais claire suffit. Ne poser une question que si une décision manquante empêche de délimiter ou de choisir le jalon.
- **Exactement une** catégorie : `bug` (comportement incorrect constaté), `enhancement` (fonctionnalité ou amélioration du jeu) ou `task` (ingénierie, docs, vérification, exploitation).
- **Exactement une** priorité, justifiée : `priority:p0` (perte de sauvegarde ou d'Album, jeu inutilisable), `priority:p1` (réponse attendue fausse, condition d'un jalon), `priority:p2` (travail normal, par défaut), `priority:p3` (amélioration facultative). Ne jamais déduire l'urgence de la seule formulation.
- Les domaines `area:*` pertinents parmi ceux existants : `area:render`, `area:pedagogy`, `area:ui`, `area:engine`, `area:save`, `area:assets`, `area:ci`, `area:workflow`. Ne pas créer de label à la volée.
- Facultatif, un statut : `status:backlog` (nouvelle proposition), `status:ready` (travail choisi et faisable) ou `status:blocked` (en nommant le vrai prérequis, la décision ou l'accord attendu).
- Un jalon existant, choisi d'après sa description réelle. S'il n'y en a aucun qui convient, demander plutôt que d'en créer un.
- Enregistrer les vrais prérequis comme liens natifs « blocked by ». Une simple proximité de sujet n'est pas une dépendance : utiliser le lien « relates to ».

## Corps du ticket

Titre concis et actionnable, en français, puis ces sections (adaptées au formulaire) :

- **Objectif :** le résultat attendu pour l'enfant ou le projet, et le comportement actuel vérifié.
- **Périmètre et hors périmètre :** comportement délimité. Rappeler les contraintes concernées : bienveillance (aucune punition), rendu prioritaire, budget tablette, compatibilité des sauvegardes, assets sous licence hors du dépôt public.
- **Critères d'acceptation :** liste observable, avec les tests et la vérification visuelle attendus. Distinguer l'acceptation proposée de la livraison vérifiée.
- **Dépendances et jalon :** tickets liés (`#N`, plus le lien natif), jalon proposé, vrais blocages.
- **État et accord :** proposition ou travail approuvé.
- **Justification de la priorité.**
- **Prochaine action :** la plus petite étape concrète, et la décision du propriétaire attendue s'il y en a une.

Ne publier que des faits nettoyés : pas de chemins privés, d'identifiants, d'assets du pack ni de données de sauvegarde de l'enfant.

## Écrire et vérifier

1. Créer le ticket avec sa catégorie, sa priorité, ses domaines, son statut et son jalon, ou mettre à jour minimalement le ticket réutilisé, en préservant son historique et ses métadonnées sans rapport.
2. Si une écriture expire ou que son résultat est incertain, relire l'état actuel avant de réessayer. Ne jamais créer un deuxième ticket ou commentaire à l'aveugle. Un doublon créé par erreur est fermé comme `not_planned`, en renvoyant au ticket canonique.
3. Relire le ticket : une seule catégorie, une seule priorité, au plus un statut ; domaines, jalon, prochaine action et liens natifs présents.
4. Renvoyer le lien du ticket, préciser s'il a été créé ou réutilisé, et indiquer les labels, le jalon et la prochaine action. Ne pas modifier de fichiers sources, commiter, pousser ni implémenter la demande pour l'enregistrer.

## Exemple

`/github-issue les animaux devraient réagir quand l'enfant les touche` est une **proposition de fonctionnalité**. Après vérification des doublons et du code, choisir normalement `enhancement`, `priority:p2`, `area:render`, `status:backlog` et le jalon qui couvre la scène de jeu. Rappeler en critères que les réactions n'ont lieu qu'entre deux questions (concentration protégée) et respectent le budget tablette. La prochaine action est de valider avec le propriétaire quels animaux et quelles réactions. Ne pas concevoir les animations ni les implémenter sans accord séparé.
