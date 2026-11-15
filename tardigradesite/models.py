"""Modèle de données : une protéine recherchable depuis l'onglet Proteins."""

from django.db import models


class Protein(models.Model):
    """Une protéine du tardigrade (nom, UniProt, description, masse)."""

    name = models.CharField('nom', max_length=120, unique=True)
    uniprot_id = models.CharField('identifiant UniProt', max_length=20, blank=True, default='')
    description = models.TextField('description', blank=True, default='')
    molecular_weight_kda = models.FloatField('masse moléculaire (kDa)', null=True, blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'protéine'
        verbose_name_plural = 'protéines'

    def __str__(self):
        return self.name
