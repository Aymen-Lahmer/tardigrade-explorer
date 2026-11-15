#!/usr/bin/env python
"""Utilitaire de ligne de commande Django (runserver, migrate, shell…)."""

import os
import sys


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tardigradesite.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django est introuvable. Activez le venv puis lancez "
            "« pip install -r requirements.txt »."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
