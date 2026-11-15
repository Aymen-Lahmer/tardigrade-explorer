"""
Routes du site.

Quatre entrées :
  /                 -> la page unique (static/index.html)
  /api/proteins/    -> l'API JSON des protéines
  /static/...       -> CSS, JS, modèles 3D, Three.js
  /<page>/          -> proteins, protein, stress (static/pages/)

Les fichiers statiques sont servis par Django lui-même pour que le dossier
fonctionne avec un simple « manage.py runserver », sans collectstatic.
"""

from django.urls import path, re_path
from django.views.static import serve

from . import views
from .settings import STATIC_DIR

urlpatterns = [
    path('', views.index, name='index'),
    path('api/proteins/', views.proteins, name='proteins'),
    re_path(r'^static/(?P<path>.+)$', serve, {'document_root': str(STATIC_DIR)}),
    path('<str:name>/', views.page, name='page'),
]
