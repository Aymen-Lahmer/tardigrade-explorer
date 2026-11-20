# Tardigrade Atlas — version JavaScript autonome

Django sert les pages et l'API, le navigateur affiche le tardigrade en 3D avec Three.js.
JavaScript natifs pour la scène 3D, plus un script dédié par page secondaire, tous
lisibles de haut en bas.


## Lancer

```sh
cd tardigrade-explorer
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python manage.py migrate     
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
GET /explore_proteins/       ──>   views.page         ──> static/pages/explore_proteins.html
GET /protein_details/        ──>   views.page         ──> static/pages/protein_details.html
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
| `static/pages/explore_proteins.html` | liste et recherche des protéines Django |
| `static/pages/protein_details.html` | viewer Mol* des structures `.cif` |
| `static/pages/stress.html` | page Stress response |
| `static/css/pages.css` | base commune des pages secondaires : en-tête, recherche, cartes |
| `static/css/protein_details.css` | styles du viewer Mol* et de sa recherche |
| `static/js/explore_proteins.js` | interroge `/api/proteins/` et rend les cartes |
| `static/js/protein_details.js` | liste les `.cif` de `static/data/` et pilote Mol* |
| `static/vendor/three/` | Three.js 0.159.0 + OrbitControls (aucun CDN) |

### Les deux pages protéines ne mélangent rien

- **Explore Proteins** (`/explore_proteins/`) lit la **base Django** via
  `/api/proteins/` : du texte (nom, UniProt, masse, description).
- **Protein details** (`/protein_details/`) lit les **fichiers `.cif`** de
  `static/data/` : de la 3D, chargée par Mol* depuis un CDN.

Chacune a son HTML, son JS et, pour le viewer, son CSS. Le seul fichier partagé
est `pages.css`. Aucune des deux ne dépend du code de l'autre.



## Personnaliser

- Textes des pièces : `PIECE_DESCRIPTIONS` dans `main.js`.
- Couleurs : `PART_COLORS` et `SELECTED_COLOR` dans `scene.js`.
- Taille du modèle à l'écran : `MODEL_HEIGHT` dans `scene.js`.
- Description d'une protéine : voir « Modifier la base de données » plus bas.
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

## Modifier la base de données

Les six protéines de départ sont créées par
`tardigradesite/migrations/0002_seed_proteins.py`. Attention : cette migration
ne s'exécute **qu'une seule fois**. Éditer le texte dans `0002` puis relancer
`migrate` ne change rien — elle est déjà marquée appliquée (`showmigrations`)
et `seed()` utilise `bulk_create`.

Trois façons de mettre à jour une description :

**1. Nouvelle migration (recommandé)** — `tardigradesite/migrations/0003_....py` :

```python
from django.db import migrations

DESCRIPTIONS = {'Dsup (damage suppressor)': 'Nouvelle description…'}


def update(apps, schema_editor):
    Protein = apps.get_model('tardigradesite', 'Protein')
    for name, description in DESCRIPTIONS.items():
        Protein.objects.filter(name=name).update(description=description)


class Migration(migrations.Migration):
    dependencies = [('tardigradesite', '0002_seed_proteins')]
    operations = [migrations.RunPython(update, migrations.RunPython.noop)]
```

```sh
./venv/bin/python manage.py migrate
```

**2. Directement en base (dev, plus rapide)**

```sh
./venv/bin/python manage.py shell -c "from tardigradesite.models import Protein; Protein.objects.filter(name='Dsup (damage suppressor)').update(description='…')"
```

**3. Repartir de zéro (efface la table)**

```sh
./venv/bin/python manage.py migrate tardigradesite zero   # unseed() supprime les 6 protéines
./venv/bin/python manage.py migrate                       # seed() les recrée avec le nouveau texte
```

Côté site, aucun code à toucher : le JS lit `/api/proteins/` à l'affichage, donc
un simple rafraîchissement de la page montre la nouvelle description.