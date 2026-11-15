"""Remplit la base avec six protéines de résistance du tardigrade.

Les identifiants UniProt sont laissés vides volontairement : à compléter
après vérification de l'accession sur uniprot.org.
"""

from django.db import migrations

PROTEINS = [
    {
        'name': 'Dsup (damage suppressor)',
        'description': (
            'Protéine suppresseur de dommages identifiée chez le tardigrade '
            'Ramazzottius varieornatus. Protéine désordonnée associée aux '
            'nucléosomes, elle protège l’ADN des radiations ionisantes et des '
            'radicaux hydroxyles ; exprimée dans des cellules humaines, elle '
            'augmente nettement leur tolérance au stress.'
        ),
    },
    {
        'name': 'CAHS-1 (cytoplasmic abundant heat-soluble)',
        'description': (
            'Protéine cytoplasmique abondante et soluble à la chaleur, de la '
            'famille CAHS. Lors de la dessiccation, elle gélifie et vitrifie le '
            'cytoplasme, formant une matrice protectrice qui maintient les '
            'structures cellulaires intactes pendant l’anhydrobiose.'
        ),
    },
    {
        'name': 'SAHS-1 (secretory abundant heat-soluble)',
        'description': (
            'Protéine sécrétée abondante et soluble à la chaleur, de la famille '
            'SAHS. Le manque d’eau déclenche sa libération dans l’espace '
            'extracellulaire, où elle forme un gel qui soutient les tissus '
            'depuis l’extérieur des cellules pendant la cryptobiose.'
        ),
    },
    {
        'name': 'LEA (late embryogenesis abundant-like)',
        'description': (
            'Famille de protéines intrinsèquement désordonnées apparentées aux '
            'protéines LEA. Associées à la tolérance à la dessiccation et au gel, '
            'elles stabilisent les membranes et les autres protéines lorsque '
            'l’eau quitte les cellules, contre l’agrégation et la fusion.'
        ),
    },
    {
        'name': 'Trehalose-phosphate synthase',
        'description': (
            'Enzyme de la biosynthèse du tréhalose, disaccharide non réducteur '
            'accumulé par de nombreux tardigrades. Le tréhalose remplace l’eau '
            'et vitrifie le milieu intracellulaire pendant la cryptobiose, '
            'protégeant protéines et membranes.'
        ),
    },
    {
        'name': 'Hsp70 (heat shock protein 70)',
        'description': (
            'Chaperon moléculaire de la famille HSP70. Il se lie aux régions '
            'hydrophobes exposées des protéines endommagées et favorise leur '
            'repliement après un stress thermique, osmotique ou oxydatif ; il '
            'est surexprimé pendant la récupération du tardigrade.'
        ),
    },
]


def seed(apps, schema_editor):
    Protein = apps.get_model('tardigradesite', 'Protein')
    Protein.objects.bulk_create(Protein(**record) for record in PROTEINS)


def unseed(apps, schema_editor):
    Protein = apps.get_model('tardigradesite', 'Protein')
    Protein.objects.filter(name__in=[record['name'] for record in PROTEINS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tardigradesite', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
