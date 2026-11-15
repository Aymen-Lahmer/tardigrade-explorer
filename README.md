# Tardigrade Atlas — version JavaScript autonome

Version autonome et volontairement simple du studio `../tardigrade/`.
Django sert la page et l'API, le navigateur affiche le tardigrade en 3D avec Three.js.
Pas de React, pas de TypeScript, pas de Vite, pas de `node_modules` : trois modules
JavaScript natifs, lisibles de haut en bas.

Le dossier est complet : le modèle 3D, Three.js et la base de protéines vivent
à l'intérieur, rien n'est importé depuis le reste du dépôt.

## Lancer

```sh
cd tardigrade-js
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python manage.py migrate     # crée db.sqlite3 et les 6 protéines
./venv/bin/python manage.py runserver
```

Ouvrir http://127.0.0.1:8000.

`db.sqlite3` est créé par `migrate` et ignoré par git : on peut le supprimer,
il suffit de relancer `migrate`. Aucun `collectstatic` n'est nécessaire, Django
sert `static/` directement (voir `tardigradesite/urls.py`).

## Ce que fait le site

- Viewer 3D : orbite à la souris, zoom à la molette, 4 vues (¾, face, côté, dos),
  rotation automatique, reset.
- Curseur **Zoom** : le tardigrade reste entier et grossit jusqu'à 50 % ; au-delà,
  il s'efface au profit de la couche protéines (emplacements provisoires).
- Clic (ou tap) sur une pièce : la pièce passe en turquoise et sa fiche s'ouvre.
- Bouton **Find a protein** (raccourci `/`) : recherche dans la base de protéines
  servie par l'API Django (plus d'onglet ni de catalogue de pièces).
- Fiche protéine : description, UniProt, masse moléculaire, lien UniProt.
- Barre latérale gauche : 4 liens (Home, Explore Proteins, Protein details,
  Stress response) qui ouvrent chacun sa page dans un nouvel onglet.

## Comment les fichiers s'enchaînent

```
navigateur                         Django
──────────                         ──────
GET /                        ──>   views.index        ──> static/index.html
GET /static/js/main.js       ──>   urls.py (serve)    ──> fichier statique
fetch /static/models/...     ──>   urls.py (serve)    ──> JSON + binaire 3D
fetch /api/proteins/?q=Dsup  ──>   views.proteins     ──> SQLite
```

Dans le navigateur :

1. `index.html` charge `js/main.js` en module et déclare un **import map** qui
   fait pointer `three` vers `static/vendor/three/`.
2. `main.js` câble toute l'interface (DOM direct) et appelle `atlas.js`.
3. `atlas.js` télécharge le catalogue JSON puis le binaire, et construite une
   géométrie Three.js par pièce.
4. `scene.js` crée le rendu, oriente et pose le modèle, puis expose une petite
   API : `setPieces`, `setZoom`, `setView`, `setRotate`, `select`, `reset`.
5. Un clic est transmis par `scene.onSelect` → `main.js` ouvre la fiche.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `manage.py` | commandes Django (`runserver`, `migrate`, `shell`) |
| `requirements.txt` | une seule dépendance : Django 5.2 |
| `tardigradesite/settings.py` | réglages, chemins, SQLite |
| `tardigradesite/urls.py` | 4 routes : page, API, fichiers statiques, pages du menu |
| `tardigradesite/views.py` | lecture d'`index.html` + API `/api/proteins/` |
| `tardigradesite/models.py` | modèle `Protein` |
| `tardigradesite/migrations/` | schéma + données de départ (6 protéines) |
| `static/index.html` | toute la structure de l'interface |
| `static/css/styles.css` | mise en page et responsive |
| `static/js/main.js` | interface : recherche, fiches, contrôles |
| `static/js/scene.js` | Three.js : caméra, zoom / couche protéines, sélection |
| `static/js/atlas.js` | lecture du JSON et du binaire de géométrie |
| `static/models/` | 10 pièces et 683 396 triangles, prêts pour le navigateur |
| `static/pages/` | pages Explore Proteins, Protein details et Stress response |
| `static/vendor/three/` | Three.js 0.159.0 + OrbitControls (aucun CDN) |

## Les données 3D

`tardigrade-atlas.json` décrit 10 pièces : le corps, huit disques sensoriels
(Sensilla R1–R4 et L1–L4) et la bouche avec ses stylets. Chaque pièce donne ses
bornes et trois offsets absolus dans `tardigrade-chunk-0.bin` :

- positions `float32`, 3 par sommet ;
- normales `int16` normalisées, 3 par sommet ;
- indices `uint32`, 3 par triangle.

`atlas.js` se contente de découper ce binaire avec `Float32Array` / `Int16Array` /
`Uint32Array`. Pour comprendre le calcul d'éventail et le cadrage, tout est dans
`setPieces()` de `scene.js`.

## Différences avec `../tardigrade/`

- React, TypeScript, Tailwind et Vite ont été retirés ; l'interface est en HTML
  + CSS + DOM direct, sans étape de compilation.
- La pièce sélectionnée est réellement surlignée dans la scène (dans la version
  d'origine, `SELECTED_COLOR` était calculé mais jamais appliqué).
- Three.js est fourni dans le dossier : le site fonctionne hors ligne.
- Django sert les fichiers statiques directement ; c'est un montage de
  développement, pas une configuration de production.
- Les descriptions scientifiques restent en anglais, comme sur le site d'origine.

## Personnaliser

- Textes des pièces : `PIECE_DESCRIPTIONS` dans `main.js`.
- Couleurs : `PART_COLORS` et `SELECTED_COLOR` dans `scene.js`.
- Taille du modèle à l'écran : `MODEL_HEIGHT` dans `scene.js`.
- Ajouter une protéine :

```sh
./venv/bin/python manage.py shell
```

```python
from tardigradesite.models import Protein
Protein.objects.create(name='CAHS-2', description='...', uniprot_id='')
```

## Déplacer ou renommer le dossier

Aucun chemin absolu n'est utilisé : `settings.py` part de `BASE_DIR` et les
modules JS résolvent leurs fichiers avec `import.meta.url`. Le dossier peut être
copié ailleurs (autre disque, autre nom) et relancé tel quel — testé en le
copiant sous un autre nom puis en le lançant depuis ce nouvel emplacement.

Seule exception : le `venv/` s'il a été créé à l'intérieur. Son `python`
fonctionne encore, mais `pip`, `django-admin` et `activate` contiennent le chemin
absolu d'origine. Après un déplacement, le plus simple est de le recréer :

```sh
rm -rf venv
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

`venv/` et `db.sqlite3` sont ignorés par git. `db.sqlite3` suit le dossier, donc
les protéines restent en place ; s'il manque, `manage.py migrate` le recrée.

Il faut Python 3.10+ et Django (dans le venv ou globalement). Le site doit être
servi à la racine du domaine, car les URL statiques commencent par `/static/`.
En production : servir `static/` avec le serveur web, passer `DEBUG = False` et
fournir une vraie `SECRET_KEY`.

## Crédits et licences

- Modèle 3D « Water Bear » par oneillbeck ([Sketchfab](https://sketchfab.com/3d-models/water-bear-6e0ecc9d43ad4cf9a17efab2900f72ee)),
  licence **CC BY 4.0**. L'attribution est conservée dans le panneau
  « Source & scope » du site.
- Three.js, licence MIT (voir `static/vendor/three/`).
- Code de l'application : licence MIT, voir `LICENSE`.
