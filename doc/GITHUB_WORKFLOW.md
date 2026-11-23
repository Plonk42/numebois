# Workflow GitHub

Numebois est un projet solo. Le workflow, repris de PasCap, favorise l'itération rapide : petits commits directement sur `main`, CI comme filet de sécurité, PR seulement pour les changements risqués, tickets seulement pour le travail qui mérite un suivi.

Différence majeure avec PasCap : **`main` est la production**. Chaque push sur `main` déploie le jeu sur la tablette de l'enfant, si et seulement si la CI passe. La vision et les décisions sont dans [PLAN_ACTION.md](PLAN_ACTION.md).

## Livrer un changement

| Changement                                                                                                                                                                                                   | Route                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Courant :** interface, widgets, notions et leçons, quêtes, problèmes, textes, docs, tests, petites corrections, refactorisations                                                                           | Contrôle local rapide, commit, push direct sur `main` |
| **Risqué :** format de sauvegarde ou de l'Album, service worker et cache PWA, moteur de rendu partagé et budget tablette, chaîne de traitement des assets, CI/workflows/secrets, mises à jour de dépendances | Branche courte et PR en squash auto-merge             |

En cas de doute, la route risquée. Un mauvais service worker peut bloquer l'app hors-ligne sur la tablette, et un mauvais format de sauvegarde peut faire perdre l'Album : ces deux-là ne passent jamais en direct.

### Changements courants

1. `git pull --ff-only` sur `main`. Ne jamais mettre de côté (stash), réinitialiser, jeter ni commiter des modifications sans rapport déjà présentes : les laisser non indexées.
2. Modifier, en lançant les tests unitaires concernés et le serveur de dev. Pour un changement d'interface, faire aussi une vérification visuelle en émulation tablette (paysage). Pour un changement de rendu, faire la revue visuelle (captures avant/après aux paliers 0, 6 et 11).
3. Contrôle rapide : `npm run format`, puis `npm run check` (format, lint, types, Vitest, build), plus les specs Playwright concernées. Pour les trouver, chercher dans `tests/e2e` les sélecteurs et les textes modifiés, renommés ou masqués. Un changement de docs seul ne demande que `npm run format`.
4. Commiter chaque étape cohérente avec ses tests et ses docs, puis `git push origin main`. GitHub signale que le push contourne la règle de PR : c'est normal pour un changement courant.
5. La CI tourne sur `main` et déploie si elle passe. Si elle échoue, la corriger est la tâche suivante. On corrige en avançant plutôt que de revenir en arrière, sauf si la casse bloque autre chose. Tant que la CI est rouge, rien n'est déployé.

### Changements risqués

1. Créer une branche depuis `main` à jour, commiter des étapes cohérentes, pousser et ouvrir une PR avec le [modèle](../.github/pull_request_template.md).
2. Activer la fusion automatique avec `gh pr merge --auto --squash`. GitHub fusionne quand le **Delivery gate** passe. Ne pas attendre la CI pendant la session.
3. Si la CI échoue, la PR reste ouverte : la corriger sur la même branche. Si `main` a bougé et que la PR est en conflit, fusionner `main` dans la branche. Rebaser et faire un force-push avec `--force-with-lease` seulement sur demande, ou pour retirer une base déjà fusionnée en squash de sa propre branche non fusionnée.
4. Ne pas empiler de PR dépendantes qui touchent au format de sauvegarde, au service worker ou au moteur de rendu : fusionner chacune avant de créer la suivante depuis `main`.

### Échecs de CI

Un échec qui n'arrive que sur les runners hébergés est un signal réel, pas une instabilité. Le reproduire dans des conditions proches de la CI (processeur ralenti, rendu logiciel) et corriger la cause. La même signature d'échec deux fois mérite un ticket de bug, prioritaire sur les nouvelles fonctionnalités. Les limites de temps peuvent être relevées pour un travail légitimement lourd (environ trois fois le temps mesuré). La vitesse des runners n'est jamais un critère de correction ou de performance.

### Commits, fermeture des tickets et accords

- Résumé à l'impératif, par exemple `Ajoute la rafale des tables (#12)`. Référencer les tickets liés avec `(#N)`. Mettre `Closes #N` dans le message de commit (push direct) ou dans la description de la PR quand le travail termine le ticket.
- Un ticket avancé sans être fermé reçoit un commentaire court une fois le travail livré : commit ou PR, ce qui est fait, ce qui reste. Le suivant reprend ainsi sans tout relire.
- Ne jamais faire de force-push sur `main`, affaiblir ou sauter des tests pour obtenir du vert, ni commiter des chemins privés, des fichiers bruts des packs, des identifiants, des caches ou des rapports générés.
- Les actions suivantes demandent l'accord explicite du propriétaire :
  - la fermeture d'un jalon ;
  - l'ajout d'un nouveau pack d'assets ;
  - la validation d'un nouveau décor ;
  - la déclaration « l'enfant joue pour de vrai ».

## CI et déploiement

Le workflow `.github/workflows/ci.yml` tourne sur les PR, les pushs sur `main` et le déclenchement manuel, avec des permissions en lecture seule (sauf pour le déploiement). Un push plus récent sur la même branche annule l'exécution précédente.

| Job             | Rôle                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `checks`        | `npm run check` en étapes séparées : format, lint, types, Vitest, build                                                     |
| `e2e`           | Playwright en émulation de la tablette cible (Lenovo Tab M10 Gen 3, paysage 1280×800)                                       |
| `Delivery gate` | Réussit seulement si tous les jobs ci-dessus ont réussi                                                                     |
| `deploy`        | Seulement sur `main`, après le `Delivery gate` : construit et publie sur GitHub Pages (https://plonk42.github.io/numebois/) |

- Seulement des assets gratuits (KayKit CC0) et des compléments générés : pas de pack payant ni de dépôt privé. Les fichiers bruts des packs restent hors du dépôt ; seuls les modèles optimisés (`public/assets/kaykit.glb`) y entrent, avec `LICENSES.md`.
- Une nouvelle version de la PWA s'active au lancement suivant, jamais au milieu d'une session.
- Protection de `main` :
  - PR obligatoire pour les non-administrateurs, avec le **Delivery gate** comme seul contrôle requis (les branches n'ont pas besoin d'être à jour) ;
  - historique linéaire, pas de force-push ni de suppression ;
  - l'application aux administrateurs est désactivée, pour que le propriétaire puisse pousser les changements courants ;
  - fusion squash, fusion automatique et suppression automatique des branches activées.

## Tickets et planification

- Ouvrir un ticket pour les bugs, les fonctionnalités, les investigations et le travail en plusieurs étapes qui mérite un suivi, après avoir cherché les doublons. Les changements courants n'en ont pas besoin. Logger un ticket n'autorise pas son implémentation.
- Trier avec une catégorie, une priorité, les domaines concernés et un jalon. Enregistrer les vrais prérequis comme liens natifs « blocked by ».
- Les labels `status:*` sont une aide facultative : ne pas les mettre à jour à chaque commit, ni les nettoyer après la fermeture.
- Commenter seulement pour une information utile : une reproduction, une décision, un échec de CI. Pas de points d'étape.
- Pas de GitHub Project : labels et jalons suffisent.
- [PLAN_ACTION.md](PLAN_ACTION.md) porte la vision et le journal, les tickets portent l'avancement.

| Catégorie     | Sens                                                    |
| ------------- | ------------------------------------------------------- |
| `bug`         | Comportement incorrect reproductible                    |
| `enhancement` | Fonctionnalité ou amélioration du jeu                   |
| `task`        | Ingénierie, vérification, documentation ou exploitation |

| Priorité      | Sens                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `priority:p0` | Perte de sauvegarde ou d'Album, jeu inutilisable sur la tablette       |
| `priority:p1` | Exactitude pédagogique (réponse attendue fausse), condition d'un jalon |
| `priority:p2` | Travail planifié normal (par défaut)                                   |
| `priority:p3` | Amélioration facultative                                               |

| Domaine         | Périmètre                                                                          |
| --------------- | ---------------------------------------------------------------------------------- |
| `area:render`   | Paysage, effets, décors, paliers de richesse                                       |
| `area:pedagogy` | Notions, générateurs, indices, leçons, quêtes, problèmes                           |
| `area:ui`       | Interface, widgets, pavé, Carnet, Album (écran)                                    |
| `area:engine`   | Sentier, rafale, maîtrise, révision, défis                                         |
| `area:save`     | Sauvegarde, Album (données), export/import, compatibilité                          |
| `area:assets`   | Packs KayKit et autres, licences, modèles générés ou Blender, chaîne de traitement |
| `area:ci`       | CI, déploiement, tests e2e                                                         |
| `area:workflow` | Workflow, personnalisations Copilot, docs                                          |

Les jalons GitHub sont M0 à M5, avec la même description que dans le plan. Un nouveau jalon est créé seulement avec l'accord du propriétaire.

Dans Copilot Chat :

- `/github-issue <demande courte>` crée ou réutilise un ticket trié, via le [skill](../.github/skills/github-issue/SKILL.md) ou les formulaires [bug](../.github/ISSUE_TEMPLATE/bug_report.yml), [fonctionnalité](../.github/ISSUE_TEMPLATE/feature_request.yml) et [tâche](../.github/ISSUE_TEMPLATE/work_item.yml).
- `/work-on-issue <X>` choisit les X tickets les plus pertinents et les livre un par un selon les routes ci-dessus, via le [prompt](../.github/prompts/work-on-issue.prompt.md). L'invoquer autorise l'implémentation des tickets choisis, pas les décisions qu'ils laissent ouvertes.

## Compatibilité des sauvegardes

La progression de l'enfant et son Album sont précieux : les perdre serait très démotivant.

- **Tant que le propriétaire n'a pas déclaré « l'enfant joue pour de vrai »** (à noter dans le journal du plan), le format de sauvegarde peut changer librement.
- **Ensuite,** toute sauvegarde écrite par une version publiée doit s'ouvrir avec le même sens. On préfère les ajouts compatibles, qui ne demandent pas de changer de version (nouvelle notion, nouveau décor, nouveau champ facultatif). Un changement incompatible passe par la route risquée et apporte, dans la même PR :
  - `SAVE_SCHEMA_VERSION` incrémenté ;
  - l'étape de mise à niveau depuis la version précédente dans `src/save/migrations.ts`, une fonction pure qui ne supprime ni ne réinterprète jamais une valeur ;
  - une fixture figée `tests/fixtures/saves/schema-N.json`, générée avec des données représentatives (tableau en cours, Album, faits). Ne jamais modifier une fixture existante : les tests ouvrent chacune d'elles.
- La mise à niveau se fait en mémoire au chargement. La sauvegarde d'origine est conservée à côté jusqu'à la prochaine écriture réussie, et un export JSON est proposé avant toute mise à niveau.
- Une sauvegarde illisible (trop ancienne, plus récente ou invalide) est refusée avec une raison claire, et laissée intacte.
- Indiquer tout impact sur les données dans la ligne **Impact sur les données** de la PR.
