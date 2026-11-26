---
name: work-on-issue
description: "Choisir les X tickets GitHub ouverts les plus pertinents de Numebois et les livrer un par un : changements courants directement sur main, changements risqués sur leur propre PR en squash auto-merge. Use /work-on-issue 3 pour traiter les trois premiers."
argument-hint: "Nombre de tickets à traiter, par ex. 3"
agent: agent
---

# Traiter les tickets les plus pertinents

Traiter les **X** tickets ouverts les plus pertinents de `Plonk42/numebois`, X étant le nombre donné après `/work-on-issue` (1 par défaut). Suivre les [instructions du dépôt](../copilot-instructions.md) et le [workflow GitHub](../../doc/GITHUB_WORKFLOW.md), y compris les routes : les changements courants vont directement sur `main`, les risqués passent par une branche courte et une PR.

Rappel : `main` est la production. Un push sur `main` déploie sur la tablette de l'enfant si la CI passe.

L'invocation autorise l'implémentation des tickets choisis. Elle n'autorise pas la fermeture d'un jalon, l'ajout d'un nouveau pack d'assets, la validation d'un nouveau décor, la déclaration « l'enfant joue pour de vrai », ni les décisions qu'un ticket laisse ouvertes.

## 1. Choisir

1. `git pull --ff-only` sur `main`. Noter les modifications sans rapport non commitées : ne jamais les mettre de côté, réinitialiser, jeter ni indexer.
2. Lister les tickets ouverts (pas les PR) avec leurs labels, jalon, corps et commentaires, via `gh api --hostname github.com` ou `gh … -R Plonk42/numebois` (vérifier l'hôte). Vérifier aussi les PR ouvertes, pour sauter un ticket déjà en cours.
3. Classer par pertinence, dans cet ordre :
   - signatures d'échec de CI et `bug` avant `enhancement`/`task` ;
   - `priority:p0` → `p3` ;
   - jalon le plus proche (M0 avant M1 avant M2…) ;
   - `status:ready` avant les tickets sans statut, avant `status:backlog` ;
   - périmètre plus petit et autonome d'abord, et tickets qui débloquent les autres d'abord.
4. Écarter, en expliquant pourquoi, les tickets :
   - avec un sous-ticket encore ouvert (son prérequis) ;
   - qui attendent une décision ou un accord du propriétaire ;
   - qui demandent des identifiants ou un nouveau pack d'assets ;
   - qui demandent la validation visuelle d'un nouveau décor par le propriétaire avant livraison ;
   - qui dépendent de la PR non fusionnée d'un autre ticket choisi. Ne jamais empiler des PR risquées dépendantes.
5. Annoncer les X tickets choisis et les candidats écartés en une courte liste, puis continuer sans attendre de confirmation.

## 2. Livrer chaque ticket, un à la fois

Pour chaque ticket choisi, dans l'ordre du classement :

1. `git pull --ff-only` sur `main`. Lire le ticket, ses commentaires, les tickets liés et les sections concernées de `doc/PLAN_ACTION.md`. Vérifier le comportement actuel dans le code avant de changer quoi que ce soit.
2. Classer le changement en courant ou risqué selon le tableau du workflow (en cas de doute : risqué). Pour un travail risqué : `git fetch origin`, puis `git switch -c issue/<N>-<court-slug> origin/main`.
3. Implémenter le plus petit changement complet qui remplit les critères d'acceptation, avec ses tests et la mise à jour du plan (décisions, recettes). Respecter les règles non négociables (bienveillance, rendu prioritaire, budget tablette, fichiers bruts des packs hors du dépôt, compatibilité des sauvegardes). Utiliser les skills existants (`add-skill`, `add-biome`, `write-lesson`, `visual-review`, `tablet-ui-check`) quand ils s'appliquent.
4. Valider comme l'exigent les instructions :
   - tests unitaires concernés ;
   - vérification en émulation tablette (paysage) pour un changement d'interface ;
   - captures avant/après aux paliers 0, 6 et 11 et budget tablette pour un changement de rendu ;
   - `npm run format`, `npm run check` et chaque spec Playwright concernée, trouvée en cherchant dans `tests/e2e`.

   Ne jamais affaiblir une assertion, ajouter des relances ni sauter un test.

5. Commiter des étapes cohérentes avec uniquement ses propres fichiers (résumé à l'impératif avec `(#N)`).
   - Courant : `Closes #N` dans le dernier commit, puis `git push origin main`.
   - Risqué : pousser la branche, ouvrir une PR avec le [modèle](../pull_request_template.md) et `Closes #N`, puis `gh pr merge --auto --squash`. Ne pas attendre la CI ; revenir sur `main`.
   - Ticket seulement avancé (sans `Closes`) : commenter le ticket (commit ou PR, ce qui est fait, ce qui reste).
6. Si le ticket ne peut pas être terminé (décision manquante, validation qui échoue et que l'on ne sait pas corriger, périmètre plus grand que prévu), arrêter ce ticket et ne rien commiter d'incomplet sur `main`.
   - Travail risqué : pousser ce qui est utile en PR brouillon sans `Closes`, puis passer au suivant.
   - Travail courant : laisser les modifications partielles non commitées et terminer la session, pour qu'elles ne se mélangent pas avec le ticket suivant.

   Commenter le ticket avec ce qui mérite d'être gardé (cause de l'arrêt, travail partiel poussé).

## 3. Compte rendu

Terminer par une ligne courte par ticket : numéro, titre, lien du commit ou de la PR (ou raison de l'arrêt), validation effectuée et limites restantes. Lister les candidats écartés à part.
