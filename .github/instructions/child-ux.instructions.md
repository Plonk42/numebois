---
description: "Use when writing child-facing text, UI, interactions, lessons or word problems for the child (8 ans, CE2) : textes du jeu, formulations bienveillantes, astuces de Plume, énoncés de problèmes, interface tablette, cibles tactiles, concentration."
applyTo: "src/ui/**, src/scene/**, src/domains/**/lessons/**, src/domains/**/problems.ts"
---

# Textes et interactions pour l'enfant (8 ans, CE2)

## Textes

- Phrases courtes : 12 mots au maximum par phrase, 2 phrases au maximum par bulle, énoncés de problème de 25 mots au maximum (vérifié par les tests de contenu).
- Vocabulaire de CE2, sans jargon. Tutoiement. Chiffres en chiffres (« 24 glands »), sans abréviation inhabituelle.
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
- Paysage seulement (1280×800) : la tablette n'est jamais utilisée en portrait, pas de mise en page portrait.
- Surimpression (`src/ui/`, Preact) : jauge en haut à gauche, chemin de pierres du sentier en haut au centre, bouton du son en haut à droite, carte question à droite, ancrée en bas. Rien ne doit bouger sous le doigt (un indice pousse la carte vers le haut, pas les touches). Vérification : `tests/e2e/game.spec.ts` (cibles, chevauchements, débordement), puis quelques captures relues à l'œil.

## Concentration

- Pendant une question, une seule chose à l'écran : pas de menu, pas d'animation qui attire l'œil, pas d'animal interactif. Les récompenses et les interactions avec la forêt ont lieu entre deux questions.
- La fin est toujours visible (chemin de 10 pierres). Aucune notification, aucune pression.
- Palette douce et chaleureuse, cohérente avec le pack. Pas de couleurs criardes ni d'interface « scolaire ».
