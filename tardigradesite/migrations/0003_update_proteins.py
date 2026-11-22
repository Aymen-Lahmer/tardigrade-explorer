from django.db import migrations

PROTEINES = [
    # --- 1. Mise à jour des 6 protéines déjà présentes dans le site ---
    {
        "name": "Dsup (damage suppressor)",
        "uniprot_id": "P0DOW4",
        "molecular_weight_kda": 46.1,
        "description": "Protéine unique aux tardigrades (Ramazzottius varieornatus) qui se lie à l'ADN et le protège contre les radiations ionisantes, les radicaux libres et le stress oxydatif."
    },
    {
        "name": "CAHS-1 (cytoplasmic abundant heat-soluble)",
        "uniprot_id": "J7M799",
        "molecular_weight_kda": 26.8,
        "description": "Protéine intrinsèquement désordonnée du cytoplasme qui s'assemble en gel protecteur lors de la déshydratation (anhydrobiose)."
    },
    {
        "name": "SAHS-1 (secretory abundant heat-soluble)",
        "uniprot_id": "J7M7K1",
        "molecular_weight_kda": 21.7,
        "description": "Protéine sécrétée thermostable qui stabilise les membranes et structures extracellulaires pendant la dessiccation."
    },
    {
        "name": "Hsp70 (heat shock protein 70)",
        "uniprot_id": "A0A1D1V1Q2",
        "molecular_weight_kda": 70.4,
        "description": "Protéine chaperonne qui empêche l'agrégation des protéines cellulaires et aide à leur repliement lors d'un stress thermique ou hydrique."
    },
    {
        "name": "LEA (late embryogenesis abundant-like)",
        "uniprot_id": "A0A1D1V489",
        "molecular_weight_kda": 29.4,
        "description": "Protéine hydrophile fortement exprimée en anhydrobiose pour protéger les macromolécules contre la perte d'eau."
    },
    {
        "name": "Trehalose-phosphate synthase",
        "uniprot_id": "A0A1D1UZW3",
        "molecular_weight_kda": 57.99,
        "description": "Enzyme catalysant la synthèse du tréhalose, un sucre qui vitrifie le milieu cellulaire en état de cryptobiose."
    },

    # --- 2. Ajout des nouvelles protéines de la présentation ---
    {
        "name": "CAHS-8",
        "uniprot_id": "A0A1D1V4E1",
        "molecular_weight_kda": 25.0,
        "description": "S'auto-assemble en réseau de longs filaments dans le cytosol pour figer mécaniquement la cellule et éviter son effondrement lors d'une déshydratation extrême."
    },
    {
        "name": "CAHS-3",
        "uniprot_id": "J7M4A7",
        "molecular_weight_kda": 26.1,
        "description": "Protéine cytosolique thermostable formant des fibrilles réversibles pour protéger les organites durant l'anhydrobiose."
    },
    {
        "name": "SAHS-2",
        "uniprot_id": "J7M6A4",
        "molecular_weight_kda": 22.3,
        "description": "Protéine sécrétée associée à la tolérance à la dessiccation et à la protection des tissus périphériques."
    },
    {
        "name": "MAHS (mitochondrial abundant heat-soluble)",
        "uniprot_id": "A0A1D1UZR5",
        "molecular_weight_kda": 24.6,
        "description": "Protéine localisée dans les mitochondries qui préserve l'intégrité des membranes mitochondriales et la production d'énergie sous stress osmotique."
    },
    {
        "name": "TDR1 (Tardigrade DNA damage response 1)",
        "uniprot_id": "A0A1D1V9L8",
        "molecular_weight_kda": 38.2,
        "description": "Protéine spécifique aux tardigrades fortement induite après irradiation, favorisant la réparation rapide de l'ADN."
    },
    {
        "name": "Catalase",
        "uniprot_id": "A0A1D1V3K9",
        "molecular_weight_kda": 56.8,
        "description": "Enzyme antioxydante essentielle qui dégrade le peroxyde d'hydrogène (H2O2) accumulé pendant le stress hydrique et oxydatif."
    },
    {
        "name": "MnSOD (Manganese superoxide dismutase)",
        "uniprot_id": "A0A1D1V7M1",
        "molecular_weight_kda": 24.9,
        "description": "Enzyme mitochondriale neutralisant les radicaux superoxydes produits lors des cycles de déshydratation et réhydratation."
    },
    {
        "name": "Hsp90 (Heat shock protein 90)",
        "uniprot_id": "A0A1D1V2P6",
        "molecular_weight_kda": 82.5,
        "description": "Chaperonne moléculaire stabilisant les protéines de signalisation durant les températures extrêmes."
    },
]

def remplir_base(apps, schema_editor):
    Protein = apps.get_model('tardigradesite', 'Protein')
    for p in PROTEINES:
        Protein.objects.update_or_create(
            name=p["name"],
            defaults={
                "uniprot_id": p["uniprot_id"],
                "molecular_weight_kda": p["molecular_weight_kda"],
                "description": p["description"],
            }
        )

class Migration(migrations.Migration):
    dependencies = [
        ('tardigradesite', '0002_seed_proteins'),
    ]
    operations = [
        migrations.RunPython(remplir_base),
    ]