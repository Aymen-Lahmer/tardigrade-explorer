"""Création de la table des protéines."""

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Protein',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True, verbose_name='nom')),
                ('uniprot_id', models.CharField(blank=True, default='', max_length=20, verbose_name='identifiant UniProt')),
                ('description', models.TextField(blank=True, default='', verbose_name='description')),
                ('molecular_weight_kda', models.FloatField(blank=True, null=True, verbose_name='masse moléculaire (kDa)')),
            ],
            options={
                'verbose_name': 'protéine',
                'verbose_name_plural': 'protéines',
                'ordering': ['name'],
            },
        ),
    ]
