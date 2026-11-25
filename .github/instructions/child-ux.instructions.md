---
description: "Use when writing child-facing text, UI, interactions, lessons or word problems for the child (8 ans, CE2) : textes du jeu, formulations bienveillantes, astuces de Plume, énoncés de problèmes, interface tablette, cibles tactiles, concentration."
applyTo: "src/ui/**, src/scene/**, src/domains/**/lessons/**, src/domains/**/problems.ts"
---

# Textes et interactions pour l'enfant (8 ans, CE2)

## Textes

- Phrases courtes : 12 mots au maximum par phrase, deux phrases et une ligne de calcul au maximum par bulle (3 lignes, 120 caractères), énoncés de problème de 25 mots au maximum (vérifié par les tests de contenu, `exerciseErrors`).
- L'enfant a un très bon vocabulaire (propriétaire) : des mots justes et précis, sans jargon, ni scolaires ou d'adulte (« travailler », « recommandé »), ni enfantins (pas de mots de tout-petit, de diminutifs ni de ton bébé). Tutoiement. Chiffres en chiffres (« 24 glands »), sans abréviation inhabituelle.
- Le jeu a plusieurs décors (clairière, verger…) : dans les textes du jeu, parler du « paysage », pas de la « forêt » (demande du propriétaire).
- Pas de synthèse vocale : le texte doit se lire d'un coup d'œil, en gros caractères.
- Les énoncés parlent du décor en cours (glands, cabane, ruisseau, moulin…) et de ses habitants.

## Retours bienveillants

- À préférer : « Presque ! Regarde l'astuce », « Bravo ! », « Encore un peu et la fleur s'ouvre », « On regarde ensemble ? ».
- À proscrire :
  - « Faux », « Erreur », « Raté », « Perdu » ;
  - tout son d'échec, du rouge pour signaler une faute, un compte à rebours ;
  - « tu as perdu ta série », une comparaison avec d'autres enfants.
- 1re erreur : indice de méthode. 2e erreur : on montre la réponse avec la méthode, puis on avance. Jamais de ressource perdue.
- Un score plus bas que d'habitude se présente sans comparaison négative (« 12 glands. Ton record : 14 »).
- Le mot « leçon » n'apparaît pas : « Plume te montre une astuce ». Les devoirs de la semaine sont des « quêtes ».

## Interactions sur tablette

- Cibles tactiles de 56 px minimum. Réaction dès que le doigt touche (`pointerdown`), sans attendre le `click`.
- Zones à faire glisser (aiguilles, règle, repère) : `touch-action: none`, tolérance généreuse, aimantation aux valeurs utiles.
- Pavé numérique intégré : ne jamais ouvrir le clavier Android (pas d'`<input>` focalisable pour les réponses).
- Un calcul au pavé s'écrit comme sur une feuille (propriétaire) : la case de la réponse juste après le « = » (« 7 × 8 = ▢ ») ou à la place du « ? » (« 37 + ▢ = 100 ») : le générateur pose `inline: true` sur la saisie `keypad`. Pas pour une phrase ni un nombre en lettres.
- Paysage seulement (1280×800) : la tablette n'est jamais utilisée en portrait, pas de mise en page portrait.
- Surimpression (`src/ui/`, Preact) : réserve (feuilles, graines dorées) en haut à gauche, sentier (`#trail`) toujours en bas au centre, saisons et nuit du tableau (`src/ui/seasons.tsx`, la nuit en cinquième choix, seulement quand le tableau a au moins deux choix, entre deux sentiers et dans la boutique) puis bouton du son en haut à droite. Entre deux sentiers, au lancement comme après un sentier, l'écran est le même, sans carte d'accueil : le paysage à explorer aux doigts, la réserve en bouton (fond plein, rebord, une pousse au bout, même vide), le sentier en grand, son panneau « Chemin du progrès » planté sur la même tuile, au départ du chemin, et à sa droite, en bas à droite, la souche « Rafale » (dès qu'une notion à rafale a été rencontrée), qui ouvre la carte de la rafale, et en bas à gauche le panneau « Défi » (dès qu'une notion acquise a un défi), toujours refusable (« Pas maintenant »), le temps en soleil qui traverse le ciel, jamais en chiffres ni en rouge, et une fin toujours heureuse ; après un sentier réussi, au plus une fois par session, un écureuil propose un défi (refuser ne coûte rien) ; un petit « Éclair » sur le cadre de l'ardoise marque parfois une question bonus, sans temps affiché ; pendant la rafale, l'ardoise sans indice, une guirlande de feuilles sur son cadre, des tours de 20 questions avec leurs galets en bas de l'écran, et à la fin du tour les faits rencontrés avec leurs feuilles vers le par cœur (pas de chrono visible hors des défis ; « questions », pas « calculs » : une notion n'est pas toujours un calcul). Entre deux sentiers, sous le bouton du son : le livre de l'Album (dès le premier tableau encadré) et le carnet du Carnet (dès qu'une notion à faits a été rencontrée : un arbre par notion, une feuille par fait, une branche complète fleurit ; un appui sur une feuille dit où en est le fait, jamais sa réponse). Ce qui se touche a l'air d'un bouton, ce qui n'est qu'un affichage reste plat et translucide. L'exercice est sur l'ardoise (`Slate`), entre la réserve et le bouton du son, au-dessus du sentier devenu petit, la forêt assombrie derrière : consigne en haut (bandeau vert pâle), énoncé seul sur toute la largeur au-dessus de la zone de réponse (zone de travail à gauche seulement pour une figure ou un widget large), zone de réponse en bas à droite, Plume au bord gauche avec l'indice en bulle. En fin de sentier, une courte carte « Sentier terminé ! » (`#trail-end`, Plume verse son panier) puis directement la promenade ; la boutique n'a pas de nom : un appui sur la réserve (qui brille quand un article est à portée) ouvre la carte `#shop`, un second la ferme (`src/ui/shop.tsx` : quelques cartes, une grande image, un prix, ce qu'il reste à gagner sous un article hors de portée, un seul bouton « Fermer ») ; elle s'écarte quand la forêt a la main (places qui brillent au-dessus des emplacements, pousse, voile d'un nouveau palier). Le sentier ne change jamais de place : un appui sur lui ou sur son panneau le commence, il rapetisse, panneau compris (immobile, sans halo) ; consigne du geste puis « Revenir » en haut au centre pendant la promenade (hors du cadrage, le sentier s'efface). Rien ne doit bouger sous le doigt (l'indice va sous la zone de travail, jamais sur la zone de réponse). Un widget se place avec `Work` (ou `Work wide`) et `AnswerZone`. Hors d'une question, l'enfant explore la forêt aux doigts, dans des limites (`src/scene/render/explore.ts`), jamais pendant une question (`tests/e2e/explore.spec.ts`). Tableau complet (`src/ui/finale.tsx`) : bandeau du grand final en bas (`#finale`), cadre en bois autour de l'écran avec sa plaque (`#frame`), puis la carte « Un nouveau tableau ! » sur le voile (`#next-painting`, une grande image par décor). Le livre de l'Album (`#album-button`, sous le bouton du son) n'apparaît qu'entre deux sentiers ; l'Album (`#album`) est une grande carte sur le voile, et la page d'un tableau rejoué une petite carte en bas à droite (`#album-page`), la promenade restant possible (`tests/e2e/album.spec.ts`). Vérification : `tests/e2e/game.spec.ts` et `tests/e2e/notions.spec.ts` (chaque notion sur l'ardoise : cibles, chevauchements, débordement), puis quelques captures relues à l'œil.

## Concentration

- Pendant une question, une seule chose à l'écran : pas de menu, pas d'animation qui attire l'œil, pas d'animal interactif. Les récompenses et les interactions avec la forêt ont lieu entre deux questions.
- La fin est toujours visible (chemin de 10 pierres). Aucune notification, aucune pression.
- Palette douce et chaleureuse, cohérente avec le pack. Pas de couleurs criardes ni d'interface « scolaire ».
