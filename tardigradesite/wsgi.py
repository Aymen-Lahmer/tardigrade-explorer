"""Point d'entrée WSGI (utilisé par les serveurs de production)."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tardigradesite.settings')

application = get_wsgi_application()
