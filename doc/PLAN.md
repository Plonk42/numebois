# NUMEBOIS

## Cahier des charges — Prototype jouable V1

### 1. Présentation du projet

**Nom :** Numebois  
**Sous-titre :** La Forêt de Numebois

Numebois est un jeu éducatif de mathématiques accessible depuis un navigateur web, destiné principalement à un enfant de niveau CE2 (environ 8 ans).

Son principe est simple : l'enfant résout des opérations mathématiques pour faire grandir et embellir progressivement sa propre forêt.

Le jeu ne doit pas ressembler à un exercice scolaire traditionnel. Les mathématiques sont le moyen de faire évoluer un environnement naturel vivant, que l'enfant prend plaisir à découvrir et à développer.

**Philosophie générale :**

- Très facile à comprendre et à prendre en main.
- Sessions de jeu courtes, de 3 à 10 minutes.
- Récompenses visuelles fréquentes et gratifiantes.
- Progression durable entre les sessions.
- Aucune pression, aucun système punitif.
- Une attention particulière portée à la beauté et à l'atmosphère du paysage.

L'objectif de cette première version est de valider la boucle de jeu principale, avant d'envisager un contenu plus important.

---

### 2. Concept et boucle de jeu

Le joueur découvre une petite clairière naturelle, initialement presque vide.

Des opérations mathématiques lui sont proposées successivement.

Chaque bonne réponse lui rapporte de l'énergie naturelle. Cette énergie remplit une jauge de progression.

Lorsque la jauge atteint son maximum, un nouvel élément apparaît dans le paysage :

- Une fleur pousse.
- Un jeune arbre sort de terre.
- Un buisson apparaît.
- Des champignons poussent au pied d'un arbre.
- Un écureuil arrive.
- Un ruisseau commence à couler.
- Une cascade apparaît.

L'enfant voit ainsi directement le résultat de ses efforts.

**Boucle principale :**

1. Afficher une opération.
2. Saisir la réponse.
3. Vérifier la réponse.
4. Donner un retour visuel et sonore immédiat.
5. En cas de réussite, ajouter de l'énergie naturelle.
6. Si la jauge est pleine, faire apparaître un nouvel élément dans la forêt.
7. Proposer automatiquement l'opération suivante.

Le joueur doit pouvoir enchaîner les opérations sans navigation complexe ni interruption.

---

### 3. Direction artistique

La qualité visuelle est un élément central du projet.

Le jeu doit proposer un environnement naturel chaleureux, contemplatif et immersif, inspiré des forêts et paysages de montagne.

**Ambiance recherchée :**

- Forêt verdoyante et lumineuse.
- Végétation variée et naturelle.
- Reliefs doux, pierres, mousses et sous-bois.
- Lumière naturelle, ombres douces.
- Petits détails animés : herbes qui bougent, feuilles, eau qui coule.
- Animaux forestiers discrets et attachants.

Éviter absolument l'esthétique trop scolaire, les couleurs criardes et l'accumulation d'éléments d'interface.

L'ensemble doit donner envie de contempler le paysage.

#### Environnement initial

Le joueur commence dans une petite clairière comprenant :

- Un terrain herbeux.
- Quelques pierres.
- Une souche.
- Un ou deux jeunes arbres.
- Quelques fleurs.

La scène doit être suffisamment belle dès le départ, même si elle est peu développée.

#### Éléments naturels à intégrer

Prévoir une première bibliothèque d'environ 10 à 15 éléments :

| Catégorie  | Éléments                                 |
| ---------- | ---------------------------------------- |
| Végétation | Herbe, fleurs, fougères, buissons        |
| Arbres     | Jeune arbre, bouleau, sapin, grand arbre |
| Sol        | Pierres, rochers, champignons            |
| Animaux    | Écureuil, hérisson, oiseau               |
| Eau        | Petit ruisseau, cascade                  |

Les éléments doivent pouvoir apparaître progressivement dans le paysage.

Privilégier des assets de qualité ou des modèles procéduraux soignés. La cohérence visuelle est plus importante que la quantité.

---

### 4. Interface utilisateur

L'interface doit être minimaliste et adaptée à un enfant de 8 ans.

L'essentiel de l'écran doit être consacré au paysage.

#### Zone mathématique

Afficher une opération bien lisible, au premier plan ou dans un panneau discret.

Exemple :

**27 + 35 = ?**

Prévoir :

- Une zone de saisie numérique.
- Un bouton de validation.
- La validation par touche Entrée.
- Un retour immédiat après chaque réponse.

La saisie doit fonctionner aussi bien au clavier qu'à la souris.

#### Jauge de progression

Afficher une jauge représentant l'énergie naturelle accumulée.

Elle doit être compréhensible visuellement, sans nécessiter de lire des explications.

Lorsqu'elle se remplit :

- Animation de la jauge.
- Petit effet lumineux ou particules.
- Apparition du nouvel élément dans la
