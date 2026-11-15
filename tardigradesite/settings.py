"""
Réglages Django du Tardigrade Atlas (version JavaScript).

Le projet est volontairement minimal : Django sert une page HTML, quelques
fichiers statiques et une petite API. Aucun template, aucun build front-end.
"""

from pathlib import Path

# Racine du dossier tardigrade-js/ (le dossier est déplaçable tel quel).
BASE_DIR = Path(__file__).resolve().parent.parent

# Tous les fichiers servis au navigateur vivent ici.
STATIC_DIR = BASE_DIR / 'static'

# Clé de développement uniquement : à remplacer avant toute mise en ligne.
SECRET_KEY = 'django-insecure-demo-tardigrade-js'

DEBUG = True

# Démo locale : pratique pour ouvrir le site depuis un téléphone du réseau.
# En production, lister explicitement les domaines autorisés.
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'tardigradesite',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'tardigradesite.urls'

# Pas de moteur de template : index.html est un fichier statique.
TEMPLATES = []

WSGI_APPLICATION = 'tardigradesite.wsgi.application'

# SQLite est fourni avec Python : une simple commande « migrate » crée la base.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Les URLs des fichiers statiques commencent par /static/ (voir urls.py).
STATIC_URL = '/static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
