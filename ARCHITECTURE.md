# Architecture — comment les fichiers sont reliés

Ce document explique les deux ponts du projet :

1. **HTML ↔ Python** : Django sert la page et répond à l'API.
2. **HTML ↔ JavaScript** : le navigateur exécute les modules et pilote l'interface.

À retenir d'emblée : **il n'y a aucun lien direct entre `index.html` et les fichiers
Python**. Pas de balise `{% ... %}`, pas de `{{ ... }}`, pas de moteur de template
(`settings.py` déclare `TEMPLATES = []`). `index.html` est un fichier statique
ordinaire, et tout le reste passe par des **URLs HTTP**.

---

## Vue d'ensemble

```
navigateur                                   Django
──────────                                   ──────
GET /                            ──>  urls.py ──> views.index   ──> static/index.html
GET /static/js/main.js           ──>  urls.py ──> serve         ──> fichier statique
GET /static/models/*.json|*.bin  ──>  urls.py ──> serve         ──> fichier statique
GET /api/proteins/?q=Dsup        ──>  urls.py ──> views.proteins ──> modèles.py ──> SQLite
```

Quatre routes seulement, définies dans `tardigradesite/urls.py` :

| URL demandée | Vue Python | Réponse |
| --- | --- | --- |
| `/` | `views.index` | le contenu de `static/index.html` |
| `/api/proteins/` | `views.proteins` | JSON construit depuis SQLite |
| `/static/...` | `django.views.static.serve` | CSS, JS, Three.js, modèles 3D |
| `/<page>/` | `views.page` | `static/pages/<page>.html` servi tel quel |

Le dossier `static/` est servi par Django lui-même (`document_root=STATIC_DIR`),
ce qui permet de tout lancer avec un simple `manage.py runserver`, sans
`collectstatic`. C'est un montage de **développement**.

### Pages secondaires : un fichier par page

Chaque page secondaire est autonome — son HTML, son JS et, si elle a une
interface particulière, son CSS. Le seul point commun est `pages.css`.

| Page | HTML | JS | CSS |
| --- | --- | --- | --- |
| `/explore_proteins/` | `static/pages/explore_proteins.html` | `static/js/explore_proteins.js` | `pages.css` (cartes, recherche) |
| `/protein_details/` | `static/pages/protein_details.html` | `static/js/protein_details.js` | `pages.css` + `protein_details.css` (viewer Mol*) |
| `/stress/` | `static/pages/stress.html` | — | `pages.css` |

La règle à garder en tête : **`explore_proteins` lit la base Django**
(`/api/proteins/`, donc du texte), **`protein_details` lit les `.cif`** de
`static/data/` (donc de la 3D). Aucun des deux ne partage de code avec l'autre.

---

## 1. Côté serveur : la chaîne Django

```
manage.py            → DJANGO_SETTINGS_MODULE = tardigradesite.settings
settings.py          → BASE_DIR, STATIC_DIR, ROOT_URLCONF = tardigradesite.urls, DATABASES
urls.py              → les 4 routes ci-dessus
views.py             → index(), page() et proteins()
models.py            → Protein (name, uniprot_id, description, molecular_weight_kda)
migrations/0002_…    → insère les 6 protéines de départ
```

Deux chemins méritent d'être notés dans `settings.py` :

```python
BASE_DIR   = Path(__file__).resolve().parent.parent   # racine du dossier projet
STATIC_DIR = BASE_DIR / 'static'                      # tout ce que voit le navigateur
```

Aucun chemin absolu n'est codé en dur : le dossier reste déplaçable.

---

## 2. Le pont HTML ↔ Python

### 2.1 Servir la page

`views.index` ne fait aucun rendu : elle lit le fichier et le renvoie tel quel.

```python
@require_GET
def index(request):
    html = (STATIC_DIR / 'index.html').read_text(encoding='utf-8')
    return HttpResponse(html, content_type='text/html; charset=utf-8')
```

Conséquence pratique : **modifier `index.html` et recharger la page suffit**,
aucun redémarrage de `runserver` n'est nécessaire (le fichier est relu à chaque
requête).

### 2.2 Les ressources référencées par le HTML

Toutes les références de `index.html` sont **absolues** et pointent donc vers la
route `serve` de `urls.py` :

```html
<link rel="icon" href="/static/favicon.svg" />
<link rel="stylesheet" href="/static/css/styles.css" />
<script type="module" src="/static/js/main.js"></script>
```

L'`importmap` fait de même pour Three.js :

```html
<script type="importmap">
{
  "imports": {
    "three": "/static/vendor/three/three.module.js",
    "three/addons/": "/static/vendor/three/addons/"
  }
}
</script>
```

> Le site doit être servi à la **racine du domaine**, puisque ces URLs commencent
> par `/static/`.

### 2.3 Le seul vrai appel « HTML → Python » : l'API

C'est `static/js/main.js` qui dialogue avec Django, via `fetch` dans
`searchProteins()` :

```
panneau de recherche (#protein-search)
    → fetch(`/api/proteins/?q=${encodeURIComponent(term)}`)
    → views.proteins
        → Protein.objects.filter(Q(name__icontains=q)
                                 | Q(uniprot_id__icontains=q)
                                 | Q(description__icontains=q))[:50]
    → JsonResponse
    → renderProteins() reconstruit le DOM de #protein-results
```

La vue est volontairement simple :

```python
MAX_RESULTS = 50

@require_GET
def proteins(request):
    query = (request.GET.get('q') or '').strip()
    proteins = Protein.objects.all()
    if query:
        proteins = proteins.filter(
            Q(name__icontains=query)
            | Q(uniprot_id__icontains=query)
            | Q(description__icontains=query)
        )
    results = [ {...} for protein in proteins[:MAX_RESULTS] ]
    return JsonResponse({'query': query, 'count': len(results), 'results': results})
```

Réponse type (`GET /api/proteins/?q=Dsup`) :

```json
{
  "query": "Dsup",
  "count": 1,
  "results": [
    {
      "id": 1,
      "name": "Dsup (damage suppressor)",
      "uniprot_id": "",
      "description": "Protéine suppresseur de dommages identifiée chez le tardigrade…",
      "molecular_weight_kda": null
    }
  ]
}
```

La forme de la réponse est **constante** (même sans terme de recherche), ce qui
évite au JavaScript de gérer deux cas. Les données viennent du modèle `Protein`
(`models.py`), alimenté par la migration `0002_seed_proteins.py` — **pas** par le
HTML.

### 2.4 Les données 3D

`atlas.js` utilise aussi `fetch`, mais uniquement sur des fichiers statiques :

- `/static/models/tardigrade-atlas.json` — catalogue des 10 pièces ;
- `/static/models/tardigrade-chunk-0.bin` — positions, normales et indices.

Aucun Python n'intervient dans la géométrie : ce sont deux fichiers servis
bruts, que le navigateur découpe en `Float32Array` / `Int16Array` / `Uint32Array`.

### 2.5 Ajouter une fonctionnalité serveur

Le schéma est toujours le même :

1. ajouter une route dans `tardigradesite/urls.py` ;
2. écrire la vue dans `tardigradesite/views.py` ;
3. appeler cette URL depuis `main.js` et rendre la réponse dans le DOM.

---

## 3. Le pont HTML ↔ JavaScript

`index.html` ne contient **aucun code JavaScript inline** (hors bloc JSON de
l'`importmap`). Tout part d'une unique balise, en bas du `<body>` :

```html
<script type="module" src="/static/js/main.js"></script>
```

Trois mécanismes font le lien : l'**import map**, les **modules ES** et le
**contrat DOM**.

### 3.1 L'import map

Le navigateur ne sait pas résoudre `import * as THREE from 'three'`. L'`importmap`
du `<head>` lui fournit la correspondance — c'est ce qui remplace un bundler.
Elle doit être déclarée **avant** le script module.

### 3.2 La chaîne des modules ES

```
index.html
   └── <script type="module" src="/static/js/main.js">
          ├── import { loadAtlas, loadGeometries } from './atlas.js'
          │      └── import * as THREE from 'three'
          └── import { createTardigradeScene } from './scene.js'
                 ├── import * as THREE from 'three'
                 └── import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

Aucune variable globale : chaque fichier n'expose que ce qu'il `export`. Les
chemins relatifs (`./scene.js`) sont résolus par le navigateur par rapport à
l'URL du module.

`atlas.js` résout ses données avec `import.meta.url`, ce qui rend le dossier
déplaçable :

```js
const ATLAS_URL = new URL('../models/tardigrade-atlas.json', import.meta.url);
```

### 3.3 Le contrat DOM

`main.js` ne génère pas la page : il la **trouve déjà écrite** et s'y accroche
par identifiant.

```js
const $ = (id) => document.getElementById(id);

$('protein-search').addEventListener('input', (event) => scheduleProteinSearch(event.target.value));
$('zoom').addEventListener('input', (event) => updateZoom(Number(event.target.value)));
scene = createTardigradeScene($('scene'));
```

Les points de raccordement, tous déclarés dans le HTML :

| Élément HTML | Utilisé par `main.js` pour |
| --- | --- |
| `<div id="scene">` | recevoir le `<canvas>` WebGL créé par `scene.js` |
| `#search-toggle`, `#search-close`, `#search-panel` | ouvrir / fermer le panneau |
| `.side-rail a` (menu) | rien : ce sont de simples liens `target="_blank"` vers les pages Django |
| `#protein-search` | capter la saisie et déclencher la requête vers l'API |
| `#protein-results` | liste **remplie par JS** (`replaceChildren()`) |
| `#zoom`, `#zoom-value` | curseur 0–100 % : tardigrade entier, puis couche protéines |
| `[data-view]` (¾, F, S, B) | les 4 caméras, lues via `button.dataset.view` |
| `#details`, `#detail-title`, `#detail-description`, `#detail-meta` | fiche pièce / protéine |
| `#loading`, `#error`, `#error-message` | états de démarrage et d'échec |
| attribut `hidden`, classes `.active` / `.hint` | le CSS seul décide de l'apparence |

Deux conventions portent tout le reste :

- **`hidden`** — le HTML cache les panneaux (`<section … hidden>`) et le JS ne
  fait que basculer `element.hidden = true/false`. Aucun `display: none` écrit
  en JavaScript.
- **`data-view`** — `<button data-view="front">` devient `scene.setView('front')`.
  Ajouter une vue = ajouter un bouton + une entrée dans `VIEW_DIRECTIONS`
  (`scene.js`) ; rien à changer dans `main.js`.

### 3.4 Le sens inverse : la scène ne touche pas au HTML

`scene.js` est volontairement isolé : il ne connaît aucun `id` de l'interface,
**sauf** son hôte (`#scene`, passé en argument), dans lequel il injecte son
canvas :

```js
host.appendChild(renderer.domElement);
```

La communication se fait dans les deux sens par une petite API :

```
main.js  ──>  scene.setPieces / setZoom / setView / setRotate / select / reset
main.js  <──  scene.onSelect = showPiece      (déclenché par un clic / raycast)
```

`setZoom` fait glisser le curseur de 0 à 1 : le tardigrade reste entier et grossit
jusqu'à 50 %, puis ses maillages sont masqués et la couche `proteinLayer` (un
marqueur par emplacement de protéine, en attendant les vraies protéines) devient
visible.

C'est ce callback qui relie un clic 3D au panneau HTML :

```
pointerup sur le canvas
   → raycaster → api.onSelect(hit.part.id)
   → main.js : showPiece(id)
        → scene.select(concept.elements[0])      // surlignage turquoise
        → openDetails(...)                       // #details devient visible
```

### 3.5 Le démarrage, dans l'ordre

```
HTML parsé → importmap enregistrée → main.js exécuté (les modules sont différés)
   → createTardigradeScene($('scene'))       // canvas + fond visibles immédiatement
   → boot()
        → loadAtlas()                        // fetch du JSON
        → loadGeometries()                   // fetch du .bin → BufferGeometry
        → scene.setPieces(atlas, geometries) // cadrage, orientation, pose au sol
        → $('loading').hidden = true
```

Tant que les `fetch` n'ont pas répondu, `#loading` reste affiché. En cas
d'échec, `showError()` masque `#loading` et affiche `#error`.

---

## 4. Cycle complet d'une interaction

Exemple : rechercher « Dsup » depuis le panneau de recherche.

```
1. clic sur #search-toggle (ou touche `/`)
      → main.js openSearch() : #search-panel visible, #protein-search focalisé
      → scheduleProteinSearch('') charge la liste complète
2. frappe « Dsup » dans #protein-search
      → scheduleProteinSearch() : debounce 250 ms, annule la requête précédente
3. fetch /api/proteins/?q=Dsup
      → Django urls.py → views.proteins → Protein.objects.filter(...)
      → JsonResponse
4. renderProteins(data.results)
      → vide #protein-results, crée un <button> par protéine
5. clic sur un résultat
      → showProtein(protein) → openDetails({...}) remplit #details
      → #detail-link pointe vers uniprot.org (ou reste masqué sans UniProt)
```

Aucune page n'est rechargée, aucun HTML n'est généré côté serveur : Django ne
fournit que le fichier initial et du JSON.

---

## 5. Où intervenir

| Objectif | Fichier |
| --- | --- |
| Structure de l'interface | `static/index.html` |
| Apparence, responsive | `static/css/styles.css` |
| Textes des pièces, câblage de l'UI | `static/js/main.js` (`PIECE_DESCRIPTIONS`) |
| Couleurs, cadrage, caméras | `static/js/scene.js` (`PART_COLORS`, `SELECTED_COLOR`, `MODEL_HEIGHT`, `VIEW_DIRECTIONS`) |
| Format des données 3D | `static/js/atlas.js` |
| Routes HTTP | `tardigradesite/urls.py` |
| API et page servie | `tardigradesite/views.py` |
| Schéma de la base | `tardigradesite/models.py` + une migration |
| Ajouter des protéines | `manage.py shell` (voir `README.md`) |

---

## 6. Limites de ce montage

- `DEBUG = True`, `SECRET_KEY` de démonstration, `ALLOWED_HOSTS = ['*']` :
  **développement uniquement**.
- Django sert les fichiers statiques : en production, laisser le serveur web
  (nginx, Apache…) s'en charger et passer `DEBUG = False`.
- Pas de protection CSRF ni de session : le site est en lecture seule.
- Les URLs sont absolues (`/static/...`) : le site doit être à la racine du
  domaine, pas dans un sous-dossier.
